# ASRS-Choker — Plan Part 2: Firestore CRUD + Zustand Store

> **Prerequisite:** Complete `plan-01-scaffold-and-types.md` first.
> **What you do here:** Wire up the database (Firestore) so data is saved and loaded, and build the in-memory store (Zustand) that the UI reads from.
> **When you're done:** The app loads all data from Firestore into memory on startup, and every save/delete is synced to Firestore with undo support.

---

## Background: How Data Flows

```
Firestore (cloud database)
       ↕  (on startup: load all; on every edit: write immediately)
Zustand Store (in-memory, in the browser)
       ↕  (React components read from here)
UI Components
```

The user never waits for Firestore — they see the in-memory store immediately. Every edit is pushed to Firestore in the background.

**Firestore collections** (one per entity type):

| Collection | TypeScript Type |
|------------|----------------|
| `cells` | `Cell` |
| `packagingMasters` | `PackagingMaster` |
| `materials` | `Material` |
| `familyStatuses` | `FamilyStatusConfig` |
| `processes` | `Process` |
| `routes` | `Route` |
| `stations` | `Station` |
| `edges` | `Edge` |
| `engineConfig` | `EngineConfig` (single doc, id = "global") |

---

## Task 2: Firestore CRUD Helpers

### What you're doing
Creating `src/lib/collections.ts` — a set of functions for reading, writing, and deleting each Firestore collection. All other code calls these functions; nothing else touches Firestore directly.

### Step-by-step

**Step 2.1** — Create `src/lib/collections.ts`:

```typescript
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
```

**Step 2.2** — Verify it compiles:
```powershell
npx tsc --noEmit
```
Zero errors expected.

**Step 2.3** — Commit:
```powershell
git add .
git commit -m "feat: Firestore CRUD helpers"
```

---

## Task 3: Zustand Store with Undo

### What you're doing
Creating `src/store/useAppStore.ts` — the in-memory state of the whole app. Every React component reads data from here instead of fetching from Firestore directly.

### How undo works
Before every destructive action (upsert or delete), we take a snapshot of the current state and push it to `undoPast[]`. Calling `undo()` pops the last snapshot, restores the state, and re-syncs Firestore. `redo()` works the same way in reverse.

### Step-by-step

**Step 3.1** — Create `src/store/useAppStore.ts`:

