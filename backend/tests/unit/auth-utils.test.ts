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
  });

  it("hashes tokens deterministically and compares codes safely", () => {
    expect(hashToken("token")).toBe(hashToken("token"));
    expect(hashToken("token")).not.toBe(hashToken("other"));
    expect(codesMatch("12345678", hashToken("12345678"))).toBe(true);
    expect(codesMatch("12345679", hashToken("12345678"))).toBe(false);
    expect(codesMatch("12345678", "not-a-hash")).toBe(false);
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
  });

  it("sets and clears the session cookie with environment-specific attributes", () => {
    const res = { setHeader: vi.fn() } as any;
    vi.stubEnv("NODE_ENV", "test");
    setSessionCookie(res, "token value");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.stringContaining(`${SESSION_COOKIE_NAME}=token%20value`),
    );
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining(`Max-Age=${SESSION_DURATION_MS / 1000}`));
    expect(res.setHeader).not.toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"));
    clearSessionCookie(res);
    expect(res.setHeader).toHaveBeenLastCalledWith("Set-Cookie", expect.stringContaining("Max-Age=0"));
    vi.unstubAllEnvs();
  });
});
