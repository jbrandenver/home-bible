import { getSupabaseBrowserClient } from './supabase/client';
import type { PropertySummary } from './properties';

// Portfolio roll-ups: one loader that fans out across every property the user
// can see, and pure aggregation functions the page and tests share. All reads
// go through RLS row by row — a property id in the list yields nothing unless
// the signed-in user actually holds a seat on it.

export type PortfolioAssetRow = {
  id: string;
  property_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  asset_type: string;
  purchase_date: string | null;
  warranty_expires_at: string | null;
};

export type PortfolioRepairRow = {
  id: string;
  property_id: string;
  title: string;
  status: string;
  priority: string | null;
  scheduled_date: string | null;
};

export type PortfolioReminderRow = {
  id: string;
  property_id: string;
  title: string;
  status: string;
  due_date: string | null;
};

export type PortfolioComplianceRow = {
  id: string;
  property_id: string;
  title: string;
  authority: string | null;
  obligation_type: string;
  next_due: string | null;
  last_completed_on: string | null;
  frequency_months: number | null;
};

export type PortfolioData = {
  assets: PortfolioAssetRow[];
  repairs: PortfolioRepairRow[];
  reminders: PortfolioReminderRow[];
  compliance: PortfolioComplianceRow[];
};

const OPEN_REPAIR_STATUSES = new Set(['open', 'scheduled', 'in_progress']);

export async function loadPortfolioData(propertyIds: string[]): Promise<PortfolioData> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || propertyIds.length === 0) {
    return { assets: [], repairs: [], reminders: [], compliance: [] };
  }

  const [assets, repairs, reminders, compliance] = await Promise.all([
    supabase
      .from('assets')
      .select('id, property_id, name, brand, model, asset_type, purchase_date, warranty_expires_at')
      .in('property_id', propertyIds)
      .is('deleted_at', null)
      .limit(2000),
    supabase
      .from('repairs')
      .select('id, property_id, title, status, priority, scheduled_date')
      .in('property_id', propertyIds)
      .is('deleted_at', null)
      .limit(2000),
    supabase
      .from('reminders')
      .select('id, property_id, title, status, due_date')
      .in('property_id', propertyIds)
      .is('deleted_at', null)
      .eq('status', 'open')
      .limit(2000),
    supabase
      .from('compliance_obligations')
      .select('id, property_id, title, authority, obligation_type, next_due, last_completed_on, frequency_months')
      .in('property_id', propertyIds)
      .is('deleted_at', null)
      .limit(2000)
  ]);

  const firstError = assets.error ?? repairs.error ?? reminders.error ?? compliance.error;
  if (firstError) {
    throw new Error(`Failed to load portfolio data. ${firstError.message}`);
  }

  return {
    assets: (assets.data ?? []) as PortfolioAssetRow[],
    repairs: (repairs.data ?? []) as PortfolioRepairRow[],
    reminders: (reminders.data ?? []) as PortfolioReminderRow[],
    compliance: (compliance.data ?? []) as PortfolioComplianceRow[]
  };
}

export type PropertyRollup = {
  property: PropertySummary;
  unitCount: number;
  openRepairs: number;
  remindersDue: number;
  warrantiesExpiringSoon: number;
  complianceDueSoon: number;
  complianceOverdue: number;
};

