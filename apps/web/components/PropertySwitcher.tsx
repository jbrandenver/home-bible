import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/router';
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

function optionLabel(
  property: PropertySummary,
  byId: Map<string, PropertySummary>,
  viewerId: string
): string {
  // Mark homes belonging to somebody else. Without it a shared home reads as
  // your own, which is both confusing and quietly misleading about what you
  // are allowed to change.
  const suffix = viewerId && property.owner_user_id !== viewerId ? ' · shared with me' : '';

  if (!property.parent_property_id) {
    return property.nickname + suffix;
  }

  const parent = byId.get(property.parent_property_id);
  if (parent) {
    // Indent units under their building so the list reads building → units.
    return `  ${parent.nickname} — ${property.unit_label ?? property.nickname}`;
  }

  // Orphan unit (the user cannot see its building): show its own name.
  return property.nickname + suffix;
}

// Sentinel value: an action rather than a home.
const ADD_HOME = '__add_home__';

export function PropertySwitcher() {
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [activeId, setActiveId] = useState('');
  const [viewerId, setViewerId] = useState('');
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user || !isMounted) {
          return;
        }

        // Archived homes are set aside — they don't belong in the switcher.
        const list = sortPortfolio(
          (await listPropertiesForUser(user.id)).filter((property) => !property.archived_at)
        );
        if (!isMounted) {
          return;
        }

        const storedId = getActivePropertyId();
        const stored = storedId ? list.find((property) => property.id === storedId) : undefined;

        setViewerId(user.id);
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
  }, [
    // The Layout (and this switcher) lives in _app and survives client-side
    // navigation, so a once-per-mount load showed a list from minutes ago —
    // a just-created building and its units were simply absent (founder QA,
    // 2026-08-04). Re-list on every route change; the query is two cheap
    // selects.
    router.asPath
  ]);

  // Shown from the first home onward, not the second. Someone whose only home
  // is one shared with them used to see no control at all — which reads as
  // "this is your home" and hides both the fact that it is not, and the fact
  // that they can add their own.
  if (properties.length === 0) {
    return null;
  }

  const byId = new Map(properties.map((property) => [property.id, property]));

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    if (!nextId || nextId === activeId) {
      return;
    }
    if (nextId === ADD_HOME) {
      window.location.href = '/create-property';
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
            {optionLabel(property, byId, viewerId)}
          </option>
        ))}
        <option value={ADD_HOME}>+ Add a home of my own</option>
      </select>
    </span>
  );
}
