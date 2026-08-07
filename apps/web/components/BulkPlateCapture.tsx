// Walking the house with a camera instead of a keyboard.
//
// Recording ten appliances one at a time means ten trips through a form. This
// takes ten photos in a row, turns each into a draft, and saves them together
// once they have been looked over.
//
// Nothing is written until the person presses save. The scan is a suggestion —
// a serial number misread off a worn label and saved silently would be worse
// than no serial at all, because nobody re-reads a field that looks filled in.

import { useState } from 'react';
import { Button, Card, Input, Select } from '@home-folder/ui';
import { PlateScanButton } from './PlateScanButton';
import { draftAssetNameFrom } from '../lib/derivations';
import { createAssetForContext, type AssetDataContext } from '../lib/assets';
import { formatRoomLocation } from '../lib/roomLabels';
import type { PlateScanResult } from '../lib/plateScan';

type Room = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

type Draft = {
  key: string;
  name: string;
  brand: string;
  model: string;
  serial_number: string;
  room_id: string;
  confidence: PlateScanResult['confidence'];
};

type BulkPlateCaptureProps = {
  context: AssetDataContext | null;
  rooms: Room[];
  signedIn: boolean;
  onSaved: (count: number) => void;
};

export function BulkPlateCapture({ context, rooms, signedIn, onSaved }: BulkPlateCaptureProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Applied to each new draft, so a whole room can be captured without
  // re-picking the room every time.
  const [roomForNext, setRoomForNext] = useState('');

  const addDraft = (result: PlateScanResult) => {
    setDrafts((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        name: draftAssetNameFrom(result.brand, result.model_number) ?? '',
        brand: result.brand ?? '',
        model: result.model_number ?? '',
        serial_number: result.serial_number ?? '',
        room_id: roomForNext,
        confidence: result.confidence
      }
    ]);
  };

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));

  const remove = (key: string) => setDrafts((current) => current.filter((draft) => draft.key !== key));

  const unnamed = drafts.filter((draft) => !draft.name.trim()).length;

  const saveAll = async () => {
    if (!context || drafts.length === 0) return;

    if (unnamed > 0) {
      setError(`Give ${unnamed === 1 ? 'the unnamed item' : `all ${unnamed} unnamed items`} a name before saving.`);
      return;
    }

    setSaving(true);
    setError('');

    let saved = 0;
    const failed: Draft[] = [];

    for (const draft of drafts) {
      try {
        await createAssetForContext(context, {
          asset_type: 'appliance',
          name: draft.name.trim(),
          brand: draft.brand.trim() || null,
          model: draft.model.trim() || null,
          serial_number: draft.serial_number.trim() || null,
          purchase_date: null,
          purchase_price: null,
          retailer: null,
          warranty_length_months: null,
          warranty_expires_at: null,
          manual_url: null,
          support_url: null,
          notes: null,
          room_id: draft.room_id || null,
          visibility_contexts: ['personal_archive']
        });
        saved += 1;
      } catch {
        // One bad row must not discard the other nine photos somebody walked
        // the house to take. Keep it on screen and report honestly.
        failed.push(draft);
      }
    }

    setDrafts(failed);
    setSaving(false);

    if (failed.length > 0) {
      setError(
        `Saved ${saved}. ${failed.length} could not be saved and ${failed.length === 1 ? 'is' : 'are'} still listed below.`
      );
    }

    if (saved > 0) {
      onSaved(saved);
    }
  };

  return (
    <Card>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>Record several at once</h2>
      <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
        Photograph one data plate after another — the boiler, the washing machine, the fridge.
        Each becomes a draft below. Nothing is saved until you have looked them over.
      </p>

      {rooms.length > 0 ? (
        <label style={{ display: 'grid', gap: 6, maxWidth: 320, marginBottom: 12 }}>
          <span style={{ fontWeight: 600 }}>Room for the next photos</span>
          <Select value={roomForNext} onChange={(event) => setRoomForNext(event.target.value)}>
            <option value="">No room</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {formatRoomLocation(room)}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      <PlateScanButton
        signedIn={signedIn}
        label={drafts.length > 0 ? 'Photograph the next one' : 'Photograph the first one'}
        hint="One plate per photo. Get the label filling most of the frame."
        onScanned={addDraft}
        disabled={saving}
      />

      {error ? (
        <p role="alert" style={{ color: 'var(--status-urgent)', fontWeight: 600 }}>
          {error}
        </p>
      ) : null}

      {drafts.length > 0 ? (
        <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
          <p aria-live="polite" style={{ margin: 0, fontWeight: 700 }}>
            {drafts.length} {drafts.length === 1 ? 'item' : 'items'} ready to save.
          </p>

          {drafts.map((draft, index) => (
            <div
              key={draft.key}
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-card)',
                padding: 12,
                display: 'grid',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <strong>Item {index + 1}</strong>
                {draft.confidence !== 'high' ? (
                  <span style={{ color: 'var(--color-clay)', fontSize: 14 }}>
                    Read with {draft.confidence} confidence — worth checking.
                  </span>
                ) : null}
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Name</span>
                <Input
                  value={draft.name}
                  onChange={(event) => update(draft.key, { name: event.target.value })}
                  placeholder="Nothing legible — what is it?"
                />
              </label>

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Brand</span>
                  <Input value={draft.brand} onChange={(event) => update(draft.key, { brand: event.target.value })} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Model</span>
                  <Input value={draft.model} onChange={(event) => update(draft.key, { model: event.target.value })} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Serial number</span>
                  <Input
                    value={draft.serial_number}
                    onChange={(event) => update(draft.key, { serial_number: event.target.value })}
                  />
                </label>
                {rooms.length > 0 ? (
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Room</span>
                    <Select
                      value={draft.room_id}
                      onChange={(event) => update(draft.key, { room_id: event.target.value })}
                    >
                      <option value="">No room</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {formatRoomLocation(room)}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : null}
              </div>

              <div>
                <Button type="button" variant="secondary" disabled={saving} onClick={() => remove(draft.key)}>
                  Discard this one
                </Button>
              </div>
            </div>
          ))}

          <div>
            <Button type="button" disabled={saving || !context} onClick={saveAll}>
              {saving ? 'Saving…' : `Save ${drafts.length} ${drafts.length === 1 ? 'item' : 'items'}`}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
