import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel, ROOM_TYPES } from '@home-folder/shared';
import { PageHeader, Card, Button, ConfirmDialog, Input, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import { ViewOnlyNotice } from '../../components/ViewOnlyNotice';
import { usePropertyAccess } from '../../lib/access';
import { RelatedDocuments } from '../../components/RelatedDocuments';
import { RelatedReceipts } from '../../components/RelatedReceipts';
import { getAssetDataContext, getAssetsForRoom, type AssetRow } from '../../lib/assets';
import { getDemoRooms, setDemoRooms } from '../../lib/demoStorage';
import {
  getDocumentDataContext,
  getDocumentsForLink,
  type DocumentDataContext,
  type DocumentRow
} from '../../lib/documents';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../../lib/issues';
import { getReminderDataContext, getRemindersForRoom, type ReminderRow } from '../../lib/reminders';
import { getReceiptDataContext, getReceiptsForLink, type ReceiptDataContext, type ReceiptRow } from '../../lib/receipts';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from '../../lib/repairs';
import {
  createRoomsForProperty,
  deleteRoomForProperty,
  getRoomById,
  getRoomLinkCounts,
  updateRoomForProperty,
  type RoomLinkCount
} from '../../lib/rooms';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../../lib/trendFlags';
import { getUtilitiesForRoom, getUtilityDataContext, type UtilityRow } from '../../lib/utilities';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
  notes?: string | null;
  outlet_count?: number | null;
  switch_count?: number | null;
  vent_count?: number | null;
  vent_type?: string | null;
  breaker_label?: string | null;
  has_plumbing?: boolean;
};

type RoomType = (typeof ROOM_TYPES)[number];

function asRoomType(value: string | undefined): RoomType {
  return (ROOM_TYPES as readonly string[]).includes(value ?? '') ? (value as RoomType) : 'other';
}

// Blank means "not counted". Anything else has to be a sensible whole number.
function parseOptionalCount(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999) {
    return 'invalid';
  }

  return parsed;
}

