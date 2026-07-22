import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16">
      <section className="grid gap-10 pt-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="flex flex-col gap-6">
          <p className="eyebrow">Reserve · check in · order at the table</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            The seat you want,
            <br />
            <span className="text-crema-deep">held before you arrive.</span>
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-steam">
            Pick your café, walk the room in 3D, and hold a desk or table for the next five minutes
            while you confirm. Check in with a code, then call a waiter or order without leaving your seat.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/branches" className="btn btn-accent px-6 py-3 text-base">
              Find a seat
            </Link>
            <Link href="/register" className="btn btn-ghost px-6 py-3 text-base">
              Create an account
            </Link>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="grid grid-cols-3 gap-px bg-line p-px">
            {[
              { label: "Available", tone: "bg-sage/15 text-sage" },
              { label: "On hold", tone: "bg-crema/15 text-crema-deep" },
              { label: "Reserved", tone: "bg-clay/12 text-clay" },
            ].map((chip) => (
              <div key={chip.label} className="bg-surface px-3 py-2 text-center">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${chip.tone}`}>
                  {chip.label}
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 p-5">
            {Array.from({ length: 12 }).map((_, i) => {
              const tone =
                i % 5 === 0 ? "bg-clay/70" : i % 3 === 0 ? "bg-crema/70" : "bg-sage/60";
              return <div key={i} className={`aspect-square rounded-md ${tone}`} />;
            })}
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-steam">
            A live seat map. Green is yours for the taking.
          </p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Walk the room first",
            body: "An interactive 3D floor map shows every table, desk, and lounge seat with real-time status.",
          },
          {
            title: "Five-minute hold",
            body: "Tap a free seat and it's yours to confirm. No one else can grab it while you decide.",
          },
          {
            title: "Service without the wave",
            body: "Once you're checked in, call a waiter, ask for the bill, or order — all from your phone.",
          },
        ].map((feature) => (
          <div key={feature.title} className="card flex flex-col gap-2 p-6">
            <h2 className="font-display text-xl text-ink">{feature.title}</h2>
            <p className="text-sm leading-relaxed text-steam">{feature.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
