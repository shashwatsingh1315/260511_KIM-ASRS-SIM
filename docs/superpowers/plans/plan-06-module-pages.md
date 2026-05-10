# ASRS-Choker — Plan Part 6: Module Pages (Data Entry UI)

> **Prerequisite:** Plans 01–05 complete.
> **Goal:** Build all 7 data-entry pages so the user can enter Cells, Packaging, Materials, Processes, Routes, Stations, and Edges.

---

## Task 10: Cells Page (`/cells`)

**Step 10.1** — Replace `src/app/cells/page.tsx`:

```tsx
"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import { CsvImport } from "@/components/CsvImport";
import type { Cell } from "@/types";

const COLUMNS: ColDef[] = [
  { key: "name",      header: "Name",       type: "text" },
  { key: "building",  header: "Building",   type: "select", options: ["Production", "Warehouse"] },
  { key: "floor",     header: "Floor",      type: "number" },
  { key: "block",     header: "Block",      type: "text" },
  { key: "length_mm", header: "Length (mm)",type: "number" },
  { key: "width_mm",  header: "Width (mm)", type: "number" },
  { key: "height_mm", header: "Height (mm)",type: "number" },
];

const CSV_HEADERS = ["name","building","floor","block","length_mm","width_mm","height_mm"];

function newCell(): Cell {
  return { id: undefined as any, name: "", building: "Production", floor: 0, block: "A", length_mm: 0, width_mm: 0, height_mm: 0 };
}

export default function CellsPage() {
  const cells = useAppStore((s) => s.cells);
  const upsertCell = useAppStore((s) => s.upsertCell);
  const deleteCell = useAppStore((s) => s.deleteCell);

  function handleImport(rows: Record<string, string>[]) {
    rows.forEach((row) => upsertCell({
      id: undefined as any,
      name: row.name,
      building: row.building as "Production" | "Warehouse",
      floor: Number(row.floor),
      block: row.block,
      length_mm: Number(row.length_mm),
      width_mm: Number(row.width_mm),
      height_mm: Number(row.height_mm),
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">🏗 Cells</h1>
        <p className="text-gray-500 text-sm mt-1">
          Physical locations in the factory. Every station must live in a cell.
          Cell dimensions are used to check that station footprints fit (Rule 15).
        </p>
      </div>
      <CsvImport templateHeaders={CSV_HEADERS} templateFilename="cells-template.csv" onImport={handleImport} />
      <DataTable columns={COLUMNS} rows={cells} onSave={upsertCell} onDelete={deleteCell} newRowTemplate={newCell} />
    </div>
  );
}
```

---

## Task 11: Packaging Page (`/packaging`)

**Step 11.1** — Replace `src/app/packaging/page.tsx`:

```tsx
"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import { CsvImport } from "@/components/CsvImport";
import type { PackagingMaster } from "@/types";

const COLUMNS: ColDef[] = [
  { key: "name",        header: "Name",         type: "text" },
  { key: "code",        header: "Code",         type: "text" },
  { key: "length_mm",   header: "Length (mm)",  type: "number" },
  { key: "breadth_mm",  header: "Breadth (mm)", type: "number" },
  { key: "height_mm",   header: "Height (mm)",  type: "number" },
  { key: "collapsible", header: "Collapsible",  type: "boolean" },
  { key: "returnable",  header: "Returnable",   type: "boolean" },
];

const CSV_HEADERS = ["name","code","length_mm","breadth_mm","height_mm","collapsible","returnable"];

function newPkg(): PackagingMaster {
  return { id: undefined as any, name: "", code: "", length_mm: 0, breadth_mm: 0, height_mm: 0, collapsible: false, returnable: false };
}

export default function PackagingPage() {
  const packagingMasters = useAppStore((s) => s.packagingMasters);
  const upsertPackagingMaster = useAppStore((s) => s.upsertPackagingMaster);
  const deletePackagingMaster = useAppStore((s) => s.deletePackagingMaster);

  function handleImport(rows: Record<string, string>[]) {
    rows.forEach((row) => upsertPackagingMaster({
      id: undefined as any,
      name: row.name, code: row.code,
      length_mm: Number(row.length_mm), breadth_mm: Number(row.breadth_mm), height_mm: Number(row.height_mm),
      collapsible: row.collapsible === "true", returnable: row.returnable === "true",
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">📦 Packaging Master</h1>
        <p className="text-gray-500 text-sm mt-1">
          Reusable box and container types. Each material references these in its packaging chain.
        </p>
      </div>
      <CsvImport templateHeaders={CSV_HEADERS} templateFilename="packaging-template.csv" onImport={handleImport} />
      <DataTable columns={COLUMNS} rows={packagingMasters} onSave={upsertPackagingMaster} onDelete={deletePackagingMaster} newRowTemplate={newPkg} />
    </div>
  );
}
```

