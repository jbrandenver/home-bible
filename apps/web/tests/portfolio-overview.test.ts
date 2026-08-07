import { describe, expect, it } from 'vitest';
import { buildPortfolioOverview, type PortfolioAssetRow, type PortfolioComplianceRow, type PortfolioData, type PortfolioReminderRow, type PortfolioRepairRow } from '../lib/portfolio';
import { sortPortfolio, type PropertySummary } from '../lib/properties';
import {
  evaluatePortfolioAccess,
  FREE_PROPERTY_ALLOWANCE,
  MAX_HOMES_WITHOUT_PORTFOLIO,
  MAX_PER_HOME_ADDITIONS
} from '../lib/entitlements';

// All pure functions: no supabase client, no network, no browser. Dates are
// pinned via todayIso so horizon math is deterministic.

const TODAY = '2026-01-01';

function property(overrides: Partial<PropertySummary> & { id: string }): PropertySummary {
  return {
    household_id: 'hh-1',
    owner_user_id: 'user-1',
    nickname: overrides.id,
    property_type: 'house',
    created_at: '2026-01-01T00:00:00Z',
    parent_property_id: null,
    unit_label: null,
    ...overrides
  };
}

function asset(overrides: Partial<PortfolioAssetRow> & { id: string; property_id: string }): PortfolioAssetRow {
  return {
    name: overrides.id,
    brand: null,
    model: null,
    asset_type: 'appliance',
    purchase_date: null,
    warranty_expires_at: null,
    ...overrides
  };
}

function repair(overrides: Partial<PortfolioRepairRow> & { id: string; property_id: string }): PortfolioRepairRow {
  return {
    title: overrides.id,
    status: 'open',
    priority: null,
    scheduled_date: null,
    ...overrides
  };
}

function reminder(overrides: Partial<PortfolioReminderRow> & { id: string; property_id: string }): PortfolioReminderRow {
  return {
    title: overrides.id,
    status: 'open',
    due_date: null,
    ...overrides
  };
}

function compliance(
  overrides: Partial<PortfolioComplianceRow> & { id: string; property_id: string }
): PortfolioComplianceRow {
  return {
    title: overrides.id,
    authority: null,
    obligation_type: 'inspection',
    next_due: null,
    last_completed_on: null,
    frequency_months: null,
    ...overrides
  };
}

function emptyData(overrides: Partial<PortfolioData> = {}): PortfolioData {
  return { assets: [], repairs: [], reminders: [], compliance: [], ...overrides };
}

