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

  const isActiveRoute = (path: string) => {
    if (path === '/') return router.pathname === '/';
    return router.pathname === path || router.pathname.startsWith(`${path}/`);
  };

  const sectionMatches = (section: NavSection) => {
    if (section.href === '/dashboard') {
      return isActiveRoute('/dashboard');
    }

    return section.activeRoutes.some((path) => isActiveRoute(path));
  };

  const navLinkClass = (section: NavSection) =>
    `px-3 py-2 rounded ${sectionMatches(section) ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:text-gray-900'}`;

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
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-gray-600">
                {userEmail ? 'Saved to your account.' : 'Demo data is stored only in this browser.'}
              </span>
              {userEmail ? (
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
              ) : (
                <>
                  <Link href="/sign-in" className="px-3 py-2 rounded text-gray-600 hover:text-gray-900">
                    Sign in
                  </Link>
                  <Link href="/sign-up" className="px-3 py-2 rounded text-gray-600 hover:text-gray-900">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="desktop-primary-nav flex gap-2 text-sm flex-wrap">
            {desktopSections.map((section) => (
              <Link key={section.href} href={section.href} className={navLinkClass(section)}>
                {section.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="p-6 app-main">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>

      <nav className="mobile-bottom-nav bg-white shadow-sm border-t border-gray-200">
        {mobileSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className={`mobile-bottom-link ${sectionMatches(section) ? 'bg-amber-100 text-amber-900' : 'text-gray-600'}`}
          >
            <span aria-hidden="true">{section.icon}</span>
            <span>{section.mobileLabel || section.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

type NavSection = {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: string;
  activeRoutes: string[];
};

const desktopSections: NavSection[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'D',
    activeRoutes: ['/dashboard']
  },
  {
    href: '/home',
    label: 'Home',
    icon: 'H',
    activeRoutes: ['/home', '/home-map', '/create-property', '/add-rooms', '/rooms', '/utilities']
  },
  {
    href: '/assets',
    label: 'Assets',
    icon: 'A',
    activeRoutes: ['/assets']
  },
  {
    href: '/maintenance',
    label: 'Maintenance',
    mobileLabel: 'Care',
    icon: 'M',
    activeRoutes: ['/maintenance', '/warranties', '/reminders', '/repairs', '/issues', '/receipts']
  },
  {
    href: '/documents',
    label: 'Documents',
    icon: 'Docs',
    activeRoutes: ['/documents']
  },
  {
    href: '/more',
    label: 'More',
    icon: '...',
    activeRoutes: ['/more', '/handover', '/sharing', '/settings', '/mvp-test', '/sign-in', '/sign-up']
  }
];

const mobileSections = desktopSections.filter((section) => section.href !== '/documents');
