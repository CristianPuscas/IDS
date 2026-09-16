# Harta Comorilor — Milano → Lacul Maggiore

Hartă interactivă (o singură pagină HTML) pentru o zi de excursie: patru opriri
care se descuie pe rând, fiecare cerând două poze făcute la fața locului. La
final se deschide albumul comun.

## Structură

- `index.html` — întreaga aplicație: stiluri, ilustrațiile SVG ale hărții, datele
  traseului (`DATA.d2`) și logica de încărcare a pozelor.

## Unde ajung pozele

Pagina are trei moduri, alese automat la pornire, în ordinea asta:

1. **`remote`** — depozit extern propriu, configurat în blocul `CONFIG` din
   `index.html`. Oricine deschide linkul poate adăuga poze, **fără cont**.
   Merge doar când pagina e găzduită în afara claude.ai (vezi mai jos).
2. **`shared`** — depozitul artefactului (capabilitățile `db` + `assets`).
   Merge doar pentru cine are drept de scriere pe artefact.
3. **`local`** — IndexedDB. Pozele rămân pe dispozitivul curent.

### De ce nu merg amândouă în același loc

Paginile de artefact rulează sub un CSP care blochează `fetch`/XHR/WebSocket
către orice host extern, tăcut. Deci modul `remote` **nu funcționează în
interiorul artefactului publicat pe claude.ai** — pagina trebuie găzduită în
altă parte (GitHub Pages, Netlify, Vercel, Cloudflare Pages).

Invers, modul `shared` cere drept de scriere pe artefact, iar partajarea
nominală cu drept de editare nu e disponibilă pe conturile personale. De aceea
există modul `remote`.

## Configurarea depozitului extern (Supabase)

În `index.html`, la începutul scriptului principal:

```js
const CONFIG = {
  url: "https://<proiect>.supabase.co",
  key: "<cheia anon/public>",
  bucket: "poze",
  table: "poze"
};
```

Cheia `anon` e proiectată să stea în pagină. **Nu pune niciodată `service_role`
acolo** — ar da oricui control complet pe proiect.

### 1. Tabelul

```sql
create table poze (
  id    bigint generated always as identity primary key,
  stop  smallint    not null,
  at    timestamptz not null default now(),
  autor text        default '',
  path  text        not null
);

alter table poze enable row level security;

create policy "citeste oricine" on poze for select to anon using (true);
create policy "adauga oricine"  on poze for insert to anon with check (true);
create policy "sterge oricine"  on poze for delete to anon using (true);
```

Coloana se numește `autor`, nu `by`: `by` e cuvânt-cheie SQL.

### 2. Bucket-ul

Creează un bucket numit `poze`, marcat **public** (pozele se citesc prin
`/storage/v1/object/public/...`), apoi:

```sql
create policy "poze citeste" on storage.objects for select to anon using (bucket_id = 'poze');
create policy "poze adauga"  on storage.objects for insert to anon with check (bucket_id = 'poze');
create policy "poze sterge"  on storage.objects for delete to anon using (bucket_id = 'poze');
```

### 3. Găzduirea

Pune `index.html` pe GitHub Pages sau echivalent și dă linkul mai departe.

## Ce presupune deschiderea către oricine

Politicile de mai sus permit oricui are linkul să adauge **și să șteargă** poze,
fără cont. E prețul pentru „fără cont”. Dacă devine o problemă, variantele sunt:
scoaterea politicii de `delete`, o coloană-secret verificată la ștergere, sau
moderare în Supabase.

## Cum se modifică traseul

Opriri, ore, povești, sfaturi și poziții pe hartă se editează în obiectul
`DATA.d2` din `index.html`. Coordonatele `x`/`y` sunt în sistemul SVG
`0 0 1000 720`. Numărul de poze cerute per oprire e în constanta `REQUIRED`.

Artefact publicat (modurile `shared`/`local`):
https://claude.ai/artifact/BGbTbeXTXvxKcs5jx8NgGD
