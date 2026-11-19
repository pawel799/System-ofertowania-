# Pomiar przed zmianami (main 4f2bdf2 + recon, 2026-11-19)
- npx tsc --noEmit: exit 0; npm run lint: exit 0; npm run build: exit 0
- out/: 24425225 B (25M)
- FPS (Playwright, headless Chromium, WebGL SwiftShader – programowy; liczby porównawcze, nie realne FPS GPU), kuchnia pokazowa (12 mebli + 3 AGD), 5 s obracania kamery:
  - desktop 1440×900, /kreator: 10.6 / 10.5 / 10.3 FPS, 832 draw calls na klatkę
  - telefon Pixel 7, /oferta/view (API z atrapą): 9.0 / 9.0 FPS, 803 draw calls na klatkę
- narzędzia: narzedzia/fps.mjs, narzedzia/plany.ts
