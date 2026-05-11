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
import { getAllDb, upsertDb, removeDb, getConfigDb, setConfigDb } from "@/app/actions/db";

// ─────────────────────────────────────────────
// Generic helpers — Hybrid Local-First Implementation
// ─────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export async function getAll<T extends { id?: string }>(collectionName: string): Promise<T[]> {
  if (typeof window === "undefined") return [];
  
  let cloudData: T[] = [];
  try {
    cloudData = await getAllDb<T>(collectionName) || [];
  } catch (error) {
    console.warn(`Upstash fetch failed for ${collectionName}, falling back to local storage.`);
  }

  const localDataStr = localStorage.getItem(`asrs_${collectionName}`);
  const localData: T[] = localDataStr ? JSON.parse(localDataStr) : [];

  // Merge local and cloud data (Cloud wins conflicts)
  const mergedMap = new Map<string, T>();
  localData.forEach(item => { if (item.id) mergedMap.set(item.id, item); });
  cloudData.forEach(item => { if (item.id) mergedMap.set(item.id, item); });
  
  const mergedData = Array.from(mergedMap.values());

  // If local had data but cloud was empty, perform a one-time migration push
  if (localData.length > 0 && cloudData.length === 0) {
    try {
      await Promise.all(localData.map((item) => upsertDb(collectionName, item.id!, item)));
    } catch (e) {
      console.warn("Failed to migrate local data to Upstash", e);
    }
  }

  // Always keep local storage updated with the merged set
  localStorage.setItem(`asrs_${collectionName}`, JSON.stringify(mergedData));
  
  return mergedData;
}

export async function upsert<T extends { id?: string }>(
  collectionName: string,
  data: T
): Promise<string> {
  const items = await getAll<T>(collectionName);
  const { id, ...rest } = data as Record<string, unknown>;
  const resolvedId = (id as string) || generateId();
  const itemToSave = { id: resolvedId, ...rest } as any;
  
  // Update local items array
  const idx = items.findIndex((i: any) => i.id === resolvedId);
  if (idx >= 0) {
    items[idx] = itemToSave;
  } else {
    items.push(itemToSave);
  }
  
  // 1. Save to local storage immediately
  localStorage.setItem(`asrs_${collectionName}`, JSON.stringify(items));
  
  // 2. Async save to Upstash
  try {
    await upsertDb(collectionName, resolvedId, itemToSave);
  } catch (error) {
    console.warn(`Upstash upsert failed for ${collectionName}. Data is safe locally.`);
  }
  
  return resolvedId;
}

export async function remove(
  collectionName: string,
  id: string
): Promise<void> {
  const items = await getAll<{ id: string }>(collectionName);
  const filtered = items.filter((i) => i.id !== id);
  
  // 1. Save to local storage immediately
  localStorage.setItem(`asrs_${collectionName}`, JSON.stringify(filtered));
  
  // 2. Async remove from Upstash
  try {
    await removeDb(collectionName, id);
  } catch (error) {
    console.warn(`Upstash remove failed for ${collectionName}.`);
  }
}

// ─────────────────────────────────────────────
// Typed wrappers — one per entity type
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
    
    // Try Upstash first
    try {
      const cloudConfig = await getConfigDb<EngineConfig>("engineConfig");
      if (cloudConfig) {
        localStorage.setItem("asrs_engineConfig", JSON.stringify(cloudConfig));
        return cloudConfig;
      }
    } catch (error) {
      console.warn("Upstash config fetch failed, falling back to local.");
    }
    
    // Fallback
    const data = localStorage.getItem("asrs_engineConfig");
    if (data) return JSON.parse(data);
    return getDefaultEngineConfig();
  },
  set: async (d: EngineConfig) => {
    // 1. Save local
    localStorage.setItem("asrs_engineConfig", JSON.stringify(d));
    // 2. Save cloud
    try {
      await setConfigDb("engineConfig", d);
    } catch (error) {
      console.warn("Upstash config save failed.");
    }
  },
};

function getDefaultEngineConfig(): EngineConfig {
  return {
    global_yield_default: 0.97,
    working_hours_per_day: 16,
    pallet_pool_declared: null,
  };
}
