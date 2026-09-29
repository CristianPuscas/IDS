# Private Jet Charter: variabile de creat ÎNAINTE de legare

O singură culoare nouă: fundalul „rece” al coloanei LunaJets din tabelul comparativ (și al celulelor de antet Fractional / Membership, al rândurilor-etichetă pe mobil). Nu se potrivește cu `Neutral/lightest` `#F4F2EF` (cald). Valoare **≈** (eșantionată din referința Figma neclară; Figma dădea ≈ `#F5F8FB` pentru coloană și ≈ `#F7F8FA` pentru antet) ⇒ **un singur token**, de confirmat în Dev Mode; dacă Dev Mode dă altă valoare, se schimbă doar primitiva.

Convenția existentă (vezi `../../about/04-build-log.md`): primitivele în colecția `Primitives`, grupate `Brand/`, `Neutral/`, `Alpha/`, `System/`; semanticele în colecția `Semantic`, ca **alias** spre primitivă; numele fără prefix.

| # | Colecție | ID colecție | Nume (grup/nume) | Tip | Valoare | Motiv |
|---|---|---|---|---|---|---|
| 1 | `Primitives` | `collection-0220e3ad-eb86-03ea-3026-8a5979301dd2` | **`Neutral/lightest-cool`** | Color | `#F5F8FB` | primitivă nouă (gri-albăstrui foarte deschis) |
| 2 | `Semantic` | `collection-fdbc1c40-eb55-0ca1-48fe-6627002fe71f` | **`Background Color/highlight`** | Color (alias) | → `Neutral/lightest-cool` | rol: fundal pentru date evidențiate (coloana recomandată, antet de tabel, rânduri-etichetă); nu poartă numele culorii |

Ordine: 1 → 2 (aliasul cere primitiva). După creare, se notează ID-urile generate în `bindings.md` (coloana „ID”, rândurile marcate `‹nou›`) și în build log.

Nu se creează nimic altceva: toate celelalte valori din payload-uri au deja token (`Background Color/primary`, `Text Color/secondary`, `Border Color/primary` etc.) sau rămân brute ca one-off (overlay-uri, gradient, panoul translucid; vezi `bindings.md`).
