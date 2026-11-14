/*
 * Miniatura rzutu (karta gotowego projektu, szybka oferta): pokój, meble dolne i wysokie pełne, górne przerywane.
 * Sam SVG, bez interakcji – lekki do listy kart.
 */
import { rect, type PlanKuchni } from "@/lib/kuchnia";

export default function MiniRzut({ plan, className, etykieta }: { plan: PlanKuchni; className?: string; etykieta?: string }) {
  const pom = plan.pomieszczenie ?? { szer: Math.max(plan.scianaA, 120), dlug: 300 };
  const m = 12;
  const kolejnosc = { wysoka: 0, dolna: 1, blat: 2, polka: 3, gorna: 4 } as const;
  const elementy = [...plan.elementy].sort((a, b) => kolejnosc[a.strefa] - kolejnosc[b.strefa]);
  return (
    <svg className={className ?? "mini-rzut"} viewBox={`${-m} ${-m} ${pom.szer + 2 * m} ${pom.dlug + 2 * m}`} role="img" aria-label={etykieta ?? "Rzut z góry"}>
      <rect x={0} y={0} width={pom.szer} height={pom.dlug} className="mr-pokoj" />
      {elementy.map((e) => {
        const r = rect(e);
        return <rect key={e.id} x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} className={`mr-el mr-${e.strefa}`} />;
      })}
    </svg>
  );
}
