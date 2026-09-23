"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MagnifyingGlassIcon,
  ChatBubbleIcon,
  ReaderIcon,
  GridIcon,
} from "@radix-ui/react-icons";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type CSSProperties,
} from "react";

import { useI18n } from "./locale-provider";
import { v05Copy } from "@/lib/v05-copy";
import { Sprout } from "./brand";
import { ActionMenu } from "./action-menu";

import { communityCopy } from "@/lib/community-copy";
import { ParallaxBackground } from "./parallax-background";
import { GlassLighting } from "./design/glass-lighting";

let memoryCollapsed = false;

function snapshot() {
  try {
    return localStorage.getItem("nis-sidebar") === "collapsed";
  } catch {
    return memoryCollapsed;
  }
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("nis-sidebar-change", listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("nis-sidebar-change", listener);
  };
}

const paths = [
  "M3 10l9-7 9 7v11h-6v-7H9v7H3Z",
  "M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3ZM12 6v16",
  "M4 5h16v16H4ZM4 10h16M8 2v6m8-6v6",
  "M12 3a4 4 0 1 0 0 8 4 4 0 0 0-0-8ZM4 21v-3c0-6 16-6 16 0v3",
  "M4 4h16v13H9l-5 4ZM8 8h8m-8 4h5",
  "M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z",
];

function NavIcon({ index }: { index: number }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[index]} />
    </svg>
  );
}

