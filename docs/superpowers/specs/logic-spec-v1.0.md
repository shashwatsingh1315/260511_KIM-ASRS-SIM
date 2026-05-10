# ASRS-Choker — Logic Specification (v1.0)
Status: Logic locked. Implementation deferred. Audience: A new engineer who has never seen this project and needs to understand what the tool is, what it computes, and why before writing a line of code.

This document is the single source of truth for the logic of ASRS-Choker. The earlier 2026-05-08-asrs-choker-plan.md describes a UI/Firestore plan; treat that as a draft. Where the two disagree, this document wins because it was derived from physical first principles. The earlier plan will be revised against this spec before implementation.

## 0. How to read this document
Sections 1–3 give you the mental model and the laws. Sections 4–5 introduce the six objects the entire tool is built from. Sections 6–9 explain what the tool actually computes and what it must check. Section 10 walks a full example. Section 11 lists what is deliberately not modeled yet. Section 12 is a glossary. You should be able to explain the tool to someone else after section 5.

If a sentence in this doc sounds like an arbitrary choice, ask which axiom it descends from. Every rule must trace back to a numbered axiom in section 3. If you find one that doesn't, that's a bug in the spec — flag it.

## 1. The problem in plain language
We manufacture electricity meters in a multi-floor facility split into a Production building and a Warehouse building. We need a planning tool that answers four kinds of question, in any combination, before we commit to a physical layout:

*   **Storage** — How much storage do I need for each material, where, and is the rack/ASRS capacity enough?
*   **Flow** — Are my elevators, lanes, and bridge able to carry the pallet-trips per hour that production demands? (This is the “choker” the project is named after — chokepoint detection.)
*   **Layout** — Where should production lines, WIP buffers, IQC areas, and storage zones physically sit?
*   **What-if** — If I add a product, double a line’s rate, or change packaging, what breaks first?

The tool is a single-user planning canvas. There is no real-time inventory, no MES, no ERP integration. It is a calculator and a feasibility checker on top of a structured description of the factory.

## 2. Mental model: the factory as a network of processes
The trap with this kind of tool is to start from “buildings have floors, floors have racks, racks have slots…” and pile data structures on top. We are deliberately not doing that. Instead, the mental model is:

*A factory is a network of processes that act on materials. Each process happens at a station. Stations live in cells (physical locations). Stations are connected by edges. The tool’s job is to verify that the demanded flow of material through the processes is feasible given the declared capacities.*

Five consequences of this view, all of which you will see again later:

1.  **Process is first-class, location is incidental.** IQC is a process. It happens at some station, which sits in some cell. The same process can be hosted at different stations in different scenarios.
2.  **A material’s life is a route** — an ordered list of processes — not a list of locations. Locations show up only when you assign each process to a station.
3.  **Anything that holds material is a buffer.** WIP, line-side stock, ASRS, conventional racks, an IQC quarantine pen — all the same kind of thing mathematically.
4.  **Waiting is a process too.** “Aging for 24 hours” is a real process with a real duration. The fact that no machine is operating on it is irrelevant.
5.  **The pallet is itself a resource.** It’s not free. There are only N of them in the building. They get consumed by being in use.

These five points are the ground from which the axioms below are derived.

## 3. The eleven axioms
Every computation in this tool reduces to these. If you ever feel you’re inventing a new rule, stop and check whether one of these already covers it.