export type PortfolioOverview = {
  rows: PropertyRollup[];
  totals: {
    doors: number;
    openRepairs: number;
    remindersDue: number;
    warrantiesExpiringSoon: number;
    complianceDueSoon: number;
    complianceOverdue: number;
  };
  warrantiesExpiring: (PortfolioAssetRow & { daysLeft: number })[];
  agingAssets: (PortfolioAssetRow & { ageYears: number })[];
  complianceAttention: (PortfolioComplianceRow & { overdue: boolean; daysLeft: number | null })[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const WARRANTY_HORIZON_DAYS = 90;
export const REMINDER_HORIZON_DAYS = 30;
export const COMPLIANCE_HORIZON_DAYS = 60;
export const AGING_ASSET_YEARS = 10;

function daysUntil(dateIso: string, todayIso: string): number {
  return Math.floor((Date.parse(dateIso) - Date.parse(todayIso)) / DAY_MS);
}

// Pure: everything time-dependent takes `todayIso` (YYYY-MM-DD) so tests are
// deterministic and the page passes the same "today" to every computation.
export function buildPortfolioOverview(
  properties: PropertySummary[],
  data: PortfolioData,
  todayIso: string
): PortfolioOverview {
  const unitCounts = new Map<string, number>();
  for (const property of properties) {
    if (property.parent_property_id) {
      unitCounts.set(property.parent_property_id, (unitCounts.get(property.parent_property_id) ?? 0) + 1);
    }
  }

  const warrantiesExpiring = data.assets
    .filter((asset) => asset.warranty_expires_at)
    .map((asset) => ({ ...asset, daysLeft: daysUntil(asset.warranty_expires_at as string, todayIso) }))
    .filter((asset) => asset.daysLeft >= 0 && asset.daysLeft <= WARRANTY_HORIZON_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const agingAssets = data.assets
    .filter((asset) => asset.purchase_date)
    .map((asset) => ({
      ...asset,
      ageYears: Math.floor(-daysUntil(asset.purchase_date as string, todayIso) / 365)
    }))
    .filter((asset) => asset.ageYears >= AGING_ASSET_YEARS)
    .sort((a, b) => b.ageYears - a.ageYears);

  const complianceAttention = data.compliance
    .map((obligation) => {
      const daysLeft = obligation.next_due ? daysUntil(obligation.next_due, todayIso) : null;
      return { ...obligation, daysLeft, overdue: daysLeft !== null && daysLeft < 0 };
    })
    .filter(
      (obligation) =>
        obligation.overdue || (obligation.daysLeft !== null && obligation.daysLeft <= COMPLIANCE_HORIZON_DAYS)
    )
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

  const openRepairs = data.repairs.filter((repair) => OPEN_REPAIR_STATUSES.has(repair.status));
  const remindersDue = data.reminders.filter(
    (reminder) =>
      reminder.status === 'open' &&
      reminder.due_date &&
      daysUntil(reminder.due_date, todayIso) <= REMINDER_HORIZON_DAYS
  );

  const countByProperty = <T extends { property_id: string }>(rows: T[]) => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.property_id, (counts.get(row.property_id) ?? 0) + 1);
    }
    return counts;
  };

  const repairCounts = countByProperty(openRepairs);
  const reminderCounts = countByProperty(remindersDue);
  const warrantyCounts = countByProperty(warrantiesExpiring);
  const complianceSoonCounts = countByProperty(complianceAttention.filter((item) => !item.overdue));
  const complianceOverdueCounts = countByProperty(complianceAttention.filter((item) => item.overdue));

  const rows: PropertyRollup[] = properties.map((property) => ({
    property,
    unitCount: unitCounts.get(property.id) ?? 0,
    openRepairs: repairCounts.get(property.id) ?? 0,
    remindersDue: reminderCounts.get(property.id) ?? 0,
    warrantiesExpiringSoon: warrantyCounts.get(property.id) ?? 0,
    complianceDueSoon: complianceSoonCounts.get(property.id) ?? 0,
    complianceOverdue: complianceOverdueCounts.get(property.id) ?? 0
  }));

  return {
    rows,
    totals: {
      doors: properties.length,
      openRepairs: openRepairs.length,
      remindersDue: remindersDue.length,
      warrantiesExpiringSoon: warrantiesExpiring.length,
      complianceDueSoon: complianceAttention.filter((item) => !item.overdue).length,
      complianceOverdue: complianceAttention.filter((item) => item.overdue).length
    },
    warrantiesExpiring,
    agingAssets,
    complianceAttention
  };
}
