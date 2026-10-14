import { describe, expect, it, vi } from "vitest";
import {
  clearSessionCookie,
  codesMatch,
  createSessionToken,
  createVerificationCode,
  getCookie,
  hashToken,
  isByuiEmail,
  normalizeEmail,
  setSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "../../src/utils/auth.js";

describe("authentication utilities", () => {
  it("normalizes email and checks BYU-Idaho addresses", () => {
    expect(normalizeEmail("  Student@BYUI.EDU ")).toBe("student@byui.edu");
    expect(isByuiEmail("student@byui.edu")).toBe(true);
    expect(isByuiEmail("student@example.com")).toBe(false);
    expect(isByuiEmail("@byui.edu")).toBe(false);
    expect(isByuiEmail("student@mail.byui.edu")).toBe(false);
    expect(isByuiEmail("student@byui.edu.")).toBe(false);
    expect(isByuiEmail("  STUDENT@BYUI.EDU ")).toBe(true);
  });

  it("hashes tokens deterministically and compares codes safely", () => {
    expect(hashToken("token")).toBe(hashToken("token"));
    expect(hashToken("token")).not.toBe(hashToken("other"));
    expect(codesMatch("12345678", hashToken("12345678"))).toBe(true);
    expect(codesMatch("12345679", hashToken("12345678"))).toBe(false);
    expect(codesMatch("12345678", "not-a-hash")).toBe(false);
    expect(codesMatch("", "")).toBe(false);
    expect(codesMatch("12345678", "abc")).toBe(false);
    expect(codesMatch("12345678", "g".repeat(64))).toBe(false);
  });

  it("generates URL-safe session tokens and eight-digit codes", () => {
    const token = createSessionToken();
    const code = createVerificationCode();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code).toMatch(/^\d{8}$/);
  });

  it("extracts cookies and decodes cookie values", () => {
    const req = { headers: { cookie: `other=x; ${SESSION_COOKIE_NAME}=hello%20world` } } as any;
    expect(getCookie(req, SESSION_COOKIE_NAME)).toBe("hello world");
    expect(getCookie({ headers: {} } as any, SESSION_COOKIE_NAME)).toBeUndefined();
    expect(getCookie({ headers: { cookie: `${SESSION_COOKIE_NAME}=first; ${SESSION_COOKIE_NAME}=second` } } as any, SESSION_COOKIE_NAME)).toBe("first");
    expect(getCookie({ headers: { cookie: `${SESSION_COOKIE_NAME}` } } as any, SESSION_COOKIE_NAME)).toBe("");
    expect(getCookie({ headers: { cookie: `${SESSION_COOKIE_NAME}="quoted%20value"` } } as any, SESSION_COOKIE_NAME)).toBe("quoted value");
    expect(getCookie({ headers: { cookie: `${SESSION_COOKIE_NAME}=a=b=c` } } as any, SESSION_COOKIE_NAME)).toBe("a=b=c");
    expect(getCookie({ headers: { cookie: `${SESSION_COOKIE_NAME}=%E0%A4%A` } } as any, SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("sets and clears the session cookie with environment-specific attributes", () => {
    const res = { setHeader: vi.fn() } as any;
    vi.stubEnv("NODE_ENV", "test");
    setSessionCookie(res, "token value");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.stringContaining(`${SESSION_COOKIE_NAME}=token%20value`),
    );
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Path=/"));
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("HttpOnly"));
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("SameSite=Lax"));
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining(`Max-Age=${SESSION_DURATION_MS / 1000}`));
    expect(res.setHeader).not.toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"));
    clearSessionCookie(res);
    expect(res.setHeader).toHaveBeenLastCalledWith("Set-Cookie", expect.stringContaining("Max-Age=0"));
    expect(res.setHeader).toHaveBeenLastCalledWith("Set-Cookie", expect.stringContaining("Path=/"));
    expect(res.setHeader).toHaveBeenLastCalledWith("Set-Cookie", expect.stringContaining("HttpOnly"));
    expect(res.setHeader).toHaveBeenLastCalledWith("Set-Cookie", expect.stringContaining("SameSite=Lax"));
    vi.unstubAllEnvs();
  });

  it("adds Secure to session cookies in production", () => {
    const res = { setHeader: vi.fn() } as any;
    vi.stubEnv("NODE_ENV", "production");
    setSessionCookie(res, "token");
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"));
    clearSessionCookie(res);
    expect(res.setHeader).toHaveBeenLastCalledWith("Set-Cookie", expect.stringContaining("Secure"));
    vi.unstubAllEnvs();
  });

  it("generates distinct random session tokens and verification codes", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => createSessionToken()));
    const codes = new Set(Array.from({ length: 20 }, () => createVerificationCode()));
    expect(tokens.size).toBe(20);
    expect(codes.size).toBeGreaterThan(1);
  });
});
