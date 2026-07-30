import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react';
import { getCurrentUser } from '../lib/auth';
import {
  getActivePropertyId,
  listPropertiesForUser,
  setActivePropertyId,
  sortPortfolio,
  type PropertySummary
} from '../lib/properties';

// Compact property switcher for the header. Renders nothing when signed out,
// in demo mode, or with fewer than two properties — the app then behaves
// exactly as it always has. On change it records the choice and reloads: every
// page resolves its data from the primary property, so a full reload is the
// honest way to swap the whole record over.

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0
};

function defaultPropertyId(properties: PropertySummary[], userId: string): string {
  // Mirrors loadPrimaryPropertyForUser: newest owned building/home, so the
  // select reflects what the app actually resolved when nothing is stored.
  const newestFirst = [...properties].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const owned = newestFirst.filter((property) => property.owner_user_id === userId);
  const pool = owned.length > 0 ? owned : newestFirst;
  const chosen = pool.find((property) => !property.parent_property_id) ?? pool[0];
  return chosen ? chosen.id : '';
}

function optionLabel(property: PropertySummary, byId: Map<string, PropertySummary>): string {
  if (!property.parent_property_id) {
    return property.nickname;
  }

  const parent = byId.get(property.parent_property_id);
  if (parent) {
    // Indent units under their building so the list reads building → units.
    return `  ${parent.nickname} — ${property.unit_label ?? property.nickname}`;
  }

  // Orphan unit (the user cannot see its building): show its own name.
  return property.nickname;
}

export function PropertySwitcher() {
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user || !isMounted) {
          return;
        }

        const list = sortPortfolio(await listPropertiesForUser(user.id));
        if (!isMounted) {
          return;
        }

        const storedId = getActivePropertyId();
        const stored = storedId ? list.find((property) => property.id === storedId) : undefined;

        setProperties(list);
        setActiveId(stored ? stored.id : defaultPropertyId(list, user.id));
      } catch {
        // The switcher is a convenience, not a page: stay quiet on failure and
        // let the pages themselves surface data errors.
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (properties.length < 2) {
    return null;
  }

  const byId = new Map(properties.map((property) => [property.id, property]));

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    if (!nextId || nextId === activeId) {
      return;
    }
    setActivePropertyId(nextId);
    window.location.reload();
  };

  return (
    <span>
      <label htmlFor="property-switcher" style={visuallyHidden}>
        Working in property
      </label>
      <select
        id="property-switcher"
        value={activeId}
        onChange={onChange}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          padding: '0.5rem 0.6rem',
          maxWidth: 220,
          borderRadius: 'var(--radius-control)',
          border: '1px solid rgba(227,194,136,0.3)',
          background: 'var(--surface-card)',
          color: 'var(--color-ink)',
          cursor: 'pointer'
        }}
      >
        {properties.map((property) => (
          <option key={property.id} value={property.id}>
            {optionLabel(property, byId)}
          </option>
        ))}
      </select>
    </span>
  );
}
