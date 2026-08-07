// The network's equipment, addressing and recovery details.
//
// This block was written out twice — once on the networks list page and once
// on a network's own page — and the two copies had already drifted: the detail
// page had quietly lost recovery instructions, the credential reference and
// notes, so a field you could fill in on one screen did not exist on the
// other. One component, one set of fields, both places.
//
// The two callers store the values differently (one in a details bag, one on
// the row itself), so the interface is a getter and a setter rather than a
// shape.

import { Input } from '@home-folder/ui';

type NetworkDetailFieldsProps = {
  summary?: string;
  value: (key: string) => string;
  onChange: (key: string, next: string) => void;
  disabled?: boolean;
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 54,
  marginTop: 6,
  padding: 10
};

/** Short, single-line facts about the hardware and the addressing. */
const SHORT_FIELDS: ReadonlyArray<{ key: string; label: string; placeholder?: string }> = [
  { key: 'router_model', label: 'Router model' },
  { key: 'modem', label: 'Modem' },
  { key: 'mesh_system', label: 'Mesh system' },
  { key: 'access_points', label: 'Access points' },
  { key: 'gateway', label: 'Gateway address', placeholder: '192.168.1.1' },
  { key: 'subnet', label: 'Subnet' },
  { key: 'vlan', label: 'VLAN' },
  { key: 'dhcp_range', label: 'DHCP range' },
  { key: 'backup_internet', label: 'Backup internet' },
  { key: 'ups_backup', label: 'Battery backup (UPS)' }
];

const LONG_FIELDS: ReadonlyArray<{ key: string; label: string; placeholder?: string }> = [
  { key: 'dns_notes', label: 'DNS notes' },
  // Reference only, never a secret: migration-era copy that must stay put.
  { key: 'security_notes', label: 'Security notes (reference only — never a password)' },
  { key: 'setup_instructions', label: 'Setup instructions' },
  {
    key: 'recovery_instructions',
    label: 'Recovery instructions (shown in the emergency guide)',
    placeholder: 'Power-cycle the modem, then the router; wait 3 min.'
  },
  { key: 'notes', label: 'Notes' }
];

export function NetworkDetailFields({
  summary = 'Equipment, addressing & recovery (optional)',
  value,
  onChange,
  disabled = false
}: NetworkDetailFieldsProps) {
  return (
    <details>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{summary}</summary>

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          marginTop: 12
        }}
      >
        {SHORT_FIELDS.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <Input
              value={value(field.key)}
              onChange={(event) => onChange(field.key, event.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
              style={{ marginTop: 6 }}
            />
          </label>
        ))}
      </div>

      {LONG_FIELDS.map((field) => (
        <label key={field.key} style={{ display: 'block', marginTop: 12 }}>
          <span>{field.label}</span>
          <textarea
            value={value(field.key)}
            onChange={(event) => onChange(field.key, event.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            style={textareaStyle}
          />
        </label>
      ))}

      <label style={{ display: 'block', marginTop: 12 }}>
        <span>Where credentials are stored (reference only — never the Wi-Fi password)</span>
        <Input
          value={value('credential_reference')}
          onChange={(event) => onChange('credential_reference', event.target.value)}
          placeholder="1Password › Home Wi-Fi"
          disabled={disabled}
          style={{ marginTop: 6 }}
        />
      </label>
    </details>
  );
}
