"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { ErrorNote, Button } from "@/components/ui";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
});
type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await api.requestPasswordReset(values.email);
      setSent(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card flex flex-col gap-3 p-8">
          <p className="eyebrow">Check your inbox</p>
          <h1 className="font-display text-3xl text-ink">Reset link sent</h1>
          <p className="text-sm leading-relaxed text-steam">
            If an account exists for that address, we&apos;ve sent a link to reset your password. It
            expires in 30 minutes.
          </p>
          <Link href="/login" className="btn btn-ghost mt-2 self-start">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <p className="eyebrow mb-2">Forgot your password?</p>
        <h1 className="mb-2 font-display text-3xl text-ink">Reset it</h1>
        <p className="mb-6 text-sm text-steam">
          Enter the email you signed up with and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" className="field-input" {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-clay">{errors.email.message}</p>}
          </div>

          {formError && <ErrorNote message={formError} />}

          <Button type="submit" className="mt-1 w-full py-3" loading={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-steam">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-crema-deep hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
