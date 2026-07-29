import React from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
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

function sectionHref(section: NavSection, item: NavSectionLink) {
  return item.hash ? `${section.href}#${item.hash}` : section.href;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  // Any navigation (including hash jumps) closes an open section menu.
  useEffect(() => {
    setOpenMenu(null);
  }, [router.asPath]);

  // Click/tap outside closes the open section menu.
  useEffect(() => {
    if (!openMenu) {
      return;
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-nav-menu]')) {
        return;
      }
      setOpenMenu(null);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [openMenu]);

  const handleMenuKeyDown = (menuKey: string) => (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && openMenu === menuKey) {
      event.stopPropagation();
      setOpenMenu(null);
      menuTriggerRefs.current[menuKey]?.focus();
    }
  };

  const renderMenuItems = (section: NavSection) =>
    (section.sections ?? []).map((item) => (
      <Link
        key={item.label}
        href={sectionHref(section, item)}
        className="nav-dropdown-item"
        onClick={() => setOpenMenu(null)}
      >
        {item.label}
      </Link>
    ));

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
            {desktopSections.map((section) => {
              if (!section.sections) {
                return (
                  <Link key={section.href} href={section.href} className={navLinkClass(section)}>
                    {section.label}
                  </Link>
                );
              }

              const menuKey = `desktop:${section.href}`;
              const menuId = `desktop-menu${section.href.replace(/\//g, '-')}`;
              const isOpen = openMenu === menuKey;

              return (
                <div
                  key={section.href}
                  className="nav-menu-wrap"
                  data-nav-menu
                  onKeyDown={handleMenuKeyDown(menuKey)}
                >
                  <Link href={section.href} className={navLinkClass(section)}>
                    {section.label}
                  </Link>
                  <button
                    type="button"
                    className="desktop-nav-link nav-menu-trigger"
                    aria-expanded={isOpen}
                    aria-controls={menuId}
                    aria-label={`${section.label} sections`}
                    ref={(element) => {
                      menuTriggerRefs.current[menuKey] = element;
                    }}
                    onClick={() => setOpenMenu(isOpen ? null : menuKey)}
                  >
                    <span aria-hidden="true">▾</span>
                  </button>
                  {isOpen ? (
                    <div id={menuId} className="nav-dropdown nav-dropdown-desktop">
                      {renderMenuItems(section)}
                    </div>
                  ) : null}
                </div>
              );
            })}
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
        {mobileSections.map((section) => {
          const activeClass = sectionMatches(section) ? 'mobile-bottom-link-active' : '';

          if (!section.sections) {
            return (
              <Link
                key={section.href}
                href={section.href}
                className={`mobile-bottom-link ${activeClass}`}
              >
                <span aria-hidden="true">{section.icon}</span>
                <span>{section.mobileLabel || section.label}</span>
              </Link>
            );
          }

          const menuKey = `mobile:${section.href}`;
          const menuId = `mobile-menu${section.href.replace(/\//g, '-')}`;
          const isOpen = openMenu === menuKey;

          return (
            <div
              key={section.href}
              className="mobile-menu-wrap"
              data-nav-menu
              onKeyDown={handleMenuKeyDown(menuKey)}
            >
              <button
                type="button"
                className={`mobile-bottom-link mobile-menu-trigger ${activeClass}`}
                aria-expanded={isOpen}
                aria-controls={menuId}
                ref={(element) => {
                  menuTriggerRefs.current[menuKey] = element;
                }}
                onClick={() => setOpenMenu(isOpen ? null : menuKey)}
              >
                <span aria-hidden="true">{section.icon}</span>
                <span>{section.mobileLabel || section.label}</span>
              </button>
              {isOpen ? (
                <div id={menuId} className="nav-dropdown mobile-nav-sheet">
                  {renderMenuItems(section)}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </div>
  );
};

type NavSectionLink = {
  label: string;
  /** Anchor id on the section's page; omitted = top of the page. */
  hash?: string;
};

type NavSection = {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: string;
  activeRoutes: string[];
  /** When present, the tab gets a jump menu listing the page's sections. */
  sections?: NavSectionLink[];
};

const desktopSections: NavSection[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'D',
    activeRoutes: ['/dashboard'],
    sections: [
      { label: 'Overview' },
      { label: 'Home record', hash: 'home-record' },
      { label: 'This week at home', hash: 'this-week' },
      { label: 'Rooms & spaces', hash: 'rooms-spaces' },
      { label: 'Critical utilities', hash: 'critical-utilities' },
      { label: 'Home handover', hash: 'handover' },
      { label: 'Sharing review', hash: 'sharing' },
      { label: 'Service history', hash: 'service-history' },
      { label: 'Recent documents', hash: 'recent-documents' },
      { label: 'Recent receipts', hash: 'recent-receipts' },
      { label: 'Trends', hash: 'trends' },
      { label: 'Warranty summary', hash: 'warranties' },
      { label: 'Reminder summary', hash: 'reminders' },
      { label: 'All rooms & spaces', hash: 'room-list' }
    ]
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
    activeRoutes: ['/more', '/handover', '/sharing', '/settings', '/mvp-test', '/sign-in', '/sign-up'],
    sections: [
      { label: 'Overview' },
      { label: 'Files', hash: 'files' },
      { label: 'Records', hash: 'records' },
      { label: 'Review tools', hash: 'review-tools' },
      { label: 'Account', hash: 'account' },
      { label: 'Legal', hash: 'legal' }
    ]
  }
];

const mobileSections = desktopSections.filter((section) => section.href !== '/documents');