*   **A1 — Material balance.** For any material m, in steady state and over any time window: produced(m) + received(m) = consumed(m) + dispatched(m) + Δinventory(m). This is conservation of mass. It is the only reason demand propagation exists.
*   **A2 — Demand multiplies along BOM.** If parent p requires q(p→c) units of child c to produce one unit of itself, and the parent has yield y(p) (fraction of good output), then: D(c) = Σ_p (D(p) · q(p→c)) / y(p). Demand is computed in topological order over the BOM, not by random traversal. Cycles are illegal and must be caught by validation.
*   **A3 — Discreteness and integer packaging.** Material exists in countable units. Packaging is a chain of integer multipliers (units → inner box → outer box → … → pallet). The “pallet” level is the anchor for storage and transport. Conversions between levels are exact integer ratios, never floats with rounding-as-truth.
*   **A4 — Spatial exclusivity.** A pallet occupies exactly one slot. A slot holds at most one pallet. A station occupies a footprint that fits inside its cell. Two stations cannot overlap.
*   **A5 — Channel capacity.** Every channel that does work — an edge moving pallets, a station performing a process — has a maximum peak pallets per hour. The sum of demands assigned to that channel must not exceed its rated capacity.
*   **A6 — Peak-hour as the canonical rate.** All rate fields the user enters and all rate fields the tool reports are peak pallets per hour (or peak units per hour where the pallet conversion isn’t yet applied). Daily totals are derived by multiplying by the station’s operating hours. The tool never asks for daily averages.
*   **A7 — Counter-flow closure for returnables.** Every returnable container that goes forward must come back. If R returnable pallets per hour go from station S₁ to S₂, then R empty-returnable pallets per hour must go from S₂ back to S₁ (modulo the pack’s density ratio, which says how many empties fit on one pallet relative to one full).
*   **A8 — Locality.** Every quantity is anchored to a cell. A material doesn’t exist “in the system”; it exists at a station at a cell. Demand isn’t global; it is the demand at a specific process at a specific station.
*   **A9 — Process state.** Every material instance is in exactly one status at any moment. Status is changed only by status-changing processes (IQC, FG-QC, etc.). Conservation (A1) closes per (material, status) pair, not per material alone. This is what makes IQC quarantine visible to the tool.
*   **A10 — Little’s Law for steady-state WIP.** At any process, in steady state: WIP = throughput × residence_time. The user supplies residence time; the tool derives WIP. The user never types in a buffer size directly — they declare how long material has to dwell, and the buffer falls out.
*   **A11 — Closed-loop resources.** Pallets, returnable boxes, and any other physical carrier are conserved exactly like materials. The pool is finite. WIP at every station consumes from the pool. If the pool runs out, production stops even if every other capacity is fine. The tool must size the pool from Little’s Law applied to the carriers themselves.

That is the entire physical core. Everything else is bookkeeping.

## 4. The six core entities
These are the only object types in the system. Every concept (IQC, ASRS, WIP, line-side, ageing, returnable, FG-QC, repack) is built by combining them. Do not add new entity types without revisiting the axioms.

### 4.1 Cell
A pure location. No behavior.
*   **id**: string - Unique.
*   **building**: enum - Production or Warehouse (extensible later).
*   **floor**: integer - 0 = ground floor.
*   **block**: string - e.g. A, B.
*   **length_mm, width_mm**: number - Floor footprint of this cell. Per cell, not assumed uniform.
*   **height_mm**: number - Clear height from floor to underside of the slab above.

*Why this exists:* A8 requires every quantity to be anchored somewhere. A4 requires footprint checks (does the station fit in the cell?). A cell with no station is allowed (empty real estate). A cell with multiple stations is the common case.

### 4.2 Material
The identity of a thing that flows through the factory.
*   **id, code, name**: strings - Identity.
*   **family**: enum - RM, SFG, FG, Returnable. Modifiable list, user-extensible.
*   **subfamily**: string - User-defined within a family (e.g. RM → Electronic, Plastic; FG → SinglePhase, ThreePhase).
*   **uom**: enum - piece, kg, litre, …
*   **unit_weight_kg**: number - Required. Used for pallet weight check (A4).
*   **unit_volume_mm3**: number - Required. Used for box-fit and slot-fit checks.
*   **yield_default_override**: number? - If null, the global yield default applies (A2).
*   **packaging_chain**: array - Ordered list of { packaging_master_id, qty_per_parent }. The last entry is the pallet level.
*   **returnable_density_ratio**: number? - Only for Returnable family. e.g. 5 means one return pallet holds 5× the units that the forward full pallet does.

*Why this exists:* A2 needs identity to propagate demand. A3 needs packaging. A4 needs weight and volume. A9 needs status to attach to material instances (status itself is its own dimension — see 4.3).

