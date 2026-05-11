"use client";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import { CsvImport } from "@/components/CsvImport";
import { Modal } from "@/components/Modal";
import type { Material, MaterialFamily, UOM, PackagingLevel } from "@/types";

const COLUMNS: ColDef[] = [
  { key: "code",                    header: "Code",             type: "text" },
  { key: "name",                    header: "Name",             type: "text" },
  { key: "family",                  header: "Family",           type: "select", options: ["RM","SFG","FG","Returnable"] },
  { key: "subfamily",               header: "Subfamily",        type: "text" },
  { key: "uom",                     header: "UOM",              type: "select", options: ["piece","kg","litre","metre"] },
  { key: "unit_weight_kg",          header: "Unit Weight (kg)", type: "number" },
  { key: "unit_volume_mm3",         header: "Unit Volume (mm³)",type: "number" },
  { key: "yield_default_override",  header: "Yield Override",   type: "number" },
  { key: "returnable_density_ratio",header: "Density Ratio",    type: "number" },
];

const CSV_HEADERS = ["code","name","family","subfamily","uom","unit_weight_kg","unit_volume_mm3","yield_default_override","returnable_density_ratio"];

function newMaterial(): Material {
  return {
    id: undefined as any, code: "", name: "",
    family: "RM", subfamily: "", uom: "piece",
    unit_weight_kg: 0, unit_volume_mm3: 0,
    yield_default_override: null,
    packaging_chain: [],
    returnable_density_ratio: null,
  };
}

export default function MaterialsPage() {
  const materials = useAppStore((s) => s.materials);
  const packagingMasters = useAppStore((s) => s.packagingMasters);
  const upsertMaterial = useAppStore((s) => s.upsertMaterial);
  const deleteMaterial = useAppStore((s) => s.deleteMaterial);

  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  function handleImport(rows: Record<string, string>[]) {
    rows.forEach((row) => upsertMaterial({
      id: undefined as any,
      code: row.code, name: row.name,
      family: row.family as MaterialFamily, subfamily: row.subfamily,
      uom: row.uom as UOM,
      unit_weight_kg: Number(row.unit_weight_kg),
      unit_volume_mm3: Number(row.unit_volume_mm3),
      yield_default_override: row.yield_default_override ? Number(row.yield_default_override) : null,
      packaging_chain: [],
      returnable_density_ratio: row.returnable_density_ratio ? Number(row.returnable_density_ratio) : null,
    }));
  }

  function saveChain() {
    if (editingMaterial) {
      upsertMaterial(editingMaterial);
      setEditingMaterial(null);
    }
  }

  function addPackagingLevel() {
    if (!editingMaterial) return;
    setEditingMaterial({
      ...editingMaterial,
      packaging_chain: [...editingMaterial.packaging_chain, { packaging_master_id: "", qty_per_parent: 1 }],
    });
  }

  function updatePackagingLevel(idx: number, field: keyof PackagingLevel, val: string | number) {
    if (!editingMaterial) return;
    const next = [...editingMaterial.packaging_chain];
    (next[idx] as any)[field] = val;
    setEditingMaterial({ ...editingMaterial, packaging_chain: next });
  }

  function removePackagingLevel(idx: number) {
    if (!editingMaterial) return;
    const next = editingMaterial.packaging_chain.filter((_, i) => i !== idx);
    setEditingMaterial({ ...editingMaterial, packaging_chain: next });
  }

  function moveLevel(i: number, dir: -1 | 1) {
    if (!editingMaterial) return;
    const next = [...editingMaterial.packaging_chain];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setEditingMaterial({ ...editingMaterial, packaging_chain: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">🧱 Materials</h1>
        <p className="text-gray-500 text-sm mt-1">
          Every thing that flows through the factory. After creating materials here,
          click "Edit Packaging" to link them to Packaging Masters.
        </p>
      </div>

      <CsvImport templateHeaders={CSV_HEADERS} templateFilename="materials-template.csv" onImport={handleImport} />

      <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 text-sm text-gray-400">
        <strong className="text-gray-300">Note on Packaging Chain:</strong> The engine assumes the *last* level in the chain is the pallet.
      </div>

      <div className="space-y-4">
        {materials.map((m) => (
          <div key={m.id} className="flex justify-between items-center p-3 border border-gray-800 rounded-lg bg-gray-900/50">
            <div>
              <span className="font-medium text-gray-200">{m.name}</span>
              <span className="text-gray-500 text-sm ml-2">({m.code})</span>
            </div>
            <button
              onClick={() => setEditingMaterial(m)}
              className="text-sm text-indigo-400 border border-indigo-800 hover:bg-indigo-900/30 px-3 py-1.5 rounded"
            >
              Edit Packaging Chain ({m.packaging_chain?.length || 0})
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-8 border-t border-gray-800">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Base Attributes</h2>
        <DataTable columns={COLUMNS} rows={materials} onSave={upsertMaterial} onDelete={deleteMaterial} newRowTemplate={newMaterial} />
      </div>

      {/* MODAL FOR PACKAGING CHAIN */}
      <Modal
        isOpen={!!editingMaterial}
        onClose={() => setEditingMaterial(null)}
        title={`Packaging Chain: ${editingMaterial?.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Define how this material is packed. Order from inner-most to outer-most. 
            The <strong>last item</strong> in this list must be the Pallet.
          </p>
          
          <div className="space-y-3">
            {editingMaterial?.packaging_chain.map((level, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-950 p-3 rounded border border-gray-800">
                <span className="text-gray-500 text-sm w-4">{i + 1}.</span>
                <select
                  value={level.packaging_master_id}
                  onChange={(e) => updatePackagingLevel(i, "packaging_master_id", e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 flex-1"
                >
                  <option value="">— Select Container/Pallet —</option>
                  {packagingMasters.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name} ({pm.code})</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Qty per parent:</span>
                  <input
                    type="number"
                    value={level.qty_per_parent}
                    onChange={(e) => updatePackagingLevel(i, "qty_per_parent", Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 w-20"
                  />
                </div>
                <button onClick={() => moveLevel(i, -1)} className="text-gray-500 hover:text-white px-1">↑</button>
                <button onClick={() => moveLevel(i, 1)} className="text-gray-500 hover:text-white px-1">↓</button>
                <button onClick={() => removePackagingLevel(i)} className="text-red-400 hover:text-red-300 ml-2">✕</button>
              </div>
            ))}
            
            {editingMaterial?.packaging_chain.length === 0 && (
              <div className="text-sm text-gray-500 italic p-4 text-center border border-dashed border-gray-700 rounded">
                No packaging defined. Add a level below.
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button onClick={addPackagingLevel} className="text-sm text-indigo-400 hover:text-indigo-300">
              + Add Level
            </button>
            <div className="space-x-3">
              <button onClick={() => setEditingMaterial(null)} className="text-sm text-gray-400 hover:text-white">
                Cancel
              </button>
              <button onClick={saveChain} className="text-sm bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded">
                Save Chain
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
