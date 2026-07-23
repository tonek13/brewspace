import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "accent" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows an inline spinner and disables the button while an action is in flight. */
  loading?: boolean;
}

/**
 * Shared button with a built-in loading state. When `loading` is true it shows a
 * spinner (in the current text color) and is disabled so the click can't repeat.
 */
export function Button({
  variant = "primary",
  loading = false,
  type = "button",
  className = "",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const variantClass =
    variant === "accent" ? "btn-accent" : variant === "ghost" ? "btn-ghost" : "btn-primary";
  return (
    <button
      type={type}
      className={`btn ${variantClass} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-steam" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-crema" />
      {label ?? "Loading…"}
    </div>
  );
}

/**
 * Full-segment loading fallback for App Router `loading.tsx` files. Renders a
 * centered spinner so route navigation shows immediate progress feedback.
 */
export function PageLoading({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 px-6 py-12 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm text-steam">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-clay/25 bg-clay/8 px-3.5 py-2.5 text-sm text-clay" role="alert">
      {message}
    </p>
  );
}
