import { ServiceView } from "@/features/service-requests/ServiceView";

export default function ServicePage({ params }: { params: { reservationId: string } }) {
  return <ServiceView reservationId={params.reservationId} />;
}
