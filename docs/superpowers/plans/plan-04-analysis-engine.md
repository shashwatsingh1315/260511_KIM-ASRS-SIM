# ASRS-Choker — Plan Part 4: Analysis Engine

> **Prerequisite:** Complete plans 01–03 first.
> **Goal:** Build `src/lib/engine.ts` — demand propagation, WIP, station checks, cell checks, pallet pool sizing, conservation closure.
> **When done:** Calling `runAnalysis(storeData)` returns a complete `AnalysisResult`.

---

## How the Engine Works (Plain English)

The engine runs these 6 steps in order:

1. **Demand Propagation** — Start from production targets (user-entered peak pph for each FG line). Walk up the BOM tree to calculate how many pallets/hour of each raw material is needed.
2. **WIP Calculation** — For every step in every route: `WIP = throughput_pph × residence_time_hr`. This tells us how many pallets are sitting at each station at any moment.
3. **Station Capacity Check** — For each station: does the total throughput it must handle exceed its `peak_throughput_pph`? Does the total WIP exceed its `holding_capacity_pallets`?
4. **Cell Footprint Check** — For each cell: does the sum of station footprints exceed the cell's floor area?
5. **Pallet Pool Sizing** — Total pallets needed = sum of all WIP across all stations.
6. **Conservation Closure** — For every (material, status) pair: inflow must equal outflow within rounding.

---

## Task 5: Create the Analysis Engine

**Step 5.1** — Create `src/lib/engine.ts`:

