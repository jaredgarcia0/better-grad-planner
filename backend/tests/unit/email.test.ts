import { afterEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  sendMail.mockReset();
  createTransport.mockClear();
});

describe("sendAuthCode", () => {
  it("logs the code locally when SMTP is not configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { sendAuthCode } = await import("../../src/services/email.js");

    await sendAuthCode("student@byui.edu", "12345678", "email verification");

    expect(warning).toHaveBeenCalledWith(expect.stringContaining("12345678"));
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("rejects missing SMTP settings in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { sendAuthCode } = await import("../../src/services/email.js");

    await expect(sendAuthCode("student@byui.edu", "12345678", "password reset"))
      .rejects.toThrow("SMTP email settings are required in production.");
  });

  it("sends configured SMTP messages with the correct security and subject", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_USER", "user");
    vi.stubEnv("SMTP_PASSWORD", "password");
    vi.stubEnv("EMAIL_FROM", "planner@example.test");
    vi.stubEnv("SMTP_PORT", "465");
    const { sendAuthCode } = await import("../../src/services/email.js");

    await sendAuthCode("student@byui.edu", "12345678", "password reset");

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.example.test",
      port: 465,
      secure: true,
      auth: { user: "user", pass: "password" },
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "planner@example.test",
      to: "student@byui.edu",
      subject: "Reset your Better Grad Planner password",
      text: expect.stringContaining("12345678"),
    }));

    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_SECURE", "true");
    await sendAuthCode("student@byui.edu", "87654321", "email verification");
    expect(createTransport).toHaveBeenLastCalledWith(expect.objectContaining({ port: 587, secure: true }));
    expect(sendMail).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: "Verify your Better Grad Planner account",
    }));
  });
});
