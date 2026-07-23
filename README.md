# BILH Burlington Planning Dashboard

Interactive planning dashboard for the **BIDMC Burlington** campus (Beth Israel Lahey Health), built for the Burlington interview. Modeled on the Payette Space Strategies RUSM program dashboard.

**Live use:** open `index.html` in a browser, or host with GitHub Pages (Settings → Pages → deploy from branch, root folder).

## Tabs

| Tab | What it does |
|---|---|
| **Overview** | Model-program snapshot (KPIs, program mix), key-building summary, campus 3D site plan, FICM color legend, project meta. |
| **Program** | Fully editable model program — *BIDMC Chestnut Square Outpatient Practice* (10,000 DGSF outpatient clinic). Edit any cell, drag rows/categories to reorder, add/delete rooms and categories, set FICM color, comfort, circulation, aspect ratio, room height, and notes. |
| **Site Scenarios** | Drag / drop program rooms onto the floor levels of the three key buildings — **Stilts**, **31 Mall Road**, **67 South Bedford** — with the vector campus site plan alongside. Multiple scenarios, room grouping, per-level zoom/pan, utilization vs. approximate plate capacity, printable PDFs, scenario JSON export/import. |

## Toolbar (top right)

- **⤓ Export Graphic SVG** — program as scaled colored rectangles (one per room instance).
- **⤓ Export JSON / ⤒ Import JSON** — full dashboard state (program + scenarios).
- **⤓ Export Excel** — program workbook (Program / Buildings / Summary sheets, via SheetJS CDN — needs internet).
- **🖨 Print / PDF** — browser print of the current tab.

## Key buildings (approximate floor plates)

Measured from the vector site plan / floor outline SVGs (C. Booth, 2026-07-22) at the site-plan scale (100 ft = 57.72 SVG units). Approximate — planning use only.

| Building | Levels | Plates |
|---|---|---|
| Stilts (Medical Center, partially buried) | 6 modeled (7 max) | L1 ≈ 250,500 SF · L2–L3 ≈ 181,000 SF · L4–L6 ≈ 137,000 SF |
| 31 Mall Road (towers excluded — mech/elevator) | 2 | L1–L2 ≈ 31,500 SF |
| 67 South Bedford (steps 2→4 levels) | 4 | L1–L2 ≈ 61,100 SF · L3 ≈ 46,300 SF · L4 ≈ 35,100 SF |

## File structure

```
index.html              app shell (header, export/import toolbar, tabs)
css/styles.css          styles
js/data.js              initial state: project, model program, building registry, FICM catalog
js/app.js               helpers, Overview + Program tabs, export/import (JSON / Excel / SVG), render loop
js/site-scenarios.js    Site Scenarios tab (program panel, building level canvases, site map, prints)
js/site-svg.js          inline campus site plan SVG (generated from assets/siteplan.svg)
js/floor-svgs.js        inline floor outline SVGs for the three key buildings (generated)
assets/                 source SVG / JPG graphics
```

The two `js/*-svgs.js` files are generated from `assets/` so the dashboard also works from `file://` (no fetch/CORS issues).

## Sources

- Site plan + floor outlines: `SITE PLAN & PLANS` package, Carolyn Booth, 2026-07-22.
- Model program: BIDMC Chestnut Square Outpatient Practice, Michael Hinchcliffe email, 2026-07-17.
- Building level assumptions per Tom Simister / Carolyn Booth email thread, 2026-07-21.
