import type { ReactNode } from "react";

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
