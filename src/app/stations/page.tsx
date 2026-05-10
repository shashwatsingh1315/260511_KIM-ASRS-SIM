"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import type { Station } from "@/types";

export default function StationsPage() {
  const stations = useAppStore((s) => s.stations);
  const cells = useAppStore((s) => s.cells);
  const processes = useAppStore((s) => s.processes);
  const upsertStation = useAppStore((s) => s.upsertStation);
  const deleteStation = useAppStore((s) => s.deleteStation);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">🏭 Stations</h1>
        <p className="text-gray-500 text-sm mt-1">
          Physical equipment/areas at a cell that perform one process.
          After creating a station, set its material allocations (days of stock or residence override).
        </p>
      </div>
      <DataTable columns={COLUMNS} rows={stations} onSave={upsertStation} onDelete={deleteStation} newRowTemplate={newStation} />
    </div>
  );
}