### 4.3 Status
The lifecycle states a material instance can be in. The status set is user-modifiable per material family. This is your decision: you wanted modularity here.

Default starter sets (user can edit, add, remove):
*   **RM family**: incoming → in-IQC → approved → consumed. Side branch: rejected.
*   **SFG family**: produced → in-IPQC → approved → consumed. Side branches: rejected, ageing.
*   **FG family**: produced → in-FGQC → approved → dispatched. Side branch: rejected.
*   **Returnable family**: full-outbound → empty-inbound → available.

A status is just a tag. The interesting bit is that conservation closes per (material, status) pair. 200 pallets of PCB-001 with 30 in in-IQC is not 200 usable pallets — it’s 170 usable and 30 locked. The tool reports both numbers.

### 4.4 Process
A named transformation. Declared once per factory, reused across materials. Fully user-modifiable — you can add IQC, PCB-test, oven-cure-30min, kit-to-line, label-print, anything.
*   **id, name**: strings - Identity.
*   **type**: enum - identity-change, packaging-change, status-change, location-change, hold.
*   **input_status**: string - What status the material must be in to enter this process.
*   **output_status**: string - What status it leaves in.
*   **default_residence_time_hr**: number - Used by A10 unless a material overrides it.
*   **default_yield**: number - Fraction good. Used by status-change processes. The “bad” fraction is routed to the reject sink.

The five process types are the closed set:
1.  **identity-change** — A BOM transformation. Input is a set of children, output is a parent with a different identity. Production lines run identity-change processes.
2.  **packaging-change** — Same identity, different packaging level. Repack, depalletize, palletize, kit, line-side-breakdown.
3.  **status-change** — Same identity, same packaging, different status. IQC, IPQC, FGQC, accept/reject decisions, ageing-complete.
4.  **location-change** — Same identity, same packaging, same status, different cell. Transport over an edge.
5.  **hold** — No change to anything. The “process” is just waiting. Ageing is a hold with a long residence time. A buffer that just sits also performs hold.

Every process has a residence time. Even instantaneous ones (a tag-flip in software) have residence time zero. A10 then gives WIP = 0 — fine, no buffer needed for that process. Ageing has residence time 24h — WIP at the ageing process = 24h × throughput.

### 4.5 Route (per material)
The ordered list of processes a material goes through, from creation/receipt to consumption/dispatch.
*   **material_id**: string - The material this route belongs to.
*   **steps**: array - Ordered list of { process_id, residence_time_hr_override? }.

Example for RM-PCB-Bare:
1.  receive
2.  IQC-RM (status: incoming → approved or rejected)
3.  transport-to-store (location-change)
4.  store-approved (hold, residence = days_of_stock × 24h)
5.  transport-to-line (location-change)
6.  consumed-by-line (identity-change, into SFG-PCB)

Example for FG-MeterSinglePhase:
1.  produced-on-line-A (identity-change, from SFG-PCB + SFG-Casing)
2.  FGQC (status-change)
3.  palletize (packaging-change)
4.  transport-to-FG-store
5.  store-FG (hold)
6.  transport-to-dispatch
7.  dispatched

The route is yours to declare, per material. Default routes per (family, subfamily) are provided as starting points; per-material override is supported.

### 4.6 Station
A physical thing at a cell that performs exactly one process. (Your decision: one process per station record. Multiple physical capabilities of one machine are modeled as multiple station records pointing at the same cell.)
*   **id, name**: strings - Identity.
*   **cell_id**: string - Where it lives.
*   **process_id**: string - What process it performs.
*   **peak_throughput_pph**: number - Peak pallets per hour for this process at this station.
*   **holding_capacity_pallets**: number - Slots this station has for material held at it. Can be 0 (pure flow) or the full ASRS pallet count (pure buffer).
*   **operating_hours_per_day**: number - Per A6, peak is canonical, but daily derivations need this. Per-station, not per-line, not per-building.
*   **footprint_length_mm, footprint_width_mm**: number - For A4 footprint check against the cell.
*   **allocations**: array - List of { material_id, days_of_stock?, residence_time_hr_override? }. See note below.

