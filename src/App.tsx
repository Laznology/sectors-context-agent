import { useState, type FormEvent } from "react";
import "./App.css";
import { authClient } from "./lib/auth-client.ts";

type AuthMode = "sign-in" | "sign-up";

function App() {
  const session = authClient.useSession();

  if (session.isPending) {
    return <main className="auth-shell">Checking session…</main>;
  }

  if (!session.data) {
    return <AuthForm />;
  }

  return <Dashboard name={session.data.user.name} />;
}

function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = isSignUp
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });

    setIsSubmitting(false);
    if (result.error) setError(result.error.message ?? "Authentication failed");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">SECTORS CONTEXT AGENT</p>
        <h1 id="auth-title">Understand what moved.</h1>
        <p className="muted">Sign in to keep your watchlist and investigation memory private.</p>

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Working…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          className="link-button"
          type="button"
          onClick={() => setMode(isSignUp ? "sign-in" : "sign-up")}
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </section>
    </main>
  );
}

function Dashboard({ name }: { name: string }) {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">SECTORS CONTEXT AGENT</p>
          <h1>Investigation workspace</h1>
        </div>
        <button type="button" onClick={() => authClient.signOut({})}>
          Sign out
        </button>
      </header>
      <section className="welcome-card">
        <p className="eyebrow">SIGNED IN</p>
        <h2>Welcome, {name}.</h2>
        <p className="muted">Your watchlist and investigations will appear here.</p>
      </section>
    </main>
  );
}

export default App;