describe('buildPortfolioOverview', () => {
  it('counts totals and splits them per property', () => {
    const properties = [property({ id: 'p1' }), property({ id: 'p2' })];
    const data = emptyData({
      repairs: [
        repair({ id: 'r1', property_id: 'p1', status: 'open' }),
        repair({ id: 'r2', property_id: 'p1', status: 'in_progress' }),
        repair({ id: 'r3', property_id: 'p2', status: 'scheduled' }),
        // Closed work never counts as open.
        repair({ id: 'r4', property_id: 'p2', status: 'completed' })
      ],
      reminders: [
        reminder({ id: 'm1', property_id: 'p1', due_date: '2026-01-10' }),
        reminder({ id: 'm2', property_id: 'p2', due_date: '2026-01-05' }),
        // Beyond the 30-day horizon, closed, or dateless — all excluded.
        reminder({ id: 'm3', property_id: 'p2', due_date: '2026-06-01' }),
        reminder({ id: 'm4', property_id: 'p2', status: 'done', due_date: '2026-01-05' }),
        reminder({ id: 'm5', property_id: 'p2', due_date: null })
      ],
      assets: [asset({ id: 'a1', property_id: 'p1', warranty_expires_at: '2026-02-01' })],
      compliance: [
        compliance({ id: 'c1', property_id: 'p2', next_due: '2026-01-15' }),
        compliance({ id: 'c2', property_id: 'p2', next_due: '2025-12-01' })
      ]
    });

    const overview = buildPortfolioOverview(properties, data, TODAY);

    expect(overview.totals).toEqual({
      doors: 2,
      openRepairs: 3,
      remindersDue: 2,
      warrantiesExpiringSoon: 1,
      complianceDueSoon: 1,
      complianceOverdue: 1
    });

    const p1 = overview.rows.find((row) => row.property.id === 'p1');
    const p2 = overview.rows.find((row) => row.property.id === 'p2');
    expect(p1).toMatchObject({
      openRepairs: 2,
      remindersDue: 1,
      warrantiesExpiringSoon: 1,
      complianceDueSoon: 0,
      complianceOverdue: 0
    });
    expect(p2).toMatchObject({
      openRepairs: 1,
      remindersDue: 1,
      warrantiesExpiringSoon: 0,
      complianceDueSoon: 1,
      complianceOverdue: 1
    });
  });

  it('includes warranties at exactly 0 and 90 days and excludes 91 days and the past', () => {
    const properties = [property({ id: 'p1' })];
    const data = emptyData({
      assets: [
        asset({ id: 'today', property_id: 'p1', warranty_expires_at: '2026-01-01' }),
        asset({ id: 'edge-90', property_id: 'p1', warranty_expires_at: '2026-04-01' }),
        asset({ id: 'past-91', property_id: 'p1', warranty_expires_at: '2026-04-02' }),
        asset({ id: 'expired', property_id: 'p1', warranty_expires_at: '2025-12-31' }),
        asset({ id: 'no-date', property_id: 'p1', warranty_expires_at: null })
      ]
    });

    const overview = buildPortfolioOverview(properties, data, TODAY);

    expect(overview.warrantiesExpiring.map((item) => item.id)).toEqual(['today', 'edge-90']);
    expect(overview.warrantiesExpiring[0].daysLeft).toBe(0);
    expect(overview.warrantiesExpiring[1].daysLeft).toBe(90);
    expect(overview.totals.warrantiesExpiringSoon).toBe(2);
  });

  it('flags overdue compliance with negative days and sorts it first', () => {
    const properties = [property({ id: 'p1' })];
    const data = emptyData({
      compliance: [
        compliance({ id: 'soon', property_id: 'p1', next_due: '2026-03-02' }), // +60, edge of horizon
        compliance({ id: 'late', property_id: 'p1', next_due: '2025-12-22' }), // -10
        compliance({ id: 'far', property_id: 'p1', next_due: '2026-03-03' }), // +61, out
        compliance({ id: 'undated', property_id: 'p1', next_due: null })
      ]
    });

    const overview = buildPortfolioOverview(properties, data, TODAY);

    expect(overview.complianceAttention.map((item) => item.id)).toEqual(['late', 'soon']);
    const late = overview.complianceAttention[0];
    expect(late.overdue).toBe(true);
    expect(late.daysLeft).toBe(-10);
    const soon = overview.complianceAttention[1];
    expect(soon.overdue).toBe(false);
    expect(soon.daysLeft).toBe(60);
    expect(overview.totals.complianceOverdue).toBe(1);
    expect(overview.totals.complianceDueSoon).toBe(1);
  });

  it('counts units under their building and leaves unit rows at zero', () => {
    const properties = [
      property({ id: 'b1', property_type: 'apartment_building' }),
      property({ id: 'u1', parent_property_id: 'b1', unit_label: 'Unit 1', property_type: 'apartment' }),
      property({ id: 'u2', parent_property_id: 'b1', unit_label: 'Unit 2', property_type: 'apartment' }),
      property({ id: 'solo' })
    ];

    const overview = buildPortfolioOverview(properties, emptyData(), TODAY);

    const byId = new Map(overview.rows.map((row) => [row.property.id, row]));
    expect(byId.get('b1')?.unitCount).toBe(2);
    expect(byId.get('u1')?.unitCount).toBe(0);
    expect(byId.get('u2')?.unitCount).toBe(0);
    expect(byId.get('solo')?.unitCount).toBe(0);
    // Every door counts, buildings and units alike.
    expect(overview.totals.doors).toBe(4);
  });

  it('surfaces aging assets by whole years, oldest first', () => {
    const properties = [property({ id: 'p1' })];
    const data = emptyData({
      assets: [
        asset({ id: 'old-boiler', property_id: 'p1', purchase_date: '2010-01-01' }),
        asset({ id: 'older-furnace', property_id: 'p1', purchase_date: '2004-06-15' }),
        asset({ id: 'newish', property_id: 'p1', purchase_date: '2020-01-01' })
      ]
    });

    const overview = buildPortfolioOverview(properties, data, TODAY);

    expect(overview.agingAssets.map((item) => item.id)).toEqual(['older-furnace', 'old-boiler']);
    expect(overview.agingAssets[0].ageYears).toBeGreaterThanOrEqual(21);
    expect(overview.agingAssets[1].ageYears).toBe(16);
  });
});

