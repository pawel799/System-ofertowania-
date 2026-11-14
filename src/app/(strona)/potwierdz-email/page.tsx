import type { Metadata } from "next";
import { AuthCard, VerifyEmail } from "@/components/site/AuthForms";

export const metadata: Metadata = { title: "Potwierdzenie adresu e-mail · OP RZUT", robots: { index: false } };

export default function PotwierdzEmailPage() {
  return (
    <AuthCard title="Potwierdzenie adresu e-mail">
      <VerifyEmail />
    </AuthCard>
  );
}
