import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getCurrentUser, onAuthStateChange, signOut } from '../lib/auth';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const isActive = (path: string) => {
    if (path === '/') return router.pathname === '/';
    return router.pathname === path || router.pathname.startsWith(`${path}/`);
  };

  const navLinkClass = (path: string) =>
    `px-3 py-2 rounded ${isActive(path) ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'}`;

  useEffect(() => {
    let isMounted = true;

    getCurrentUser().then((user) => {
      if (isMounted) {
        setUserEmail(user?.email ?? null);
      }
    });

    const unsubscribe = onAuthStateChange((user) => {
      setUserEmail(user?.email ?? null);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <Link href="/" className="text-lg font-semibold text-amber-700">
              Home Bible
            </Link>
            <div className="text-sm text-gray-600">
              {userEmail ? `Signed in: ${userEmail}` : 'Demo mode'}
            </div>
          </div>
          <div className="flex gap-2 text-sm flex-wrap">
            <Link
              href="/"
              className={navLinkClass('/')}
            >
              Home
            </Link>
            <Link
              href="/create-property"
              className={navLinkClass('/create-property')}
            >
              Create Property
            </Link>
            <Link
              href="/dashboard"
              className={navLinkClass('/dashboard')}
            >
              Dashboard
            </Link>
            <Link
              href="/handover"
              className={navLinkClass('/handover')}
            >
              Handover
            </Link>
            <Link
              href="/sharing"
              className={navLinkClass('/sharing')}
            >
              Sharing
            </Link>
            <Link
              href="/home-map"
              className={navLinkClass('/home-map')}
            >
              Home Map
            </Link>
            <Link
              href="/add-rooms"
              className={navLinkClass('/add-rooms')}
            >
              Add Rooms
            </Link>
            <Link
              href="/utilities"
              className={navLinkClass('/utilities')}
            >
              Utilities
            </Link>
            <Link
              href="/assets"
              className={navLinkClass('/assets')}
            >
              Assets
            </Link>
            <Link
              href="/warranties"
              className={navLinkClass('/warranties')}
            >
              Warranties
            </Link>
            <Link
              href="/documents"
              className={navLinkClass('/documents')}
            >
              Documents
            </Link>
            <Link
              href="/receipts"
              className={navLinkClass('/receipts')}
            >
              Receipts
            </Link>
            <Link
              href="/reminders"
              className={navLinkClass('/reminders')}
            >
              Reminders
            </Link>
            <Link
              href="/repairs"
              className={navLinkClass('/repairs')}
            >
              Repairs
            </Link>
            <Link
              href="/issues"
              className={navLinkClass('/issues')}
            >
              Issues
            </Link>
            {userEmail ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    router.push('/sign-in');
                  }}
                  className="px-3 py-2 rounded text-gray-600 hover:text-gray-900"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={navLinkClass('/sign-in')}
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className={navLinkClass('/sign-up')}
                >
                  Sign up
                </Link>
              </>
            )}
            <Link
              href="/settings"
              className={navLinkClass('/settings')}
            >
              {userEmail ? 'Account' : 'Settings'}
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="p-6">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
};
