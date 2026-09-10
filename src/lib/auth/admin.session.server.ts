import { getCookie, setCookie } from "@tanstack/react-start/server";

export const ADMIN_ACCESS_COOKIE = "aether-admin-access";
export const ADMIN_REFRESH_COOKIE = "aether-admin-refresh";

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

export function writeAdminSessionCookies(accessToken: string, refreshToken: string) {
  setCookie(ADMIN_ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_MAX_AGE));
  setCookie(ADMIN_REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE));
}

export function clearAdminSessionCookies() {
  setCookie(ADMIN_ACCESS_COOKIE, "", cookieOptions(0));
  setCookie(ADMIN_REFRESH_COOKIE, "", cookieOptions(0));
}
