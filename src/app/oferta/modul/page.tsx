import type { Metadata } from "next";
import ModulView from "@/components/modul/ModulView";

export const metadata: Metadata = {
  title: "Moduł parametryczny – test",
  description: "Testowa szafka kuchenna generowana parametrycznie.",
};

export default function ModulPage() {
  return <ModulView />;
}
