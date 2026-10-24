import type { Metadata } from "next";
import { AuthCard, RegisterForm } from "@/components/site/AuthForms";

export const metadata: Metadata = { title: "Rejestracja · System ofertowania" };

export default function RejestracjaPage() {
  return (
    <AuthCard title="Załóż konto firmy" lede="Konto dla Twojej stolarni: oferty 3D, linki dla klientów i zgłoszenia. Wpisz NIP, a nazwę firmy uzupełnimy z rejestrów.">
      <RegisterForm />
    </AuthCard>
  );
}
