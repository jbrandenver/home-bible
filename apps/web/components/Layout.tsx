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
    `desktop-nav-link px-3 py-2 rounded ${sectionMatches(section) ? 'desktop-nav-link-active' : ''}`;

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
    <div className="app-shell">
      {/* Navigation header */}
      <nav className="app-header shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <Link href="/" className="brand-lockup">
              <span className="brand-wordmark">
                <span>Home</span>
                <span className="brand-wordmark-accent">Bible</span>
              </span>
              <span className="brand-tagline">A home, documented.</span>
            </Link>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="header-meta">
                {userEmail ? "Everything's saved to your account." : 'Demo data is stored only in this browser.'}
              </span>
              {userEmail ? (
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    router.push('/sign-in');
                  }}
                  className="header-action px-3 py-2 rounded"
                >
                  Sign out
                </button>
              ) : (
                <>
                  <Link href="/sign-in" className="header-action px-3 py-2 rounded">
                    Sign in
                  </Link>
                  <Link href="/sign-up" className="header-action px-3 py-2 rounded">
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
            className={`mobile-bottom-link ${sectionMatches(section) ? 'mobile-bottom-link-active' : ''}`}
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