describe('sortPortfolio', () => {
  it('orders buildings by creation with their units directly beneath them', () => {
    const buildingA = property({ id: 'a', created_at: '2026-01-01T00:00:00Z' });
    const buildingB = property({ id: 'b', created_at: '2026-01-02T00:00:00Z' });
    const unitA = property({
      id: 'a-unit',
      parent_property_id: 'a',
      unit_label: 'Unit 1',
      created_at: '2026-01-03T00:00:00Z'
    });
    const unitB = property({
      id: 'b-unit',
      parent_property_id: 'b',
      unit_label: 'Unit 1',
      created_at: '2026-01-03T00:00:00Z'
    });

    const sorted = sortPortfolio([unitB, buildingB, unitA, buildingA]);
    expect(sorted.map((item) => item.id)).toEqual(['a', 'a-unit', 'b', 'b-unit']);
  });

  it('orders unit labels numerically so Unit 2 precedes Unit 10', () => {
    const building = property({ id: 'bld', created_at: '2026-01-01T00:00:00Z' });
    const unit10 = property({
      id: 'u10',
      parent_property_id: 'bld',
      unit_label: 'Unit 10',
      created_at: '2026-01-02T00:00:00Z'
    });
    const unit2 = property({
      id: 'u2',
      parent_property_id: 'bld',
      unit_label: 'Unit 2',
      // Created after Unit 10 — the label ordering must win anyway.
      created_at: '2026-01-03T00:00:00Z'
    });

    const sorted = sortPortfolio([unit10, unit2, building]);
    expect(sorted.map((item) => item.id)).toEqual(['bld', 'u2', 'u10']);
  });

  it('places units whose building is not visible after everything else', () => {
    const home = property({ id: 'home', created_at: '2026-01-05T00:00:00Z' });
    const orphan = property({
      id: 'orphan',
      parent_property_id: 'invisible-building',
      unit_label: 'Unit 4',
      created_at: '2026-01-01T00:00:00Z'
    });

    const sorted = sortPortfolio([orphan, home]);
    expect(sorted.map((item) => item.id)).toEqual(['home', 'orphan']);
  });
});

describe('evaluatePortfolioAccess', () => {
  it('never requires an upgrade while payments are unconfigured', () => {
    for (const hasPlan of [true, false]) {
      for (const propertyCount of [0, 1, 2, 12]) {
        const access = evaluatePortfolioAccess({ hasPlan, paymentsConfigured: false, propertyCount });
        expect(access.requiresUpgradeToAdd).toBe(false);
      }
    }
  });

  it('never requires an upgrade for plan holders', () => {
    for (const propertyCount of [0, 2, 12]) {
      const access = evaluatePortfolioAccess({ hasPlan: true, paymentsConfigured: true, propertyCount });
      expect(access.requiresUpgradeToAdd).toBe(false);
    }
  });

  it('requires an upgrade only past the free allowance, once payments exist', () => {
    const withinAllowance = evaluatePortfolioAccess({
      hasPlan: false,
      paymentsConfigured: true,
      propertyCount: FREE_PROPERTY_ALLOWANCE - 1
    });
    expect(withinAllowance.withinFreeAllowance).toBe(true);
    expect(withinAllowance.requiresUpgradeToAdd).toBe(false);

    const atAllowance = evaluatePortfolioAccess({
      hasPlan: false,
      paymentsConfigured: true,
      propertyCount: FREE_PROPERTY_ALLOWANCE
    });
    expect(atAllowance.withinFreeAllowance).toBe(false);
    expect(atAllowance.requiresUpgradeToAdd).toBe(true);

    const beyondAllowance = evaluatePortfolioAccess({
      hasPlan: false,
      paymentsConfigured: true,
      propertyCount: FREE_PROPERTY_ALLOWANCE + 3
    });
    expect(beyondAllowance.requiresUpgradeToAdd).toBe(true);
  });

  it('echoes its inputs so callers can message the state honestly', () => {
    const access = evaluatePortfolioAccess({ hasPlan: false, paymentsConfigured: true, propertyCount: 5 });
    expect(access).toEqual({
      hasPlan: false,
      paymentsConfigured: true,
      propertyCount: 5,
      withinFreeAllowance: false,
      upgradePath: 'portfolio',
      requiresUpgradeToAdd: true
    });
  });

  // The fee ladder: one free home, $4.99/mo each for homes two and three, and
  // the Portfolio plan from the fourth. The middle rung is the part worth
  // pinning — quoting $29 to someone adding their second home would be selling
  // them the wrong thing at six times the price.
  it('offers the rung the next home actually lands on', () => {
    const at = (propertyCount: number, hasPlan = false) =>
      evaluatePortfolioAccess({ hasPlan, paymentsConfigured: true, propertyCount }).upgradePath;

    expect(at(0)).toBe('none'); // first home is free
    expect(at(1)).toBe('per_home'); // adding the second
    expect(at(2)).toBe('per_home'); // adding the third
    expect(at(3)).toBe('portfolio'); // adding the fourth
    expect(at(9)).toBe('portfolio');
  });

  it('offers nothing to someone already on the Portfolio plan', () => {
    for (const propertyCount of [0, 1, 3, 40]) {
      expect(
        evaluatePortfolioAccess({ hasPlan: true, paymentsConfigured: true, propertyCount }).upgradePath
      ).toBe('none');
    }
  });

  it('keeps the ladder consistent with the constants', () => {
    // Guards against someone changing one number and not the other.
    expect(MAX_HOMES_WITHOUT_PORTFOLIO).toBe(FREE_PROPERTY_ALLOWANCE + MAX_PER_HOME_ADDITIONS);
    expect(FREE_PROPERTY_ALLOWANCE).toBe(1);
    expect(MAX_HOMES_WITHOUT_PORTFOLIO).toBe(3);
  });
});
