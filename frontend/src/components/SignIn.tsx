import { FormEvent, useState } from "react";
import { login, register, User, verifyEmail } from "../api/client";

type SignInProps = {
  onAuthenticated: (user: User) => void;
};
type AuthMode = "login" | "register" | "verify";

export function SignIn({ onAuthenticated }: SignInProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setNotice("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    setError("");
    try {
      if (mode === "login") {
        const result = await login(email, password);
        onAuthenticated(result.data);
      } else if (mode === "register") {
        const result = await register(email, password);
        setMode("verify");
        setNotice(result.message);
      } else {
        const result = await verifyEmail(email, code);
        onAuthenticated(result.data);
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

  const isVerification = mode === "verify";
  const title =
    mode === "login"
      ? "Your degree, clearly planned."
      : mode === "register"
        ? "Create your account."
        : "Verify your email.";

  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <a className="brand" href="/" aria-label="Better Grad Planner home">
          <span className="brand-mark">B</span>
          <span>Better Grad Planner</span>
        </a>
        <span className="auth-help">Secure student planning</span>
      </header>
      <main className="auth-main">
        <section className="auth-card" aria-labelledby="sign-in-title">
          <div className="auth-intro">
            <p className="eyebrow">
              {mode === "login" ? "WELCOME BACK" : "BETTER GRAD PLANNER"}
            </p>
            <h1 id="sign-in-title">{title}</h1>
            <p className="auth-copy">
              {isVerification
                ? `Enter the 8-digit code sent to ${email}.`
                : mode === "register"
                  ? "Create an account with your BYU-Idaho email to save your degree plan."
                  : "Sign in to pick up where you left off and keep your path to graduation in view."}
            </p>
          </div>
          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="email">BYU-Idaho email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@byui.edu"
              required
              disabled={isVerification}
            />
            {isVerification ? (
              <>
                <label htmlFor="code">Verification code</label>
                <input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="8-digit code"
                  required
                />
              </>
            ) : (
              <>
                <div className="label-row">
                  <label htmlFor="password">Password</label>
                  {mode === "login" && (
                    <button
                      className="forgot-button"
                      type="button"
                      onClick={() =>
                        setNotice("Password recovery will be connected next.")
                      }
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="password-field">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder={
                      mode === "register"
                        ? "At least 15 characters"
                        : "Enter your password"
                    }
                    minLength={mode === "register" ? 15 : 1}
                    maxLength={128}
                    required
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {mode === "register" && (
                  <p className="field-help">Use at least 15 characters.</p>
                )}
              </>
            )}
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading
                ? "Working…"
                : isVerification
                  ? "Verify email"
                  : mode === "register"
                    ? "Create account"
                    : "Sign in"}
              <span>→</span>
            </button>
          </form>
          <div className="auth-divider">
            <span>or</span>
          </div>
          {mode === "login" ? (
            <button
              className="guest-button"
              type="button"
              onClick={() => switchMode("register")}
            >
              Sign up <span>→</span>
            </button>
          ) : (
            <button
              className="guest-button"
              type="button"
              onClick={() => switchMode("login")}
            >
              Back to sign in <span>→</span>
            </button>
          )}
          <p className="auth-legal">
            By continuing, you agree to use Better Grad Planner for educational
            planning purposes.
          </p>
        </section>
        <aside className="auth-aside" aria-label="Planner benefits">
          <div className="aside-orbit orbit-one" />
          <div className="aside-orbit orbit-two" />
          <span className="aside-dot" />
          <p className="eyebrow light">A CLEARER PATH FORWARD</p>
          <h2>Make every credit count.</h2>
          <p>
            See what you’ve completed, shape what comes next, and move through
            your degree with confidence.
          </p>
          <div className="aside-points">
            <span>
              <b>✓</b> Track degree progress
            </span>
            <span>
              <b>✓</b> Build your semester plan
            </span>
            <span>
              <b>✓</b> Find the courses you need
            </span>
          </div>
        </aside>
      </main>
      <footer>
        <span>Better Grad Planner</span>
        <span>Built for a clearer path forward.</span>
      </footer>
    </div>
  );
}
