32 MODELE WYPOSAŻENIA (GLB) – telewizory, sofy, łóżka, biurko, sprzęt wolnostojący, łazienka, dekoracje

PO CO
  Żeby projekt wyglądał jak pokój, a nie same szafki: telewizor nad szafką RTV, sofa naprzeciwko,
  łóżko przy szafie, pralka w łazience. To tło wizualizacji – stolarz tych rzeczy nie robi, więc
  nie wchodzą do ceny ani do formatek i nie mają kolorów mebli do wyboru.

BEZ ZNAKÓW FIRMOWYCH
  Same bryły i jednolite kolory. Żadnych tekstur, obrazków, napisów ani logotypów – ekrany są czarne,
  sprzęt ma gładkie panele. seed.mjs --check odrzuca plik, w którym jest choć jedna tekstura albo obrazek.
  Nazwy części i materiałów są opisowe (TV_ekran, Sofa_siedziska…), bez nazw producentów i modeli.

CO JEST W ŚRODKU
  modele/             32 pliki .glb
  katalog.json        nazwa, kategoria, wymiary (cm), rozmiar, trójkąty
  id-map.json         stabilne id mw01–mw32, grupa, strefa, rodzaj, odPodlogi
  seed.mjs            wgranie do R2 kuchnia-modele i KV firmy main
  wyposazenie_gen.py  skrypt Blendera, który je generuje (korzysta z ../modele-kuchnia-50/kuchnia_gen.py)
  Miniatury (240 px, WebP) leżą w public/biblioteka/<id>.webp, opisy w src/lib/bibliotekaOpisy.json.

LISTA
  RTV (01–03):        telewizor 55″ i 65″ na ścianie, telewizor 50″ na podstawie
  Salon (04–10):      sofa 2- i 3-osobowa, narożnik 260 × 170, fotel, stolik kawowy, lampa stojąca, dywan 200 × 140
  Dekoracje (11–14):  roślina w donicy, obraz 100 × 70, zasłony z karniszem 200 cm, lustro ścienne 60 × 120
  Sypialnia (15–16):  łóżko 160 × 200 i 90 × 200
  Biuro (17–20):      biurko 140 × 70, krzesło biurowe, monitor 27″, laptop
  Jadalnia (21–22):   stół okrągły 100 cm, krzesło tapicerowane
  AGD wolnostojące (23–28): pralka, suszarka, lodówka side by side 91 cm, kuchenka 60 cm, ekspres do kawy, czajnik
  Łazienka (29–32):   miska WC kompakt, wanna 170 × 75, kabina prysznicowa 90 × 90, grzejnik płytowy 100 × 60

ROZMIARY
  Największy plik 77 KB, razem ok. 830 KB. Low-poly, najwyżej ok. 1 200 trójkątów.
  Wszystkie 32 pliki przeszły walidator Khronos glTF (0 błędów, 0 ostrzeżeń). Bez kompresji Draco.

JAK ZACHOWUJĄ SIĘ W KREATORZE
  Grupa „Wyposażenie i dekoracje” – we wszystkich rodzajach projektu. Sprzęt wolnostojący (23–28) jest w grupie AGD.
  Rodzaj wyposazenie: poza wyceną („wyposażenie, poza ceną”), bez formatek, bez blatu kuchennego nad sobą,
    bez kolorów frontów i korpusu, bez „zamień na mebel na wymiar”. Lodówka zostaje rodzajem lodowka.
  Rodzaj dekoracja (dywan, zasłony): to samo, a do tego z niczym nie koliduje (meble stoją na dywanie)
    i nie blokuje okien ani drzwi (zasłony wiszą przy oknie).
  Strefa gorna = wisi na ścianie; odPodlogi w id-map.json mówi, na jakiej wysokości jest spód:
    telewizor 55″ 95 cm, 65″ 90 cm (środek ekranu ok. 130 cm), obraz 120 cm, lustro 50 cm, grzejnik 12 cm.
    Bez odPodlogi rzecz wisiałaby na 145 cm jak szafka górna.
  Strefa blat = stoi na meblu pod spodem: telewizor na podstawie, monitor, laptop, ekspres, czajnik.
    Na szafce kuchennej stoi na blacie, na komodzie, szafce RTV albo biurku – wprost na meblu.
  Układ pliku jak w pozostałych paczkach: metry, przód w stronę widza, zaczep w lewym-tylnym-dolnym rogu.

WGRANIE DO SYSTEMU OFERTOWANIA
  Model pokaże się w kreatorze dopiero, gdy jest w R2 i KV (GET /api/models) – samo wdrożenie strony nie wystarczy.
  node seed/modele-wyposazenie-32/seed.mjs --check
  node seed/modele-wyposazenie-32/seed.mjs --local
  SEED_CONFIRM=kuchnia-modele node seed/modele-wyposazenie-32/seed.mjs --remote
  Skrypt wgrywa tylko te 32 id (mw…). Nie rusza mk01–mk50 ani ms001–ms100.
  Wymaga `npx wrangler login` albo CLOUDFLARE_API_TOKEN z prawem do KV i R2.

PONOWNE GENEROWANIE
  blender -b -P wyposazenie_gen.py -- /sciezka/do/folderu
  albo bez Blendera:  pip install bpy  &&  python3 wyposazenie_gen.py /sciezka/do/folderu
  Z dopiskiem --miniatury renderuje też podglądy PNG. Kolory są na górze skryptu, lista modeli w MODELS.
  Nowy model: funkcja z bryłami + wpis w MODELS, potem wpis w id-map.json (id, grupa, strefa, rodzaj, wymiary).
