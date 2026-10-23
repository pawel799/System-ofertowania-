import type { Metadata } from "next";
import { AuthCard, ResetForm } from "@/components/site/AuthForms";

export const metadata: Metadata = { title: "Zmiana hasła · System ofertowania", robots: { index: false } };

export default function ResetHaslaPage() {
  return (
    <AuthCard title="Nie pamiętasz hasła?" lede="Podaj e-mail konta, a wyślemy link do ustawienia nowego hasła.">
      <ResetForm />
    </AuthCard>
  );
}
