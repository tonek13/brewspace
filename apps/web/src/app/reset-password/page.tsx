import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/authentication/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
