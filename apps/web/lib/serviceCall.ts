// Service Call Sheet — a robust, shareable repair report a homeowner (or a
// spouse/renter who does NOT know the details) can print or text to a repairman.
//
// It pulls together:
//   - what the person is seeing (the repair description)
//   - the relevant safety / shut-off & utility locations for the issue type
//     (plumbing -> water shut-off; electrical -> panel; hvac -> furnace/AC + gas)
//   - any relevant service history for the same asset/utility/room
//   - contractor and "who's home" contact details
//
// Sensitive fields (access codes, Wi-Fi passwords, etc.) are scrubbed with the
// shared safeText() so a renter can share the sheet without leaking secrets.

import { safeText, type RepairType, type UtilityType } from '@home-folder/shared';
import type { RepairRow } from './repairs';
import type { ServiceRecordRow } from './serviceRecords';
import type { UtilityRow } from './utilities';

export type SafetyItem = {
  utilityType: UtilityType;
  typeLabel: string;
  name: string | null;
  location: string | null;
  emergencyNotes: string | null;
  recorded: boolean;
};

export type ServiceCallContact = {
  name: string;
  phone: string;
};

export type ScheduledVisit = {
  date: string | null;
  dateLabel: string | null;
  window: string | null;
};

export type ServiceCallSheet = {
  propertyName: string;
  propertyAddress: string | null;
  issueTitle: string;
  issueTypeLabel: string;
  issueType: RepairType;
  description: string | null;
  priorityLabel: string;
  statusLabel: string;
  reportedDate: string | null;
  locationLabel: string | null;
  scheduledVisit: ScheduledVisit | null;
  onSiteContact: ServiceCallContact | null;
  contractor: { name: string | null; phone: string | null; email: string | null } | null;
  safety: SafetyItem[];
  serviceHistory: Array<{
    title: string;
    date: string | null;
    provider: string | null;
    summary: string | null;
  }>;
};

const UTILITY_TYPE_LABELS: Record<UtilityType, string> = {
  main_water_shutoff: 'Main water shut-off',
  electrical_panel: 'Electrical panel',
  gas_shutoff: 'Gas shut-off',
  water_heater: 'Water heater',
  hvac_unit: 'HVAC unit',
  furnace: 'Furnace',
  air_conditioner: 'Air conditioner',
  breaker_panel: 'Breaker panel',
  sump_pump: 'Sump pump',
  irrigation_shutoff: 'Irrigation shut-off',
  internet_modem: 'Internet modem',
  router: 'Router',
  smoke_detector: 'Smoke detector',
  carbon_monoxide_detector: 'Carbon monoxide detector',
  other: 'Other utility'
};

// Which shut-offs / systems a repairman (or the person on-site) should be able
// to point to, by issue type. Order = most relevant first.
const REPAIR_TYPE_UTILITY_MAP: Record<RepairType, UtilityType[]> = {
  plumbing: ['main_water_shutoff', 'water_heater', 'sump_pump', 'gas_shutoff'],
  electrical: ['electrical_panel', 'breaker_panel'],
  hvac: ['furnace', 'air_conditioner', 'hvac_unit', 'gas_shutoff', 'electrical_panel'],
  appliance: ['main_water_shutoff', 'gas_shutoff', 'electrical_panel'],
  roof: ['main_water_shutoff', 'electrical_panel'],
  exterior: ['irrigation_shutoff', 'main_water_shutoff', 'electrical_panel'],
  interior: ['main_water_shutoff', 'electrical_panel'],
  smart_home: ['router', 'internet_modem', 'electrical_panel'],
  utility: ['main_water_shutoff', 'electrical_panel', 'gas_shutoff'],
  general: ['main_water_shutoff', 'electrical_panel'],
  other: ['main_water_shutoff', 'electrical_panel']
};

// Everyone should be able to find these two, regardless of issue type.
const ALWAYS_INCLUDE: UtilityType[] = ['main_water_shutoff', 'electrical_panel'];

export function relevantUtilityTypesForRepair(repairType: RepairType): UtilityType[] {
  const mapped = REPAIR_TYPE_UTILITY_MAP[repairType] || [];
  const ordered = [...mapped];
  for (const type of ALWAYS_INCLUDE) {
    if (!ordered.includes(type)) {
      ordered.push(type);
    }
  }
  return ordered;
}

