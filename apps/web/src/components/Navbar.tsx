"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/authentication/session-context";
import { Button } from "@/components/ui";

export function Navbar() {
  const { user, logout } = useSession();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      setMenuOpen(false);
      router.push("/");
    } finally {
      setLoggingOut(false);
    }
  }

  // Primary nav links, built once and rendered in both the desktop row and the
  // mobile dropdown.
  const links: { href: string; label: string }[] = [{ href: "/branches", label: "Book a spot" }];
  if (user) {
    links.push({ href: "/reservations", label: "My reservations" });
    if (user.role === "WAITER" || user.role === "ADMIN") links.push({ href: "/staff", label: "Staff" });
    if (user.role === "ADMIN") links.push({ href: "/admin", label: "Admin" });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-baseline gap-2" onClick={() => setMenuOpen(false)}>
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">BrewSpace</span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-crema-deep sm:inline">
            workspace café
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="btn btn-ghost whitespace-nowrap border-transparent hover:border-line"
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <Button variant="ghost" onClick={handleLogout} className="ml-1 whitespace-nowrap" loading={loggingOut}>
              Sign out
            </Button>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost whitespace-nowrap border-transparent hover:border-line">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary ml-1 whitespace-nowrap">
                Create account
              </Link>
            </>
          )}
        </nav>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="btn btn-ghost h-10 w-10 p-0 sm:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav id="mobile-menu" className="flex flex-col gap-1 border-t border-line bg-paper px-5 py-3 text-sm sm:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="btn btn-ghost w-full justify-start border-transparent"
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start"
              loading={loggingOut}
            >
              Sign out
            </Button>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="btn btn-ghost w-full justify-start border-transparent"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                onClick={() => setMenuOpen(false)}
                className="btn btn-primary mt-1 w-full"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
