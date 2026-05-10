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