export function AppFrame({
  children,
  preferences,
  account,
  avatar,
  profileAccount,
  admin = false,
}: {
  children: ReactNode;
  preferences: ReactNode;
  account: ReactNode;
  avatar: ReactNode;
  profileAccount?: ReactNode;
  admin?: boolean;
}) {
  const { locale, t } = useI18n();
  const p = v05Copy(locale);
  const community = communityCopy(locale);
  const pathname = usePathname();

  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);

  const dialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.sidebar = snapshot()
      ? "collapsed"
      : "expanded";
  }, [collapsed]);

  function toggle() {
    memoryCollapsed = !collapsed;

    try {
      localStorage.setItem(
        "nis-sidebar",
        memoryCollapsed ? "collapsed" : "expanded",
      );
    } catch {}

    window.dispatchEvent(new Event("nis-sidebar-change"));
  }

  function close() {
    dialog.current?.close();
    setMobileOpen(false);
  }

  const links = [
    ["/", t.home],
    ["/library", t.library],
    ["/schedule", t.schedule],
    ["/profile", t.profile],
    ["/diary", community.diary],
    ["/support", p.support],
    ...(admin ? [["/admin", t.admin]] : []),
  ];

  const renderNavIcon = (href: string) => {
    if (href === "/messages") return <ChatBubbleIcon aria-hidden="true" />;
    if (href === "/diary") return <ReaderIcon aria-hidden="true" />;
    if (href === "/") return <NavIcon index={0} />;
    if (href === "/library") return <NavIcon index={1} />;
    if (href === "/schedule") return <NavIcon index={2} />;
    if (href === "/profile") return <NavIcon index={3} />;
    if (href === "/support") return <NavIcon index={4} />;
    if (href === "/admin") return <NavIcon index={5} />;
    return <NavIcon index={0} />;
  };

  const navigation = (mobile: boolean) => (
    <nav aria-label={t.mainNav} className="sidebar-navigation" data-has-active={links.some(([href])=>href==="/" ? pathname===href : pathname.startsWith(href))} style={{"--active-route":Math.max(0,links.findIndex(([href])=>href==="/" ? pathname===href : pathname.startsWith(href)))} as CSSProperties}>
      {links.map(([href, label]) => (
        <Link
          key={href}
          prefetch={false}
          href={href}
          title={!mobile && collapsed ? label : undefined}
          aria-label={label}
          aria-current={
            (href === "/" ? pathname === href : pathname.startsWith(href))
              ? "page"
              : undefined
          }
          className="sidebar-link"
          onClick={() => {
            delete document.documentElement.dataset.intro;

            if (mobile) {
              close();
              requestAnimationFrame(() => {
                document.getElementById("main")?.focus();
              });
            }
          }}
        >
          {renderNavIcon(href)}
          <span className="sidebar-label">{label}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="app-frame">
      <ParallaxBackground />
      <GlassLighting />
      <a className="skip-link" href="#main">
        {t.skip}
      </a>

      <aside id="desktop-navigation" className="app-sidebar" data-material="nav">


        <div className="sidebar-brand-row">
          <Link className="brand-link" href="/" aria-label="NIS Hub">
            <Sprout />
            <span className="brand-name">
              NIS <em>Hub</em>
            </span>
          </Link>
        </div>

        <div className="sidebar-identity-row sidebar-toggle-row">
          <div className="sidebar-edition sidebar-label"><span>NIS / НИШ / НЗМ</span></div>
          <button
            type="button"
            className="sidebar-collapse"
            onClick={toggle}
            aria-label={collapsed ? p.expand : p.collapse}
            title={collapsed ? p.expand : p.collapse}
            aria-controls="desktop-navigation"
            aria-expanded={!collapsed}
          >
            <svg
              className="sidebar-toggle-symbol"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
            >
              <rect
                x="2.5"
                y="3.5"
                width="19"
                height="17"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                className="sidebar-toggle-divider"
                d="M8.5 4.25v15.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {navigation(false)}

        <div className="sidebar-bottom" inert={collapsed}>
          {profileAccount && <div className="sidebar-account">{profileAccount}{account}</div>}
          <div className="sidebar-legal">
            <Link href="/privacy">{t.privacy}</Link>
            <Link href="/terms">{t.terms}</Link>
          </div>

          <span className="sidebar-label text-xs">NIS Hub · {t.beta}</span>
        </div>
      </aside>

      <div className="app-content">
        <header className="app-topbar">
          <button
            ref={menuButton}
            type="button"
            className="icon-button mobile-menu app-launcher-mobile"
            aria-label={p.menu}
            aria-controls="mobile-navigation"
            aria-expanded={mobileOpen}
            onClick={() => {
              dialog.current?.showModal();
              setMobileOpen(true);
            }}
          >
            ☰
          </button>

          <div className="app-launcher"><ActionMenu label={p.menu} icon={<GridIcon aria-hidden="true"/>}>
            {close => links.map(([href,label]) => <Link role="menuitem" className="menu-action" key={href} href={href} prefetch={false} onClick={close}>{renderNavIcon(href)}{label}</Link>)}
          </ActionMenu></div>
          <form
            action="/library"
            method="get"
            role="search"
            aria-label={p.search}
            className="global-search" data-material="search"
          >
            <label className="sr-only" htmlFor="global-search">
              {p.search}
            </label>

            <input
              id="global-search"
              type="search"
              name="q"
              maxLength={100}
              placeholder={p.search}
            />

            <button type="submit" aria-label={p.searchGo}>
              <MagnifyingGlassIcon aria-hidden="true" />
            </button>
          </form>

          <div className="topbar-preferences">{preferences}</div>
          <div className="topbar-account">
            {avatar}
            {account}
          </div>
        </header>

        <div className="app-canvas">

        <main id="main" tabIndex={-1} className="app-main">

          <div className="page-content">{children}</div>
        </main>

        <footer className="app-footer">
          <p>NIS Hub · {t.beta}</p>

          <div>
            <Link href="/privacy">{t.privacy}</Link>
            <Link href="/terms">{t.terms}</Link>
          </div>
        </footer>
        </div>
      </div>

      <dialog
        ref={dialog}
        id="mobile-navigation"
        className="mobile-drawer" data-material="popover"
        aria-label={p.menu}
        onClose={() => {
          setMobileOpen(false);
          menuButton.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) {
            close();
          }
        }}
      >
        <div>


          <div className="flex items-center justify-between gap-3">
            <Link className="brand-link" href="/" onClick={close}>
              <Sprout />
              <span>
                NIS <em>Hub</em>
              </span>
            </Link>

            <button
              className="button button-secondary"
              type="button"
              onClick={close}
              aria-label={p.close}
            >
              ×
            </button>
          </div>

          {navigation(true)}
          {profileAccount && <div className="sidebar-account">{profileAccount}{account}</div>}

          <div className="sidebar-legal">
            <Link href="/privacy" onClick={close}>
              {t.privacy}
            </Link>
            <Link href="/terms" onClick={close}>
              {t.terms}
            </Link>
          </div>
        </div>
      </dialog>
    </div>
  );
}