```typescript
import type {
  Cell, Material, Process, Route, RouteStep,
  Station, EngineConfig,
  StepDemand, StepWIP, StationCheck, CellCheck, Alert, AnalysisResult,
} from "@/types";
import { validateNetwork, ValidationInput } from "./validation";

export interface EngineInput extends ValidationInput {}

// ─────────────────────────────────────────────────────────────────
// HELPER: Get units_per_pallet for a material
// The last entry in packaging_chain is the pallet level.
// units_per_pallet = product of all qty_per_parent values in the chain.
// Example: [10 units/box, 7 boxes/pallet] → 70 units/pallet
// ─────────────────────────────────────────────────────────────────
function getUnitsPerPallet(mat: Material): number {
  if (!mat.packaging_chain || mat.packaging_chain.length === 0) return 1;
  return mat.packaging_chain.reduce((product, level) => product * level.qty_per_parent, 1);
}

// ─────────────────────────────────────────────────────────────────
// STEP 1: Demand Propagation (Axiom A2)
//
// Algorithm:
//   a) Find all identity-change processes that have a production_target_pph set.
//      These are the "production lines" — the starting point of demand.
//   b) Build the BOM graph: for each identity-change process, its bom_inputs
//      tell us which child materials (and how many) are consumed per unit of parent.
//   c) Topological sort from FG → RM.
//   d) Propagate demand: D(child) = D(parent) × qty_per_parent / yield(parent)
// ─────────────────────────────────────────────────────────────────
function computeDemand(data: EngineInput): Map<string, number> {
  // materialDemand[material_id] = peak units per hour
  const demandPph = new Map<string, number>();
  const processMap = new Map(data.processes.map((p) => [p.id, p]));
  const materialMap = new Map(data.materials.map((m) => [m.id, m]));

  // Seed: production targets from identity-change stations
  for (const st of data.stations) {
    const proc = processMap.get(st.process_id);
    if (!proc || proc.type !== "identity-change" || !proc.production_target_pph) continue;

    // The station produces an FG/SFG. Which material does this station produce?
    // We find it by looking at which material's route has this process as a step.
    for (const route of data.routes) {
      const hasStep = route.steps.some((s) => s.process_id === st.process_id);
      if (!hasStep) continue;
      const mat = materialMap.get(route.material_id);
      if (!mat) continue;

      const unitsPerPallet = getUnitsPerPallet(mat);
      const targetUnitsPph = proc.production_target_pph * unitsPerPallet;
      demandPph.set(mat.id, (demandPph.get(mat.id) || 0) + targetUnitsPph);
    }
  }

  // BFS/topological propagation: for each identity-change process,
  // propagate demand from parent to children.
  // We process in multiple passes until stable (handles multi-level BOMs).
  let changed = true;
  let passes = 0;
  while (changed && passes < 50) {
    changed = false;
    passes++;
    for (const proc of data.processes) {
      if (proc.type !== "identity-change") continue;

      // Find which material this process PRODUCES (look in routes)
      for (const route of data.routes) {
        const hasStep = route.steps.some((s) => s.process_id === proc.id);
        if (!hasStep) continue;
        const parentMat = materialMap.get(route.material_id);
        if (!parentMat) continue;

        const parentDemandUnits = demandPph.get(parentMat.id) || 0;
        if (parentDemandUnits === 0) continue;

        const yieldRate = parentMat.yield_default_override ?? data.engineConfig.global_yield_default;

        // Propagate to each child in BOM
        for (const inp of proc.bom_inputs) {
          const childDemand = (parentDemandUnits * inp.qty_per_parent) / yieldRate;
          const prev = demandPph.get(inp.child_material_id) || 0;
          if (Math.abs(childDemand - prev) > 0.001) {
            demandPph.set(inp.child_material_id, childDemand);
            changed = true;
          }
        }
      }
    }
  }

  return demandPph;
}

// ─────────────────────────────────────────────────────────────────
// STEP 2: Build StepDemands — demand at every route step
// For status-change steps: demand at input = demand_at_output / yield
// For all other steps: demand passes through unchanged.
// ─────────────────────────────────────────────────────────────────
function buildStepDemands(data: EngineInput, materialDemandPph: Map<string, number>): StepDemand[] {
  const results: StepDemand[] = [];
  const processMap = new Map(data.processes.map((p) => [p.id, p]));
  const materialMap = new Map(data.materials.map((m) => [m.id, m]));

  for (const route of data.routes) {
    const mat = materialMap.get(route.material_id);
    if (!mat) continue;

    const unitsPerPallet = getUnitsPerPallet(mat);
    let throughputUnits = materialDemandPph.get(mat.id) || 0;

    // Walk route steps in REVERSE to propagate yield upstream
    const stepsReversed = [...route.steps].reverse();
    const stepThroughputs: number[] = new Array(route.steps.length).fill(0);

    let currentThroughput = throughputUnits;
    for (let i = stepsReversed.length - 1; i >= 0; i--) {
      const step = stepsReversed[i];
      const proc = processMap.get(step.process_id);
      stepThroughputs[stepsReversed.length - 1 - i] = currentThroughput;
      if (proc?.type === "status-change") {
        currentThroughput = currentThroughput / proc.default_yield;
      }
    }
    // Re-reverse to get forward order
    stepThroughputs.reverse();

    for (let i = 0; i < route.steps.length; i++) {
      const step = route.steps[i];
      const proc = processMap.get(step.process_id);
      const tUnits = stepThroughputs[i];
      const tPallets = Math.ceil(tUnits / unitsPerPallet);
      const operatingHours = data.stations.find((s) => s.process_id === step.process_id)?.operating_hours_per_day
        ?? data.engineConfig.working_hours_per_day;

      results.push({
        material_id: mat.id,
        process_id: step.process_id,
        throughput_units_pph: tUnits,
        throughput_pallets_pph: tPallets,
        throughput_daily_pallets: tPallets * operatingHours,
        is_reject_branch: false,
      });

      // Also produce the reject branch demand for status-change steps
      if (proc?.type === "status-change") {
        const rejectThroughput = tUnits * (1 - proc.default_yield);
        const rejectPallets = Math.ceil(rejectThroughput / unitsPerPallet);
        results.push({
          material_id: mat.id,
          process_id: step.process_id,
          throughput_units_pph: rejectThroughput,
          throughput_pallets_pph: rejectPallets,
          throughput_daily_pallets: rejectPallets * operatingHours,
          is_reject_branch: true,
        });
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────
// STEP 3: WIP Calculation (Axiom A10: Little's Law)
// WIP_pallets = throughput_pph × residence_time_hr
// ─────────────────────────────────────────────────────────────────
function buildStepWIPs(data: EngineInput, stepDemands: StepDemand[]): StepWIP[] {
  const results: StepWIP[] = [];
  const processMap = new Map(data.processes.map((p) => [p.id, p]));
  const routeMap = new Map(data.routes.map((r) => [r.material_id, r]));
  const materialMap = new Map(data.materials.map((m) => [m.id, m]));

  for (const demand of stepDemands) {
    if (demand.is_reject_branch) continue; // reject branch WIP counted at reject station

    const proc = processMap.get(demand.process_id);
    if (!proc) continue;

    // Get residence time: check route step override first, then process default
    const route = routeMap.get(demand.material_id);
    const routeStep = route?.steps.find((s) => s.process_id === demand.process_id);
    const residenceHr = routeStep?.residence_time_hr_override ?? proc.default_residence_time_hr;

    // For ASRS hold stations: use days_of_stock from the station's allocation
    const station = data.stations.find((s) => s.process_id === demand.process_id);
    let effectiveResidenceHr = residenceHr;
    if (station?.is_asrs) {
      const alloc = station.allocations.find((a) => a.material_id === demand.material_id);
      if (alloc?.days_of_stock != null) {
        effectiveResidenceHr = alloc.days_of_stock * 24;
      }
    } else if (station) {
      const alloc = station.allocations.find((a) => a.material_id === demand.material_id);
      if (alloc?.residence_time_hr_override != null) {
        effectiveResidenceHr = alloc.residence_time_hr_override;
      }
    }

    const wip = demand.throughput_pallets_pph * effectiveResidenceHr;

    results.push({
      material_id: demand.material_id,
      process_id: demand.process_id,
      wip_pallets: wip,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────
// STEP 4: Station Capacity Checks (Axiom A5)
// ─────────────────────────────────────────────────────────────────
function checkStations(data: EngineInput, stepDemands: StepDemand[], stepWIPs: StepWIP[]): StationCheck[] {
  const results: StationCheck[] = [];
  const cellMap = new Map(data.cells.map((c) => [c.id, c]));

  for (const station of data.stations) {
    // Sum throughput across all materials assigned to this station
    const stationDemands = stepDemands.filter((d) => d.process_id === station.process_id && !d.is_reject_branch);
    const totalThroughputRequired = stationDemands.reduce((s, d) => s + d.throughput_pallets_pph, 0);

    // Sum WIP across all materials at this station
    const stationWIPs = stepWIPs.filter((w) => w.process_id === station.process_id);
    const totalHoldingRequired = stationWIPs.reduce((s, w) => s + w.wip_pallets, 0);

    const tGap = station.peak_throughput_pph - totalThroughputRequired;
    const hGap = station.holding_capacity_pallets - totalHoldingRequired;
    const cell = cellMap.get(station.cell_id);

    results.push({
      station_id: station.id,
      station_name: station.name,
      cell_id: station.cell_id,
      throughput_required_pph: totalThroughputRequired,
      throughput_capacity_pph: station.peak_throughput_pph,
      throughput_gap_pph: tGap,
      throughput_bottleneck: tGap < 0,
      holding_required_pallets: totalHoldingRequired,
      holding_capacity_pallets: station.holding_capacity_pallets,
      holding_gap_pallets: hGap,
      holding_bottleneck: hGap < 0,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────
// STEP 5: Cell Footprint Checks (Axiom A4)
// ─────────────────────────────────────────────────────────────────
function checkCells(data: EngineInput): CellCheck[] {
  const results: CellCheck[] = [];
  const cellMap = new Map(data.cells.map((c) => [c.id, c]));

  const stationsByCell = new Map<string, Station[]>();
  for (const st of data.stations) {
    if (!stationsByCell.has(st.cell_id)) stationsByCell.set(st.cell_id, []);
    stationsByCell.get(st.cell_id)!.push(st);
  }

  for (const [cellId, stations] of stationsByCell) {
    const cell = cellMap.get(cellId);
    if (!cell) continue;
    const required = stations.reduce((s, st) => s + st.footprint_length_mm * st.footprint_width_mm, 0);
    const available = cell.length_mm * cell.width_mm;
    const gap = available - required;
    results.push({
      cell_id: cell.id,
      cell_name: cell.name,
      footprint_required_mm2: required,
      footprint_available_mm2: available,
      footprint_gap_mm2: gap,
      footprint_bottleneck: gap < 0,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────
// STEP 6: Pallet Pool Sizing (Axiom A11)
// Total pallets needed = sum of all WIP across all stations
// ─────────────────────────────────────────────────────────────────
function computePalletPool(stepWIPs: StepWIP[]): number {
  return stepWIPs.reduce((sum, w) => sum + w.wip_pallets, 0);
}

// ─────────────────────────────────────────────────────────────────
// STEP 7: Conservation Closure (Axiom A1)
// For every (material, status) pair: inflow must equal outflow.
// We approximate this by checking that every material used in a
// BOM input actually appears in a route (is produced somewhere).
// ─────────────────────────────────────────────────────────────────
function checkConservation(data: EngineInput): Alert[] {
  const alerts: Alert[] = [];
  const routeMaterialIds = new Set(data.routes.map((r) => r.material_id));
  const processMap = new Map(data.processes.map((p) => [p.id, p]));
  const materialMap = new Map(data.materials.map((m) => [m.id, m]));

  for (const proc of data.processes) {
    if (proc.type !== "identity-change") continue;
    for (const inp of proc.bom_inputs) {
      if (!routeMaterialIds.has(inp.child_material_id)) {
        const mat = materialMap.get(inp.child_material_id);
        alerts.push({
          severity: "error",
          category: "conservation",
          message: `Material "${mat?.name ?? inp.child_material_id}" is consumed in BOM but has no route — its inflow is untracked.`,
          entity_id: inp.child_material_id,
        });
      }
    }
  }

  return alerts;
}

// ─────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────
export function runAnalysis(data: EngineInput): AnalysisResult {
  // Always run validation first
  const validationErrors = validateNetwork(data);
  if (validationErrors.length > 0) {
    return {
      is_valid: false,
      validation_errors: validationErrors,
      step_demands: [],
      step_wips: [],
      station_checks: [],
      cell_checks: [],
      total_pallets_needed: 0,
      pallet_pool_gap: null,
      alerts: validationErrors.map((e) => ({
        severity: "error" as const,
        category: "validation" as const,
        message: e,
      })),
    };
  }

  // Run the engine steps
  const materialDemandPph = computeDemand(data);
  const stepDemands = buildStepDemands(data, materialDemandPph);
  const stepWIPs = buildStepWIPs(data, stepDemands);
  const stationChecks = checkStations(data, stepDemands, stepWIPs);
  const cellChecks = checkCells(data);
  const totalPalletsNeeded = computePalletPool(stepWIPs);
  const conservationAlerts = checkConservation(data);

  // Build alerts from all checks
  const alerts: Alert[] = [...conservationAlerts];

  for (const sc of stationChecks) {
    if (sc.throughput_bottleneck) {
      alerts.push({
        severity: "error",
        category: "throughput",
        message: `Station "${sc.station_name}": requires ${sc.throughput_required_pph.toFixed(1)} pph but capacity is only ${sc.throughput_capacity_pph} pph (gap: ${sc.throughput_gap_pph.toFixed(1)}).`,
        entity_id: sc.station_id,
      });
    }
    if (sc.holding_bottleneck) {
      alerts.push({
        severity: "error",
        category: "holding",
        message: `Station "${sc.station_name}": needs ${sc.holding_required_pallets.toFixed(0)} pallet slots but only has ${sc.holding_capacity_pallets} (gap: ${sc.holding_gap_pallets.toFixed(0)}).`,
        entity_id: sc.station_id,
      });
    }
  }

  for (const cc of cellChecks) {
    if (cc.footprint_bottleneck) {
      alerts.push({
        severity: "error",
        category: "footprint",
        message: `Cell "${cc.cell_name}": stations need ${(cc.footprint_required_mm2 / 1e6).toFixed(1)} m² but cell is only ${(cc.footprint_available_mm2 / 1e6).toFixed(1)} m².`,
        entity_id: cc.cell_id,
      });
    }
  }

  const palletPoolDeclared = data.engineConfig.pallet_pool_declared;
  let palletPoolGap: number | null = null;
  if (palletPoolDeclared !== null) {
    palletPoolGap = palletPoolDeclared - totalPalletsNeeded;
    if (palletPoolGap < 0) {
      alerts.push({
        severity: "error",
        category: "pallet-pool",
        message: `Pallet pool shortage: system needs ${totalPalletsNeeded.toFixed(0)} pallets but only ${palletPoolDeclared} are declared (gap: ${palletPoolGap.toFixed(0)}).`,
      });
    }
  }

  return {
    is_valid: true,
    validation_errors: [],
    step_demands: stepDemands,
    step_wips: stepWIPs,
    station_checks: stationChecks,
    cell_checks: cellChecks,
    total_pallets_needed: totalPalletsNeeded,
    pallet_pool_gap: palletPoolGap,
    alerts,
  };
}
```

**Step 5.2** — Verify it compiles:
```powershell
npx tsc --noEmit
```

**Step 5.3** — Commit:
```powershell
git add .
git commit -m "feat: analysis engine (demand, WIP, station checks, cell checks, pool sizing)"
```

---

## How to Verify the Engine is Correct (Manual Test)

Use the example from Section 10 of `logic-spec-v1.0.md`. Enter this data through the UI (built in Plan 05) and click Run Analysis. You should see:

| Check | Expected value |
|-------|---------------|
| RM-PCB demand at IQC step | ≈ 111.97 pph |
| IQC-RM WIP for RM-PCB | ≈ 457 pallets |
| FGQC WIP for FG-Meter-SP | ≈ 202 pallets |
| ASRS WIP for RM-PCB | ≈ 18,800 pallets |
| ST-IQC-RM bottleneck | YES (holding: 457 > 80) |
| ST-FGQC bottleneck | YES (holding: 202 > 30) |
| ST-ASRS bottleneck | YES (holding: 18,800 > 2,000) |

---

## Checklist

- [ ] `src/lib/engine.ts` created
- [ ] `npx tsc --noEmit` = zero errors
- [ ] `git commit -m "feat: analysis engine"` done

**➡ Continue with: `plan-05-ui.md`**
