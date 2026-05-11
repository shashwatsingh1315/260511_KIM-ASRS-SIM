import type {
  Cell,
  PackagingMaster,
  Material,
  FamilyStatusConfig,
  Process,
  Route,
  Station,
  Edge,
  EngineConfig,
} from "@/types";

// ─────────────────────────────────────────────
// Generic helpers — LocalStorage implementation
// ─────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export async function getAll<T>(collectionName: string): Promise<T[]> {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(`asrs_${collectionName}`);
  return data ? JSON.parse(data) : [];
}

export async function upsert<T extends { id?: string }>(
  collectionName: string,
  data: T
): Promise<string> {
  const items = await getAll<T>(collectionName);
  const { id, ...rest } = data as Record<string, unknown>;
  
  if (id) {
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...rest } as any;
    } else {
      items.push({ id, ...rest } as any);
    }
    localStorage.setItem(`asrs_${collectionName}`, JSON.stringify(items));
    return id as string;
  }
  
  const newId = generateId();
  items.push({ id: newId, ...rest } as any);
  localStorage.setItem(`asrs_${collectionName}`, JSON.stringify(items));
  return newId;
}

export async function remove(
  collectionName: string,
  id: string
): Promise<void> {
  const items = await getAll<{ id: string }>(collectionName);
  const filtered = items.filter((i) => i.id !== id);
  localStorage.setItem(`asrs_${collectionName}`, JSON.stringify(filtered));
}

// ─────────────────────────────────────────────
// Typed wrappers — one per entity type
// Use these everywhere; don't call getAll/upsert/remove directly.
// ─────────────────────────────────────────────

export const CellsCol = {
  getAll: () => getAll<Cell>("cells"),
  upsert: (d: Cell) => upsert<Cell>("cells", d),
  remove: (id: string) => remove("cells", id),
};

export const PackagingMastersCol = {
  getAll: () => getAll<PackagingMaster>("packagingMasters"),
  upsert: (d: PackagingMaster) => upsert<PackagingMaster>("packagingMasters", d),
  remove: (id: string) => remove("packagingMasters", id),
};

export const MaterialsCol = {
  getAll: () => getAll<Material>("materials"),
  upsert: (d: Material) => upsert<Material>("materials", d),
  remove: (id: string) => remove("materials", id),
};

export const FamilyStatusesCol = {
  getAll: () => getAll<FamilyStatusConfig>("familyStatuses"),
  upsert: (d: FamilyStatusConfig) =>
    upsert<FamilyStatusConfig>("familyStatuses", d),
  remove: (id: string) => remove("familyStatuses", id),
};

export const ProcessesCol = {
  getAll: () => getAll<Process>("processes"),
  upsert: (d: Process) => upsert<Process>("processes", d),
  remove: (id: string) => remove("processes", id),
};

export const RoutesCol = {
  getAll: () => getAll<Route>("routes"),
  upsert: (d: Route) => upsert<Route>("routes", d),
  remove: (id: string) => remove("routes", id),
};

export const StationsCol = {
  getAll: () => getAll<Station>("stations"),
  upsert: (d: Station) => upsert<Station>("stations", d),
  remove: (id: string) => remove("stations", id),
};

export const EdgesCol = {
  getAll: () => getAll<Edge>("edges"),
  upsert: (d: Edge) => upsert<Edge>("edges", d),
  remove: (id: string) => remove("edges", id),
};

// Engine config is a single document with a fixed ID "global"
export const EngineConfigCol = {
  get: async (): Promise<EngineConfig> => {
    if (typeof window === "undefined") return getDefaultEngineConfig();
    const data = localStorage.getItem("asrs_engineConfig");
    if (data) return JSON.parse(data);
    return getDefaultEngineConfig();
  },
  set: async (d: EngineConfig) => {
    localStorage.setItem("asrs_engineConfig", JSON.stringify(d));
  },
};

function getDefaultEngineConfig(): EngineConfig {
  return {
    global_yield_default: 0.97,
    working_hours_per_day: 16,
    pallet_pool_declared: null,
  };
}
