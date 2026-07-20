import { useEffect, useState } from 'react';
import { getAssetDataContext, getAssetsForContext, type AssetRow } from './assets';
import { getDocumentDataContext, getDocumentsForContext, type DocumentRow } from './documents';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from './issues';
import { getReceiptDataContext, getReceiptsForContext, type ReceiptRow } from './receipts';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from './reminders';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from './repairs';
import { getRoomsForProperty, type RoomWithFloor } from './rooms';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from './serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from './trendFlags';
import { getUtilitiesForContext, getUtilityDataContext, type UtilityRow } from './utilities';

export type HomeData = {
  assets: AssetRow[];
  documents: DocumentRow[];
  issues: IssueRow[];
  receipts: ReceiptRow[];
  reminders: ReminderRow[];
  repairs: RepairRow[];
  rooms: RoomWithFloor[];
  serviceRecords: ServiceRecordRow[];
  trendFlags: TrendFlagRow[];
  utilities: UtilityRow[];
};

const emptyHomeData: HomeData = {
  assets: [],
  documents: [],
  issues: [],
  receipts: [],
  reminders: [],
  repairs: [],
  rooms: [],
  serviceRecords: [],
  trendFlags: [],
  utilities: []
};

export function useHomeData() {
  const [data, setData] = useState<HomeData>(emptyHomeData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [
          assetContext,
          documentContext,
          issueContext,
          receiptContext,
          reminderContext,
          repairContext,
          serviceRecordContext,
          trendFlagContext,
          utilityContext
        ] = await Promise.all([
          getAssetDataContext(),
          getDocumentDataContext(),
          getIssueDataContext(),
          getReceiptDataContext(),
          getReminderDataContext(),
          getRepairDataContext(),
          getServiceRecordDataContext(),
          getTrendFlagDataContext(),
          getUtilityDataContext()
        ]);

        const propertyId = utilityContext.property?.id;
        const [
          assets,
          documents,
          issues,
          receipts,
          reminders,
          repairs,
          rooms,
          serviceRecords,
          trendFlags,
          utilities
        ] = await Promise.all([
          getAssetsForContext(assetContext),
          getDocumentsForContext(documentContext),
          getIssuesForContext(issueContext),
          getReceiptsForContext(receiptContext),
          getRemindersForContext(reminderContext),
          getRepairsForContext(repairContext),
          propertyId ? getRoomsForProperty(propertyId) : Promise.resolve([] as RoomWithFloor[]),
          getServiceRecordsForContext(serviceRecordContext),
          getTrendFlagsForContext(trendFlagContext),
          getUtilitiesForContext(utilityContext)
        ]);

        if (isMounted) {
          setData({
            assets,
            documents,
            issues,
            receipts,
            reminders,
            repairs,
            rooms,
            serviceRecords,
            trendFlags,
            utilities
          });
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load home data.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  return { data, loading, error };
}
