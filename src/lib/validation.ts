import type {
  Cell, Material, Process, Route, Station, Edge,
  FamilyStatusConfig, EngineConfig,
} from "@/types";

export interface ValidationInput {
  cells: Cell[];
  materials: Material[];
  processes: Process[];
  routes: Route[];
  stations: Station[];
  edges: Edge[];
  familyStatuses: FamilyStatusConfig[];
  engineConfig: EngineConfig;
}

/**
 * Run all 15 validation rules.
 * Returns an array of human-readable error strings.
 * Empty array = all checks passed.
 */
export function validateNetwork(data: ValidationInput): string[] {
  const errors: string[] = [];

  const processMap = new Map(data.processes.map((p) => [p.id, p]));
  const materialMap = new Map(data.materials.map((m) => [m.id, m]));
  const cellMap = new Map(data.cells.map((c) => [c.id, c]));
  const routeMap = new Map(data.routes.map((r) => [r.material_id, r]));

  // ── Rule 1: BOM is acyclic ──────────────────────────────────
  // Build adjacency list from identity-change processes' bom_inputs
  const children: Record<string, string[]> = {};
  for (const p of data.processes) {
    if (p.type === "identity-change") {
      // The station that runs this process produces some FG/SFG
      // bom_inputs are the children consumed
      for (const inp of p.bom_inputs) {
        if (!children[p.id]) children[p.id] = [];
        children[p.id].push(inp.child_material_id);
      }
    }
  }
  // Simple cycle check: DFS with visited/inStack sets
  const visited = new Set<string>();
  const inStack = new Set<string>();
  function hasCycle(node: string): boolean {
    visited.add(node);
    inStack.add(node);
    for (const child of children[node] || []) {
      if (!visited.has(child) && hasCycle(child)) return true;
      if (inStack.has(child)) return true;
    }
    inStack.delete(node);
    return false;
  }
  for (const mat of data.materials) {
    if (!visited.has(mat.id) && hasCycle(mat.id)) {
      errors.push(`Rule 1: BOM contains a cycle involving material "${mat.name}" (${mat.id}). Cycles are not allowed.`);
      break;
    }
  }

  // ── Rule 2: Every material has a route ──────────────────────
  for (const mat of data.materials) {
    if (!routeMap.has(mat.id)) {
      errors.push(`Rule 2: Material "${mat.name}" (${mat.id}) has no route defined.`);
    }
  }

  // ── Rule 3: Every route step references an existing process ─
  for (const route of data.routes) {
    const mat = materialMap.get(route.material_id);
    const matName = mat?.name ?? route.material_id;
    for (const step of route.steps) {
      if (!processMap.has(step.process_id)) {
        errors.push(`Rule 3: Route for "${matName}" references process "${step.process_id}" which does not exist.`);
      }
    }
  }

  // ── Rule 4: Status transitions are legal ────────────────────
  for (const route of data.routes) {
    const mat = materialMap.get(route.material_id);
    const matName = mat?.name ?? route.material_id;
    let prevOutputStatus: string | null = null;
    for (let i = 0; i < route.steps.length; i++) {
      const proc = processMap.get(route.steps[i].process_id);
      if (!proc) continue; // already caught by Rule 3
      if (prevOutputStatus !== null && proc.input_status !== prevOutputStatus) {
        errors.push(
          `Rule 4: Route for "${matName}", step ${i + 1} ("${proc.name}"): ` +
          `expects input status "${proc.input_status}" but previous step outputs "${prevOutputStatus}".`
        );
      }
      prevOutputStatus = proc.output_status;
    }
  }

  // ── Rule 5: Every process in every route has a station ──────
  const stationProcessIds = new Set(data.stations.map((s) => s.process_id));
  for (const route of data.routes) {
    const mat = materialMap.get(route.material_id);
    const matName = mat?.name ?? route.material_id;
    for (const step of route.steps) {
      if (!stationProcessIds.has(step.process_id)) {
        const proc = processMap.get(step.process_id);
        errors.push(
          `Rule 5: Process "${proc?.name ?? step.process_id}" used in route for "${matName}" has no station performing it.`
        );
      }
    }
  }

  // ── Rule 6: Every material has a packaging chain ending at pallet level ──
  for (const mat of data.materials) {
    if (!mat.packaging_chain || mat.packaging_chain.length === 0) {
      errors.push(`Rule 6: Material "${mat.name}" has no packaging chain. Must have at least one level (the pallet level).`);
    }
  }

  // ── Rule 7: Every material has unit_weight and unit_volume ──
  for (const mat of data.materials) {
    if (mat.unit_weight_kg == null || mat.unit_weight_kg <= 0) {
      errors.push(`Rule 7: Material "${mat.name}" is missing unit_weight_kg (must be > 0).`);
    }
    if (mat.unit_volume_mm3 == null || mat.unit_volume_mm3 <= 0) {
      errors.push(`Rule 7: Material "${mat.name}" is missing unit_volume_mm3 (must be > 0).`);
    }
  }

  // ── Rule 8: Every station has required fields ────────────────
  for (const st of data.stations) {
    if (!st.cell_id) errors.push(`Rule 8: Station "${st.name}" has no cell assigned.`);
    if (!st.process_id) errors.push(`Rule 8: Station "${st.name}" has no process assigned.`);
    if (st.peak_throughput_pph == null || st.peak_throughput_pph <= 0)
      errors.push(`Rule 8: Station "${st.name}" must have peak_throughput_pph > 0.`);
    if (st.operating_hours_per_day == null || st.operating_hours_per_day <= 0)
      errors.push(`Rule 8: Station "${st.name}" must have operating_hours_per_day > 0.`);
    if (st.footprint_length_mm == null || st.footprint_width_mm == null)
      errors.push(`Rule 8: Station "${st.name}" is missing footprint dimensions.`);
  }

  // ── Rule 9: Every cell with stations has dimensions ──────────
  const cellsWithStations = new Set(data.stations.map((s) => s.cell_id));
  for (const cellId of cellsWithStations) {
    const cell = cellMap.get(cellId);
    if (!cell) {
      errors.push(`Rule 9: Station references cell "${cellId}" which does not exist.`);
    } else if (!cell.length_mm || !cell.width_mm) {
      errors.push(`Rule 9: Cell "${cell.name}" has stations but is missing length_mm or width_mm.`);
    }
  }

  // ── Rule 10: All yield values in (0, 1] ──────────────────────
  for (const proc of data.processes) {
    if (proc.default_yield <= 0 || proc.default_yield > 1) {
      errors.push(`Rule 10: Process "${proc.name}" has default_yield=${proc.default_yield}. Must be in (0, 1].`);
    }
  }
  if (data.engineConfig.global_yield_default <= 0 || data.engineConfig.global_yield_default > 1) {
    errors.push(`Rule 10: Global yield default must be in (0, 1].`);
  }

  // ── Rule 11: All residence times >= 0 ────────────────────────
  for (const proc of data.processes) {
    if (proc.default_residence_time_hr < 0) {
      errors.push(`Rule 11: Process "${proc.name}" has negative default_residence_time_hr.`);
    }
  }
  for (const route of data.routes) {
    for (const step of route.steps) {
      if (step.residence_time_hr_override !== null && step.residence_time_hr_override < 0) {
        const mat = materialMap.get(route.material_id);
        errors.push(`Rule 11: Route for "${mat?.name}" has a step with negative residence_time_hr_override.`);
      }
    }
  }

  // ── Rule 12: Returnable density ratio >= 1 ───────────────────
  for (const mat of data.materials) {
    if (mat.family === "Returnable" && mat.returnable_density_ratio !== null) {
      if (mat.returnable_density_ratio < 1) {
        errors.push(`Rule 12: Material "${mat.name}" is Returnable but has density_ratio < 1.`);
      }
    }
  }

  // ── Rule 13: Receiving and dispatch stations exist per (family, subfamily) ──
  const usedSubfamilies = new Map<string, Set<string>>();
  for (const mat of data.materials) {
    if (!usedSubfamilies.has(mat.family)) usedSubfamilies.set(mat.family, new Set());
    usedSubfamilies.get(mat.family)!.add(mat.subfamily);
  }
  const receiveProcessIds = data.processes.filter((p) => p.name.toLowerCase().includes("receive")).map((p) => p.id);
  const dispatchProcessIds = data.processes.filter((p) => p.name.toLowerCase().includes("dispatch")).map((p) => p.id);
  const stationProcessSet = new Set(data.stations.map((s) => s.process_id));
  const hasReceive = receiveProcessIds.some((id) => stationProcessSet.has(id));
  const hasDispatch = dispatchProcessIds.some((id) => stationProcessSet.has(id));
  if (data.materials.length > 0 && !hasReceive) {
    errors.push(`Rule 13: No receiving station found. At least one station must perform a "receive" process.`);
  }
  if (data.materials.filter((m) => m.family === "FG").length > 0 && !hasDispatch) {
    errors.push(`Rule 13: No dispatch station found for FG materials. At least one station must perform a "dispatch" process.`);
  }

  // ── Rule 14: Reject station exists per family with status-change processes ──
  const familiesWithStatusChange = new Set<string>();
  for (const route of data.routes) {
    for (const step of route.steps) {
      const proc = processMap.get(step.process_id);
      if (proc?.type === "status-change") {
        const mat = materialMap.get(route.material_id);
        if (mat) familiesWithStatusChange.add(mat.family);
      }
    }
  }
  for (const family of familiesWithStatusChange) {
    const hasRejectStation = data.stations.some(
      (s) => s.is_reject_station && s.reject_family === family
    );
    if (!hasRejectStation) {
      errors.push(`Rule 14: Family "${family}" has status-change processes but no reject station is defined for it.`);
    }
  }

  // ── Rule 15: No two stations overlap footprint in the same cell ──
  const stationsByCell = new Map<string, Station[]>();
  for (const st of data.stations) {
    if (!stationsByCell.has(st.cell_id)) stationsByCell.set(st.cell_id, []);
    stationsByCell.get(st.cell_id)!.push(st);
  }
  for (const [cellId, sts] of stationsByCell) {
    const cell = cellMap.get(cellId);
    if (!cell) continue;
    const totalFootprint = sts.reduce(
      (sum, s) => sum + s.footprint_length_mm * s.footprint_width_mm,
      0
    );
    const cellArea = cell.length_mm * cell.width_mm;
    if (totalFootprint > cellArea) {
      errors.push(
        `Rule 15: Cell "${cell.name}" has stations totalling ${(totalFootprint / 1e6).toFixed(1)} m² ` +
        `but the cell is only ${(cellArea / 1e6).toFixed(1)} m². Stations overlap or don't fit.`
      );
    }
  }

  return errors;
}
