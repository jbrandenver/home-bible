import { useId } from 'react';
import { Input, Select } from '@home-folder/ui';
import {
  LOCATION_CUSTOM_VALUE,
  customLocationValue,
  getGroupedLocationPresets,
  isCustomLocationValue
} from '../lib/locationPresets';
import { formatRoomLocation } from '../lib/roomLabels';

type RoomOption = { id: string; name: string; room_type?: string | null; floor_name?: string | null };

type Props = {
  /** Existing rooms for the active property. */
  rooms: RoomOption[];
  /** Current dropdown value: a room id, a preset value, or the custom marker. */
  value: string;
  onChange: (value: string) => void;
  /** Name typed into the "new room" field; owned by the parent so it survives re-renders. */
  customName: string;
  onCustomNameChange: (name: string) => void;
  label?: string;
  emptyLabel?: string;
  disabled?: boolean;
};

/**
 * One room picker for every form that stores a room_id.
 *
 * The problem it solves: people fill in a device, appliance, or repair and
 * discover the room it lives in was never mapped. Before this, they had to
 * abandon the form, create the room elsewhere, and start over. Here they can
 * pick a common room, an outdoor spot, or type a name — the room is created
 * on save (and rolled back if the save fails), so nothing is half-written.
 */
export function RoomLocationSelect({
  rooms,
  value,
  onChange,
  customName,
  onCustomNameChange,
  label = 'Room or location',
  emptyLabel = 'No room yet',
  disabled
}: Props) {
  const selectId = useId();
  const customId = `${selectId}-custom`;
  const grouped = getGroupedLocationPresets(rooms);
  const showCustom = isCustomLocationValue(value);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label htmlFor={selectId} style={{ fontWeight: 600 }}>
        {label}
      </label>
      <Select
        id={selectId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {rooms.length > 0 ? (
          <optgroup label="Rooms already on file">
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {formatRoomLocation(room)}
              </option>
            ))}
          </optgroup>
        ) : null}
        {grouped.indoor.length > 0 ? (
          <optgroup label="Add a room inside">
            {grouped.indoor.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </optgroup>
        ) : null}
        {grouped.outdoor.length > 0 ? (
          <optgroup label="Add an outdoor spot">
            {grouped.outdoor.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </optgroup>
        ) : null}
        <optgroup label="Something else">
          <option value={LOCATION_CUSTOM_VALUE}>Name a new room…</option>
        </optgroup>
      </Select>

      {showCustom ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor={customId} style={{ fontSize: '0.9rem' }}>
            What is this room called?
          </label>
          <Input
            id={customId}
            value={customName}
            disabled={disabled}
            placeholder="Guest bedroom"
            onChange={(event) => onCustomNameChange(event.target.value)}
          />
        </div>
      ) : null}

      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        New rooms and spots join your home record when you save.
      </p>
    </div>
  );
}

/**
 * Turn the picker's state into the value resolveLocationRoomId expects.
 * Returns null when the user chose "name a new room" but typed nothing —
 * callers surface that as a validation message rather than saving a blank.
 */
export function roomSelectionValue(value: string, customName: string): string | null {
  if (!isCustomLocationValue(value)) {
    return value;
  }

  const trimmed = customName.trim();
  return trimmed ? customLocationValue(trimmed) : null;
}