Allocation semantics (the days-of-stock rule you set):
*   If the station performs a hold process and sits inside an ASRS, days_of_stock is read from a material-level policy, not from the allocation. ASRS is monolithic; one policy across the box.
*   Everywhere else (WIP buffer, line-side, conventional rack, ageing room), days_of_stock (or residence_time_hr_override) is read from the allocation, i.e. per (material, station).

This is the only place where ASRS gets special treatment. Everywhere else, station-level is the rule.

The “ASRS as monolith” move: An ASRS in this tool is one station with process = hold, large holding_capacity_pallets, one peak_throughput_pph, and a list of material allocations. We do not model internal aisles, cranes, or layout inside the ASRS. The user supplies its three numbers and we treat it as a black box.

### 4.7 Edge
Connects two cells. Used by location-change processes only.
*   **id, name**: strings - Identity.
*   **from_cell_id, to_cell_id**: strings - Endpoints.
*   **type**: enum - lane, elevator, bridge, dock-link.
*   **bidirectional**: boolean - If true, capacity is per direction unless capacity_per_direction_pph is split.
*   **capacity_pph**: number - Rated peak pallets per hour.
*   **materials_allowed**: array - Optional whitelist; empty = all.

What we are doing with edges right now: storing them only. Per your call, lane traversal is treated as instantaneous for v1, so location-change processes have residence time zero, contribute zero WIP, and edge utilisation is not computed in v1. Edges are persisted so that v2 routing can be added without a data migration.

## 5. How the entities relate
```
Cell  ◄── lives_at ──  Station  ── performs ──►  Process
                          │
                          │ allocates
                          ▼
                       Material  ── has ──►  Route (ordered list of Processes)
                          │
                          │ packs into
                          ▼
                       Packaging chain  ── ends at ──►  Pallet level

Edge  ── connects ──  Cell ↔ Cell    (used by location-change processes; v2)

Status  ── attached to ──  Material instance at every step of its Route
```
Read it as: a Material has a Route. Each step of the Route is a Process. Each Process is performed by one Station. Each Station sits in a Cell. Stations are linked by Edges (for transport). At every step, the Material instance has a Status, which changes only via status-change Processes.

## 6. What the tool computes (and how)
All computations below are station-local. They do not require routing. They are valid the moment data is entered. v2 routing adds edge-load on top without invalidating any of these.

### 6.1 Demand at every step of every route
Inputs needed:
*   Production target per line (your decision: production targets are explicit user inputs, not derived). For each line, the user enters peak pph of the FG (or SFG) it produces.
*   BOM (parent → children with qty_per_parent).
*   Material yield (per material; falls back to global default).

Algorithm:
1.  Build the BOM as a DAG. Validate acyclic.
2.  Identify all terminal outputs — materials produced by a station running an identity-change process. Their demand is set directly by the user (production target).
3.  Topologically sort all materials such that parents precede children.
4.  For each material in order: D(child) = Σ_parents (D(parent) · q(parent→child)) / yield(parent) Demand is in peak units per hour.
5.  Convert to peak pallets per hour for each material: pallets_pph(m) = ceil(units_pph(m) / units_per_pallet(m)). Note the ceil: a pallet is indivisible (A3).
6.  For every process in the route of every material, the demand at that process equals the demand at its consuming process upstream, scaled by yield where the process is status-changing. For a route step k: throughput_at_step_k = throughput_at_step_(k+1) / yield_of_step_k.

So if FG-QC has 95% yield and downstream demand is 100 pallets/h, the upstream demand into FG-QC is ~105.3 pallets/h, and the reject branch is ~5.3 pallets/h. Both numbers are produced.

### 6.2 WIP at every process (Little’s Law)
For every process step in every route: `WIP_pallets = throughput_pph × residence_time_hr`.

Examples:
*   Ageing PCB, 24h residence, 5 pallets/h throughput → 120 pallets always in ageing.
*   IQC-RM, 4h residence, 2 pallets/h throughput → 8 pallets always in IQC.
*   Line-side buffer of 2h, consumption 3 pallets/h → 6 pallets always at line-side.
*   ASRS store-approved, 7 days residence (× 24), 1 pallet/h average throughput → 168 pallets in the ASRS.

