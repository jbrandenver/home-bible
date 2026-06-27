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

  const isActive = (path: string) => router.pathname === path;

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
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-lg font-semibold text-amber-700">
              Home Bible
            </Link>
            <div className="text-sm text-gray-600">
              {userEmail ? `Signed in: ${userEmail}` : 'Demo mode'}
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <Link
              href="/"
              className={`px-3 py-2 rounded ${
                isActive('/') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Home
            </Link>
            <Link
              href="/create-property"
              className={`px-3 py-2 rounded ${
                isActive('/create-property') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Create Property
            </Link>
            <Link
              href="/dashboard"
              className={`px-3 py-2 rounded ${
                isActive('/dashboard') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/handover"
              className={`px-3 py-2 rounded ${
                isActive('/handover') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Handover
            </Link>
            <Link
              href="/sharing"
              className={`px-3 py-2 rounded ${
                isActive('/sharing') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sharing
            </Link>
            <Link
              href="/home-map"
              className={`px-3 py-2 rounded ${
                isActive('/home-map') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Home Map
            </Link>
            <Link
              href="/add-rooms"
              className={`px-3 py-2 rounded ${
                isActive('/add-rooms') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Add Rooms
            </Link>
            <Link
              href="/utilities"
              className={`px-3 py-2 rounded ${
                isActive('/utilities') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Utilities
            </Link>
            <Link
              href="/assets"
              className={`px-3 py-2 rounded ${
                isActive('/assets') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Assets
            </Link>
            <Link
              href="/warranties"
              className={`px-3 py-2 rounded ${
                isActive('/warranties') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Warranties
            </Link>
            <Link
              href="/documents"
              className={`px-3 py-2 rounded ${
                isActive('/documents') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Documents
            </Link>
            <Link
              href="/receipts"
              className={`px-3 py-2 rounded ${
                isActive('/receipts') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Receipts
            </Link>
            <Link
              href="/reminders"
              className={`px-3 py-2 rounded ${
                isActive('/reminders') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Reminders
            </Link>
            <Link
              href="/repairs"
              className={`px-3 py-2 rounded ${
                isActive('/repairs') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Repairs
            </Link>
            <Link
              href="/issues"
              className={`px-3 py-2 rounded ${
                isActive('/issues') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Issues
            </Link>
            {userEmail ? (
              <>
                <Link
                  href="/settings"
                  className={`px-3 py-2 rounded ${
                    isActive('/settings') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Account
                </Link>
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
              <Link
                href="/sign-in"
                className={`px-3 py-2 rounded ${
                  isActive('/sign-in') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sign in
              </Link>
            )}
            <Link
              href="/settings"
              className={`px-3 py-2 rounded ${
                isActive('/settings') ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Settings
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
