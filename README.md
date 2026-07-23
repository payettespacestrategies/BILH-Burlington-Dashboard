# Lahey HMC — Burlington Planning Dashboard

Interactive planning dashboard for the **Lahey Hospital and Medical Center** campus in Burlington, MA (Beth Israel Lahey Health). Base dashboard (Project Assumptions + Program tabs) by Tom Simister (`LaheyHMC_Dashboard_v0.4`); Site Scenarios tab merged in as v0.5.

**Live use:** open `index.html` in a browser, or host with GitHub Pages (Settings → Pages → deploy from branch, root folder).

## Tabs

| Tab | What it does |
|---|---|
| **Project Assumptions** | Measurement assumptions (plan scale, drawing units, rounding), DGSF→GSF building grossing per category, site overview axon, floor-plate GSF table for the three key buildings. |
| **Program** | Three editable program categories — General Exam Clinic, Diagnostic & Treatment (KPU mode), Administrative Office — with key-variable drivers feeding computed throughput cards (visits, OR cases, imaging, headcount). |
| **Site Scenarios** | The three program categories become scalable GSF **blocks**. Add block instances per category and scale each by a factor (×1, ×0.5, …) — e.g. an extra Admin block at half the office program. Dropped blocks **auto-fill the usable floor area** (3-ft cells): they keep their GSF, hug the plan boundary and neighboring blocks, snap inside if dropped outside, and flag ⚠ truncation when a floor can't hold them. **Grey plan areas are unusable** (masked out); white and colored areas accept program. **67 South Bedford** has a **Lease Timeline**: 3 existing leases (drag their edges to resize, middle to move) plotted 2026–2050 against a draggable "current year" flag — a lease's colored zone blocks program and shows on the plan in its original color while active, and turns blank/placeable once the flag passes its end date. Moving the flag re-flows any block that's now displaced into free space nearby, or returns it to the Program Blocks panel if nothing fits. **Stilts Level 3** has an editable *Available Area* field (default 30,000 SF) — a horizontal divider line is auto-drawn so exactly that much white area remains above it, and it moves when the number changes. Plus per-floor % of usable area, unplaced-program remainder, a drawable section cut (45° snap, per-level HT datums), the vector campus site plan with clickable building footprints, multiple scenarios, Buildings/Site PDF prints, and scenario JSON export/import. |

Top-bar **Export JSON / Import JSON** carries the full state including site scenarios; **Print / PDF** prints the current tab.

## Block math

Block GSF = category NSF × departmental grossing (Program tab driver) × building grossing (Assumptions tab), × the block's factor. Headline stats scale with the factor (exam rooms & visits/day, KPUs & OR cases/day, headcount). Floor-plate capacity comes from the floor outline SVGs converted at the Assumptions drawing scale.

> **Scale note:** the drawn scale bar on Carolyn Booth's site plan (57.72 units = 100′, 36″×24″ sheet at 72 units/inch) implies **1″ ≈ 125′**, not the 1″ = 80′ default on the Assumptions tab. If 125 is correct, every floor plate is ~2.4× larger than shown. Change *Plan scale (ft/inch)* to 125 on the Assumptions tab to rescale everything — worth verifying against a known building GSF (e.g. Google Earth check of 31 Mall Road).

## File structure

```
index.html              full dashboard (v0.4 base + merged Site Scenarios): styles, state, Assumptions + Program tabs, 3D site axon
js/site-scenarios.js    Site Scenarios tab (program blocks, building level canvases, section view, site map, prints)
js/site-svg.js          inline campus site plan SVG (generated from assets/siteplan.svg)
js/floor-svgs.js        inline floor plan SVGs (generated from assets/floors-v2, class-namespaced)
assets/floors-v2/       updated floor plans (2026-07-23): grey = unusable, white/colored = placeable
assets/                 source SVG / JPG graphics (site plan, older outlines, 3D site plan)
```

SVG assets are inlined as JS so the dashboard also works from `file://` (no fetch/CORS issues). Everything runs offline.

## Sources

- Site plan + floor outlines: `SITE PLAN & PLANS` package, Carolyn Booth, 2026-07-22.
- Model clinic program: BIDMC Chestnut Square Outpatient Practice, Michael Hinchcliffe email, 2026-07-17.
- D&T KPU module per the "D&T OR Ambulatory Program" planning sheet; Admin office program is a placeholder.
- Building level assumptions per Tom Simister / Carolyn Booth email thread, 2026-07-21.
