"use client";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import type { Station, StationAllocation } from "@/types";

export default function StationsPage() {
  const stations = useAppStore((s) => s.stations);
  const cells = useAppStore((s) => s.cells);
  const processes = useAppStore((s) => s.processes);
  const materials = useAppStore((s) => s.materials);
  const upsertStation = useAppStore((s) => s.upsertStation);
  const deleteStation = useAppStore((s) => s.deleteStation);

  const [editingStation, setEditingStation] = useState<Station | null>(null);

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

  function saveAllocations() {
    if (editingStation) {
      upsertStation(editingStation);
      setEditingStation(null);
    }
  }

  function addAllocation() {
    if (!editingStation) return;
    setEditingStation({
      ...editingStation,
      allocations: [...(editingStation.allocations || []), { material_id: "", days_of_stock: null, residence_time_hr_override: null }],
    });
  }

  function updateAllocation(idx: number, field: keyof StationAllocation, val: string | number | null) {
    if (!editingStation) return;
    const next = [...editingStation.allocations];
    (next[idx] as any)[field] = val;
    setEditingStation({ ...editingStation, allocations: next });
  }

  function removeAllocation(idx: number) {
    if (!editingStation) return;
    const next = editingStation.allocations.filter((_, i) => i !== idx);
    setEditingStation({ ...editingStation, allocations: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">🏭 Stations</h1>
        <p className="text-gray-500 text-sm mt-1">
          Physical equipment/areas at a cell that perform one process.
          After creating a station, click "Edit Allocations" to specify which materials it processes and their storage requirements.
        </p>
      </div>

      <div className="space-y-4">
        {stations.map((s) => (
          <div key={s.id} className="flex justify-between items-center p-3 border border-gray-800 rounded-lg bg-gray-900/50">
            <div>
              <span className="font-medium text-gray-200">{s.name}</span>
            </div>
            <button
              onClick={() => setEditingStation(s)}
              className="text-sm text-indigo-400 border border-indigo-800 hover:bg-indigo-900/30 px-3 py-1.5 rounded"
            >
              Edit Allocations ({s.allocations?.length || 0})
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-8 border-t border-gray-800">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Base Attributes</h2>
        <DataTable columns={COLUMNS} rows={stations} onSave={upsertStation} onDelete={deleteStation} newRowTemplate={newStation} />
      </div>

      {/* MODAL FOR STATION ALLOCATIONS */}
      <Modal
        isOpen={!!editingStation}
        onClose={() => setEditingStation(null)}
        title={`Allocations: ${editingStation?.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Allocate materials to this station. 
            {editingStation?.is_asrs 
              ? " Since this is an ASRS, set 'Days of Stock' to calculate holding requirements."
              : " Set 'Residence HR Override' if a material takes longer here than the process default."}
          </p>
          
          <div className="space-y-3">
            {editingStation?.allocations?.map((alloc, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-950 p-3 rounded border border-gray-800">
                <select
                  value={alloc.material_id}
                  onChange={(e) => updateAllocation(i, "material_id", e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 flex-1"
                >
                  <option value="">— Select Material —</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                  ))}
                </select>

                {editingStation.is_asrs ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Days of Stock:</span>
                    <input
                      type="number"
                      value={alloc.days_of_stock ?? ""}
                      placeholder="e.g. 5"
                      onChange={(e) => updateAllocation(i, "days_of_stock", e.target.value ? Number(e.target.value) : null)}
                      className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 w-24"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Residence Override (hr):</span>
                    <input
                      type="number"
                      value={alloc.residence_time_hr_override ?? ""}
                      placeholder="default"
                      onChange={(e) => updateAllocation(i, "residence_time_hr_override", e.target.value ? Number(e.target.value) : null)}
                      className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 w-24"
                    />
                  </div>
                )}
                
                <button onClick={() => removeAllocation(i)} className="text-red-400 hover:text-red-300 ml-2">✕</button>
              </div>
            ))}
            
            {(!editingStation?.allocations || editingStation.allocations.length === 0) && (
              <div className="text-sm text-gray-500 italic p-4 text-center border border-dashed border-gray-700 rounded">
                No materials allocated.
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button onClick={addAllocation} className="text-sm text-indigo-400 hover:text-indigo-300">
              + Add Allocation
            </button>
            <div className="space-x-3">
              <button onClick={() => setEditingStation(null)} className="text-sm text-gray-400 hover:text-white">
                Cancel
              </button>
              <button onClick={saveAllocations} className="text-sm bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded">
                Save Allocations
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
