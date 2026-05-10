# ASRS-Choker — Plan Part 1: Project Scaffold + TypeScript Types

> **Who this is for:** A brand-new developer who has never seen this project.
> **What you do here:** Set up the project from scratch and define every data shape the app will use.
> **When you're done:** You have a Next.js app that compiles, and a single `types/index.ts` file that every other file in the project will import from.

---

## Before You Start — Read This

This tool is a **warehouse planning calculator**. It helps answer: "If I run my production lines at this speed, do I have enough storage, elevator capacity, and floor space?"

The tool is built around **6 core objects**:

| Object | Plain English | Example |
|--------|--------------|---------|
| **Cell** | A named physical location (room/zone) | "Warehouse Floor 3, Block A" |
| **Material** | A thing that moves through the factory | "Raw PCB", "Assembled Meter" |
| **Process** | A named activity done to a material | "IQC Inspection", "Palletize", "Store in ASRS" |
| **Route** | The ordered list of processes one material goes through | PCB: Receive → IQC → Store → Consume |
| **Station** | A physical machine/area in a cell that performs one process | "IQC Bench 1" at Warehouse GF Block A |
| **Edge** | A connection (elevator, lane, bridge) between two cells | Elevator between WH Floor 0 and Floor 3 |

**The key rule:** You never enter a "buffer size." Instead you enter *how long material waits* (residence time), and the tool calculates the buffer size using Little's Law: `buffer_pallets = throughput_pph × residence_time_hr`.

---

## Task 0: Scaffold the Next.js Project

### What you're doing
Creating the project folder structure with Next.js 15, TypeScript, Tailwind CSS, and installing all dependencies.

### Step-by-step

**Step 0.1** — Open PowerShell. Navigate to the project root:
```
cd "c:\Users\ShashwatSingh\OneDrive - Sinhal Udyog pvt ltd\Downloads\6) Codex\1) Kimbal\260508_ASRS-Choker"
```

**Step 0.2** — Create the Next.js app (this installs Next.js, React, TypeScript, Tailwind, ESLint all at once):
```powershell
npx create-next-app@latest . --typescript --app --tailwind --eslint --src-dir --import-alias "@/*" --yes
```
> If it asks "The directory is not empty. Proceed?" → type `y` and press Enter.
> This will take 2–3 minutes. Wait for it to finish.

**Step 0.3** — Install the extra packages we need:
```powershell
npm install firebase zustand papaparse
npm install --save-dev @types/papaparse
```

**Step 0.4** — Create the environment config file. Create a new file at the project root named `.env.local` with this content:
```
NEXT_PUBLIC_FB_API_KEY=REPLACE_ME
NEXT_PUBLIC_FB_AUTH_DOMAIN=REPLACE_ME
NEXT_PUBLIC_FB_PROJECT_ID=REPLACE_ME
```
> These will be filled with real Firebase values in the deploy task. For now they are placeholders.

**Step 0.5** — Create the Firebase client file. Create `src/lib/firestore.ts`:
```typescript
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
};

// Prevent re-initializing on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
```

**Step 0.6** — Verify the app runs:
```powershell
npm run dev
```
Open your browser to `http://localhost:3000`. You should see the default Next.js welcome page. Press `Ctrl+C` to stop.

**Step 0.7** — Initialise git and make the first commit:
```powershell
git init
git add .
git commit -m "chore: scaffold Next.js project"
```

### ✅ Done when
- `npm run dev` shows the Next.js welcome page at localhost:3000
- No errors in the terminal

---

## Task 1: Define All TypeScript Types

### What you're doing
Creating one file, `src/types/index.ts`, that contains the TypeScript interface for every data object in the system. Every other file will import from here. Think of this as the "dictionary" of the entire app.

### Why this matters
If you know the shape of the data, everything else becomes straightforward. You will not invent any new types anywhere else — they all live here.

### Step-by-step

**Step 1.1** — Create the file `src/types/index.ts` with the following content. Read the comments carefully — they explain WHY each field exists.

