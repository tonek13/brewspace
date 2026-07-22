"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BranchDto } from "@brewspace/contracts";
import { api, ApiError } from "@/lib/api-client";
import { Spinner, EmptyState, ErrorNote } from "@/components/ui";

export function BranchList() {
  const [branches, setBranches] = useState<BranchDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listBranches()
      .then(setBranches)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load cafés."));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!branches) return <Spinner label="Loading cafés…" />;
  if (branches.length === 0)
    return <EmptyState title="No cafés yet" hint="Check back soon — new locations are on the way." />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">Choose a location</p>
        <h1 className="font-display text-4xl text-ink">Where are you working today?</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {branches.map((branch) => (
          <Link
            key={branch.id}
            href={`/branches/${branch.id}`}
            className="card group flex flex-col gap-3 p-6 transition-shadow hover:shadow-lift"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-display text-2xl text-ink">{branch.name}</h2>
              <span className="text-crema-deep transition-transform group-hover:translate-x-1">→</span>
            </div>
            {branch.description && (
              <p className="text-sm leading-relaxed text-steam">{branch.description}</p>
            )}
            <p className="mt-auto text-sm text-steam">{branch.address}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
