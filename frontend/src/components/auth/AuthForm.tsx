"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ZoomLogo } from "@/components/layout/ZoomLogo";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { ApiError, errorMessage } from "@/lib/api/client";
import { safeNextPath } from "@/lib/auth/redirect";
import { validateAuthForm, type AuthFormErrors, type AuthFormValues } from "@/lib/validation/authForm";
import { useAuth } from "@/providers/AuthProvider";

const DEMO_ACCOUNT = { email: "alex.morgan@example.com", password: "demo1234" };

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { user, loading, login, signup } = useAuth();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [values, setValues] = useState<AuthFormValues>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === "signup";

  // Already signed in (or just signed in): continue to where the user was going.
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  const update = (field: keyof AuthFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const submit = async () => {
    const validation = validateAuthForm(values, mode);
    setErrors(validation);
    if (Object.keys(validation).length) return;

    setSubmitting(true);
    try {
      if (isSignup) await signup(values.name.trim(), values.email.trim(), values.password);
      else await login(values.email.trim(), values.password);
    } catch (err) {
      const details = err instanceof ApiError ? err.details : null;
      if (details && Object.keys(details).length) setErrors(details as AuthFormErrors);
      else setFormError(errorMessage(err));
      setSubmitting(false);
    }
  };

  const otherHref = `${isSignup ? "/login" : "/signup"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <main className="flex min-h-dvh flex-col items-center bg-surface px-4 py-10 sm:justify-center">
      <Link href="/" className="mb-8" aria-label="Zoom home">
        <ZoomLogo />
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-1 text-2xl font-black text-ink">{isSignup ? "Create your account" : "Sign in"}</h1>
        <p className="mb-6 text-sm text-ink-muted">
          {isSignup ? "Host, schedule and manage your meetings." : "Welcome back. Sign in to start or schedule meetings."}
        </p>

        {formError && (
          <p role="alert" className="mb-4 rounded-lg bg-zoom-red/10 px-4 py-3 text-sm text-zoom-red">
            {formError}
          </p>
        )}

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {isSignup && (
            <TextField
              label="Full name"
              value={values.name}
              error={errors.name}
              autoComplete="name"
              maxLength={100}
              onChange={(event) => update("name", event.target.value)}
              autoFocus
            />
          )}
          <TextField
            label="Email address"
            type="email"
            value={values.email}
            error={errors.email}
            autoComplete="email"
            onChange={(event) => update("email", event.target.value)}
            autoFocus={!isSignup}
          />
          <TextField
            label="Password"
            type="password"
            value={values.password}
            error={errors.password}
            autoComplete={isSignup ? "new-password" : "current-password"}
            maxLength={128}
            hint={isSignup ? "At least 8 characters, including a letter and a number." : undefined}
            onChange={(event) => update("password", event.target.value)}
          />
          <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
            {isSignup ? "Sign Up" : "Sign In"}
          </Button>
        </form>

        {!isSignup && (
          <div className="mt-5 rounded-lg bg-zoom-blue-soft px-4 py-3 text-sm text-ink">
            <p className="font-bold">Demo account</p>
            <p className="text-ink-muted">
              {DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}
            </p>
            <button
              type="button"
              onClick={() => setValues((current) => ({ ...current, ...DEMO_ACCOUNT }))}
              className="mt-1 font-bold text-zoom-blue hover:underline"
            >
              Use demo account
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-ink-muted">
          {isSignup ? "Already have an account? " : "New to Zoom? "}
          <Link href={otherHref} className="font-bold text-zoom-blue hover:underline">
            {isSignup ? "Sign In" : "Sign Up Free"}
          </Link>
        </p>
        <p className="mt-3 text-center text-sm">
          <Link href="/join" className="text-ink-muted hover:text-ink">
            Join a meeting without signing in
          </Link>
        </p>
      </div>
    </main>
  );
}
