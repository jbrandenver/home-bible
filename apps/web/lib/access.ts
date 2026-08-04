import { useEffect, useState } from 'react';
import { getCurrentPropertyRole } from './sharing';
import { getActivePropertyId, getPrimaryPropertyForUser } from './properties';
import { getCurrentUser } from './auth';
import type { SharingRole } from './sharing';

// What a role may do, in one place.
//
// A viewer used to be shown every Add and Save button in the app, click one,
// and get "new row violates row-level security policy for table utilities"
// back. The database was right to refuse; offering the action at all was the
// mistake. Roles below the line can read a home and nothing else.
const WRITE_ROLES: readonly string[] = ['owner', 'co_owner', 'editor'];

export function roleCanWrite(role: SharingRole | null): boolean {
  return role !== null && WRITE_ROLES.includes(role);
}

export type PropertyAccess = {
  /** Still resolving. Render neither the form nor the refusal yet. */
  loading: boolean;
  role: SharingRole | null;
  canWrite: boolean;
  /** Browser-only demo data: it is theirs, so they may always change it. */
  isDemo: boolean;
};

const DEMO_ACCESS: PropertyAccess = { loading: false, role: null, canWrite: true, isDemo: true };

/**
 * What the signed-in person may do to the home they are currently working in.
 *
 * Deliberately fails OPEN. This is a courtesy, not a security control — the
 * database refuses the write either way. Hiding a control because we could not
 * determine a role would take editing away from a legitimate editor whenever
 * the auth client is slow, which is a worse failure than showing a button that
 * turns out to be refused with a message that now explains itself.
 */
export function usePropertyAccess(): PropertyAccess {
  const [access, setAccess] = useState<PropertyAccess>({
    loading: true,
    role: null,
    canWrite: false,
    isDemo: false
  });

  useEffect(() => {
    let isMounted = true;

    async function resolve() {
      try {
        const user = await getCurrentUser();
        if (!isMounted) return;

        if (!user) {
          // Signed out means demo mode, which is the visitor's own browser copy.
          setAccess(DEMO_ACCESS);
          return;
        }

        const activeId = getActivePropertyId();
        const property = activeId ? { id: activeId } : await getPrimaryPropertyForUser(user.id);
        if (!isMounted) return;

        if (!property) {
          // No home yet: nothing to be read-only about, and the create flows
          // have their own empty states.
          setAccess({ loading: false, role: null, canWrite: true, isDemo: false });
          return;
        }

        const role = await getCurrentPropertyRole(property.id);
        if (!isMounted) return;

        setAccess({ loading: false, role, canWrite: roleCanWrite(role), isDemo: false });
      } catch {
        if (isMounted) {
          setAccess({ loading: false, role: null, canWrite: true, isDemo: false });
        }
      }
    }

    resolve();
    return () => {
      isMounted = false;
    };
  }, []);

  return access;
}

/** How to describe a role to the person holding it. */
export function describeRole(role: SharingRole | null): string {
  switch (role) {
    case 'viewer':
      return 'view-only access';
    case 'maintenance_guest':
      return 'maintenance access';
    case 'buyer_preview':
      return 'buyer preview access';
    case 'insurance_view':
      return 'insurance view access';
    default:
      return 'view-only access';
  }
}
