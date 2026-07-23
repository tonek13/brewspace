import { Suspense } from "react";
import { ForgotPasswordForm } from "@/features/authentication/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
