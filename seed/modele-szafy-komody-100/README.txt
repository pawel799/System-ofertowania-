100 MODELI MEBLI (GLB) – szafy, szafki i komody do systemu ofertowania

CO JEST W ŚRODKU
  szafy-i-szafki/  50 plików .glb (25 szaf + 25 szafek)
  komody/          50 plików .glb
  katalog.json     nazwa, kategoria, wymiary (cm), rozmiar, trójkąty, gotowe oznaczenia front/blat/uchwyt
  id-map.json      stabilne id ms001–ms100 (nie kolidują z mk01–mk50)
  seed.mjs         wgranie do R2 kuchnia-modele i KV firmy main
  meble_blender.py skrypt Blendera, który je generuje (zmiana wymiarów i kolorów → uruchom ponownie)

  Miniatury podglad-*.png są w paczce źródłowej, nie w repozytorium (tak samo jak podglad.png kuchni).

SZAFY (01–25): 2-, 3-, 4-, 5-drzwiowe (100–250 cm), z lustrem, z szufladami, z nadstawką, wąska 50 cm,
  przesuwne 150–250 cm (z lustrami, profile w kolorze okuć), wnękowa 300 cm, narożna, dziecięca, na nóżkach,
  z kolumną półek, 2 garderoby otwarte, przedpokojowa, bezuchwytowa, z uchwytem krawędziowym, niska, nadstawka 200 cm.
SZAFKI (26–50): na buty (3), RTV (4, w tym wisząca), witryny (2), regały (3), kredens z witryną,
  łazienkowe z umywalką (2), słupek łazienkowy, szafka z lustrem, nocne (2), biurowa,
  na dokumenty, kontenerek na kółkach, wiszące (2), gospodarcza.
KOMODY (51–100 w id-map, w katalogu 01–50): szerokości 40–220 cm, szuflady, drzwi + szuflady,
  nisze i witryny, wysokie, wiszące, z przewijakiem, z lustrem, na kółkach, bufet.

ROZMIARY
  Największy plik ok. 125 KB, razem ok. 4,5 MB – każdy daleko poniżej 3 MB. Low-poly, max ok. 1 700 trójkątów.
  Wszystkie 100 plików przeszły walidator Khronos glTF (0 błędów, 0 ostrzeżeń). Bez kompresji Draco.
  W kreatorze obrys jest zaokrąglony do centymetrów (id-map.json). Największa szafa: 300×253×62 cm,
  mieści się w limicie modelu GLB (400×280×400 cm).

MATERIAŁY (jak w paczce kuchennej)
  Front  – fronty, drzwi, panele szaf przesuwnych   → rola „Front”
  Uchwyt – uchwyty, gałki, profile szaf przesuwnych → rola „Uchwyt”
  Blat   – blat szafek łazienkowych                 → rola „Blat”
  Bez zmian: Korpus, Lustro, Szklo, Ceramika, Stal, Drewno, Czarny_mat, Cokol.
  Gotowa mapa ról jest w katalog.json (pole "tags").

UKŁAD I STREFY W KREATORZE
  Metry, przód patrzy w stronę widza, punkt zaczepienia: lewy-tylny-dolny róg.
  Wszystkie 100 mają uzycie „modul” i wchodzą do katalogu kreatora (grupy Szafy, Szafki, Komody),
  tak samo jak szafki kuchenne 01–46. Nie są modelem całej oferty.
  Strefa wysoka: szafy i inne meble od podłogi o wysokości od 145 cm (słupek zajmuje całą wysokość,
  nie nachodzi na szafkę górną). Strefa gorna: wiszące, nadstawka i szafka z lustrem
  (spód na wysokości szafek górnych, 145 cm). Strefa dolna: komody, szafki RTV, na buty, nocne,
  łazienkowe z umywalką (blat około 82 cm — nie wiszą pod sufitem).
  Rodzaj: szafa narożna = narozna, umywalka = zlew, komoda z szufladami oraz szafki nocne i kontenerek = szuflady,
  komoda z samymi drzwiami albo klapami = szafka. Szafy zostają szafką.

WGRANIE DO SYSTEMU OFERTOWANIA
  Id: id-map.json (ms + numer 001–100 + nazwa bez podkreśleń). Nie używać mk01–mk50.
  node seed/modele-szafy-komody-100/seed.mjs --check
  node seed/modele-szafy-komody-100/seed.mjs --local
  SEED_CONFIRM=kuchnia-modele node seed/modele-szafy-komody-100/seed.mjs --remote
  Skrypt wgrywa tylko te 100 id. Nie kasuje i nie nadpisuje modeli kuchni.
  Kuchnia zostaje osobno: node seed/modele-kuchnia-50/seed.mjs --check
  Szczegóły: komentarz na górze seed.mjs i docs/kreator-kuchni.md.
  Nie wgrywać na produkcję, dopóki nie ma zgody na deploy.

PONOWNE GENEROWANIE
  Blender 4.x/5.x: Scripting → otwórz meble_blender.py → Run Script
  albo:  blender -b -P meble_blender.py -- /sciezka/do/folderu
  Kolory i wymiary są na górze skryptu, lista modeli w MODELS.
