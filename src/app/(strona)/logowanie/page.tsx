import type { Metadata } from "next";
import { AuthCard, LoginForm } from "@/components/site/SiteForms";

export const metadata: Metadata = { title: "Logowanie · System ofertowania" };

export default function LogowaniePage() {
  return (
    <AuthCard title="Zaloguj się" lede="Lorem ipsum dolor sit amet. Twoje oferty, linki dla klientów i akceptacje w jednym miejscu.">
      <LoginForm />
    </AuthCard>
  );
}
