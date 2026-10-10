import type { Metadata } from "next";
import { AuthCard, ResetForm } from "@/components/site/SiteForms";

export const metadata: Metadata = { title: "Reset hasła · System ofertowania" };

export default function ResetHaslaPage() {
  return (
    <AuthCard title="Nie pamiętasz hasła?" lede="Podaj e-mail konta, a wyślemy link do ustawienia nowego hasła.">
      <ResetForm />
    </AuthCard>
  );
}
