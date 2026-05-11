"use client";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import type { Process, BomInput } from "@/types";

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
  const materials = useAppStore((s) => s.materials);
  const upsertProcess = useAppStore((s) => s.upsertProcess);
  const deleteProcess = useAppStore((s) => s.deleteProcess);

  const [editingProcess, setEditingProcess] = useState<Process | null>(null);

  function saveBOM() {
    if (editingProcess) {
      upsertProcess(editingProcess);
      setEditingProcess(null);
    }
  }

  function addBomInput() {
    if (!editingProcess) return;
    setEditingProcess({
      ...editingProcess,
      bom_inputs: [...(editingProcess.bom_inputs || []), { child_material_id: "", qty_per_parent: 1 }],
    });
  }

  function updateBomInput(idx: number, field: keyof BomInput, val: string | number) {
    if (!editingProcess) return;
    const next = [...editingProcess.bom_inputs];
    (next[idx] as any)[field] = val;
    setEditingProcess({ ...editingProcess, bom_inputs: next });
  }

  function removeBomInput(idx: number) {
    if (!editingProcess) return;
    const next = editingProcess.bom_inputs.filter((_, i) => i !== idx);
    setEditingProcess({ ...editingProcess, bom_inputs: next });
  }

  const identityProcesses = processes.filter((p) => p.type === "identity-change");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">⚙️ Processes</h1>
        <p className="text-gray-400 text-sm mt-1">
          Named activities performed on materials. Define once, reuse across materials and stations.
        </p>
      </div>

      <div className="p-4 bg-white rounded-lg border border-gray-200 text-sm text-gray-400 space-y-1">
        <p><strong className="text-gray-700">Types explained:</strong></p>
        <p>• <span className="text-indigo-600">identity-change</span> — Assembly/production: children → parent. Set BOM inputs after saving.</p>
        <p>• <span className="text-indigo-600">packaging-change</span> — Same material, different packaging (palletize, repack).</p>
        <p>• <span className="text-indigo-600">status-change</span> — Same material, different status (IQC, FGQC). Set yield {"<"} 1 for rejections.</p>
        <p>• <span className="text-indigo-600">location-change</span> — Transport between cells. Residence = 0 in v1.</p>
        <p>• <span className="text-indigo-600">hold</span> — Just waiting (ASRS storage, ageing, line-side buffer).</p>
      </div>

      {identityProcesses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">Identity-Change Processes (BOMs)</h2>
          {identityProcesses.map((p) => (
            <div key={p.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-black/[0.02]0">
              <div>
                <span className="font-medium text-gray-800">{p.name}</span>
              </div>
              <button
                onClick={() => setEditingProcess(p)}
                className="text-sm text-indigo-600 border border-indigo-800 hover:bg-indigo-900/30 px-3 py-1.5 rounded"
              >
                Edit BOM Inputs ({p.bom_inputs?.length || 0})
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Base Attributes</h2>
        <DataTable columns={COLUMNS} rows={processes} onSave={upsertProcess} onDelete={deleteProcess} newRowTemplate={newProcess} />
      </div>

      {/* MODAL FOR BOM INPUTS */}
      <Modal
        isOpen={!!editingProcess}
        onClose={() => setEditingProcess(null)}
        title={`BOM Inputs: ${editingProcess?.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Define which child materials are consumed by this process to create the parent material.
          </p>
          
          <div className="space-y-3">
            {editingProcess?.bom_inputs?.map((input, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-950 p-3 rounded border border-gray-200">
                <select
                  value={input.child_material_id}
                  onChange={(e) => updateBomInput(i, "child_material_id", e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-800 text-sm rounded px-2 py-1.5 flex-1"
                >
                  <option value="">— Select Child Material —</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Qty per parent:</span>
                  <input
                    type="number"
                    value={input.qty_per_parent}
                    onChange={(e) => updateBomInput(i, "qty_per_parent", Number(e.target.value))}
                    className="bg-gray-50 border border-gray-300 text-gray-800 text-sm rounded px-2 py-1.5 w-24"
                  />
                </div>
                <button onClick={() => removeBomInput(i)} className="text-red-600 hover:text-red-500 ml-2">✕</button>
              </div>
            ))}
            
            {(!editingProcess?.bom_inputs || editingProcess.bom_inputs.length === 0) && (
              <div className="text-sm text-gray-400 italic p-4 text-center border border-dashed border-gray-300 rounded">
                No BOM inputs defined.
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button onClick={addBomInput} className="text-sm text-indigo-600 hover:text-indigo-300">
              + Add Component
            </button>
            <div className="space-x-3">
              <button onClick={() => setEditingProcess(null)} className="text-sm text-gray-400 hover:text-black">
                Cancel
              </button>
              <button onClick={saveBOM} className="text-sm bg-green-600 hover:bg-green-500 text-black px-4 py-2 rounded">
                Save BOM
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
