import { useState, type FormEvent } from "react";
import { Link, createRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { SessionGuard } from "@/lib/session";
import { rootRoute } from "@/routes/__root";
import { SignalReadout } from "@/components/signal-readout";

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
      setError(result.error.message ?? "Authentication failed");
      return;
    }
    await navigate({ to: "/" });
  }

  return (
    <div className="grid w-full gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <SignalReadout
        eyebrow="Create account"
        title={
          <>
            Your own
            <br />
            signal desk.
          </>
        }
        description="Keep a watchlist, run investigations on demand, and follow how a story develops between sessions — evidence stays attached to every conclusion."
      />

      <section className="w-full max-w-sm lg:justify-self-end">
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <p className="text-muted-foreground text-xs">At least 8 characters.</p>
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Working…" : "Create account"}
          </Button>
        </form>

        <p className="text-muted-foreground mt-6 text-sm">
          Already registered?{" "}
          <Link
            to="/sign-in"
            className="text-signal-text underline underline-offset-4 hover:opacity-80"
          >
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
