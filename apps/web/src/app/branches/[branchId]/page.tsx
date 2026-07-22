"use client";

import { useEffect, useState } from "react";
import type { BranchDto } from "@brewspace/contracts";
import { api, ApiError } from "@/lib/api-client";
import { BranchBooking } from "@/features/reservations/BranchBooking";
import { Spinner, ErrorNote } from "@/components/ui";

export default function BranchDetailPage({ params }: { params: { branchId: string } }) {
  const [branch, setBranch] = useState<BranchDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getBranch(params.branchId)
      .then(setBranch)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load this café."));
  }, [params.branchId]);

  if (error) return <ErrorNote message={error} />;
  if (!branch) return <Spinner label="Loading café…" />;
  return <BranchBooking branch={branch} />;
}
