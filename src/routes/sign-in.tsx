import { SignalReadout } from "@/components/signal-readout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { SessionGuard } from "@/lib/session";
import { rootRoute } from "@/routes/__root";
import { Link, createRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import "@/index.css";

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: SignInPage,
});

function SignInPage() {
  return (
    <SessionGuard mode="require-guest">
      <SignInForm />
    </SessionGuard>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await authClient.signIn.email({ email, password });

    setIsSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? "Autentikasi gagal.");
      return;
    }
    await navigate({ to: "/" });
  }

  return (
    <div className="auth-grid">
      <SignalReadout
        eyebrow="Masuk"
        title={
          <>
            Baca pasar
            <br />
            seperti sebuah instrumen.
          </>
        }
        description="Agent mengumpulkan bukti pasar, sektor, aliran dana, broker, berita, dan laporan, lalu menyebut penyebab yang paling mungkin, lengkap dengan tingkat keyakinan yang bisa diaudit."
      />

      <section className="auth-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <Label htmlFor="email" className="auth-label">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <Label htmlFor="password" className="auth-label">
              Kata Sandi
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-destructive text-xs font-medium" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full font-medium mt-2">
            {isSubmitting ? "Memproses…" : "Masuk"}
          </Button>
        </form>

        <p className="auth-footer-text">
          Belum punya akun?{" "}
          <Link to="/sign-up" className="auth-link">
            Buat akun
          </Link>
        </p>

        <div className="border-rule bg-ink/4 mt-6 space-y-1 rounded-lg border p-3">
          <p className="text-muted-foreground font-mono text-[11px] tracking-wider uppercase">
            Akun demo
          </p>
          <p className="text-muted-foreground font-mono text-[11px]">
            demo@example.com · demo-password-123
          </p>
        </div>
      </section>
    </div>
  );
}
