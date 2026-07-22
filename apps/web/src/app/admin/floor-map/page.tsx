"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { FloorMapEditor } from "@/features/floor-map/FloorMapEditor";
import { Spinner, ErrorNote } from "@/components/ui";

export default function AdminFloorMapPage() {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listBranches()
      .then((list) => {
        if (list[0]) setBranchId(list[0].id);
        else setError("No branches found.");
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load branches."));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!branchId) return <Spinner />;
  return <FloorMapEditor branchId={branchId} />;
}
