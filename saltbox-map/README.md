# Saltbox Map – style pentru Mapbox Studio

Hartă deschisă, minimalistă, în paleta Saltbox (verde închis `#173c35`, fundal `#f5f6f2`).

## Fișiere

| Fișier | Ce este |
|---|---|
| `saltbox-style.json` | Style-ul hărții, gata de încărcat în Mapbox Studio |
| `saltbox-locations.geojson` | Locațiile Saltbox (date TEST), pentru Studio ca dataset/tileset |
| `index.html` | Pagina cu sidebar + hartă + card (din exemplul inițial) |
| `locations.json` | Lista de locații folosită de `index.html` |

## 1. Încarcă style-ul în Studio

1. Intră pe https://studio.mapbox.com
2. **New style** → **Upload** (sus, lângă „Choose a template”)
3. Alege `saltbox-style.json` → style-ul apare ca „Saltbox Light”
4. Îl poți ajusta mai departe direct în Studio (culori, fonturi, straturi)
5. **Publish**, apoi **Share** → copiază **Style URL** (`mapbox://styles/<user>/<id>`)

## 2. (Opțional) Locațiile ca strat în Studio

În style, **+ Add layer** → **Upload data** → `saltbox-locations.geojson`.
Nu e obligatoriu: `index.html` desenează deja markerele din `locations.json`.

## 3. Folosește style-ul în pagină

În `index.html` completează:

```js
const MAPBOX_TOKEN = "pk....";                           // tokenul public Mapbox
const MAPBOX_STYLE_URL = "mapbox://styles/<user>/<id>";  // din Studio > Share
```

## Paletă

| Element | Culoare |
|---|---|
| Fundal / uscat | `#f5f6f2` |
| Apă | `#cfdcd6` |
| Parcuri | `#e3eadd` |
| Drumuri | `#ffffff` cu contur `#d3d9d2` |
| Clădiri | `#e8eae3` |
| Orașe, țări | `#173c35` |
| Etichete secundare | `#56645f` / `#71807b` |
| State, cartiere | `#aab3ae` |
