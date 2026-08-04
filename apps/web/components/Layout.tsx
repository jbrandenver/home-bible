import React from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { getCurrentUser, onAuthStateChange, signOut } from '../lib/auth';
import { PUBLIC_ROUTES } from '../lib/seo';
import { BrandMark } from './BrandMark';
import { PropertySwitcher } from './PropertySwitcher';

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
  if (item.href) {
    return item.href;
  }
  return item.hash ? `${section.href}#${item.hash}` : section.href;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Route transitions keep the outgoing page mounted until the incoming
  // page's code and data arrive — without a signal, the old content reads as
  // a glitchy flash of "previous items" (launch QA 2026-08-03). The gilt
  // progress rule appears the instant a navigation starts.
  const [navigating, setNavigating] = useState(false);
  const menuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // On the public marketing/legal surface a signed-out visitor gets a clean
  // masthead — no app navigation, property switcher, or demo-storage note.
  // The app chrome returns the moment they enter the app (or sign in).
  const isPublicSurface =
    (PUBLIC_ROUTES.includes(router.pathname) ||
      ['/data-promise', '/forgot-password', '/reset-password'].includes(router.pathname)) &&
    !userEmail;

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

  useEffect(() => {
    const start = (_url: string, { shallow }: { shallow: boolean }) => {
      if (!shallow) {
        setNavigating(true);
      }
    };
    const done = () => setNavigating(false);

    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', done);
    router.events.on('routeChangeError', done);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', done);
      router.events.off('routeChangeError', done);
    };
  }, [router.events]);

  // Section anchors live inside cards that only render after their page's data
  // has loaded, so arriving from another page with a #hash scrolled to nothing.
  // Retry briefly until the target exists.
  useEffect(() => {
    const hash = router.asPath.split('#')[1];
    if (!hash) {
      return;
    }

    let attempts = 0;
    const timer = window.setInterval(() => {
      const target = document.getElementById(hash);
      attempts += 1;

      if (target) {
        target.scrollIntoView();
        window.clearInterval(timer);
        return;
      }

      // ~3s of retries, then give up rather than spin forever.
      if (attempts > 30) {
        window.clearInterval(timer);
      }
    }, 100);

    return () => window.clearInterval(timer);
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
    if (openMenu !== menuKey) {
      return;
    }

    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpenMenu(null);
      menuTriggerRefs.current[menuKey]?.focus();
      return;
    }

    // Arrow keys move within the menu, per the WAI-ARIA menu button pattern.
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }

    const container = (event.currentTarget as HTMLElement).querySelector('[data-nav-dropdown]');
    const items = container ? Array.from(container.querySelectorAll<HTMLAnchorElement>('a')) : [];
    if (items.length === 0) {
      return;
    }

    event.preventDefault();
    const current = items.findIndex((item) => item === document.activeElement);

    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1 + items.length) % items.length
            : (current - 1 + items.length) % items.length;

    items[nextIndex]?.focus();
  };

  // Opening with the keyboard should land focus on the first item; opening with
  // a pointer should not steal it.
  const openMenuWithKeyboard = (menuKey: string) => {
    setOpenMenu(menuKey);
    window.requestAnimationFrame(() => {
      const container = document.querySelector(`[data-menu-key="${menuKey}"] [data-nav-dropdown]`);
      container?.querySelector<HTMLAnchorElement>('a')?.focus();
    });
  };

  const renderMenuItems = (section: NavSection) =>
    (section.sections ?? []).map((item) => (
      <Link
        key={item.label}
        href={sectionHref(section, item)}
        className="nav-dropdown-item"
        role="menuitem"
        onClick={() => setOpenMenu(null)}
      >
        {item.label}
      </Link>
    ));

  return (
    <div className={`app-shell${isPublicSurface ? ' app-shell-public' : ''}`}>
      <Head>
        <title>{`${title ?? deriveTitle(router.pathname)} · Our Home Folder`}</title>
      </Head>
      {/* Skip link — first focusable element (WCAG 2.4.1). */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* gilt page edge */}
      <div className="app-gilt" aria-hidden="true" />
      {/* route-transition indicator: the page is leaving, not glitching */}
      {navigating ? <div className="route-progress" role="progressbar" aria-label="Loading page" /> : null}
      {/* Navigation header */}
      <nav className="app-header shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <Link href="/" className="brand-lockup">
              <span className="brand-mark" aria-hidden="true">
                <BrandMark size={44} />
              </span>
              <span className="brand-lockup-text">
                <span className="brand-wordmark">
                  <span>Our Home</span>
                  <span className="brand-wordmark-accent">Folder</span>
                </span>
                <span className="brand-tagline">home documentation</span>
              </span>
            </Link>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              {!isPublicSurface && <PropertySwitcher />}
              {!isPublicSurface && (
                <span className="header-meta">
                  {userEmail ? "Everything's saved to your account." : 'Demo data is stored only in this browser.'}
                </span>
              )}
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
                  <Link href="/pricing" className="header-action px-3 py-2 rounded">
                    Pricing
                  </Link>
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
          {!isPublicSurface && (
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
                  data-menu-key={menuKey}
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
                    aria-haspopup="menu"
                    aria-label={`${section.label} sections`}
                    ref={(element) => {
                      menuTriggerRefs.current[menuKey] = element;
                    }}
                    onClick={() => setOpenMenu(isOpen ? null : menuKey)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown' && !isOpen) {
                        event.preventDefault();
                        openMenuWithKeyboard(menuKey);
                      }
                    }}
                  >
                    <span aria-hidden="true">▾</span>
                  </button>
                  {isOpen ? (
                    <div
                      id={menuId}
                      data-nav-dropdown
                      role="menu"
                      aria-label={`${section.label} sections`}
                      className="nav-dropdown nav-dropdown-desktop"
                    >
                      {renderMenuItems(section)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          )}
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
              <Link href="/data-promise">Our data promise</Link>
              <Link href="/settings">Account</Link>
              <a href="mailto:support@ourhomefolder.com?subject=Our%20Home%20Folder%20problem%20report">Report a problem</a>
            </nav>
          </div>
        </div>
      </footer>

      {!isPublicSurface && (
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
              data-menu-key={menuKey}
              onKeyDown={handleMenuKeyDown(menuKey)}
            >
              <button
                type="button"
                className={`mobile-bottom-link mobile-menu-trigger ${activeClass}`}
                aria-expanded={isOpen}
                aria-controls={menuId}
                aria-haspopup="menu"
                aria-label={`${section.mobileLabel || section.label} sections`}
                ref={(element) => {
                  menuTriggerRefs.current[menuKey] = element;
                }}
                onClick={() => setOpenMenu(isOpen ? null : menuKey)}
              >
                <span aria-hidden="true">{section.icon}</span>
                <span>{section.mobileLabel || section.label}</span>
              </button>
              {isOpen ? (
                <div
                  id={menuId}
                  data-nav-dropdown
                  role="menu"
                  aria-label={`${section.mobileLabel || section.label} sections`}
                  className="nav-dropdown mobile-nav-sheet"
                >
                  {renderMenuItems(section)}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      )}
    </div>
  );
};

type NavSectionLink = {
  label: string;
  /** Anchor id on the section's page; omitted = top of the page. */
  hash?: string;
  /** Full route for entries that live on their own page rather than an anchor. */
  href?: string;
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

// The portfolio surfaces are real routes, not anchors, so these entries carry
// full hrefs. They appear under the Portfolio tab on desktop and are folded
// into the More tab on mobile (the bottom bar holds five tabs).
const portfolioSectionLinks: NavSectionLink[] = [
  { label: 'Overview', href: '/portfolio' },
  { label: 'Compliance', href: '/compliance' },
  { label: 'Tenancies', href: '/tenancies' },
  { label: 'Condition reports', href: '/condition-reports' }
];

// The utilities surfaces are real routes (plus filtered views of the list),
// so these entries carry full hrefs. They appear under the Utilities tab on
// desktop and are folded into the More tab on mobile (five tabs only).
const utilitiesSectionLinks: NavSectionLink[] = [
  { label: 'All utilities', href: '/utilities' },
  { label: 'Add utility', href: '/add-utility' },
  { label: 'HVAC systems', href: '/utilities?type=hvac' },
  { label: 'Router / modem', href: '/utilities?type=router_modem' },
  { label: 'Smoke / CO devices', href: '/utilities?type=safety_device' }
];

// The smart-home surfaces are real routes under /automation, not anchors, so
// these entries carry full hrefs too. They appear under the Smart home tab on
// desktop and are folded into the More tab on mobile (five tabs only).
const smartHomeSectionLinks: NavSectionLink[] = [
  { label: 'Overview', href: '/automation' },
  { label: 'Devices', href: '/automation/devices' },
  { label: 'Hubs & controllers', href: '/automation/hubs' },
  { label: 'Networks', href: '/automation/networks' },
  { label: 'Automations & scenes', href: '/automation/automations' },
  { label: 'Connection map', href: '/automation/map' },
  { label: 'Emergency & handover', href: '/automation/emergency' },
  { label: 'Failure impact', href: '/automation/failure-impact' }
];

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
      { label: 'All rooms', hash: 'room-list' }
    ]
  },
  {
    href: '/home',
    label: 'Home',
    icon: 'H',
    activeRoutes: ['/home', '/home-map', '/create-property', '/add-rooms', '/rooms']
  },
  {
    href: '/utilities',
    label: 'Utilities',
    icon: 'U',
    activeRoutes: ['/utilities', '/add-utility'],
    sections: utilitiesSectionLinks
  },
  {
    href: '/automation',
    label: 'Smart home',
    icon: 'S',
    activeRoutes: ['/automation'],
    sections: smartHomeSectionLinks
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
    href: '/portfolio',
    label: 'Portfolio',
    icon: 'P',
    activeRoutes: ['/portfolio', '/compliance', '/tenancies', '/condition-reports'],
    sections: portfolioSectionLinks
  },
  {
    href: '/more',
    label: 'More',
    icon: '...',
    activeRoutes: ['/more', '/handover', '/sharing', '/settings', '/pro', '/mvp-test', '/sign-in', '/sign-up'],
    sections: [
      { label: 'Overview' },
      { label: 'Files', hash: 'files' },
      { label: 'Records', hash: 'records' },
      { label: 'Review tools', hash: 'review-tools' },
      { label: 'Professional channel', href: '/pro' },
      { label: 'Account', hash: 'account' },
      { label: 'Legal', hash: 'legal' }
    ]
  }
];