// "2026-07-30" -> "Wed, Jul 30, 2026". Parsed by parts so a date-only string
// isn't shifted a day by the UTC interpretation of new Date('YYYY-MM-DD').
export function formatFriendlyDate(dateString: string | null | undefined): string | null {
  if (!dateString) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString.trim());
  if (!match) {
    return dateString;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function serviceRecordSharesRepairScope(record: ServiceRecordRow, repair: RepairRow): boolean {
  return (
    (!!repair.asset_id && record.asset_id === repair.asset_id) ||
    (!!repair.utility_id && record.utility_id === repair.utility_id) ||
    (!!repair.room_id && record.room_id === repair.room_id)
  );
}

export function buildServiceCallSheet(params: {
  repair: RepairRow;
  utilities: UtilityRow[];
  serviceRecords: ServiceRecordRow[];
  propertyName: string;
  propertyAddress?: string | null;
  locationLabel?: string | null;
  onSiteContact?: ServiceCallContact | null;
  typeLabelFor: (value: string) => string;
}): ServiceCallSheet {
  const {
    repair,
    utilities,
    serviceRecords,
    propertyName,
    propertyAddress,
    locationLabel,
    onSiteContact,
    typeLabelFor
  } = params;

  const relevantTypes = relevantUtilityTypesForRepair(repair.repair_type);

  // Group the property's utilities by type so we can surface the relevant ones.
  const utilitiesByType = new Map<UtilityType, UtilityRow[]>();
  for (const utility of utilities) {
    const list = utilitiesByType.get(utility.utility_type) || [];
    list.push(utility);
    utilitiesByType.set(utility.utility_type, list);
  }

  const safety: SafetyItem[] = [];
  const seen = new Set<string>();

  // Always surface an explicitly-linked utility first, even if its type isn't
  // in the map (e.g. the homeowner linked a specific sump pump).
  const orderedTypes = [...relevantTypes];
  const linkedUtility = repair.utility_id
    ? utilities.find((utility) => utility.id === repair.utility_id)
    : null;
  if (linkedUtility && !orderedTypes.includes(linkedUtility.utility_type)) {
    orderedTypes.unshift(linkedUtility.utility_type);
  }

  for (const type of orderedTypes) {
    const matches = utilitiesByType.get(type) || [];
    if (matches.length === 0) {
      // Robustness: tell the reader this shut-off isn't on file rather than hiding it.
      safety.push({
        utilityType: type,
        typeLabel: UTILITY_TYPE_LABELS[type] || typeLabelFor(type),
        name: null,
        location: null,
        emergencyNotes: null,
        recorded: false
      });
      continue;
    }

    for (const utility of matches) {
      if (seen.has(utility.id)) continue;
      seen.add(utility.id);
      safety.push({
        utilityType: type,
        typeLabel: UTILITY_TYPE_LABELS[type] || typeLabelFor(type),
        name: safeText(utility.name),
        location: safeText(utility.location_notes),
        emergencyNotes: safeText(utility.emergency_notes),
        recorded: true
      });
    }
  }

  const serviceHistory = serviceRecords
    .filter((record) => serviceRecordSharesRepairScope(record, repair))
    .slice(0, 6)
    .map((record) => ({
      title: safeText(record.service_title) || 'Service record',
      date: record.service_date,
      provider: safeText(record.provider_name),
      summary: safeText(record.summary || record.notes)
    }));

  const contractor =
    repair.contractor_name || repair.contractor_phone || repair.contractor_email
      ? {
          name: safeText(repair.contractor_name),
          phone: safeText(repair.contractor_phone),
          email: safeText(repair.contractor_email)
        }
      : null;

  const scheduledVisit: ScheduledVisit | null =
    repair.scheduled_date || repair.scheduled_window
      ? {
          date: repair.scheduled_date,
          dateLabel: formatFriendlyDate(repair.scheduled_date),
          window: safeText(repair.scheduled_window)
        }
      : null;

  return {
    propertyName: propertyName || 'Home',
    propertyAddress: safeText(propertyAddress),
    issueTitle: safeText(repair.title) || 'Home repair',
    issueTypeLabel: typeLabelFor(repair.repair_type),
    issueType: repair.repair_type,
    description: safeText(repair.description),
    priorityLabel: typeLabelFor(repair.priority),
    statusLabel: typeLabelFor(repair.status),
    reportedDate: repair.reported_date,
    locationLabel: locationLabel || null,
    scheduledVisit,
    onSiteContact:
      onSiteContact && (onSiteContact.name.trim() || onSiteContact.phone.trim())
        ? { name: onSiteContact.name.trim(), phone: onSiteContact.phone.trim() }
        : null,
    contractor,
    safety,
    serviceHistory
  };
}

// Plain-text version for SMS / copy-to-clipboard / navigator.share.
export function serviceCallToPlainText(sheet: ServiceCallSheet): string {
  const lines: string[] = [];
  const rule = '----------------------------------------';

  lines.push(`HOME REPAIR — SERVICE CALL`);
  lines.push(sheet.propertyName);
  if (sheet.propertyAddress) lines.push(sheet.propertyAddress);
  lines.push(rule);

  lines.push(`ISSUE: ${sheet.issueTitle}`);
  lines.push(`Type: ${sheet.issueTypeLabel} · Priority: ${sheet.priorityLabel}`);
  if (sheet.locationLabel) lines.push(`Location: ${sheet.locationLabel}`);
  if (sheet.scheduledVisit) {
    const when = [sheet.scheduledVisit.dateLabel, sheet.scheduledVisit.window].filter(Boolean).join(' · ');
    if (when) lines.push(`Scheduled visit: ${when}`);
  }
  if (sheet.description) {
    lines.push('');
    lines.push('What we are seeing:');
    lines.push(sheet.description);
  }

  if (sheet.onSiteContact) {
    lines.push('');
    lines.push(
      `Someone is home: ${sheet.onSiteContact.name}${
        sheet.onSiteContact.phone ? ` · ${sheet.onSiteContact.phone}` : ''
      }`
    );
    lines.push('(They may not know the technical details.)');
  }

  if (sheet.safety.length > 0) {
    lines.push('');
    lines.push('SHUT-OFFS & KEY LOCATIONS:');
    for (const item of sheet.safety) {
      if (!item.recorded) {
        lines.push(`• ${item.typeLabel}: not on file — please ask on arrival`);
        continue;
      }
      const where = item.location ? ` — ${item.location}` : '';
      lines.push(`• ${item.typeLabel}${item.name ? ` (${item.name})` : ''}${where}`);
      if (item.emergencyNotes) {
        lines.push(`    Note: ${item.emergencyNotes}`);
      }
    }
  }

  if (sheet.serviceHistory.length > 0) {
    lines.push('');
    lines.push('RELEVANT SERVICE HISTORY:');
    for (const record of sheet.serviceHistory) {
      const parts = [record.title];
      if (record.date) parts.push(record.date);
      if (record.provider) parts.push(record.provider);
      lines.push(`• ${parts.join(' · ')}`);
      if (record.summary) lines.push(`    ${record.summary}`);
    }
  }

  if (sheet.contractor) {
    lines.push('');
    lines.push('PREFERRED CONTRACTOR:');
    const parts = [sheet.contractor.name, sheet.contractor.phone, sheet.contractor.email].filter(
      Boolean
    );
    lines.push(`• ${parts.join(' · ') || 'On file'}`);
  }

  lines.push(rule);
  lines.push('Shared from Our Home Folder');

  return lines.join('\n');
}

// Compact version for SMS links. Prefilled sms: bodies get truncated (or
// silently dropped) by some phones past roughly 1–2k characters, so this keeps
// only what a technician needs at the door: where, what, when, and the
// shut-offs that are actually on file.
export function serviceCallToCompactText(sheet: ServiceCallSheet): string {
  const lines: string[] = [];

  lines.push(`SERVICE CALL — ${sheet.issueTitle}`);

  const where = [sheet.propertyName, sheet.propertyAddress].filter(Boolean).join(' · ');
  if (where) lines.push(where);
  if (sheet.locationLabel) lines.push(`Location: ${sheet.locationLabel}`);

  if (sheet.scheduledVisit) {
    const when = [sheet.scheduledVisit.dateLabel, sheet.scheduledVisit.window].filter(Boolean).join(' · ');
    if (when) lines.push(`Visit: ${when}`);
  }

  if (sheet.description) {
    const problem = sheet.description.replace(/\s+/g, ' ').trim();
    lines.push(`Problem: ${problem.length > 320 ? `${problem.slice(0, 317)}...` : problem}`);
  }

  if (sheet.onSiteContact) {
    lines.push(
      `On site: ${sheet.onSiteContact.name}${sheet.onSiteContact.phone ? ` ${sheet.onSiteContact.phone}` : ''}`
    );
  }

  const recordedSafety = sheet.safety.filter((item) => item.recorded && item.location).slice(0, 4);
  if (recordedSafety.length > 0) {
    lines.push('Shut-offs:');
    for (const item of recordedSafety) {
      lines.push(`• ${item.typeLabel}: ${item.location}`);
    }
  }

  lines.push('— Shared from Our Home Folder');

  return lines.join('\n');
}

// Subject + body for a pre-addressed mailto: link.
export function buildServiceCallEmail(sheet: ServiceCallSheet): { subject: string; body: string } {
  const where = sheet.propertyAddress || sheet.propertyName;
  return {
    subject: `Service call — ${sheet.issueTitle}${where ? ` at ${where}` : ''}`,
    body: serviceCallToPlainText(sheet)
  };
}

// Keep only characters that dialers/SMS apps accept in an href target.
export function sanitizePhoneForHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.length >= 7 ? cleaned : null;
}