---

## Task 12: Materials Page (`/materials`)

**Step 12.1** — Replace `src/app/materials/page.tsx`:

```tsx
"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import { CsvImport } from "@/components/CsvImport";
import type { Material, MaterialFamily, UOM } from "@/types";

const COLUMNS: ColDef[] = [
  { key: "code",                    header: "Code",             type: "text" },
  { key: "name",                    header: "Name",             type: "text" },
  { key: "family",                  header: "Family",           type: "select", options: ["RM","SFG","FG","Returnable"] },
  { key: "subfamily",               header: "Subfamily",        type: "text" },
  { key: "uom",                     header: "UOM",              type: "select", options: ["piece","kg","litre","metre"] },
  { key: "unit_weight_kg",          header: "Unit Weight (kg)", type: "number" },
  { key: "unit_volume_mm3",         header: "Unit Volume (mm³)",type: "number" },
  { key: "yield_default_override",  header: "Yield Override",   type: "number" },
  { key: "returnable_density_ratio",header: "Density Ratio",    type: "number" },
];

const CSV_HEADERS = ["code","name","family","subfamily","uom","unit_weight_kg","unit_volume_mm3","yield_default_override","returnable_density_ratio"];

function newMaterial(): Material {
  return {
    id: undefined as any, code: "", name: "",
    family: "RM", subfamily: "", uom: "piece",
    unit_weight_kg: 0, unit_volume_mm3: 0,
    yield_default_override: null,
    packaging_chain: [],
    returnable_density_ratio: null,
  };
}

export default function MaterialsPage() {
  const materials = useAppStore((s) => s.materials);
  const upsertMaterial = useAppStore((s) => s.upsertMaterial);
  const deleteMaterial = useAppStore((s) => s.deleteMaterial);

  function handleImport(rows: Record<string, string>[]) {
    rows.forEach((row) => upsertMaterial({
      id: undefined as any,
      code: row.code, name: row.name,
      family: row.family as MaterialFamily, subfamily: row.subfamily,
      uom: row.uom as UOM,
      unit_weight_kg: Number(row.unit_weight_kg),
      unit_volume_mm3: Number(row.unit_volume_mm3),
      yield_default_override: row.yield_default_override ? Number(row.yield_default_override) : null,
      packaging_chain: [],
      returnable_density_ratio: row.returnable_density_ratio ? Number(row.returnable_density_ratio) : null,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">🧱 Materials</h1>
        <p className="text-gray-500 text-sm mt-1">
          Every thing that flows through the factory. After creating materials here,
          go to Routes to define how each material moves through the factory.
        </p>
      </div>
      <CsvImport templateHeaders={CSV_HEADERS} templateFilename="materials-template.csv" onImport={handleImport} />
      <DataTable columns={COLUMNS} rows={materials} onSave={upsertMaterial} onDelete={deleteMaterial} newRowTemplate={newMaterial} />
      <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 text-sm text-gray-400">
        <strong className="text-gray-300">Note on Packaging Chain:</strong> After adding a material here,
        edit it to add packaging levels (inner box → outer box → pallet). Each level references a Packaging Master entry.
        The last level is always the pallet. This chain is needed for the engine to compute pallet quantities.
      </div>
    </div>
  );
}
```

---

## Task 13: Processes Page (`/processes`)

**Step 13.1** — Replace `src/app/processes/page.tsx`:

