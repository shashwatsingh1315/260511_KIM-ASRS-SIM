# ASRS-Choker — Warehouse Planning Tool
## Full Design Spec + Implementation Plan
**Date:** 2026-05-08 | **Status:** Ready for implementation

---

## 1. Problem Statement

We manufacture **electricity meters**. The team currently has no clear view of:
- What to put away in storage and where
- How much capacity is needed per material
- Where production lines should sit in the building
- Whether elevators and lanes can handle the material flow

This tool is a **single-user planning canvas** that lets us model the entire factory topology, configure all materials/packaging/BOM/production/storage, and automatically compute storage capacity, lane & elevator throughput bottlenecks, and rack sizing — all exportable as `.md` reports.

---

## 2. What We Manufacture

- **Finished Good:** Electricity Meters
- **BOM example:**
  - 1 Metre = 1 PCB + 1 Plastic Part (assembled)
  - PCBs and Plastic Parts are different semi-finished goods (SFGs) stored in different packaging types
- **Packaging example for Metres:**
  - Level 1 (unit): 1 metre
  - Level 2 (small PP box): 10 metres
  - Level 3 (large PP box): 7 small PP boxes = 70 metres
  - Line-side consumption pack: 24 metres (metres are transferred into this at the production line)
- **BOM structure:** Multi-level — RM → SFG(s) → FG. Same SFG can feed multiple FGs.
- **No rework loops** in scope for now.

---

## 3. Physical Structure (Confirmed)

### Buildings
| Building | Type | Floors | Blocks/Floor | Elevators |
|----------|------|--------|--------------|-----------|
| Production | Factory | 4 (G + F1 + F2 + F3) | 2 (A, B) | Modifiable |
| Warehouse | Storage | 4 (G + F1 + F2 + F3) | 2 (A, B) | Modifiable |

- Blocks are **uniform** across all floors of each building (same A/B layout on every floor).
- Floor heights are **modifiable** per building.
- Buildings are connected via a **bidirectional bridge at Floor 2** (both buildings align at this height).
- Bridge capacity (pallets/hour) is modifiable.
- **No 3rd building** planned.

### Elevators
- Serve **all floors** in their building.
- Count, capacity (pallets/trip), and cycle time are all **modifiable**.
- Operated **manually** (forklift drives in — not automated ASRS cranes).

### Pathways & Lanes
- Pathways connect any two nodes: `(Building, Floor, Block) → (Building, Floor, Block)`.
- Types: **Elevator** (vertical), **Lane** (horizontal, within or between blocks on same floor), **Bridge** (cross-building at F2).
- Capacity unit: **pallets per hour**.
- Each lane is independently configurable (bidirectional, speed, capacity, materials allowed).
- **Multiple material types** can share a lane.
- All pathways are **modifiable** and **addable** — fully modular.

---

## 4. All Requirements Q&A (Source of Truth)

