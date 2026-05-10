import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firestore";
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
// Generic helpers — all collections use these
// ─────────────────────────────────────────────

/**
 * Load every document from a Firestore collection.
 * The document's Firestore ID is merged into the returned object as `id`.
 */
export async function getAll<T>(collectionName: string): Promise<T[]> {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

/**
 * Save (create or update) one document.
 * - If `data.id` exists → update that specific document.
 * - If `data.id` is missing → create a new document (Firestore generates the ID).
 * Returns the final ID.
 */
export async function upsert<T extends { id?: string }>(
  collectionName: string,
  data: T
): Promise<string> {
  const { id, ...rest } = data as Record<string, unknown>;
  if (id) {
    await setDoc(doc(db, collectionName, id as string), rest, { merge: true });
    return id as string;
  }
  const ref = await addDoc(collection(db, collectionName), rest);
  return ref.id;
}

/**
 * Delete one document by its ID.
 */
export async function remove(
  collectionName: string,
  id: string
): Promise<void> {
  await deleteDoc(doc(db, collectionName, id));
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
    const snap = await getDoc(doc(db, "engineConfig", "global"));
    if (snap.exists()) return snap.data() as EngineConfig;
    // Return sensible defaults if not yet configured
    return {
      global_yield_default: 0.97,
      working_hours_per_day: 16,
      pallet_pool_declared: null,
    };
  },
  set: (d: EngineConfig) =>
    setDoc(doc(db, "engineConfig", "global"), d, { merge: true }),
};
