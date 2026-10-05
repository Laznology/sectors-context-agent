import { useState, type FormEvent } from "react";
import { Link, createRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { SessionGuard } from "@/lib/session";
import { rootRoute } from "@/routes/__root";
import { SignalReadout } from "@/components/signal-readout";

import "@/index.css";

export const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up",
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <SessionGuard mode="require-guest">
      <SignUpForm />
    </SessionGuard>
  );
}

function SignUpForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await authClient.signUp.email({ name, email, password });

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
        eyebrow="Buat Akun"
        title={
          <>
            Kantor sinyal
            <br />
            milik Anda sendiri.
          </>
        }
        description="Simpan watchlist, jalankan investigasi kapan saja, dan ikuti perkembangan cerita antar sesi — bukti tetap menempel pada setiap kesimpulan."
      />

      <section className="auth-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <Label htmlFor="name" className="auth-label">
              Nama
            </Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Nama lengkap Anda"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

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
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <p className="text-muted-foreground text-[11px]">Minimal 8 karakter.</p>
          </div>

          {error && (
            <p className="text-destructive text-xs font-medium" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full font-medium mt-2">
            {isSubmitting ? "Memproses…" : "Buat Akun"}
          </Button>
        </form>

        <p className="auth-footer-text">
          Sudah punya akun?{" "}
          <Link to="/sign-in" className="auth-link">
            Masuk
          </Link>
        </p>
      </section>
    </div>
  );
}