| Q# | Topic | Answer |
|----|-------|--------|
| 1.1 | Production building structure | ✅ Confirmed: G + 3 floors, 2 blocks per floor |
| 1.2 | Warehouse structure | ✅ Confirmed: 4 floors, 2 blocks per floor. Dimensions modifiable. |
| 1.3 | Bridge | Bidirectional. Capacity (pph) modifiable. |
| 1.4 | Floor height | Modifiable per building |
| 1.5 | 3rd building | No |
| 2.1 | Elevator count | Modifiable |
| 2.2 | Floors served | All floors |
| 2.3 | Elevator capacity | Modifiable |
| 2.4 | Elevator cycle time | Modifiable |
| 2.5 | Elevator operation | Manual (forklift) |
| 3.1 | Horizontal movement | Lanes — user defines them and their capacity |
| 3.2 | Capacity unit | Pallets per hour |
| 3.3 | Shared lanes | Yes — multiple material types per lane |
| 3.4 | Lane direction | Modifiable per lane |
| 3.5 | Predefined routes | No — defined inside the tool |
| 4.1 | Number of FG types | Modifiable (user enters) |
| 4.2 | BOM levels | Modifiable (no fixed max depth) |
| 4.3 | BOM entry method | Both manual entry AND CSV import |
| 4.4 | SFG sharing | Same SFG can feed multiple FGs |
| 4.5 | Rework loops | Not in scope |
| 5.1 | Packaging hierarchy max | No max — unlimited levels and branches |
| 5.2 | Packaging fields per level | All: L×B×H, qty_per_parent, collapsible, returnable |
| 5.3 | Shared packaging master | Yes — same box type can be reused across materials |
| 5.4 | Consumption pack | Model as a special "line-side" pack on the packaging hierarchy |
| 5.5 | Returnable pack return capacity | Yes — calculate return trip capacity on lanes/elevators |
| 6.1 | Pallet types | Modifiable |
| 6.2 | Which pack level on pallet | Modifiable per material |
| 6.3 | Stacking pattern | Modifiable |
| 6.4 | Mixed pallets | No — single SKU per pallet |
| 7.1 | Production lines | Modifiable (count, type, location) |
| 7.2 | Output rate | Modifiable |
| 7.3 | Material pull point | Modifiable (line-side buffer or direct from ASRS) |
| 7.4 | Buffer stock target | Modifiable (hours of supply) |
| 7.5 | Production line placement | Modifiable — tool helps decide |
| 8.1 | Storage horizon | Modifiable (days of stock) |
| 8.2 | ASRS vs conventional | Modifiable per material |
| 8.3 | Rack definition | User inputs rack dimensions + slot count per rack |
| 8.4 | Storage outputs | All: slots needed, rack count, floor footprint, material movement feasibility |
| 8.5 | Storage incompatibility zones | Not in scope |
| 9.1 | Data entry | Spreadsheet-like tables + CSV import with template download + undo |
| 9.2 | Scenarios | No |
| 9.3 | Export format | All reports as `.md` |
| 10.1 | Database | Firestore (free tier, easiest setup) |
| 10.2 | Offline | Not required |
| 10.3 | ERP integration | Not in scope |

---

## 5. Open Questions (Unresolved)

> These need answers before the relevant module is built. They do not block starting.

| # | Question | Impacts |
|---|----------|---------|
| OQ-1 | Consumption pack (e.g. 24-metre line-side pack): modelled as a special field on the packaging hierarchy, OR as a separate material? **Current plan: special `consumption_pack` field on `material_packaging`.** Confirm? | Packaging data model |
| OQ-2 | Returnable pack return trips: counted as separate backward pallet movements on the same lane, OR as a fixed % overhead on lane capacity? | Analysis engine |
| OQ-3 | CSV templates: one `.csv` per module (e.g. `materials-template.csv`) OR one combined `.xlsx` with multiple sheets? **Current plan: one CSV per module.** Confirm? | CSV import UX |
| OQ-4 | Undo scope: session-only (in-memory, lost on refresh) OR persisted to Firestore (survives refresh)? **Current plan: session-only.** Confirm? | State management |
| OQ-5 | BOM demand attribution: if SFG-X feeds FG-A and FG-B simultaneously, demand for SFG-X = sum of demands from both lines. Confirmed? | Analysis engine |
| OQ-6 | Report: one combined `.md` file OR one `.md` per module? **Current plan: one combined file.** Confirm? | Report export |
| OQ-7 | Do block L×W dimensions differ between the two buildings, or are they the same? | Buildings UI |
| OQ-8 | When a shared packaging master (box) is edited, should the tool warn that all materials using it are affected? | Packaging UX |

---

## 6. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 15 (App Router, TypeScript) | Vercel-native, familiar |
| Database | Firestore (free tier) | Free, no-SQL, easy setup, already used in other projects |
| Hosting | Vercel | Free tier, automatic deploys from GitHub |
| State | Zustand | Lightweight, undo support |
| CSV | PapaParse | Best-in-class CSV parse/stringify |
| Styling | Tailwind CSS | Fast, consistent dark UI |
| Auth | None | Single-user personal tool |

---

## 7. Firestore Data Model