This number flows directly into the station’s holding requirement.

### 6.3 Station capacity check
For each station S performing process P with materials M₁ … Mₙ:
*   Throughput requirement = Σᵢ throughput at process P for material Mᵢ.
*   Holding requirement = Σᵢ WIP_pallets for material Mᵢ at this process + any additional days-of-stock buffer the allocation declares.
*   Throughput OK? Throughput requirement ≤ peak_throughput_pph.
*   Holding OK? Holding requirement ≤ holding_capacity_pallets.

Either failure is a bottleneck of a specific type, with a specific number for how much over capacity.

### 6.4 Cell footprint check
For each cell C with stations S₁ … Sₘ:
*   Σⱼ (footprint of Sⱼ) ≤ length × width of C.
*   If a station has a holding_capacity_pallets > 0, its footprint must include the area for that many pallet slots at the relevant packaging density. (For the ASRS-as-monolith view, the user enters the ASRS footprint directly; we don’t derive it.)

### 6.5 Pallet pool sizing (A11)
Total pallets needed = Σ over every station S of (its holding requirement) + Σ over every in-transit edge (zero in v1 because lanes are instant) + Σ over returnable pools.

If the user has declared a pallet pool size, the tool reports the gap. If not, the tool reports what the size needs to be.

### 6.6 Conservation closure (sanity check)
For every material m and every status s, sum the inflow and outflow across all stations. The two must match within rounding (allow ε). Any mismatch is a data error and must be reported, not silently absorbed.

## 7. Returnables
A returnable is a Material in the Returnable family. It is a first-class citizen — not a side concept.
*   It has a packaging chain (often trivial: one returnable = one pallet, or many returnables = one pallet stacked).
*   It has returnable_density_ratio ≥ 1, meaning one return-pallet holds ratio empties for every one full unit a forward pallet held.
*   Its route has two threads: outbound (full) and inbound (empty), with status flipping between full-outbound and empty-inbound at the consumer end.
*   Demand for the returnable equals the forward consumption of whatever it carries. A7 makes this automatic.

In v2 (routing), the returnable’s inbound flow loads the reverse direction of the relevant edges. In v1, we just compute the return demand and surface it; we don’t place it on any edge.

## 8. Reject handling
Per your decision: one reject station per family.
*   For each family (RM, SFG, FG), there exists exactly one reject station. It performs a hold process with effectively unbounded capacity (or a user-set quarantine cap).
*   Status-change processes (IQC, IPQC, FGQC) split their flow by yield. The “good” fraction continues along the route; the “bad” fraction is routed into the family’s reject station.
*   The reject station is a real station with a cell, a footprint, and a holding requirement. It eats real floor space and we plan for it.

## 9. Validation rules (must run before any analysis)
If any of these fail, the analysis is refused and the user is shown the specific violation. No silent absorption of errors ever.
1.  BOM is acyclic. Topological sort succeeds.
2.  Every material has a route. No route → cannot place it in the network.
3.  Every step of every route has a process that exists. Dangling process reference = error.
4.  Status transitions in every route are legal. Each step’s input_status must equal the previous step’s output_status.
5.  Every process in every route is performed by at least one station. Otherwise demand has nowhere to go.
6.  Every material has a complete packaging chain ending at a pallet level. A3 needs the anchor.
7.  Every material has non-null unit_weight and unit_volume. A4 requires these.
8.  Every station has a cell, footprint, throughput, and operating hours.
9.  Every cell with stations has dimensions. Footprint check needs them.
10. Every yield value is in (0, 1].
11. Every residence time is ≥ 0.
12. Returnable density ratio is ≥ 1 where set.
13. Receiving and dispatch stations exist for each (family, subfamily) that is actually used.
14. Reject station exists for each family with at least one status-change process in any route.
15. No two stations overlap in footprint inside the same cell.

## 10. Worked example
We will trace a single FG end-to-end so you can see every entity in motion. Numbers are illustrative; real ones come from the user.

