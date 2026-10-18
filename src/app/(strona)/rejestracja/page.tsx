import type { Metadata } from "next";
import { AuthCard, RegisterForm } from "@/components/site/SiteForms";

export const metadata: Metadata = { title: "Rejestracja · System ofertowania" };

export default function RejestracjaPage() {
  return (
    <AuthCard title="Załóż konto firmy" lede="Załóż konto i przygotuj pierwszą ofertę 3D dla klienta. Wpisz NIP, a dane firmy uzupełnimy z rejestrów.">
      <RegisterForm />
    </AuthCard>
  );
}