// The bottom bar is a five-column grid, so the tabs that don't earn a slot on a
// phone (Documents, Portfolio, Smart home, Utilities) are dropped here and
// their section links are folded into the More tab's jump menu instead.
const mobileSections = desktopSections
  .filter(
    (section) =>
      section.href !== '/documents' &&
      section.href !== '/portfolio' &&
      section.href !== '/automation' &&
      section.href !== '/utilities'
  )
  .map((section) =>
    section.href === '/more'
      ? {
          ...section,
          activeRoutes: [
            ...section.activeRoutes,
            '/portfolio',
            '/compliance',
            '/tenancies',
            '/condition-reports',
            '/automation',
            '/utilities',
            '/add-utility'
          ],
          // "Overview" is already taken by the More page itself, so the
          // portfolio, smart-home, and utilities overview entries are labeled
          // by their own names here — every entry in this menu needs a unique
          // label.
          sections: [
            ...utilitiesSectionLinks.map((item) =>
              item.href === '/utilities' ? { ...item, label: 'Utilities' } : item
            ),
            ...portfolioSectionLinks.map((item) =>
              item.href === '/portfolio' ? { ...item, label: 'Portfolio' } : item
            ),
            ...smartHomeSectionLinks.map((item) =>
              item.href === '/automation' ? { ...item, label: 'Smart home' } : item
            ),
            ...(section.sections ?? [])
          ]
        }
      : section
  );
