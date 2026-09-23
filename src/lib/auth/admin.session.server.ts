import { getCookie, setCookie } from "@tanstack/react-start/server";

export const ADMIN_ACCESS_COOKIE = "aether-admin-access";
export const ADMIN_REFRESH_COOKIE = "aether-admin-refresh";

/**
 * Canonical application-wide server session cookies.
 * These are intentionally separate from the legacy admin cookie names so
 * ordinary users and administrators share the same authenticated transport
 * without coupling ordinary sessions to the admin surface.
 */
export const AETHER_ACCESS_COOKIE = "aether-access";
export const AETHER_REFRESH_COOKIE = "aether-refresh";

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 60;

const cookieOptions = (maxAge: number) => ({
  path: "/",
  maxAge,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
});

export function readAdminSessionCookies() {
  return {
    accessToken: getCookie(ADMIN_ACCESS_COOKIE) ?? null,
    refreshToken: getCookie(ADMIN_REFRESH_COOKIE) ?? null,
  };
}

/**
 * Read the canonical application session, with a legacy-admin fallback.
 * The fallback keeps existing administrator sessions working during rollout.
 */
export function readAuthSessionCookies() {
  const accessToken = getCookie(AETHER_ACCESS_COOKIE);
  const refreshToken = getCookie(AETHER_REFRESH_COOKIE);

  if (accessToken || refreshToken) {
    return {
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? null,
      source: "auth" as const,
    };
  }

  const legacy = readAdminSessionCookies();
  if (legacy.accessToken || legacy.refreshToken) {
    return {
      ...legacy,
      source: "admin" as const,
    };
  }

  return {
    accessToken: null,
    refreshToken: null,
    source: null,
  };
}

export function writeAuthSessionCookies(accessToken: string, refreshToken: string) {
  setCookie(AETHER_ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_MAX_AGE));
  setCookie(AETHER_REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE));
}

export function clearAuthSessionCookies() {
  setCookie(AETHER_ACCESS_COOKIE, "", cookieOptions(0));
  setCookie(AETHER_REFRESH_COOKIE, "", cookieOptions(0));
}

export function writeAdminSessionCookies(accessToken: string, refreshToken: string) {
  setCookie(ADMIN_ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_MAX_AGE));
  setCookie(ADMIN_REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE));
}

export function clearAdminSessionCookies() {
  setCookie(ADMIN_ACCESS_COOKIE, "", cookieOptions(0));
  setCookie(ADMIN_REFRESH_COOKIE, "", cookieOptions(0));
}
