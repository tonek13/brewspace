"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "./session-context";
import { ApiError } from "@/lib/api-client";
import { ErrorNote } from "@/components/ui";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const registerSchema = z.object({
  firstName: z.string().min(1, "Required."),
  lastName: z.string().min(1, "Required."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { login, register: registerUser } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const redirectTo = params.get("redirect") ?? "/branches";

  const isLogin = mode === "login";
  const form = useForm<LoginValues & RegisterValues>({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema) as never,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: LoginValues & RegisterValues) {
    setFormError(null);
    try {
      if (isLogin) {
        await login(values.email, values.password);
      } else {
        await registerUser({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
        });
      }
      router.push(redirectTo);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <p className="eyebrow mb-2">{isLogin ? "Welcome back" : "Join BrewSpace"}</p>
        <h1 className="mb-6 font-display text-3xl text-ink">
          {isLogin ? "Sign in" : "Create your account"}
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="firstName">First name</label>
                <input id="firstName" className="field-input" {...register("firstName")} />
                {errors.firstName && <p className="mt-1 text-xs text-clay">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="field-label" htmlFor="lastName">Last name</label>
                <input id="lastName" className="field-input" {...register("lastName")} />
                {errors.lastName && <p className="mt-1 text-xs text-clay">{errors.lastName.message}</p>}
              </div>
            </div>
          )}

          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" className="field-input" {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-clay">{errors.email.message}</p>}
          </div>

          <div>
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              className="field-input"
              {...register("password")}
            />
            {errors.password && <p className="mt-1 text-xs text-clay">{errors.password.message}</p>}
          </div>

          {formError && <ErrorNote message={formError} />}

          <button type="submit" className="btn btn-primary mt-1 w-full py-3" disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-steam">
        {isLogin ? (
          <>
            New here?{" "}
            <Link href="/register" className="font-medium text-crema-deep hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-crema-deep hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