```tsx
"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import type { Process, ProcessType } from "@/types";

const COLUMNS: ColDef[] = [
  { key: "name",                    header: "Name",               type: "text" },
  { key: "type",                    header: "Type",               type: "select",
    options: ["identity-change","packaging-change","status-change","location-change","hold"] },
  { key: "input_status",            header: "Input Status",       type: "text" },
  { key: "output_status",           header: "Output Status",      type: "text" },
  { key: "default_residence_time_hr",header: "Residence Time (hr)",type: "number" },
  { key: "default_yield",           header: "Yield (0–1)",        type: "number" },
  { key: "production_target_pph",   header: "Target pph (lines only)", type: "number" },
];

function newProcess(): Process {
  return {
    id: undefined as any, name: "",
    type: "hold",
    input_status: "", output_status: "",
    default_residence_time_hr: 0,
    default_yield: 1,
    bom_inputs: [],
    production_target_pph: null,
  };
}

export default function ProcessesPage() {
  const processes = useAppStore((s) => s.processes);
  const upsertProcess = useAppStore((s) => s.upsertProcess);
  const deleteProcess = useAppStore((s) => s.deleteProcess);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">⚙️ Processes</h1>
        <p className="text-gray-500 text-sm mt-1">
          Named activities performed on materials. Define once, reuse across materials and stations.
        </p>
      </div>
      <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 text-sm text-gray-400 space-y-1">
        <p><strong className="text-gray-300">Types explained:</strong></p>
        <p>• <span className="text-indigo-400">identity-change</span> — Assembly/production: children → parent. Set BOM inputs after saving.</p>
        <p>• <span className="text-indigo-400">packaging-change</span> — Same material, different packaging (palletize, repack).</p>
        <p>• <span className="text-indigo-400">status-change</span> — Same material, different status (IQC, FGQC). Set yield {"<"} 1 for rejections.</p>
        <p>• <span className="text-indigo-400">location-change</span> — Transport between cells. Residence = 0 in v1.</p>
        <p>• <span className="text-indigo-400">hold</span> — Just waiting (ASRS storage, ageing, line-side buffer).</p>
      </div>
      <DataTable columns={COLUMNS} rows={processes} onSave={upsertProcess} onDelete={deleteProcess} newRowTemplate={newProcess} />
    </div>
  );
}
```

---

## Task 14: Routes Page (`/routes`)

**Step 14.1** — Replace `src/app/routes/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { Route, RouteStep } from "@/types";

export default function RoutesPage() {
  const materials = useAppStore((s) => s.materials);
  const processes = useAppStore((s) => s.processes);
  const routes = useAppStore((s) => s.routes);
  const upsertRoute = useAppStore((s) => s.upsertRoute);

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");

  const selectedRoute = routes.find((r) => r.material_id === selectedMaterialId);
  const [steps, setSteps] = useState<RouteStep[]>(selectedRoute?.steps ?? []);

  function handleMaterialChange(matId: string) {
    setSelectedMaterialId(matId);
    const r = routes.find((r) => r.material_id === matId);
    setSteps(r?.steps ?? []);
  }

  function addStep() {
    setSteps([...steps, { process_id: "", residence_time_hr_override: null }]);
  }

  function removeStep(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i));
  }

  function updateStep(i: number, key: keyof RouteStep, value: unknown) {
    const next = [...steps];
    (next[i] as any)[key] = value;
    setSteps(next);
  }

  function moveStep(i: number, dir: -1 | 1) {
    const next = [...steps];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  }

  async function handleSave() {
    if (!selectedMaterialId) return;
    await upsertRoute({
      id: selectedRoute?.id,
      material_id: selectedMaterialId,
      steps,
    } as Route);
    alert("Route saved!");
  }

  const processMap = new Map(processes.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">🗺 Routes</h1>
        <p className="text-gray-500 text-sm mt-1">
          The ordered list of processes each material goes through — from receipt to dispatch.
          Select a material, build its route step by step, then save.
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Select Material</label>
        <select
          value={selectedMaterialId}
          onChange={(e) => handleMaterialChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm w-72"
        >
          <option value="">— choose a material —</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name} ({m.family})</option>
          ))}
        </select>
      </div>

      {selectedMaterialId && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-300">Route Steps (in order)</h2>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
              <span className="text-gray-500 text-sm w-6">{i + 1}.</span>
              <select
                value={step.process_id}
                onChange={(e) => updateStep(i, "process_id", e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 text-sm flex-1"
              >
                <option value="">— select process —</option>
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Residence override (hr):</label>
                <input
                  type="number"
                  value={step.residence_time_hr_override ?? ""}
                  placeholder="use default"
                  onChange={(e) => updateStep(i, "residence_time_hr_override", e.target.value ? Number(e.target.value) : null)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 text-sm w-28"
                />
              </div>
              <button onClick={() => moveStep(i, -1)} className="text-gray-500 hover:text-gray-300 text-sm">↑</button>
              <button onClick={() => moveStep(i, 1)} className="text-gray-500 hover:text-gray-300 text-sm">↓</button>
              <button onClick={() => removeStep(i)} className="text-red-400 hover:text-red-300 text-sm">✕</button>
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={addStep} className="text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-800 px-3 py-1.5 rounded-lg">
              + Add Step
            </button>
            <button onClick={handleSave} className="text-sm text-green-400 hover:text-green-300 border border-green-800 px-3 py-1.5 rounded-lg">
              Save Route
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Task 15: Stations Page (`/stations`)

**Step 15.1** — Replace `src/app/stations/page.tsx`:

```tsx
"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import type { Station } from "@/types";

