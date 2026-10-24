import type { Metadata } from "next";
import { AuthCard, LoginForm } from "@/components/site/AuthForms";

export const metadata: Metadata = { title: "Logowanie · System ofertowania" };

export default function LogowaniePage() {
  return (
    <AuthCard title="Zaloguj się" lede="Oferty, linki dla klientów i zgłoszenia Twojej firmy w jednym miejscu.">
      <LoginForm />
    </AuthCard>
  );
}