```typescript
// ============================================================
// ASRS-Choker — Central Type Definitions
// Every type in the app lives here. Import from "@/types".
// ============================================================

// ------------------------------------------------------------
// CELL
// A pure physical location. No behavior.
// Example: "Production Building, Floor 2, Block A"
// Why: Every quantity in the system must be anchored to a
//      location (Axiom A8). Footprint checks require dimensions (A4).
// ------------------------------------------------------------
export interface Cell {
  id: string;
  name: string;                          // Human label e.g. "WH-F3-A"
  building: "Production" | "Warehouse";
  floor: number;                         // 0 = ground floor
  block: string;                         // e.g. "A" or "B"
  length_mm: number;                     // Floor length of this cell
  width_mm: number;                      // Floor width of this cell
  height_mm: number;                     // Clear ceiling height
}

// ------------------------------------------------------------
// PACKAGING MASTER
// A reusable box/container type used by many materials.
// Example: "200x300x150 PP Box" — used by both PCBs and Casings.
// ------------------------------------------------------------
export interface PackagingMaster {
  id: string;
  name: string;                          // e.g. "Small PP Box"
  code: string;                          // e.g. "PKG-001"
  length_mm: number;
  breadth_mm: number;
  height_mm: number;
  collapsible: boolean;                  // Can empties be collapsed?
  returnable: boolean;                   // Do empties need to come back?
}

// One level in a material's packaging chain.
// Example: Level 1 = 10 units per small box, Level 2 = 7 small boxes per large box
export interface PackagingLevel {
  packaging_master_id: string;           // Which box type
  qty_per_parent: number;                // How many of THIS level fit in the NEXT level
}

// ------------------------------------------------------------
// MATERIAL
// The identity of a thing that flows through the factory.
// Examples: "Raw PCB" (RM), "Assembled PCB" (SFG), "Single Phase Meter" (FG)
// Why: A2 needs identity to propagate demand. A3 needs packaging.
//      A4 needs weight and volume.
// ------------------------------------------------------------
export type MaterialFamily = "RM" | "SFG" | "FG" | "Returnable";
export type UOM = "piece" | "kg" | "litre" | "metre";

export interface Material {
  id: string;
  code: string;                          // e.g. "RM-PCB-001"
  name: string;                          // e.g. "Raw PCB Bare"
  family: MaterialFamily;
  subfamily: string;                     // User-defined: e.g. "Electronic", "Plastic"
  uom: UOM;
  unit_weight_kg: number;                // Weight of ONE unit (for pallet weight check)
  unit_volume_mm3: number;              // Volume of ONE unit (for box-fit check)
  yield_default_override: number | null; // null = use global yield default (see engine config)
  packaging_chain: PackagingLevel[];     // Ordered: [inner, ..., pallet]. Last entry = pallet.
  returnable_density_ratio: number | null; // Only for Returnable family.
                                           // e.g. 5 means one return pallet holds 5x empties
                                           // vs. one full forward pallet
}

// ------------------------------------------------------------
// STATUS
// A lifecycle tag for a material instance.
// Examples: "incoming", "in-IQC", "approved", "rejected"
// Why: Conservation closes per (material, status) pair (A9).
//      "approved" stock ≠ "in-IQC" stock — both must be tracked.
// Note: Status names are user-defined strings. These are stored
//       as family-level lists in the app config.
// ------------------------------------------------------------
export interface FamilyStatusConfig {
  family: MaterialFamily;
  statuses: string[];                    // Ordered list of valid status names for this family
}

// ------------------------------------------------------------
// PROCESS
// A named activity performed on a material.
// Examples: "IQC-RM", "store-in-ASRS", "assemble-meter", "palletize"
// One process can be reused by many materials and many stations.
// Why: Processes are the nodes of the network. Everything flows
//      through them.
// ------------------------------------------------------------
export type ProcessType =
  | "identity-change"    // BOM transformation: children → parent (e.g., assembly line)
  | "packaging-change"   // Same material, different packaging (e.g., palletize, repack)
  | "status-change"      // Same material, different status (e.g., IQC approval)
  | "location-change"    // Same material, different cell (e.g., transport via elevator)
  | "hold";              // Just waiting (e.g., ASRS storage, ageing, line-side buffer)

// For identity-change processes: the BOM inputs
export interface BomInput {
  child_material_id: string;
  qty_per_parent: number;                // How many child units make 1 parent unit
}

export interface Process {
  id: string;
  name: string;                          // e.g. "IQC-RM" or "assemble-meter"
  type: ProcessType;
  input_status: string;                  // Status material must be in to ENTER this process
  output_status: string;                 // Status material is in when it LEAVES this process
  default_residence_time_hr: number;     // How long material stays here (used for WIP = T × R)
  default_yield: number;                 // Fraction that passes (1.0 = no rejects, 0.97 = 3% reject)
                                         // Only meaningful for status-change and identity-change.
  bom_inputs: BomInput[];                // Only populated for type = "identity-change"
  production_target_pph: number | null;  // Only set on identity-change stations that are
                                         // production lines. User enters peak pallets/hr of FG output.
}

// ------------------------------------------------------------
// ROUTE
// The ordered list of processes a material goes through,
// from creation to consumption or dispatch.
// Example for Raw PCB:
//   receive-RM → IQC-RM → transport → store-ASRS → transport → assemble-PCB
// ------------------------------------------------------------
export interface RouteStep {
  process_id: string;
  residence_time_hr_override: number | null; // If set, overrides process.default_residence_time_hr
}

export interface Route {
  id: string;
  material_id: string;
  steps: RouteStep[];                    // Ordered from first to last
}

// ------------------------------------------------------------
// STATION
// A physical thing at a cell that performs exactly one process.
// Examples: "IQC Bench" at WH-GF-A, "ASRS Unit" at WH-F3-A
// One machine with two functions = two Station records at the same cell.
// Why: Stations are where we check capacity (throughput + holding + footprint).
// ------------------------------------------------------------
export interface StationAllocation {
  material_id: string;
  days_of_stock: number | null;          // For ASRS hold stations: days of stock for this material
  residence_time_hr_override: number | null; // For non-ASRS holds: override dwell time
}

export interface Station {
  id: string;
  name: string;                          // e.g. "ST-IQC-RM" or "ST-ASRS"
  cell_id: string;                       // Which cell this station lives in
  process_id: string;                    // Which process this station performs
  peak_throughput_pph: number;           // Max pallets per hour this station can handle
  holding_capacity_pallets: number;      // Max pallets that can sit HERE simultaneously
                                         // (0 for pure flow stations like a conveyor)
  operating_hours_per_day: number;       // How many hours per day this station runs
  footprint_length_mm: number;           // Physical footprint of this station
  footprint_width_mm: number;
  is_asrs: boolean;                      // If true: uses days_of_stock from allocations.
                                         // If false: uses residence_time_hr_override from allocations.
  is_reject_station: boolean;            // If true: absorbs the bad-yield fraction from QC processes
  reject_family: MaterialFamily | null;  // Which family's rejects go here (RM, SFG, or FG)
  allocations: StationAllocation[];      // Which materials are allocated to this station
}

// ------------------------------------------------------------
// EDGE
// A physical connection between two cells.
// Examples: Elevator (vertical), Lane (horizontal), Bridge (cross-building)
// NOTE: In v1, edges are stored but NOT used in calculations.
//       Lane traversal is instantaneous. Edges are stored now so
//       v2 routing can be added without a data migration.
// ------------------------------------------------------------
export type EdgeType = "lane" | "elevator" | "bridge" | "dock-link";

export interface Edge {
  id: string;
  name: string;                          // e.g. "WH Elevator A" or "F2 Bridge"
  from_cell_id: string;
  to_cell_id: string;
  type: EdgeType;
  bidirectional: boolean;
  capacity_pph: number;                  // Rated peak pallets per hour
  materials_allowed: string[];           // material IDs allowed; [] means all materials
}

// ------------------------------------------------------------
// ENGINE CONFIGURATION
// Global settings that the engine uses as fallbacks.
// ------------------------------------------------------------
export interface EngineConfig {
  global_yield_default: number;          // e.g. 0.97 — used when material.yield_default_override is null
  working_hours_per_day: number;         // e.g. 16 — used to convert daily totals
  pallet_pool_declared: number | null;   // If user has declared total pallet count; null = auto-size
}

// ------------------------------------------------------------
// ANALYSIS RESULTS
// The output of running the engine. These are never stored in
// Firestore — they are computed fresh on demand.
// ------------------------------------------------------------

// Demand at a single step in a route
export interface StepDemand {
  material_id: string;
  process_id: string;
  throughput_units_pph: number;          // Peak units per hour at this step
  throughput_pallets_pph: number;        // Peak pallets per hour (ceil of units/units_per_pallet)
  throughput_daily_pallets: number;      // throughput_pallets_pph × operating_hours_per_day
  is_reject_branch: boolean;             // true if this is the "bad yield" flow
}

// WIP at a single step in a route
export interface StepWIP {
  material_id: string;
  process_id: string;
  wip_pallets: number;                   // throughput_pallets_pph × residence_time_hr
}

// Station capacity check result
export interface StationCheck {
  station_id: string;
  station_name: string;
  cell_id: string;
  throughput_required_pph: number;
  throughput_capacity_pph: number;
  throughput_gap_pph: number;            // negative = bottleneck
  throughput_bottleneck: boolean;
  holding_required_pallets: number;
  holding_capacity_pallets: number;
  holding_gap_pallets: number;           // negative = bottleneck
  holding_bottleneck: boolean;
}

// Cell footprint check result
export interface CellCheck {
  cell_id: string;
  cell_name: string;
  footprint_required_mm2: number;
  footprint_available_mm2: number;       // cell.length_mm × cell.width_mm
  footprint_gap_mm2: number;             // negative = layout infeasible
  footprint_bottleneck: boolean;
}

// An alert shown to the user
export interface Alert {
  severity: "error" | "warning";
  category: "throughput" | "holding" | "footprint" | "pallet-pool" | "conservation" | "validation";
  message: string;
  entity_id?: string;                    // The station, cell, or material that caused this
}

// The full analysis result
export interface AnalysisResult {
  is_valid: boolean;                     // false if validation failed; analysis is blocked
  validation_errors: string[];           // Human-readable validation failure messages
  step_demands: StepDemand[];
  step_wips: StepWIP[];
  station_checks: StationCheck[];
  cell_checks: CellCheck[];
  total_pallets_needed: number;
  pallet_pool_gap: number | null;        // null if pool_declared is null
  alerts: Alert[];
}

// ------------------------------------------------------------
// APP STORE STATE
// Everything the Zustand store holds in memory.
// ------------------------------------------------------------
export interface AppState {
  cells: Cell[];
  packagingMasters: PackagingMaster[];
  materials: Material[];
  familyStatuses: FamilyStatusConfig[];
  processes: Process[];
  routes: Route[];
  stations: Station[];
  edges: Edge[];
  engineConfig: EngineConfig;
  lastAnalysisResult: AnalysisResult | null;
  isLoading: boolean;
  undoPast: Omit<AppState, "undoPast" | "undoFuture" | "isLoading" | "lastAnalysisResult">[];
  undoFuture: Omit<AppState, "undoPast" | "undoFuture" | "isLoading" | "lastAnalysisResult">[];
}
```

**Step 1.2** — Verify it compiles with no errors:
```powershell
npx tsc --noEmit
```
You should see no output (no errors). If you see errors, fix them before continuing.

**Step 1.3** — Commit:
```powershell
git add .
git commit -m "feat: add all TypeScript type definitions"
```

### ✅ Done when
- `src/types/index.ts` exists
- `npx tsc --noEmit` produces zero errors
- Git commit made

---

## Checklist

- [ ] Task 0: `npm run dev` shows Next.js welcome page
- [ ] Task 0: `.env.local` created with placeholder keys
- [ ] Task 0: `src/lib/firestore.ts` created
- [ ] Task 0: `git commit -m "chore: scaffold Next.js project"` done
- [ ] Task 1: `src/types/index.ts` created with all interfaces
- [ ] Task 1: `npx tsc --noEmit` = zero errors
- [ ] Task 1: `git commit -m "feat: add all TypeScript type definitions"` done

**➡ Continue with: `plan-02-firestore-store-validation.md`**