export default function StationsPage() {
  const stations = useAppStore((s) => s.stations);
  const cells = useAppStore((s) => s.cells);
  const processes = useAppStore((s) => s.processes);
  const upsertStation = useAppStore((s) => s.upsertStation);
  const deleteStation = useAppStore((s) => s.deleteStation);

  const COLUMNS: ColDef[] = [
    { key: "name",                   header: "Name",               type: "text" },
    { key: "cell_id",                header: "Cell",               type: "select", options: cells.map((c) => c.id) },
    { key: "process_id",             header: "Process",            type: "select", options: processes.map((p) => p.id) },
    { key: "peak_throughput_pph",    header: "Peak pph",           type: "number" },
    { key: "holding_capacity_pallets",header: "Holding (pallets)", type: "number" },
    { key: "operating_hours_per_day",header: "Op. Hours/Day",      type: "number" },
    { key: "footprint_length_mm",    header: "Footprint L (mm)",   type: "number" },
    { key: "footprint_width_mm",     header: "Footprint W (mm)",   type: "number" },
    { key: "is_asrs",                header: "Is ASRS?",           type: "boolean" },
    { key: "is_reject_station",      header: "Is Reject Station?", type: "boolean" },
  ];

  function newStation(): Station {
    return {
      id: undefined as any, name: "",
      cell_id: "", process_id: "",
      peak_throughput_pph: 0,
      holding_capacity_pallets: 0,
      operating_hours_per_day: 16,
      footprint_length_mm: 0, footprint_width_mm: 0,
      is_asrs: false, is_reject_station: false,
      reject_family: null, allocations: [],
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">🏭 Stations</h1>
        <p className="text-gray-500 text-sm mt-1">
          Physical equipment/areas at a cell that perform one process.
          After creating a station, set its material allocations (days of stock or residence override).
        </p>
      </div>
      <DataTable columns={COLUMNS} rows={stations} onSave={upsertStation} onDelete={deleteStation} newRowTemplate={newStation} />
    </div>
  );
}
```

---

## Task 16: Edges Page (`/edges`)

**Step 16.1** — Replace `src/app/edges/page.tsx`:

```tsx
"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import type { Edge } from "@/types";

export default function EdgesPage() {
  const edges = useAppStore((s) => s.edges);
  const cells = useAppStore((s) => s.cells);
  const upsertEdge = useAppStore((s) => s.upsertEdge);
  const deleteEdge = useAppStore((s) => s.deleteEdge);

  const cellOptions = cells.map((c) => c.id);

  const COLUMNS: ColDef[] = [
    { key: "name",           header: "Name",          type: "text" },
    { key: "type",           header: "Type",          type: "select", options: ["lane","elevator","bridge","dock-link"] },
    { key: "from_cell_id",   header: "From Cell",     type: "select", options: cellOptions },
    { key: "to_cell_id",     header: "To Cell",       type: "select", options: cellOptions },
    { key: "bidirectional",  header: "Bidirectional", type: "boolean" },
    { key: "capacity_pph",   header: "Capacity (pph)",type: "number" },
  ];

  function newEdge(): Edge {
    return {
      id: undefined as any, name: "",
      from_cell_id: "", to_cell_id: "",
      type: "lane", bidirectional: true,
      capacity_pph: 0, materials_allowed: [],
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">🛤 Edges</h1>
        <p className="text-gray-500 text-sm mt-1">
          Physical connections between cells: elevators, lanes, bridges.
          In v1, edges are stored but not used in calculations (lane traversal is instantaneous).
          Enter them now so v2 routing works without data migration.
        </p>
      </div>
      <DataTable columns={COLUMNS} rows={edges} onSave={upsertEdge} onDelete={deleteEdge} newRowTemplate={newEdge} />
    </div>
  );
}
```

**Step 16.2** — Commit all module pages:
```powershell
git add .
git commit -m "feat: all 6 data-entry module pages (cells, packaging, materials, processes, routes, stations, edges)"
```

---

## Checklist

- [ ] `/cells` page: shows DataTable + CSV import
- [ ] `/packaging` page: shows DataTable + CSV import
- [ ] `/materials` page: shows DataTable + CSV import + packaging note
- [ ] `/processes` page: shows DataTable with type explanation
- [ ] `/routes` page: shows material picker + step builder with up/down/remove
- [ ] `/stations` page: shows DataTable
- [ ] `/edges` page: shows DataTable
- [ ] All pages compile with `npx tsc --noEmit`
- [ ] `git commit` done

**➡ Continue with: `plan-07-analysis-and-reports.md`**
