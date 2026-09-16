# Harta Comorilor — Milano → Lacul Maggiore

Hartă interactivă (o singură pagină HTML) pentru o zi de excursie: patru opriri
care se descuie pe rând, fiecare cerând două poze făcute la fața locului. La
final se deschide albumul comun.

## Structură

- `index.html` — întreaga aplicație: stiluri, ilustrațiile SVG ale hărții, datele
  traseului (`DATA.d2`) și logica de încărcare a pozelor.

## Capabilități la publicare

Pagina cere două capabilități de runtime:

- `db` — albumul comun (colecția `shots`); fără el pozele rămân local, în IndexedDB.
- `assets` — stocarea propriu-zisă a pozelor; fără el încărcarea e dezactivată.

Se publică din Claude Code cu `capabilities: {"db": {}, "assets": {}}`.

Artefact publicat: https://claude.ai/artifact/BGbTbeXTXvxKcs5jx8NgGD

## Cum se modifică

Traseul (opriri, ore, povești, sfaturi, poziții pe hartă) se editează în obiectul
`DATA.d2` din `index.html`. Coordonatele `x`/`y` ale opririlor sunt în sistemul
SVG `0 0 1000 720`. Numărul de poze cerute per oprire e în constanta `REQUIRED`.

După fiecare modificare, republică același fișier ca să păstrezi acelaşi URL.
