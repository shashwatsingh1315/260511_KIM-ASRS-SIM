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

  // Database Connection State
  dbConnected: boolean;

  // Actions
  loadAll: () => Promise<void>;
  setAnalysisResult: (r: AnalysisResult | null) => void;
  checkConnection: () => Promise<void>;

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
  dbConnected: false,

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
    // Check connection after initial load
    get().checkConnection();
  },

  checkConnection: async () => {
    try {
      const { pingDb } = await import("@/app/actions/db");
      const isConnected = await pingDb();
      set({ dbConnected: isConnected });
    } catch {
      set({ dbConnected: false });
    }
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
