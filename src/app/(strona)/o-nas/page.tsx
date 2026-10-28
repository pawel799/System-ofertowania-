import type { Metadata } from "next";
import Link from "next/link";
import PageIntro from "@/components/site/PageIntro";
import { btn } from "@/components/site/styles";

export const metadata: Metadata = { title: "O nas · OP RZUT" };

const POINTS = [
  { title: "Oferta w 3D", text: "Klient widzi swoją kuchnię w trójwymiarze, a nie tylko listę pozycji i rzut z góry." },
  { title: "Link dla klienta", text: "Oferta otwiera się w przeglądarce na telefonie i komputerze – bez załączników i instalowania programów." },
  { title: "Uwagi i zgłoszenia online", text: "Klient sam zmienia fronty, blat i uchwyty, widzi cenę, zostawia uwagi i prosi o wycenę albo pomiar." },
];

export default function ONasPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageIntro eyebrow="O nas" title="Pomagamy sprzedawać meble na wymiar">
        <p>
          Tworzymy OP RZUT – system ofertowania dla stolarzy, pracowni i producentów mebli na wymiar. Zamiast wysyłać PDF z rysunkiem,
          wysyłasz klientowi link do kuchni w 3D, którą może obejrzeć ze wszystkich stron.
        </p>
      </PageIntro>

      <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
        {POINTS.map((p) => (
          <section key={p.title} className="bg-[#0c0b0a] p-6 md:p-8">
            <h2 className="text-lg text-stone-50">{p.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">{p.text}</p>
          </section>
        ))}
      </div>

      <div className="mt-16 max-w-2xl space-y-5 text-base leading-relaxed text-stone-400">
        <p>
          Klient, który widzi przyszłą kuchnię, szybciej podejmuje decyzję i rzadziej wraca z pytaniami „a jak to będzie
          wyglądać?”. Może sam porównać dąb z lakierem, kamień z laminatem i od razu zobaczyć, jak zmienia się cena.
        </p>
        <p>
          Ty widzisz w panelu, czy oferta została otwarta, jakie materiały wybrał klient i jakie ma uwagi. Dzięki temu
          wiesz, kiedy zadzwonić, i rozmawiasz o konkretach.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/kontakt" className={btn("solid")}>
          Napisz do nas
        </Link>
        <Link href="/oferta/demo" className={btn("ghost")}>
          Zobacz przykładową ofertę
        </Link>
      </div>
    </div>
  );
}
