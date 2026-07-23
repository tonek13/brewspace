"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { ErrorNote, Button, EmptyState } from "@/components/ui";

const schema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters."),
    confirmPassword: z.string().min(1, "Re-enter your new password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    if (!token) return;
    setFormError(null);
    try {
      await api.resetPassword(token, values.password);
      setDone(true);
      // The reset revokes every session, so send them back to sign in fresh.
      setTimeout(() => router.push("/login"), 1500);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          title="This reset link is incomplete"
          hint="Request a new password reset link and try again."
        />
        <p className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-crema-deep hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card flex flex-col gap-3 p-8">
          <p className="eyebrow">All set</p>
          <h1 className="font-display text-3xl text-ink">Password updated</h1>
          <p className="text-sm text-steam">
            You&apos;ve been signed out everywhere. Redirecting you to sign in…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <p className="eyebrow mb-2">Almost there</p>
        <h1 className="mb-6 font-display text-3xl text-ink">Choose a new password</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div>
            <label className="field-label" htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="field-input"
              {...register("password")}
            />
            {errors.password && <p className="mt-1 text-xs text-clay">{errors.password.message}</p>}
          </div>

          <div>
            <label className="field-label" htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="field-input"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-clay">{errors.confirmPassword.message}</p>
            )}
          </div>

          {formError && <ErrorNote message={formError} />}

          <Button type="submit" className="mt-1 w-full py-3" loading={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-steam">
        Link expired?{" "}
        <Link href="/forgot-password" className="font-medium text-crema-deep hover:underline">
          Request a new one
        </Link>
      </p>
    </div>
  );
}
