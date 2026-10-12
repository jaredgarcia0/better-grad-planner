import nodemailer from "nodemailer";

type AuthCodeKind = "email verification" | "password reset";

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.EMAIL_FROM,
  );
}

function getTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

export async function sendAuthCode(
  email: string,
  code: string,
  kind: AuthCodeKind,
): Promise<void> {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP email settings are required in production.");
    }

    console.warn(`[auth] SMTP is not configured; development ${kind} code for ${email}: ${code}`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: kind === "email verification"
      ? "Verify your Better Grad Planner account"
      : "Reset your Better Grad Planner password",
    text: `Your Better Grad Planner ${kind} code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Better Grad Planner ${kind} code is:</p><p style="font-size: 24px; font-weight: bold; letter-spacing: 4px">${code}</p><p>This code expires in 10 minutes.</p>`,
  });
}