export default function RoomDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const roomId = typeof id === 'string' ? id : '';

  const access = usePropertyAccess();
  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [documentContext, setDocumentContext] = useState<DocumentDataContext | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [receiptContext, setReceiptContext] = useState<ReceiptDataContext | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [utilityError, setUtilityError] = useState('');
  const [assetError, setAssetError] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [repairError, setRepairError] = useState('');
  const [serviceRecordError, setServiceRecordError] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [issueError, setIssueError] = useState('');
  const [trendFlagError, setTrendFlagError] = useState('');
  const [roomError, setRoomError] = useState('');

  const [propertyId, setPropertyId] = useState('');
  const [editName, setEditName] = useState('');
  const [editRoomType, setEditRoomType] = useState<RoomType>('other');
  const [editFloorName, setEditFloorName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editOutletCount, setEditOutletCount] = useState('');
  const [editSwitchCount, setEditSwitchCount] = useState('');
  const [editVentCount, setEditVentCount] = useState('');
  const [editVentType, setEditVentType] = useState('');
  const [editBreakerLabel, setEditBreakerLabel] = useState('');
  const [editHasPlumbing, setEditHasPlumbing] = useState(false);
  const [roomSaving, setRoomSaving] = useState(false);
  const [roomDeleting, setRoomDeleting] = useState(false);
  // Two-step deletion: "Remove room" opens the dialog, which lists what still
  // links to the room; nothing is removed until the dialog is confirmed.
  // window.confirm proved unreliable elsewhere (a suppressed dialog returns
  // false and the click dies silently), so this uses the in-page ConfirmDialog.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteLinkCounts, setDeleteLinkCounts] = useState<RoomLinkCount[] | null>(null);
  const [roomFormError, setRoomFormError] = useState('');
  const [roomSaved, setRoomSaved] = useState(false);

  const [closetAdding, setClosetAdding] = useState(false);
  const [closetError, setClosetError] = useState('');
  const [closetCreatedId, setClosetCreatedId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!roomId) {
        return;
      }

      setUtilityError('');
      setAssetError('');
      setReminderError('');
      setRepairError('');
      setServiceRecordError('');
      setDocumentError('');
      setReceiptError('');
      setIssueError('');
      setTrendFlagError('');

      const [
        utilityContext,
        assetContext,
        reminderContext,
        repairContext,
        serviceRecordContext,
        nextDocumentContext,
        nextReceiptContext,
        issueContext,
        trendFlagContext
      ] = await Promise.all([
        getUtilityDataContext(),
        getAssetDataContext(),
        getReminderDataContext(),
        getRepairDataContext(),
        getServiceRecordDataContext(),
        getDocumentDataContext(),
        getReceiptDataContext(),
        getIssueDataContext(),
        getTrendFlagDataContext()
      ]);
      let nextUtilities: UtilityRow[] = [];
      let nextAssets: AssetRow[] = [];
      let nextReminders: ReminderRow[] = [];
      let nextRepairs: RepairRow[] = [];
      let nextServiceRecords: ServiceRecordRow[] = [];
      let nextDocuments: DocumentRow[] = [];
      let nextReceipts: ReceiptRow[] = [];
      let nextIssues: IssueRow[] = [];
      let nextTrendFlags: TrendFlagRow[] = [];

      try {
        nextUtilities = await getUtilitiesForRoom(utilityContext, roomId);
      } catch (loadError) {
        if (isMounted) {
          setUtilityError(loadError instanceof Error ? loadError.message : 'Failed to load room utilities.');
        }
      }

      try {
        nextAssets = await getAssetsForRoom(assetContext, roomId);
      } catch (loadError) {
        if (isMounted) {
          setAssetError(loadError instanceof Error ? loadError.message : 'Failed to load room assets.');
        }
      }

      try {
        nextReminders = await getRemindersForRoom(reminderContext, roomId);
      } catch (loadError) {
        if (isMounted) {
          setReminderError(loadError instanceof Error ? loadError.message : 'Failed to load room reminders.');
        }
      }

      try {
        nextRepairs = await getRepairsForContext(repairContext);
      } catch (loadError) {
        if (isMounted) {
          setRepairError(loadError instanceof Error ? loadError.message : 'Failed to load room repairs.');
        }
      }

      try {
        nextServiceRecords = await getServiceRecordsForContext(serviceRecordContext);
      } catch (loadError) {
        if (isMounted) {
          setServiceRecordError(loadError instanceof Error ? loadError.message : 'Failed to load room service history.');
        }
      }

      try {
        nextDocuments = await getDocumentsForLink(nextDocumentContext, { field: 'room_id', id: roomId });
      } catch (loadError) {
        if (isMounted) {
          setDocumentError(loadError instanceof Error ? loadError.message : 'Failed to load room documents.');
        }
      }

      try {
        nextReceipts = await getReceiptsForLink(nextReceiptContext, { field: 'room_id', id: roomId });
      } catch (loadError) {
        if (isMounted) {
          setReceiptError(loadError instanceof Error ? loadError.message : 'Failed to load room receipts.');
        }
      }

      try {
        nextIssues = await getIssuesForContext(issueContext);
      } catch (loadError) {
        if (isMounted) {
          setIssueError(loadError instanceof Error ? loadError.message : 'Failed to load room issues.');
        }
      }

      try {
        nextTrendFlags = await getTrendFlagsForContext(trendFlagContext);
      } catch (loadError) {
        if (isMounted) {
          setTrendFlagError(loadError instanceof Error ? loadError.message : 'Failed to load room trends.');
        }
      }

      if (utilityContext.mode === 'supabase') {
        let remoteRoom = null;

        try {
          remoteRoom = await getRoomById(roomId);
        } catch (loadError) {
          if (!isMounted) {
            return;
          }
          setRoomError(loadError instanceof Error ? loadError.message : 'Failed to load this room.');
        }

        if (!isMounted) {
          return;
        }

        if (remoteRoom) {
          setDataMode('supabase');
          setPropertyId(remoteRoom.property_id || '');
          setRooms([
            {
              id: remoteRoom.id,
              name: remoteRoom.name,
              room_type: remoteRoom.room_type,
              floor_name: remoteRoom.floor_name,
              notes: remoteRoom.notes ?? null,
              outlet_count: remoteRoom.outlet_count ?? null,
              switch_count: remoteRoom.switch_count ?? null,
              vent_count: remoteRoom.vent_count ?? null,
              vent_type: remoteRoom.vent_type ?? null,
              breaker_label: remoteRoom.breaker_label ?? null,
              has_plumbing: remoteRoom.has_plumbing ?? false
            }
          ]);
        } else {
          setDataMode('supabase');
          setRooms([]);
        }
      } else {
        if (!isMounted) {
          return;
        }
        setDataMode('demo');
        setRooms(getDemoRooms());
      }

      setUtilities(nextUtilities);
      setAssets(nextAssets);
      setReminders(nextReminders);
      setRepairs(nextRepairs);
      setServiceRecords(nextServiceRecords);
      setDocumentContext(nextDocumentContext);
      setDocuments(nextDocuments);
      setReceiptContext(nextReceiptContext);
      setReceipts(nextReceipts);
      setIssues(nextIssues);
      setTrendFlags(nextTrendFlags);
    }

    load().catch((loadError) => {
      if (isMounted) {
        setRoomError(loadError instanceof Error ? loadError.message : 'Failed to load this room.');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  const room = useMemo(() => {
    return rooms.find((currentRoom) => currentRoom.id === roomId);
  }, [rooms, roomId]);

  // Fill the edit form from the record, so the form always opens showing what
  // is currently saved rather than an empty slate.
  useEffect(() => {
    if (!room) {
      return;
    }

    setEditName(room.name);
    setEditRoomType(asRoomType(room.room_type));
    setEditFloorName(room.floor_name === 'Unassigned' ? '' : room.floor_name);
    setEditNotes(room.notes || '');
    setEditOutletCount(room.outlet_count != null ? String(room.outlet_count) : '');
    setEditSwitchCount(room.switch_count != null ? String(room.switch_count) : '');
    setEditVentCount(room.vent_count != null ? String(room.vent_count) : '');
    setEditVentType(room.vent_type || '');
    setEditBreakerLabel(room.breaker_label || '');
    setEditHasPlumbing(Boolean(room.has_plumbing));
  }, [room]);

  const roomUtilities = useMemo(() => {
    return utilities.filter((u) => u.room_id === roomId);
  }, [utilities, roomId]);

  const roomAssets = useMemo(() => {
    return assets.filter((a) => a.room_id === roomId);
  }, [assets, roomId]);

  const roomReminders = useMemo(
    () =>
      reminders.filter(
        (reminder) =>
          reminder.room_id === roomId ||
          (reminder.linked_type === 'room' && reminder.linked_id === roomId)
      ),
    [reminders, roomId]
  );

  const utilityIdsInRoom = useMemo(
    () => new Set(roomUtilities.map((utility) => utility.id)),
    [roomUtilities]
  );

  const roomServiceRecords = useMemo(
    () =>
      serviceRecords.filter(
        (record) => record.room_id === roomId || (!!record.utility_id && utilityIdsInRoom.has(record.utility_id))
      ),
    [serviceRecords, roomId, utilityIdsInRoom]
  );

  const roomRepairs = useMemo(
    () =>
      repairs.filter(
        (repair) => repair.room_id === roomId || (!!repair.utility_id && utilityIdsInRoom.has(repair.utility_id))
      ),
    [repairs, roomId, utilityIdsInRoom]
  );

  const roomIssues = useMemo(
    () =>
      issues.filter(
        (issue) => issue.room_id === roomId || (!!issue.utility_id && utilityIdsInRoom.has(issue.utility_id))
      ),
    [issues, roomId, utilityIdsInRoom]
  );

  const roomTrendFlags = useMemo(
    () =>
      trendFlags.filter(
        (flag) => flag.room_id === roomId || (!!flag.utility_id && utilityIdsInRoom.has(flag.utility_id))
      ),
    [trendFlags, roomId, utilityIdsInRoom]
  );

  const isAccountRoom = dataMode === 'supabase';

  async function handleSaveRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room) {
      return;
    }

    setRoomFormError('');
    setRoomSaved(false);

    const name = editName.trim();
    if (!name) {
      setRoomFormError('A room needs a name.');
      return;
    }

    const outletCount = parseOptionalCount(editOutletCount);
    const switchCount = parseOptionalCount(editSwitchCount);
    const ventCount = parseOptionalCount(editVentCount);

    if (outletCount === 'invalid' || switchCount === 'invalid' || ventCount === 'invalid') {
      setRoomFormError('Counts should be whole numbers from 0 to 999, or left blank.');
      return;
    }

    setRoomSaving(true);

    try {
      if (isAccountRoom) {
        if (!propertyId) {
          setRoomFormError('This room is still loading. Please try again in a moment.');
          return;
        }

        await updateRoomForProperty(propertyId, room.id, {
          name,
          room_type: editRoomType,
          floor_name: editFloorName.trim() || 'Main Floor',
          notes: editNotes.trim() || null,
          outlet_count: outletCount,
          switch_count: switchCount,
          vent_count: ventCount,
          vent_type: editVentType.trim() || null,
          breaker_label: editBreakerLabel.trim() || null,
          has_plumbing: editHasPlumbing
        });

        const refreshed = await getRoomById(room.id);
        if (refreshed) {
          setRooms([
            {
              id: refreshed.id,
              name: refreshed.name,
              room_type: refreshed.room_type,
              floor_name: refreshed.floor_name,
              notes: refreshed.notes ?? null,
              outlet_count: refreshed.outlet_count ?? null,
              switch_count: refreshed.switch_count ?? null,
              vent_count: refreshed.vent_count ?? null,
              vent_type: refreshed.vent_type ?? null,
              breaker_label: refreshed.breaker_label ?? null,
              has_plumbing: refreshed.has_plumbing ?? false
            }
          ]);
        }
      } else {
        // Demo rooms live in this browser and hold only a name, type, and floor.
        const nextRooms = getDemoRooms().map((demoRoom) =>
          demoRoom.id === room.id
            ? {
                ...demoRoom,
                name,
                room_type: editRoomType,
                floor_name: editFloorName.trim() || 'Main Floor'
              }
            : demoRoom
        );
        setDemoRooms(nextRooms);
        setRooms(nextRooms);
      }

      setRoomSaved(true);
    } catch (saveError) {
      setRoomFormError(saveError instanceof Error ? saveError.message : 'Failed to save this room.');
    } finally {
      setRoomSaving(false);
    }
  }

  // A closet is its own selectable space (same model as the add-rooms flow):
  // "Primary Bedroom Closet" joins the home record and things can be filed
  // under it. This exists here for the room that was mapped without one.
  async function handleAddCloset() {
    if (!room) {
      return;
    }

    setClosetError('');
    setClosetCreatedId(null);
    setClosetAdding(true);

    const closetName = `${room.name} Closet`;
    const floorName = room.floor_name === 'Unassigned' ? 'Main Floor' : room.floor_name;

    try {
      if (isAccountRoom) {
        if (!propertyId) {
          setClosetError('This room is still loading. Please try again in a moment.');
          return;
        }

        const allRooms = await createRoomsForProperty(propertyId, [
          { name: closetName, room_type: 'closet', floor_name: floorName }
        ]);
        const created = allRooms.find(
          (candidate) =>
            candidate.room_type === 'closet' &&
            candidate.name.trim().toLowerCase() === closetName.toLowerCase()
        );
        setClosetCreatedId(created?.id || null);
      } else {
        const id = crypto.randomUUID();
        setDemoRooms([
          ...getDemoRooms(),
          { id, name: closetName, room_type: 'closet', floor_name: floorName }
        ]);
        setClosetCreatedId(id);
      }
    } catch (closetAddError) {
      setClosetError(
        closetAddError instanceof Error ? closetAddError.message : 'Failed to add the closet.'
      );
    } finally {
      setClosetAdding(false);
    }
  }

  function requestDeleteRoom() {
    if (!room) {
      return;
    }

    setRoomFormError('');
    setConfirmingDelete(true);

    if (isAccountRoom && propertyId) {
      setDeleteLinkCounts(null);
      getRoomLinkCounts(propertyId, room.id)
        .then((counts) => setDeleteLinkCounts(counts))
        .catch(() => setDeleteLinkCounts([]));
      return;
    }

    setDeleteLinkCounts([]);
  }

  function describeDeletion() {
    if (!isAccountRoom) {
      return `This removes ${room?.name || 'this room'} from this browser's demo data. This cannot be undone.`;
    }

    const linkedSummary =
      deleteLinkCounts === null
        ? 'Checking what links to this room…'
        : deleteLinkCounts.length === 0
          ? 'Nothing else links to this room.'
          : `Still linked to this room: ${deleteLinkCounts
              .map((entry) => `${entry.count} ${entry.label}`)
              .join(', ')}. Those records are kept — they simply stop naming this room, and you can point them at another one.`;

    return `${linkedSummary} Removing the room cannot be undone.`;
  }

  // deleteRoomForProperty soft-deletes the room and then clears room_id on
  // every table that can reference one — utilities, appliances, repairs,
  // reminders, service records, issues, home systems, documents, receipts,
  // trend flags, and automation gear — so those records survive; they simply
  // stop naming a room.
  async function handleDeleteRoom() {
    if (!room || roomDeleting) {
      return;
    }

    setRoomFormError('');
    setRoomDeleting(true);

    try {
      if (isAccountRoom) {
        if (!propertyId) {
          setConfirmingDelete(false);
          setRoomFormError('This room is still loading. Please try again in a moment.');
          return;
        }

        await deleteRoomForProperty(propertyId, room.id);
      } else {
        setDemoRooms(getDemoRooms().filter((demoRoom) => demoRoom.id !== room.id));
      }

      router.push('/home-map');
    } catch (deleteError) {
      // Close the dialog so the error is readable in the form it points at.
      setConfirmingDelete(false);
      setRoomFormError(deleteError instanceof Error ? deleteError.message : 'Failed to remove this room.');
    } finally {
      setRoomDeleting(false);
    }
  }

  if (!room) {
    return (
      <>
        <PageHeader title={roomError ? 'Could not load this room' : 'Room not found'} />
        <Card>
          {roomError ? (
            <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{roomError}</p>
          ) : null}
          <p style={{ color: 'var(--text-muted)' }}>
            {roomError
              ? 'Something went wrong while loading this room. Check your connection and try again.'
              : 'This room may not exist yet, or setup data was cleared.'}
          </p>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
            {dataMode === 'supabase'
              ? 'Saved to your account. If this room was removed, it will no longer appear.'
              : 'Demo data is stored only in this browser. Add rooms from the onboarding flow to continue.'}
          </p>
          <ActionLink href="/home-map" variant="secondary">Back to home map</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={room.name}
        description={`${formatEnumLabel(room.room_type)} on ${room.floor_name}`}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ActionLink href="/home-map" variant="secondary">Back to home map</ActionLink>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Room snapshot</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <UtilityBadge label={formatEnumLabel(room.room_type)} />
            <UtilityBadge label={room.floor_name} />
            <UtilityBadge label={`${roomUtilities.length} utilit${roomUtilities.length === 1 ? 'y' : 'ies'}`} />
            <UtilityBadge label={`${roomAssets.length} asset${roomAssets.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomReminders.length} reminder${roomReminders.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomRepairs.length} repair${roomRepairs.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomServiceRecords.length} service history item${roomServiceRecords.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomIssues.length} issue${roomIssues.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomTrendFlags.length} trend${roomTrendFlags.length === 1 ? '' : 's'}`} />
          </div>
          <p style={{ marginTop: 12, marginBottom: 0, color: 'var(--text-muted)' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {utilityError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {utilityError}
            </p>
          ) : null}
          {assetError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {assetError}
            </p>
          ) : null}
          {reminderError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {reminderError}
            </p>
          ) : null}
          {repairError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {repairError}
            </p>
          ) : null}
          {serviceRecordError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {serviceRecordError}
            </p>
          ) : null}
          {documentError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {documentError}
            </p>
          ) : null}
          {receiptError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {receiptError}
            </p>
          ) : null}
          {issueError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {issueError}
            </p>
          ) : null}
          {trendFlagError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {trendFlagError}
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Room details &amp; options</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Everything about this room lives here — its name and floor, the details
            a technician asks for (outlets, vents, plumbing, which breaker feeds
            it), and its closet.
          </p>
          {!access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="change this room" inline />
          ) : (
          <form onSubmit={handleSaveRoom} style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <label>
                <span>Room name</span>
                <Input
                  value={editName}
                  onChange={(event) => { setEditName(event.target.value); setRoomSaved(false); }}
                  placeholder="Primary bedroom"
                  style={{ marginTop: 6 }}
                />
              </label>
              <label>
                <span>Room type</span>
                <Select
                  value={editRoomType}
                  onChange={(event) => { setEditRoomType(event.target.value as RoomType); setRoomSaved(false); }}
                  style={{ marginTop: 6 }}
                >
                  {ROOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatEnumLabel(type)}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                <span>Floor or area</span>
                <Input
                  value={editFloorName}
                  onChange={(event) => { setEditFloorName(event.target.value); setRoomSaved(false); }}
                  placeholder="Main Floor"
                  style={{ marginTop: 6 }}
                />
              </label>
            </div>

            {isAccountRoom ? (
              <>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Notes</span>
                  <textarea
                    value={editNotes}
                    onChange={(event) => { setEditNotes(event.target.value); setRoomSaved(false); }}
                    rows={3}
                    placeholder="Anything worth remembering about this room."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      fontSize: 16,
                      fontFamily: 'var(--font-body)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-control)',
                      background: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      resize: 'vertical'
                    }}
                  />
                </label>

                <fieldset style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-control)', padding: 16, margin: 0 }}>
                  <legend style={{ padding: '0 6px', fontWeight: 600 }}>Room details</legend>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                    <label>
                      <span>Outlets</span>
                      <Input
                        value={editOutletCount}
                        onChange={(event) => { setEditOutletCount(event.target.value); setRoomSaved(false); }}
                        inputMode="numeric"
                        placeholder="6"
                        style={{ marginTop: 6 }}
                      />
                    </label>
                    <label>
                      <span>Switches</span>
                      <Input
                        value={editSwitchCount}
                        onChange={(event) => { setEditSwitchCount(event.target.value); setRoomSaved(false); }}
                        inputMode="numeric"
                        placeholder="2"
                        style={{ marginTop: 6 }}
                      />
                    </label>
                    <label>
                      <span>Vents</span>
                      <Input
                        value={editVentCount}
                        onChange={(event) => { setEditVentCount(event.target.value); setRoomSaved(false); }}
                        inputMode="numeric"
                        placeholder="1"
                        style={{ marginTop: 6 }}
                      />
                    </label>
                    <label>
                      <span>Vent type</span>
                      <Input
                        value={editVentType}
                        onChange={(event) => { setEditVentType(event.target.value); setRoomSaved(false); }}
                        placeholder="Ceiling supply"
                        style={{ marginTop: 6 }}
                      />
                    </label>
                    <label>
                      <span>Breaker label</span>
                      <Input
                        value={editBreakerLabel}
                        onChange={(event) => { setEditBreakerLabel(event.target.value); setRoomSaved(false); }}
                        placeholder="Panel A, breaker 12"
                        style={{ marginTop: 6 }}
                      />
                    </label>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                    <input
                      type="checkbox"
                      checked={editHasPlumbing}
                      onChange={(event) => { setEditHasPlumbing(event.target.checked); setRoomSaved(false); }}
                    />
                    <span style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      This room has plumbing
                    </span>
                  </label>
                </fieldset>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Notes, outlet and vent counts, and breaker labels are saved to your
                account. Sign in to record them.
              </p>
            )}

            {roomFormError ? (
              <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }} role="alert">{roomFormError}</p>
            ) : null}
            {roomSaved ? (
              <p style={{ color: 'var(--status-good)', fontWeight: 600, margin: 0 }} role="status">Room saved.</p>
            ) : null}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button type="submit" disabled={roomSaving || roomDeleting}>
                {roomSaving ? 'Saving...' : 'Save room'}
              </Button>
              <button
                type="button"
                onClick={requestDeleteRoom}
                disabled={roomSaving || roomDeleting}
                style={{
                  padding: '11px 16px',
                  minHeight: 44,
                  borderRadius: 'var(--radius-control)',
                  border: '1px solid rgba(138,46,39,0.35)',
                  background: 'rgba(138,46,39,0.08)',
                  color: 'var(--status-urgent)',
                  cursor: roomSaving || roomDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: roomSaving || roomDeleting ? 0.7 : 1
                }}
              >
                {roomDeleting ? 'Removing...' : 'Remove room'}
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
              {isAccountRoom
                ? 'Removing a room keeps everything recorded in it — utilities, appliances, repairs, reminders, service history, issues, documents, receipts, and smart devices stay in your record and simply stop naming a room.'
                : 'Removing a room here only changes this browser’s demo data. Anything recorded in it will show its room as deleted.'}
            </p>
          </form>
          )}

          <ConfirmDialog
            open={confirmingDelete}
            title={`Delete ${room.name}?`}
            description={describeDeletion()}
            confirmLabel="Delete room"
            cancelLabel="Keep room"
            busy={roomDeleting}
            onConfirm={handleDeleteRoom}
            onCancel={() => {
              if (!roomDeleting) {
                setConfirmingDelete(false);
                setDeleteLinkCounts(null);
              }
            }}
          />

          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 16, paddingTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Closet</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              Forgot to add a closet when this room was mapped? Add it now —
              &ldquo;{room.name} Closet&rdquo; becomes its own selectable space, so
              things stored in it can be filed under it.
            </p>
            {closetError ? (
              <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: '0 0 12px' }} role="alert">{closetError}</p>
            ) : null}
            {closetCreatedId ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <p style={{ color: 'var(--status-good)', fontWeight: 600, margin: 0 }} role="status">
                  Closet added to {room.floor_name === 'Unassigned' ? 'Main Floor' : room.floor_name}.
                </p>
                <ActionLink href={`/rooms/${closetCreatedId}`} variant="secondary">Open the closet</ActionLink>
              </div>
            ) : access.loading || access.canWrite ? (
              <Button type="button" variant="secondary" onClick={handleAddCloset} disabled={closetAdding}>
                {closetAdding ? 'Adding closet...' : 'Add a closet to this room'}
              </Button>
            ) : null}
          </div>
        </Card>

        <RelatedDocuments
          documents={documents}
          context={documentContext}
          uploadHref={`/documents?roomId=${roomId}`}
          empty="No documents linked to this room."
        />

        <RelatedReceipts
          receipts={receipts}
          context={receiptContext}
          uploadHref={`/receipts?roomId=${roomId}`}
          empty="No receipts linked to this room."
        />

        <Card>
          <h2 style={{ marginTop: 0 }}>Trends</h2>
          {roomTrendFlags.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No room-level trends currently.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomTrendFlags.map((flag) => (
                <div key={flag.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 600 }}>{flag.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {formatEnumLabel(flag.flag_type)} • {formatEnumLabel(flag.status)} • {formatEnumLabel(flag.severity)}
                  </div>
                  {flag.description ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>{flag.description}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        {roomUtilities.length > 0 && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Utilities in this room</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {roomUtilities.map((utility) => (
                <div
                  key={utility.id}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{utility.name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                    <UtilityBadge label={formatEnumLabel(utility.utility_type)} />
                  </div>
                  {utility.location_notes && (
                    <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                      <strong>Location:</strong> {utility.location_notes}
                    </div>
                  )}
                  {utility.emergency_notes && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--status-urgent)' }}>
                      <strong>Emergency:</strong> {utility.emergency_notes}
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <ActionLink href={`/utilities/${utility.id}`} variant="secondary">View utility</ActionLink>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {roomAssets.length > 0 && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Assets in this room</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {roomAssets.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{asset.name}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        <UtilityBadge label={formatEnumLabel(asset.asset_type)} />
                      </div>
                      {asset.brand && (
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                          <strong>Brand:</strong> {asset.brand}
                        </div>
                      )}
                      {asset.model && (
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                          <strong>Model:</strong> {asset.model}
                        </div>
                      )}
                      {asset.warranty_expires_at && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-brass-deep)', marginBottom: 4 }}>
                          <strong>Warranty expires:</strong> {asset.warranty_expires_at}
                        </div>
                      )}
                    </div>
                    <ActionLink href={`/assets/${asset.id}`} variant="secondary">View</ActionLink>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h2 style={{ marginTop: 0 }}>Repairs for this room</h2>
          {roomRepairs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No repairs linked to this room.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomRepairs
                .slice()
                .sort((a, b) => new Date(b.reported_date || b.created_at).getTime() - new Date(a.reported_date || a.created_at).getTime())
                .map((repair) => (
                  <div key={repair.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{repair.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {repair.reported_date || 'No reported date'} • {formatEnumLabel(repair.repair_type)} • {formatEnumLabel(repair.status)}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <ActionLink href={`/repairs/${repair.id}`} variant="secondary">View repair</ActionLink>
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <ActionLink href="/repairs" variant="secondary">Manage repairs</ActionLink>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Service History for this room</h2>
          {roomServiceRecords.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No service history linked to this room.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomServiceRecords
                .slice()
                .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())
                .map((record) => (
                  <div key={record.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{record.service_title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {record.service_date} • {formatEnumLabel(record.service_type)}
                    </div>
                    {record.next_service_date && (
                      <div style={{ color: 'var(--color-brass-deep)', fontSize: '0.875rem' }}>
                        Next service: {record.next_service_date}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <ActionLink href="/repairs" variant="secondary">Manage repairs</ActionLink>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Issues for this room</h2>
          {roomIssues.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No issues linked to this room.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomIssues
                .slice()
                .sort((a, b) => new Date(b.first_seen_date || b.created_at).getTime() - new Date(a.first_seen_date || a.created_at).getTime())
                .map((issue) => (
                  <div key={issue.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{issue.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {issue.first_seen_date || 'Not set'} • {formatEnumLabel(issue.issue_type)} • {formatEnumLabel(issue.status)}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <ActionLink href={`/issues/${issue.id}`} variant="secondary">View issue</ActionLink>
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <ActionLink href="/issues" variant="secondary">Manage issues</ActionLink>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Reminders for this room</h2>
          {roomReminders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No reminders linked to this room yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{reminder.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {reminder.due_date || 'No due date'} • {formatEnumLabel(reminder.status)} •{' '}
                    {formatEnumLabel(reminder.reminder_type)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <ActionLink href="/reminders" variant="secondary">Manage reminders</ActionLink>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>What will live here</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            This room will store utilities, appliances, accessories, smart devices, tools, receipts, warranties, repairs, photos, and notes.
          </p>
        </Card>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ActionLink href="/home-map" variant="secondary">Back to home map</ActionLink>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
          <ActionLink href="/utilities" variant="secondary">All utilities</ActionLink>
          <ActionLink href="/repairs" variant="secondary">All repairs</ActionLink>
          <ActionLink href="/issues" variant="secondary">All issues</ActionLink>
          <ActionLink href="/reminders" variant="secondary">All reminders</ActionLink>
          <ActionLink href="/settings" variant="secondary">Settings</ActionLink>
        </div>
      </div>
    </>
  );
}