```typescript
import { create } from "zustand";
import type {
  Cell, PackagingMaster, Material, FamilyStatusConfig,
  Process, Route, Station, Edge, EngineConfig, AnalysisResult, AppState,
} from "@/types";
import {
  CellsCol, PackagingMastersCol, MaterialsCol, FamilyStatusesCol,
  ProcessesCol, RoutesCol, StationsCol, EdgesCol, EngineConfigCol,
} from "@/lib/collections";

// ─────────────────────────────────────────────────────────────
// Snapshot type — everything we save for undo (no undo stack itself)
// ─────────────────────────────────────────────────────────────
type Snapshot = {
  cells: Cell[];
  packagingMasters: PackagingMaster[];
  materials: Material[];
  familyStatuses: FamilyStatusConfig[];
  processes: Process[];
  routes: Route[];
  stations: Station[];
  edges: Edge[];
  engineConfig: EngineConfig;
};

function takeSnapshot(s: StoreState): Snapshot {
  return {
    cells: s.cells,
    packagingMasters: s.packagingMasters,
    materials: s.materials,
    familyStatuses: s.familyStatuses,
    processes: s.processes,
    routes: s.routes,
    stations: s.stations,
    edges: s.edges,
    engineConfig: s.engineConfig,
  };
}

// ─────────────────────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────────────────────
interface StoreState {
  // Data
  cells: Cell[];
  packagingMasters: PackagingMaster[];
  materials: Material[];
  familyStatuses: FamilyStatusConfig[];
  processes: Process[];
  routes: Route[];
  stations: Station[];
  edges: Edge[];
  engineConfig: EngineConfig;

  // UI state
  isLoading: boolean;
  lastAnalysisResult: AnalysisResult | null;

  // Undo/redo (session only — lost on page refresh)
  undoPast: Snapshot[];
  undoFuture: Snapshot[];

  // Actions
  loadAll: () => Promise<void>;
  setAnalysisResult: (r: AnalysisResult | null) => void;

  // --- Cells ---
  upsertCell: (item: Cell) => Promise<void>;
  deleteCell: (id: string) => Promise<void>;

  // --- Packaging Masters ---
  upsertPackagingMaster: (item: PackagingMaster) => Promise<void>;
  deletePackagingMaster: (id: string) => Promise<void>;

  // --- Materials ---
  upsertMaterial: (item: Material) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;

  // --- Family Statuses ---
  upsertFamilyStatus: (item: FamilyStatusConfig) => Promise<void>;
  deleteFamilyStatus: (id: string) => Promise<void>;

  // --- Processes ---
  upsertProcess: (item: Process) => Promise<void>;
  deleteProcess: (id: string) => Promise<void>;

  // --- Routes ---
  upsertRoute: (item: Route) => Promise<void>;
  deleteRoute: (id: string) => Promise<void>;

  // --- Stations ---
  upsertStation: (item: Station) => Promise<void>;
  deleteStation: (id: string) => Promise<void>;

  // --- Edges ---
  upsertEdge: (item: Edge) => Promise<void>;
  deleteEdge: (id: string) => Promise<void>;

  // --- Engine Config ---
  setEngineConfig: (cfg: EngineConfig) => Promise<void>;

  // --- Undo/Redo ---
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Helper: push snapshot before a mutation (for undo)
// ─────────────────────────────────────────────────────────────
function pushUndo(set: any, get: any) {
  const snapshot = takeSnapshot(get());
  set((s: StoreState) => ({
    undoPast: [...s.undoPast, snapshot],
    undoFuture: [],  // clear redo stack whenever a new action is taken
  }));
}

// ─────────────────────────────────────────────────────────────
// Helper: replace a single item in an array by id
// ─────────────────────────────────────────────────────────────
function upsertInArray<T extends { id?: string }>(arr: T[], item: T): T[] {
  const idx = arr.findIndex((x) => (x as any).id === (item as any).id);
  if (idx === -1) return [...arr, item];
  const next = [...arr];
  next[idx] = item;
  return next;
}

function removeFromArray<T extends { id?: string }>(arr: T[], id: string): T[] {
  return arr.filter((x) => (x as any).id !== id);
}

// ─────────────────────────────────────────────────────────────
// The store
// ─────────────────────────────────────────────────────────────
export const useAppStore = create<StoreState>((set, get) => ({
  cells: [],
  packagingMasters: [],
  materials: [],
  familyStatuses: [],
  processes: [],
  routes: [],
  stations: [],
  edges: [],
  engineConfig: {
    global_yield_default: 0.97,
    working_hours_per_day: 16,
    pallet_pool_declared: null,
  },
  isLoading: false,
  lastAnalysisResult: null,
  undoPast: [],
  undoFuture: [],

  // ── Load all data from Firestore on startup ──
  loadAll: async () => {
    set({ isLoading: true });
    const [
      cells, packagingMasters, materials, familyStatuses,
      processes, routes, stations, edges, engineConfig,
    ] = await Promise.all([
      CellsCol.getAll(),
      PackagingMastersCol.getAll(),
      MaterialsCol.getAll(),
      FamilyStatusesCol.getAll(),
      ProcessesCol.getAll(),
      RoutesCol.getAll(),
      StationsCol.getAll(),
      EdgesCol.getAll(),
      EngineConfigCol.get(),
    ]);
    set({
      cells, packagingMasters, materials, familyStatuses,
      processes, routes, stations, edges, engineConfig,
      isLoading: false,
    });
  },

  setAnalysisResult: (r) => set({ lastAnalysisResult: r }),

  // ── Cells ──
  upsertCell: async (item) => {
    pushUndo(set, get);
    const id = await CellsCol.upsert(item);
    const saved = { ...item, id };
    set((s) => ({ cells: upsertInArray(s.cells, saved) }));
  },
  deleteCell: async (id) => {
    pushUndo(set, get);
    await CellsCol.remove(id);
    set((s) => ({ cells: removeFromArray(s.cells, id) }));
  },

  // ── Packaging Masters ──
  upsertPackagingMaster: async (item) => {
    pushUndo(set, get);
    const id = await PackagingMastersCol.upsert(item);
    const saved = { ...item, id };
    set((s) => ({ packagingMasters: upsertInArray(s.packagingMasters, saved) }));
  },
  deletePackagingMaster: async (id) => {
    pushUndo(set, get);
    await PackagingMastersCol.remove(id);
    set((s) => ({ packagingMasters: removeFromArray(s.packagingMasters, id) }));
  },

  // ── Materials ──
  upsertMaterial: async (item) => {
    pushUndo(set, get);
    const id = await MaterialsCol.upsert(item);
    const saved = { ...item, id };
    set((s) => ({ materials: upsertInArray(s.materials, saved) }));
  },
  deleteMaterial: async (id) => {
    pushUndo(set, get);
    await MaterialsCol.remove(id);
    set((s) => ({ materials: removeFromArray(s.materials, id) }));
  },

  // ── Family Statuses ──
  upsertFamilyStatus: async (item) => {
    pushUndo(set, get);
    const id = await FamilyStatusesCol.upsert(item);
    const saved = { ...item, id };
    set((s) => ({ familyStatuses: upsertInArray(s.familyStatuses, saved) }));
  },
  deleteFamilyStatus: async (id) => {
    pushUndo(set, get);
    await FamilyStatusesCol.remove(id);
    set((s) => ({ familyStatuses: removeFromArray(s.familyStatuses, id) }));
  },

  // ── Processes ──
  upsertProcess: async (item) => {
    pushUndo(set, get);
    const id = await ProcessesCol.upsert(item);
    const saved = { ...item, id };
    set((s) => ({ processes: upsertInArray(s.processes, saved) }));
  },
  deleteProcess: async (id) => {
    pushUndo(set, get);
    await ProcessesCol.remove(id);
    set((s) => ({ processes: removeFromArray(s.processes, id) }));
  },

  // ── Routes ──
  upsertRoute: async (item) => {
    pushUndo(set, get);
    const id = await RoutesCol.upsert(item);
    const saved = { ...item, id };
    set((s) => ({ routes: upsertInArray(s.routes, saved) }));
  },
  deleteRoute: async (id) => {
    pushUndo(set, get);
    await RoutesCol.remove(id);
    set((s) => ({ routes: removeFromArray(s.routes, id) }));
  },

  // ── Stations ──
  upsertStation: async (item) => {
    pushUndo(set, get);
    const id = await StationsCol.upsert(item);
    const saved = { ...item, id };
    set((s) => ({ stations: upsertInArray(s.stations, saved) }));
  },
  deleteStation: async (id) => {
    pushUndo(set, get);
    await StationsCol.remove(id);
    set((s) => ({ stations: removeFromArray(s.stations, id) }));
  },

  // ── Edges ──
  upsertEdge: async (item) => {
    pushUndo(set, get);
    const id = await EdgesCol.upsert(item);
    const saved = { ...item, id };
    set((s) => ({ edges: upsertInArray(s.edges, saved) }));
  },
  deleteEdge: async (id) => {
    pushUndo(set, get);
    await EdgesCol.remove(id);
    set((s) => ({ edges: removeFromArray(s.edges, id) }));
  },

  // ── Engine Config ──
  setEngineConfig: async (cfg) => {
    pushUndo(set, get);
    await EngineConfigCol.set(cfg);
    set({ engineConfig: cfg });
  },

  // ── Undo ──
  undo: async () => {
    const { undoPast, undoFuture } = get();
    if (undoPast.length === 0) return;
    const snapshot = undoPast[undoPast.length - 1];
    const currentSnapshot = takeSnapshot(get());

    // Restore in-memory state
    set({
      ...snapshot,
      undoPast: undoPast.slice(0, -1),
      undoFuture: [currentSnapshot, ...undoFuture],
    });

    // Sync every collection back to Firestore
    // (Simplified: for a real undo we'd diff; for this tool we just re-write all)
    // This is acceptable for a single-user personal tool with small datasets.
    await Promise.all([
      ...snapshot.cells.map((x) => CellsCol.upsert(x)),
      ...snapshot.materials.map((x) => MaterialsCol.upsert(x)),
      ...snapshot.processes.map((x) => ProcessesCol.upsert(x)),
      ...snapshot.routes.map((x) => RoutesCol.upsert(x)),
      ...snapshot.stations.map((x) => StationsCol.upsert(x)),
      ...snapshot.edges.map((x) => EdgesCol.upsert(x)),
      EngineConfigCol.set(snapshot.engineConfig),
    ]);
  },

  // ── Redo ──
  redo: async () => {
    const { undoPast, undoFuture } = get();
    if (undoFuture.length === 0) return;
    const snapshot = undoFuture[0];
    const currentSnapshot = takeSnapshot(get());

    set({
      ...snapshot,
      undoPast: [...undoPast, currentSnapshot],
      undoFuture: undoFuture.slice(1),
    });

    await Promise.all([
      ...snapshot.cells.map((x) => CellsCol.upsert(x)),
      ...snapshot.materials.map((x) => MaterialsCol.upsert(x)),
      ...snapshot.processes.map((x) => ProcessesCol.upsert(x)),
      ...snapshot.routes.map((x) => RoutesCol.upsert(x)),
      ...snapshot.stations.map((x) => StationsCol.upsert(x)),
      ...snapshot.edges.map((x) => EdgesCol.upsert(x)),
      EngineConfigCol.set(snapshot.engineConfig),
    ]);
  },
}));
```

**Step 3.2** — Verify it compiles:
```powershell
npx tsc --noEmit
```

**Step 3.3** — Commit:
```powershell
git add .
git commit -m "feat: Zustand store with undo/redo"
```

---

## Checklist

- [ ] Task 2: `src/lib/collections.ts` created with typed wrappers for all 9 collections
- [ ] Task 2: `npx tsc --noEmit` = zero errors
- [ ] Task 2: `git commit -m "feat: Firestore CRUD helpers"` done
- [ ] Task 3: `src/store/useAppStore.ts` created
- [ ] Task 3: `npx tsc --noEmit` = zero errors
- [ ] Task 3: `git commit -m "feat: Zustand store with undo/redo"` done

**➡ Continue with: `plan-03-validation-and-engine.md`**
