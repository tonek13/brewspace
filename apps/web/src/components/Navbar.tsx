"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/authentication/session-context";

export function Navbar() {
  const { user, logout } = useSession();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">BrewSpace</span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-crema-deep sm:inline">
            workspace café
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link href="/branches" className="btn btn-ghost border-transparent hover:border-line">
            Book a spot
          </Link>
          {user ? (
            <>
              <Link href="/reservations" className="btn btn-ghost border-transparent hover:border-line">
                My reservations
              </Link>
              {(user.role === "WAITER" || user.role === "ADMIN") && (
                <Link href="/staff" className="btn btn-ghost border-transparent hover:border-line">
                  Staff
                </Link>
              )}
              {user.role === "ADMIN" && (
                <Link href="/admin" className="btn btn-ghost border-transparent hover:border-line">
                  Admin
                </Link>
              )}
              <button onClick={handleLogout} className="btn btn-ghost ml-1">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost border-transparent hover:border-line">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary ml-1">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