### 10.1 Setup
**Cells used:**
*   C-prod-2A — Production building, floor 2, block A. 10m × 8m × 5m.
*   C-prod-2B — Production building, floor 2, block B. 10m × 8m × 5m.
*   C-wh-3A — Warehouse, floor 3, block A. 20m × 15m × 6m. Hosts the ASRS.
*   C-wh-0A — Warehouse, floor 0, block A. 12m × 10m × 5m. Hosts receiving & IQC.

**Materials:**
*   RM-PCB — Raw PCB. Family RM, subfamily Electronic. Unit weight 0.05 kg, unit volume 30 000 mm³.
*   RM-Plastic — Plastic pellets. Family RM, subfamily Plastic.
*   SFG-PCB-Assembled — Family SFG, subfamily Electronic.
*   SFG-Casing — Family SFG, subfamily Plastic.
*   FG-Meter-SP — Family FG, subfamily SinglePhase. Production target = 100 pallets/h (peak).

**BOM:**
*   1 FG-Meter-SP = 1 SFG-PCB-Assembled + 1 SFG-Casing.
*   1 SFG-PCB-Assembled = 1 RM-PCB.
*   1 SFG-Casing = 3 RM-Plastic.
*   Yield default = 0.97. SFG-PCB-Assembled overrides to 0.93 (lower assembly yield).

**Processes (selected):**
*   receive-RM — type hold, residence 1h.
*   IQC-RM — type status-change, residence 4h, yield 0.98.
*   transport — type location-change, residence 0h.
*   store-approved-ASRS — type hold, residence depends on material policy.
*   assemble-PCB — type identity-change, yield 0.93, residence 0.5h.
*   mould-casing — type identity-change, yield 0.97, residence 0.3h.
*   assemble-meter — type identity-change, yield 0.97, residence 0.4h.
*   FGQC — type status-change, residence 2h, yield 0.99.
*   palletize-FG — type packaging-change, residence 0.1h.
*   dispatch-FG — type location-change to external sink, residence 0h.

**Routes (abbreviated):**
*   RM-PCB: receive → IQC-RM → transport → store-approved-ASRS → transport → assemble-PCB (consumed)
*   RM-Plastic: receive → IQC-RM → transport → store-approved-ASRS → transport → mould-casing (consumed)
*   SFG-PCB-Assembled: assemble-PCB (produced) → transport → store-approved-ASRS → transport → assemble-meter (consumed)
*   SFG-Casing: mould-casing → transport → store-approved-ASRS → transport → assemble-meter (consumed)
*   FG-Meter-SP: assemble-meter (produced) → FGQC → palletize-FG → transport → store-approved-ASRS → transport → dispatch-FG

**Stations (selected):**
*   ST-recv-RM at C-wh-0A, process receive-RM, throughput 20 pph, holding 30.
*   ST-IQC-RM at C-wh-0A, process IQC-RM, throughput 15 pph, holding 80.
*   ST-ASRS at C-wh-3A, process store-approved-ASRS, throughput 25 pph, holding 2,000 pallets (the monolith).
*   ST-PCB-assy at C-prod-2A, process assemble-PCB, throughput 110 pph, holding 20.
*   ST-mould at C-prod-2B, process mould-casing, throughput 110 pph, holding 20.
*   ST-meter-assy at C-prod-2A, process assemble-meter, throughput 105 pph, holding 25.
*   ST-FGQC at C-prod-2A, process FGQC, throughput 110 pph, holding 30.
*   ST-pack at C-prod-2A, process palletize-FG, throughput 110 pph, holding 10.
*   ST-reject-RM, ST-reject-SFG, ST-reject-FG exist with appropriate holding.

**ASRS days-of-stock policy (per material, since the ASRS is monolithic):**
*   RM-PCB: 7 days.
*   RM-Plastic: 7 days.
*   SFG-PCB-Assembled: 2 days.
*   SFG-Casing: 2 days.
*   FG-Meter-SP: 3 days.

### 10.2 Demand propagation
Production target for FG-Meter-SP = 100 pallets/h peak.

