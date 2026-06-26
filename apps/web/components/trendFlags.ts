export type ServiceRecord = {
  id: string;
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
  service_date: string;
  follow_up_needed?: boolean;
  follow_up_date?: string | null;
  title?: string;
};

export type IssueRecord = {
  id: string;
  title?: string;
  status: string;
  severity: string;
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
};

export type TrendFlag = {
  id: string;
  label: 'Review recommended' | 'Recurring service pattern' | 'Follow-up overdue' | 'Urgent issue open';
  entityType: 'home' | 'room' | 'asset' | 'utility';
  entityId?: string;
  details: string;
};

function isWithinFiveYears(dateStr: string) {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 5);
  return parsed >= cutoff;
}

export function detectTrendFlags(serviceRecords: ServiceRecord[], issues: IssueRecord[]): TrendFlag[] {
  const flags: TrendFlag[] = [];

  const recentRecords = serviceRecords.filter((record) => isWithinFiveYears(record.service_date));

  const assetCounts = new Map<string, number>();
  const utilityCounts = new Map<string, number>();
  const roomCounts = new Map<string, number>();

  for (const record of recentRecords) {
    if (record.asset_id) {
      assetCounts.set(record.asset_id, (assetCounts.get(record.asset_id) || 0) + 1);
    }

    if (record.utility_id) {
      utilityCounts.set(record.utility_id, (utilityCounts.get(record.utility_id) || 0) + 1);
    }

    if (record.room_id) {
      roomCounts.set(record.room_id, (roomCounts.get(record.room_id) || 0) + 1);
    }

    if (record.follow_up_needed && record.follow_up_date) {
      const followUpDate = new Date(record.follow_up_date);
      if (!Number.isNaN(followUpDate.getTime()) && followUpDate.getTime() < Date.now()) {
        flags.push({
          id: `follow-up-${record.id}`,
          label: 'Follow-up overdue',
          entityType: 'home',
          details: record.title ? `${record.title} has an overdue follow-up date.` : 'A service follow-up is overdue.'
        });
      }
    }
  }

  for (const [assetId, count] of assetCounts.entries()) {
    if (count >= 3) {
      flags.push({
        id: `asset-pattern-${assetId}`,
        label: 'Recurring service pattern',
        entityType: 'asset',
        entityId: assetId,
        details: `${count} service records in 5 years.`
      });
    }
  }

  for (const [utilityId, count] of utilityCounts.entries()) {
    if (count >= 3) {
      flags.push({
        id: `utility-pattern-${utilityId}`,
        label: 'Recurring service pattern',
        entityType: 'utility',
        entityId: utilityId,
        details: `${count} service records in 5 years.`
      });
    }
  }

  for (const [roomId, count] of roomCounts.entries()) {
    if (count >= 5) {
      flags.push({
        id: `room-review-${roomId}`,
        label: 'Review recommended',
        entityType: 'room',
        entityId: roomId,
        details: `${count} service records in 5 years.`
      });
    }
  }

  for (const issue of issues) {
    if (issue.severity === 'urgent' && issue.status !== 'resolved' && issue.status !== 'archived') {
      flags.push({
        id: `urgent-issue-${issue.id}`,
        label: 'Urgent issue open',
        entityType: 'home',
        details: issue.title || 'An urgent issue is still open.'
      });
    }
  }

  return flags;
}

export function trendFlagsForEntity(flags: TrendFlag[], entityType: TrendFlag['entityType'], entityId?: string) {
  if (!entityId) {
    return [];
  }

  return flags.filter((flag) => flag.entityType === entityType && flag.entityId === entityId);
}
