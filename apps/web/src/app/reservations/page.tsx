import { Suspense } from "react";
import { ReservationsView } from "@/features/reservations/ReservationsView";

export default function ReservationsPage() {
  return (
    <Suspense>
      <ReservationsView />
    </Suspense>
  );
}
