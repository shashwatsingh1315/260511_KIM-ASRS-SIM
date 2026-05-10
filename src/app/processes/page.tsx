"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import type { Process, ProcessType } from "@/types";

const COLUMNS: ColDef[] = [
  { key: "name",                    header: "Name",               type: "text" },
  { key: "type",                    header: "Type",               type: "select",
    options: ["identity-change","packaging-change","status-change","location-change","hold"] },
  { key: "input_status",            header: "Input Status",       type: "text" },
  { key: "output_status",           header: "Output Status",      type: "text" },
  { key: "default_residence_time_hr",header: "Residence Time (hr)",type: "number" },
  { key: "default_yield",           header: "Yield (0–1)",        type: "number" },
  { key: "production_target_pph",   header: "Target pph (lines only)", type: "number" },
];

function newProcess(): Process {
  return {
    id: undefined as any, name: "",
    type: "hold",
    input_status: "", output_status: "",
    default_residence_time_hr: 0,
    default_yield: 1,
    bom_inputs: [],
    production_target_pph: null,
  };
}

export default function ProcessesPage() {
  const processes = useAppStore((s) => s.processes);
  const upsertProcess = useAppStore((s) => s.upsertProcess);
  const deleteProcess = useAppStore((s) => s.deleteProcess);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">⚙️ Processes</h1>
        <p className="text-gray-500 text-sm mt-1">
          Named activities performed on materials. Define once, reuse across materials and stations.
        </p>
      </div>
      <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 text-sm text-gray-400 space-y-1">
        <p><strong className="text-gray-300">Types explained:</strong></p>
        <p>• <span className="text-indigo-400">identity-change</span> — Assembly/production: children → parent. Set BOM inputs after saving.</p>
        <p>• <span className="text-indigo-400">packaging-change</span> — Same material, different packaging (palletize, repack).</p>
        <p>• <span className="text-indigo-400">status-change</span> — Same material, different status (IQC, FGQC). Set yield {"<"} 1 for rejections.</p>
        <p>• <span className="text-indigo-400">location-change</span> — Transport between cells. Residence = 0 in v1.</p>
        <p>• <span className="text-indigo-400">hold</span> — Just waiting (ASRS storage, ageing, line-side buffer).</p>
      </div>
      <DataTable columns={COLUMNS} rows={processes} onSave={upsertProcess} onDelete={deleteProcess} newRowTemplate={newProcess} />
    </div>
  );
}
