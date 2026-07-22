/**
 * Elysia's cookie jar type is a generic `Record<string, Cookie<unknown>>`
 * whose `.value` is typed `unknown` until narrowed per-route. This alias
 * isolates that narrowing in one place instead of repeating casts everywhere
 * a route needs to read or write the session cookie.
 */
export interface SessionCookieJar {
  [key: string]: {
    value?: unknown;
    set: (opts: Record<string, unknown>) => void;
    remove: () => void;
  };
}

export function readSessionCookie(jar: SessionCookieJar, name: string): string | undefined {
  const value = jar[name]?.value;
  return typeof value === "string" ? value : undefined;
}