Working backward up the route of FG-Meter-SP:
*   Demand into palletize-FG = 100 pph.
*   Demand into FGQC = 100 / 0.99 ≈ 101.01 pph. Reject branch ≈ 1.01 pph to ST-reject-FG.
*   Demand at assemble-meter output = 101.01 pph. Demand at its input (its consumed children) is propagated via BOM and the assemble-meter yield 0.97.

For each child material consumed at assemble-meter:
*   Required output = 101.01 pph.
*   Required input per child = 101.01 / 0.97 ≈ 104.13 pph per child.
So both SFG-PCB-Assembled and SFG-Casing need ≈ 104.13 peak pallets per hour each.

Propagating to RM through the BOM:
*   RM-PCB demand at the input of assemble-PCB = 104.13 / 0.93 ≈ 111.97 pph. (Note the lower yield override.)
*   RM-Plastic demand at the input of mould-casing = (104.13 × 3) / 0.97 ≈ 322.05 pph. (Three units per casing, A2.)

Each RM then flows backward through store → IQC (yield 0.98) → receive, each step scaling by 1/yield where applicable.
These numbers immediately tell you what the receiving dock and IQC station must do.

### 10.3 WIP via Little’s Law
*   WIP at IQC-RM for RM-PCB ≈ 111.97 / 0.98 × 4 h ≈ 457 pallets (peak). That alone is six times the holding capacity of ST-IQC-RM (80). Bottleneck flagged.
*   WIP at FGQC for FG-Meter-SP = 101.01 × 2 h ≈ 202 pallets. ST-FGQC has holding 30. Bottleneck flagged.
*   WIP at ASRS for RM-PCB = (RM-PCB consumption pph) × 7 days × 24 h = roughly 112 × 168 ≈ 18,800 pallets. ASRS has 2,000. Massive bottleneck flagged.

These three numbers, derived purely from A2 + A10 + the user’s inputs, are the kind of result the tool exists to produce. The user now knows exactly what to resize.

### 10.4 Throughput check at the ASRS
ASRS handles inbound and outbound for every material that uses it: receive of every RM, post-production storage of every SFG and FG, plus picks back out for every consumer. With one peak pph number = 25, the ASRS must handle the sum of all those inbound + outbound demands. Adding them up (left as an exercise) easily exceeds 25 pph. Throughput bottleneck flagged.

### 10.5 Cell footprint check
C-prod-2A (10×8 = 80 m²) hosts ST-PCB-assy, ST-meter-assy, ST-FGQC, ST-pack. Sum of footprints must be ≤ 80 m². If not, layout infeasibility flagged, and the user must move a station to another cell.

### 10.6 What the report says
The tool produces:
*   A demand table per material per process step (peak pph and daily).
*   A WIP table per material per process step (pallets, derived).
*   A station table with throughput required / available / gap and holding required / available / gap.
*   A cell table with footprint required / available / gap.
*   An alerts list for every bottleneck and every conservation-closure violation.
*   A pallet-pool sizing line: total pallets the system needs to function at the declared production target.

## 11. What is deliberately deferred (and why)
*   **Routing of materials across edges.** Lanes, elevators, and the bridge are entered and stored, but the tool does not yet decide which path a material takes from station A to station B. Until that exists, edge utilisation and lane bottlenecks are out of scope. v1 treats lane traversal as instantaneous (per your decision). This is a strict superset: anything we report in v1 stays valid in v2.
*   **Operator/labor capacity.** Cranes and forklifts need humans. We assume the user’s declared peak pph at each station already includes any labor constraint. We do not separately size headcount.
*   **Setup/changeover times on multi-product lines.** If a line produces multiple FGs and loses time switching, that loss must be folded into the declared peak pph manually. We don’t model changeovers.
*   **Calendar.** Days off, public holidays, planned maintenance windows. The user is responsible for the peak-pph and operating-hours numbers reflecting reality.
*   **Energy, utilities, environmental constraints.** Not modeled. Not in scope.
*   **Scenarios.** v1 is single-state. To compare two layouts the user duplicates and edits manually. Future scenario support is non-invasive.

