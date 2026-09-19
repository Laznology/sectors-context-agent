import { useState, type FormEvent } from "react";
import { Link, createRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { SessionGuard } from "@/lib/session";
import { rootRoute } from "@/routes/__root";
import { SignalReadout } from "@/components/signal-readout";

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
      setError(result.error.message ?? "Authentication failed");
      return;
    }
    await navigate({ to: "/" });
  }

  return (
    <div className="grid w-full gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <SignalReadout
        eyebrow="Sign in"
        title={
          <>
            Read the market
            <br />
            like an instrument.
          </>
        }
        description="The agent gathers market, sector, flow, broker, news and filing evidence, then states the likely driver — with an explicit confidence you can audit."
      />

      <section className="w-full max-w-sm lg:justify-self-end">
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Working…" : "Sign in"}
          </Button>
        </form>

        <p className="text-muted-foreground mt-6 text-sm">
          No account yet?{" "}
          <Link
            to="/sign-up"
            className="text-signal-text underline underline-offset-4 hover:opacity-80"
          >
            Create one
          </Link>
        </p>
      </section>
    </div>
  );
}