```
/buildings/{id}
  name: string
  type: "production" | "warehouse"
  floors: number                    // total levels incl. ground
  blocks_per_floor: number
  floor_height_m: number

/elevators/{id}
  building_id: string
  name: string
  serves_floors: number[]           // e.g. [0, 1, 2, 3]
  capacity_pallets: number
  cycle_time_min: number
  count: number

/connections/{id}                   // inter-building bridge links
  from: { building_id, floor, block }
  to:   { building_id, floor, block }
  type: "bridge" | "lane" | "elevator"
  bidirectional: boolean
  capacity_pallets_per_hour: number
  materials_allowed: string[]       // [] = all materials

/lanes/{id}                         // intra-building horizontal lanes
  name: string
  from: { building_id, floor, block }
  to:   { building_id, floor, block }
  bidirectional: boolean
  capacity_pallets_per_hour: number
  materials_allowed: string[]

/materials/{id}
  name: string
  code: string
  type: "RM" | "SFG" | "FG"
  description: string

/bom/{id}
  parent_material_id: string
  child_material_id: string
  qty_per_parent: number

/packaging_master/{id}              // reusable shared packaging library
  name: string
  code: string
  length_mm: number
  breadth_mm: number
  height_mm: number
  collapsible: boolean
  returnable: boolean

/material_packaging/{id}
  material_id: string
  levels: Array<{
    level: number                   // 1 = innermost, 2 = next, etc.
    packaging_master_id: string
    qty_per_parent: number
  }>
  consumption_pack?: {              // optional line-side repack
    packaging_master_id: string
    units_per_pack: number
  }

/pallets/{id}
  name: string
  code: string
  length_mm: number
  breadth_mm: number
  height_mm: number
  max_weight_kg: number

/pallet_rules/{id}
  material_id: string
  packaging_level: number           // which level sits on the pallet
  pallet_id: string
  units_per_layer: number
  layers_per_pallet: number
  // derived: units_per_pallet = units_per_layer × layers_per_pallet

/production_lines/{id}
  name: string
  building_id: string
  floor: number
  block: string
  output_rate: number
  rate_unit: "per_hour" | "per_shift"
  shifts_per_day: number
  material_id: string               // FG produced
  buffer_hours: number              // line-side buffer target

/production_bom/{id}
  line_id: string
  material_id: string
  qty_per_output_unit: number

/racks/{id}
  name: string
  code: string
  building_id: string
  floor: number
  block: string
  length_mm: number
  breadth_mm: number
  height_mm: number
  levels: number                    // shelf levels
  slots_per_level: number
  // derived: total_slots = levels × slots_per_level

/storage_assignments/{id}
  material_id: string
  rack_id: string
  storage_days: number
```

---

## 8. App Navigation Structure

```
Sidebar (9 modules):
  1. 🏗️  Buildings & Topology   →  /buildings
  2. 🛤️  Pathways & Lanes       →  /lanes
  3. 📋  Materials & BOM        →  /materials
  4. 📦  Packaging Library      →  /packaging
  5. 🚛  Pallets & Stacking     →  /pallets
  6. ⚙️  Production Lines       →  /production
  7. 🗄️  Storage & Racks        →  /storage
  8. 📊  Analysis Dashboard     →  /analysis
  9. 📄  Reports                →  /reports
```

---

## 9. Analysis Engine Logic

All calculations run **client-side on demand** (user clicks "Run Analysis").

### Material Daily Demand
```
For each production line:
  fg_per_day = output_rate × (rate_unit == "per_hour" ? shifts_per_day × 8 : shifts_per_day)
  BFS traverse BOM tree from FG downward:
    demand[material] += qty_in_bom × fg_per_day
```
*If same SFG feeds multiple lines, demands are summed (OQ-5).*

### Storage Gaps
```
For each material:
  units_per_slot = packaging at the rack-storage level
  slots_needed   = (storage_days × daily_demand) / units_per_slot
  slots_available = Σ (rack.levels × rack.slots_per_level) for assigned racks
  gap = slots_available - slots_needed   // negative = shortage
```

### Pathway Utilisation
```
For each lane/elevator/connection:
  required_pph = Σ (daily_pallets[material] / working_hours) for all materials routed through it
  utilisation% = required_pph / capacity_pallets_per_hour × 100
  bottleneck   = utilisation% > 90
```

### Rack Footprint
```
For each (building, floor, block):
  rack_count    = count of racks assigned there
  floor_area_m² = Σ (rack.length_mm × rack.breadth_mm) / 1_000_000
```

