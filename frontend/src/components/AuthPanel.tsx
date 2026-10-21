import { FormEvent, useState } from "react";
import {
  login,
  register,
  requestPasswordReset,
  resetPassword,
  User,
  verifyEmail,
} from "../api/client";

type AuthMode = "login" | "register" | "verify" | "forgot" | "reset";

type AuthPanelProps = {
  onAuthenticated: (user: User) => void;
};

export function AuthPanel({ onAuthenticated }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage(null);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      if (mode === "login") {
        const result = await login(email, password);
        onAuthenticated(result.data);
      } else if (mode === "register") {
        const result = await register(email, password);
        setMode("verify");
        setMessage(result.message);
      } else if (mode === "verify") {
        const result = await verifyEmail(email, code);
        onAuthenticated(result.data);
      } else if (mode === "forgot") {
        const result = await requestPasswordReset(email);
        setMode("reset");
        setMessage(result.message);
      } else {
        const result = await resetPassword(email, code, password);
        setMode("login");
        setPassword("");
        setCode("");
        setMessage(result.message);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to complete the request.",
      );
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<AuthMode, string> = {
    login: "Welcome back",
    register: "Create your account",
    verify: "Verify your email",
    forgot: "Reset your password",
    reset: "Choose a new password",
  };

  return (
    <main className="auth-shell">
      <section className="auth-card card">
        <p className="eyebrow">BETTER GRAD PLANNER</p>
        <h1>{titles[mode]}</h1>
        <p className="muted">
          {mode === "verify" || mode === "reset"
            ? "Enter the 8-digit code sent to your BYU-Idaho email."
            : "Use your @byui.edu email address to continue."}
        </p>
        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
        <form className="auth-form" onSubmit={submit}>
          <label>
            BYU-Idaho email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          {(mode === "login" || mode === "register" || mode === "reset") && (
            <label>
              {mode === "reset" ? "New password" : "Password"}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={15}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
              {mode !== "login" && <small>Use at least 15 characters.</small>}
            </label>
          )}
          {(mode === "verify" || mode === "reset") && (
            <label>
              Verification code
              <input
                inputMode="numeric"
                pattern="[0-9]{8}"
                maxLength={8}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </label>
          )}
          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Working…"
              : mode === "login"
                ? "Log in"
                : mode === "register"
                  ? "Create account"
                  : mode === "verify"
                    ? "Verify email"
                    : mode === "forgot"
                      ? "Send reset code"
                      : "Reset password"}
          </button>
        </form>
        <div className="auth-links">
          {mode === "login" && (
            <>
              <button type="button" onClick={() => switchMode("register")}>
                Create an account
              </button>
              <button type="button" onClick={() => switchMode("forgot")}>
                Forgot password?
              </button>
            </>
          )}
          {mode === "register" && (
            <button type="button" onClick={() => switchMode("login")}>
              Already have an account? Log in
            </button>
          )}
          {mode === "verify" && (
            <button type="button" onClick={() => switchMode("register")}>
              Need a new code?
            </button>
          )}
          {mode === "forgot" && (
            <button type="button" onClick={() => switchMode("login")}>
              Back to login
            </button>
          )}
          {mode === "reset" && (
            <button type="button" onClick={() => switchMode("login")}>
              Back to login
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
