import React from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getCurrentUser, onAuthStateChange, signOut } from '../lib/auth';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

/** Fallback page title from the route (WCAG 2.4.2) — public pages override it
 *  with their own <Seo> title, which renders after this and wins. */
function deriveTitle(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return 'Home';
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
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
      <Head>
        <title>{`${title ?? deriveTitle(router.pathname)} · Our Home Folder`}</title>
      </Head>
      {/* Skip link — first focusable element (WCAG 2.4.1). */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* gilt page edge */}
      <div className="app-gilt" aria-hidden="true" />
      {/* Navigation header */}
      <nav className="app-header shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <Link href="/" className="brand-lockup">
              <span className="brand-wordmark">
                <span>Our Home</span>
                <span className="brand-wordmark-accent">Folder</span>
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
      <main id="main-content" className="p-6 app-main">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>

      {/* Legal footer */}
      <footer className="app-footer">
        <div className="max-w-6xl mx-auto px-6">
          <div className="app-footer-inner">
            <span className="app-footer-copy">© {new Date().getFullYear()} JBran LLC. Our Home Folder™ — all rights reserved.</span>
            <nav className="app-footer-links" aria-label="Legal">
              <Link href="/terms">Terms of Service</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/settings">Account</Link>
              <a href="mailto:support@ourhomefolder.com?subject=Our%20Home%20Folder%20problem%20report">Report a problem</a>
            </nav>
          </div>
        </div>
      </footer>

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
    activeRoutes: ['/home', '/home-map', '/create-property', '/add-rooms', '/rooms', '/utilities', '/automation']
  },
  {
    href: '/assets',
    label: 'Assets',
    icon: 'A',
    activeRoutes: ['/assets', '/tools', '/inventory']
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