### Outputs
- Per-material: daily units, daily pallets, slots needed, slots available, gap
- Per-pathway: required pph, capacity pph, utilisation%, bottleneck flag
- Per-zone: rack count, floor area
- Alerts for bottlenecks (>90%) and storage shortfalls

---

## 10. File Structure

```
src/
  app/
    layout.tsx                 # root layout: sidebar + content
    page.tsx                   # redirects to /buildings
    buildings/page.tsx
    lanes/page.tsx
    materials/page.tsx
    packaging/page.tsx
    pallets/page.tsx
    production/page.tsx
    storage/page.tsx
    analysis/page.tsx
    reports/page.tsx
  components/
    Sidebar.tsx                # 9-item dark sidebar nav
    DataTable.tsx              # reusable inline-editable table
    CsvImport.tsx              # upload → parse → preview → confirm
    UndoBar.tsx                # undo / redo toolbar
    BottleneckAlert.tsx        # alert card for bottlenecks
  lib/
    firestore.ts               # Firebase init
    collections.ts             # typed CRUD helpers per collection
    analysis.ts                # pure analysis functions
    csvTemplates.ts            # template definitions
    exportMd.ts                # .md report generator
  store/
    useAppStore.ts             # Zustand: all data + undo stack
  types/
    index.ts                   # all TypeScript interfaces
public/
  templates/
    materials-template.csv
    bom-template.csv
    packaging-master-template.csv
    pallets-template.csv
    production-lines-template.csv
    lanes-template.csv
```

---

## 11. Implementation Tasks

### Task 0 — Project Scaffold
- [ ] `npx create-next-app@latest . --typescript --app --tailwind --eslint --src-dir --import-alias "@/*" --yes`
- [ ] `npm install firebase zustand papaparse @types/papaparse`
- [ ] Create `src/lib/firestore.ts` with Firebase init using `NEXT_PUBLIC_FB_*` env vars
- [ ] Create `.env.local` with placeholder Firebase keys
- [ ] `git init && git add . && git commit -m "chore: scaffold"`

### Task 1 — TypeScript Types (`src/types/index.ts`)
- [ ] Define interfaces: `Building`, `Elevator`, `NodeRef`, `Connection`, `Lane`, `Material`, `BomEdge`, `PackagingMaster`, `PackagingLevel`, `ConsumptionPack`, `MaterialPackaging`, `Pallet`, `PalletRule`, `ProductionLine`, `ProductionBom`, `Rack`, `StorageAssignment`, `AnalysisResult`
- [ ] `git commit -m "feat: TypeScript types"`

### Task 2 — Firestore CRUD Helpers (`src/lib/collections.ts`)
- [ ] Generic `getAll<T>(col)`, `upsert<T>(col, data)`, `remove(col, id)` using Firebase v9 modular SDK
- [ ] Typed wrappers for each collection (Buildings, Elevators, Connections, Lanes, Materials, Bom, PackagingMaster, MaterialPackaging, Pallets, PalletRules, ProductionLines, ProductionBom, Racks, StorageAssignments)
- [ ] `git commit -m "feat: Firestore CRUD helpers"`

### Task 3 — Zustand Store + Undo (`src/store/useAppStore.ts`)
- [ ] State: array for each of the 14 collections
- [ ] `loadAll()`: parallel fetch of all collections from Firestore on app start
- [ ] `upsertX(item)` / `deleteX(id)` per collection: push snapshot to `past[]` → update state → write Firestore
- [ ] `undo()`: pop `past[]` → revert state → revert Firestore
- [ ] `redo()`: pop `future[]` → re-apply
- [ ] Session-only undo (no Firestore versioning)
- [ ] `git commit -m "feat: Zustand store with undo"`

### Task 4 — Layout + Sidebar
- [ ] Dark sidebar: `bg-gray-950`, 9 nav items with emoji icon + label, active state in indigo
- [ ] `layout.tsx`: flex layout, sidebar left, content right, calls `store.loadAll()` on mount
- [ ] `UndoBar`: fixed bottom strip with Undo / Redo buttons + action count
- [ ] `git commit -m "feat: layout and sidebar"`

