50 MODELI KUCHENNYCH (GLB) – do systemu ofertowania

CO JEST W ŚRODKU
  modele/        50 plików .glb (glTF 2.0 binarnie, bez kompresji Draco – działają bez zewnętrznego dekodera)
  katalog.json   lista: nazwa, kategoria, wymiary (cm), rozmiar, liczba trójkątów, gotowe oznaczenia front/blat/uchwyt
  podglad.png    miniatury wszystkich modeli
  kuchnia_gen.py skrypt Blendera, który je wygenerował (zmiana wymiarów/kolorów → uruchom ponownie)

  01–14 szafki dolne (30–90 cm, szuflady, zlewowa, cargo, narożna, pod piekarnik, zmywarka w zabudowie)
  15–22 szafki górne (30–80 cm, klapa, witryna ze szkłem, narożna, nad okap)
  23–26 słupki (piekarnik + mikrofala, lodówka w zabudowie, cargo, spiżarnia)
  27–31 blaty (60/120/180/240 cm, wyspa 200×100)
  32–40 AGD (lodówka, piekarnik, mikrofala, płyty indukcyjna i gazowa, 3 okapy, zlew z baterią)
  41–46 stół, krzesło, hoker, półka, lampa wisząca, panel boczny
  47–50 gotowe kuchnie: prosta 360 cm, w L, z wyspą, aneks 240 cm

ROZMIARY
  Największy plik ok. 430 KB (kuchnia z wyspą), razem ok. 2,2 MB – każdy daleko poniżej 3 MB.
  Low-poly: proste bryły z fazowaniem krawędzi frontów i blatów, max ok. 5 800 trójkątów.
  Wszystkie pliki przeszły walidator Khronos glTF (0 błędów, 0 ostrzeżeń).

MATERIAŁY I NAZWY (pod podmianę w ofercie)
  Front   – fronty szafek, panele boczne      → w panelu rola „Front”
  Blat    – blaty                             → rola „Blat”
  Uchwyt  – uchwyty szafek                    → rola „Uchwyt”
  Pozostałe (Korpus, Cokol, Stal, Czarne_szklo, Szklo, AGD_korpus, Drewno…) zostają bez zmian.
  Elementy mają opisowe nazwy: Front_drzwi_1, Front_szuflada_2, Uchwyty, Korpus, Piekarnik_drzwi…
  W gotowych kuchniach z prefiksem szafki: E03_zmywarka_60_Front_zmywarka.
  Po wgraniu w Ustawienia → Modele 3D: wybierz element z materiałem „Front”, użyj
  „zaznacz wszystkie z tym materiałem” i nadaj rolę – tak samo Blat i Uchwyt.
  Gotowa mapa ról każdego pliku jest w katalog.json (pole "tags").

UKŁAD I WYMIARY
  Metry, przód modelu patrzy w stronę widza (+Z w glTF), punkt zaczepienia: lewy-tylny-dolny róg.
  Szafki dolne: cokół 10 cm + korpus 72 cm, głębokość 56 cm + front 1,8 cm; blat 3,8 cm (wierzch 85,8 cm).
  Szafki górne: 72 cm (nad okap 36 cm), głębokość 33 cm, w kuchniach od 145 cm.
  Słupki: 217 cm, równo z górą szafek górnych.

WGRANIE DO SYSTEMU OFERTOWANIA
  Id modeli: id-map.json (mk + numer + nazwa bez podkreśleń; wyjątek mk43hokerx).
  node seed/modele-kuchnia-50/seed.mjs --check
  node seed/modele-kuchnia-50/seed.mjs --local
  SEED_CONFIRM=kuchnia-modele node seed/modele-kuchnia-50/seed.mjs --remote
  Szczegóły: komentarz na górze seed.mjs i docs/kreator-kuchni.md.
  01–46 trafiają do katalogu kreatora, 47–50 do wyboru modelu całej oferty.
  Nie wgrywać na produkcję, dopóki nie ma zgody na deploy.

PONOWNE GENEROWANIE
  Blender 4.x/5.x: Scripting → otwórz kuchnia_gen.py → Run Script (zapis na Pulpit\modele-kuchnia)
  albo:  blender -b -P kuchnia_gen.py -- C:\sciezka\do\folderu
  Kolory i wymiary są na górze skryptu (MAT_DEFS, PL, BH, BD…), lista modeli w MODELS.
