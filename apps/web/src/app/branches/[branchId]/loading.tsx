import { Spinner } from "@/components/ui";

/**
 * Shown instantly by the App Router while the branch detail route (and its
 * heavy 3D booking bundle) is fetched on navigation, so a click gives
 * immediate "work in progress" feedback instead of a frozen previous page.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header placeholder */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-28 animate-pulse rounded bg-line" />
        <div className="h-9 w-64 animate-pulse rounded bg-line" />
        <div className="h-4 w-40 animate-pulse rounded bg-line" />
      </div>

      {/* Map + panel skeleton mirroring the booking layout */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex h-[460px] items-center justify-center rounded-card border border-line bg-[#efe6d6]">
          <Spinner label="Loading café…" />
        </div>
        <div className="card flex flex-col gap-4 self-start p-6">
          <div className="h-6 w-40 animate-pulse rounded bg-line" />
          <div className="h-4 w-full animate-pulse rounded bg-line" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
          <div className="mt-2 h-11 w-full animate-pulse rounded-full bg-line" />
        </div>
      </div>
    </div>
  );
}