### Task 5 — Reusable DataTable + CsvImport
- [ ] `DataTable`: inline editing (click cell → input/select → blur to save), Add row, Delete row (trash icon), Tab navigation between cells
- [ ] `CsvImport`: Download Template button → file upload → PapaParse → preview table → Confirm or Cancel
- [ ] `git commit -m "feat: DataTable and CsvImport"`

### Task 6 — Buildings Module (`/buildings`)
- [ ] Section A — Buildings table (name, type, floors, blocks_per_floor, floor_height_m)
- [ ] Section B — Elevators table (building dropdown, name, capacity_pallets, cycle_time_min, count, serves_floors)
- [ ] Section C — Connections table (from/to selectors with building→floor→block dropdowns, type, bidirectional, capacity_pph, materials_allowed)
- [ ] `git commit -m "feat: buildings module"`

### Task 7 — Lanes Module (`/lanes`)
- [ ] Table: name, from (building→floor→block), to (same), bidirectional, capacity_pph, materials_allowed
- [ ] CsvImport support
- [ ] `git commit -m "feat: lanes module"`

### Task 8 — Materials & BOM (`/materials`)
- [ ] Tab A: Material master table (name, code, type RM/SFG/FG, description) + CsvImport
- [ ] Tab B: BOM edges table (parent material select, child material select, qty_per_parent) + CsvImport
- [ ] Tab C: Read-only BOM tree view (indented list derived from BOM edges)
- [ ] `git commit -m "feat: materials and BOM module"`