## 12. Glossary
*   **Axiom** — One of the eleven physical laws in section 3. Everything else descends from them.
*   **Cell** — A physical (building, floor, block) location with dimensions.
*   **Channel** — Anything with a rated pallets-per-hour capacity: an edge, or a station performing a process.
*   **Closed-loop resource** — A carrier (pallet, returnable) that is conserved like material; finite pool.
*   **Demand** — Peak units or pallets per hour required at a given point in the network.
*   **Edge** — A connection between cells; lane, elevator, bridge, or dock-link.
*   **Family** — RM, SFG, FG, Returnable. Top-level material grouping.
*   **Holding capacity** — Pallet slots available at a station for material dwelling there.
*   **Little’s Law** — WIP = throughput × residence_time. The way we derive buffer sizes.
*   **Material** — An identity that flows through processes.
*   **Monolith (ASRS)** — A storage station with one capacity number and one throughput number; internals not modeled.
*   **Peak pph** — Peak pallets per hour. The canonical rate everywhere in this tool.
*   **Process** — A typed transformation (identity, packaging, status, location, or hold).
*   **Reject station** — One per family; absorbs the bad-yield fraction from status-change processes.
*   **Residence time** — How long a material instance stays in a given process.
*   **Returnable** — A reusable carrier modeled as a first-class material in the Returnable family.
*   **Returnable density ratio** — How many empties fit on one return pallet relative to one full forward pallet.
*   **Route** — Per-material ordered list of processes from creation to consumption/dispatch.
*   **Station** — One process performed at one cell, with throughput, holding, footprint, and operating hours.
*   **Status** — The current lifecycle state of a material instance. Set is user-modifiable per family.
*   **Subfamily** — User-defined grouping within a family.
*   **Throughput** — How many pallets per hour a channel actually carries (≤ its rated capacity).
*   **Yield** — Fraction of input that becomes good output at a process. Per material, with a global default.

## 13. Locked decisions (for the record)
These were the explicit calls made during the spec session and are not to be revisited without a new design discussion.
1.  All rates are peak pph. The tool does not accept averages.
2.  Operating hours are per station.
3.  Yield is per material with a global default.
4.  Days-of-stock is per-material for ASRS, per (material, station) allocation elsewhere.
5.  ASRS throughput is a single pph number.
6.  Returnables are first-class materials (family = Returnable), not a side concept.
7.  Cell dimensions are per (building, floor, block), not assumed uniform.
8.  Receiving and dispatch stations are one per (family, subfamily).
9.  Status set is modifiable per family.
10. Process catalogue is fully user-modifiable.
11. Families are fixed (RM, SFG, FG, Returnable); subfamilies are user-defined per family.
12. Residence time is the universal dwell primitive. Buffer-hours, storage-days, ageing-time are all special cases.
13. Reject station: one per family.
14. Stations perform exactly one process. A multi-process machine is multiple station records.
15. Lane traversal is instantaneous in v1. Edges are stored, not yet loaded.
16. BOM lives on processes (specifically on identity-change processes), not on a separate parallel structure.
17. Production targets are user inputs at the line/identity-change-station level. Demand propagates from there.

## 14. What an implementer should do next
In this order:
1.  Lock the data model in code that mirrors section 4. One file per entity. No premature normalization.
2.  Build the validation pass (section 9) before anything else can run. Every analysis must call it first.
3.  Build the demand-propagation engine (section 6.1). Unit-test it on the example in section 10.
4.  Build the Little’s-Law WIP derivation (section 6.2).
5.  Build the station and cell checks (sections 6.3, 6.4).
6.  Build the pallet-pool sizing (section 6.5) and conservation closure (section 6.6).
7.  Build the data-entry UI on top — tables for cells, materials, processes, routes, stations, edges, plus CSV import.
8.  Build the report (Markdown) generator.

Only then return to routing for v2.
Do not invert this order. Validation and the engine are the hardest things; UI is the easiest. Building UI first leads to a tool that looks complete but computes the wrong thing.