### Task 9 — Packaging (`/packaging`)
- [ ] Tab A: Packaging master table (name, code, L/B/H, collapsible, returnable) + CsvImport
- [ ] Tab B: Per-material packaging hierarchy — select material → define levels (level#, packaging master dropdown, qty_per_parent, Add/Remove level) + optional Line-Side Consumption Pack row (packaging master + units_per_pack)
- [ ] `git commit -m "feat: packaging module"`

### Task 10 — Pallets (`/pallets`)
- [ ] Tab A: Pallet master (name, code, L/B/H, max_weight_kg)
- [ ] Tab B: Pallet rules (material select, packaging_level, pallet select, units_per_layer, layers_per_pallet, computed units_per_pallet)
- [ ] `git commit -m "feat: pallets module"`

### Task 11 — Production Lines (`/production`)
- [ ] Tab A: Lines table (name, building, floor, block, output_rate, rate_unit, shifts_per_day, FG material, buffer_hours) + CsvImport
- [ ] Tab B: Line material consumption (select line → table of material + qty_per_output_unit) + CsvImport
- [ ] `git commit -m "feat: production lines module"`

### Task 12 — Storage & Racks (`/storage`)
- [ ] Tab A: Racks table (name, code, building, floor, block, L/B/H, levels, slots_per_level, computed total_slots)
- [ ] Tab B: Storage assignments (material select, rack select, storage_days)
- [ ] `git commit -m "feat: storage module"`

### Task 13 — Analysis Engine (`src/lib/analysis.ts`)
- [ ] Pure function `runAnalysis(store): AnalysisResult`
- [ ] Implements: demand BFS, storage gap, pathway utilisation, rack footprint, alerts
- [ ] Unit tests in `src/lib/analysis.test.ts`:
  - Demand calculation: 1 line × 100/hr × 2 shifts × BOM depth → verify each material's daily_units
  - Bottleneck detection: set capacity < required → verify bottleneck flag + utilisation > 100%
  - Storage gap: set storage_days high → verify negative gap and alert
- [ ] `git commit -m "feat: analysis engine with tests"`

### Task 14 — Analysis Dashboard (`/analysis`)
- [ ] "Run Analysis" button → calls `runAnalysis(store)` → stores result in component state
- [ ] Table 1: Storage capacity (material, daily units, daily pallets, slots needed, slots available, gap — red if negative)
- [ ] Table 2: Pathway utilisation (label, type, required pph, capacity pph, utilisation % with red progress bar if >90%)
- [ ] Table 3: Rack footprint (building, floor, block, rack count, floor area m²)
- [ ] Alert section: bottleneck cards + storage shortfall cards
- [ ] `git commit -m "feat: analysis dashboard"`

### Task 15 — Reports (`/reports`)
- [ ] `src/lib/exportMd.ts`: `generateReport(store, result): string` — builds one combined `.md` with all modules as sections and analysis results
- [ ] Report sections: Buildings, Elevators, Connections, Lanes, Materials, BOM tree, Packaging, Pallets, Production Lines, Storage Assignments, Analysis: Storage, Analysis: Pathway Utilisation, Bottleneck Alerts
- [ ] "Generate & Download" button: creates Blob, triggers download as `asrs-report-{date}.md`
- [ ] `git commit -m "feat: md report export"`

### Task 16 — CSV Templates (`public/templates/`)
- [ ] Create 6 template files with headers + 1 example row each:
  - `materials-template.csv`: `name,code,type,description`
  - `bom-template.csv`: `parent_code,child_code,qty_per_parent`
  - `packaging-master-template.csv`: `name,code,length_mm,breadth_mm,height_mm,collapsible,returnable`
  - `pallets-template.csv`: `name,code,length_mm,breadth_mm,height_mm,max_weight_kg`
  - `production-lines-template.csv`: `name,building_name,floor,block,output_rate,rate_unit,shifts_per_day,fg_material_code,buffer_hours`
  - `lanes-template.csv`: `name,from_building,from_floor,from_block,to_building,to_floor,to_block,bidirectional,capacity_pallets_per_hour`
- [ ] `git commit -m "feat: CSV templates"`

### Task 17 — Deploy to Vercel
- [ ] Create Firebase project → Firestore database (test mode) → copy config
- [ ] Add env vars to `.env.local` and Vercel dashboard
- [ ] Push to GitHub → connect to Vercel → deploy
- [ ] Smoke test: add building + material + production line → run analysis → download report
- [ ] `git commit -m "chore: production deployment"`

---

## 12. Verification Plan

### Analysis Correctness (manual test after Task 13)

**Setup:**
- 1 production line: 100 metres/hr, 2 shifts, FG = "Metre"
- BOM: 1 Metre → 1 PCB + 1 Plastic Part
- 1 Elevator: 5 pallet capacity, 10 min cycle → 6 trips/hr = 30 pallets/hr
- PCB pallet rule: 50 units/pallet → 2 pallets/hr for PCB
- Plastic pallet rule: 100 units/pallet → 1 pallet/hr for Plastic

**Expected output:**
- Metre daily demand: 100 × 16hr = 1,600 units
- PCB daily demand: 1,600 units = 32 pallets/day
- Plastic daily demand: 1,600 units = 16 pallets/day
- Elevator utilisation: (2 + 1) pph ÷ 30 = 10% → ✅ no bottleneck

### Bottleneck Test

- Change elevator capacity to 2 pph
- Expected: utilisation = (2+1)/2 = 150% → ❌ bottleneck alert appears

### Undo Test

- Add a building → Undo → building disappears from table and Firestore ✅

### Storage Shortfall Test

- Set storage_days = 30, only 10 rack slots available for a high-demand material
- Expected: negative gap in storage table, red cell, alert card ✅

---

## 13. Example Data (for testing)

### Meter Manufacturing Example

**Materials:**
| Code | Name | Type |
|------|------|------|
| RM-001 | PCB Raw | RM |
| RM-002 | Plastic Pellets | RM |
| SFG-001 | Assembled PCB | SFG |
| SFG-002 | Plastic Casing | SFG |
| FG-001 | Single Phase Meter | FG |

**BOM:**
| Parent | Child | Qty |
|--------|-------|-----|
| FG-001 | SFG-001 | 1 |
| FG-001 | SFG-002 | 1 |
| SFG-001 | RM-001 | 1 |
| SFG-002 | RM-002 | 3 |

**Packaging (FG-001):**
| Level | Pack Name | L×B×H (mm) | Qty/Parent | Collapsible | Returnable |
|-------|-----------|------------|------------|-------------|------------|
| 1 | Single Metre | 250×100×50 | — | No | No |
| 2 | Small PP Box | 300×200×150 | 10 | No | No |
| 3 | Large PP Box | 450×350×300 | 7 | No | No |
| Line-side | Consumption Pack | 400×250×200 | 24 units | No | No |

---

*This document is the single source of truth for the ASRS-Choker project. Update it as decisions are made on open questions.*
