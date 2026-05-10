"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import { CsvImport } from "@/components/CsvImport";
import type { Material, MaterialFamily, UOM } from "@/types";

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
  const upsertMaterial = useAppStore((s) => s.upsertMaterial);
  const deleteMaterial = useAppStore((s) => s.deleteMaterial);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">🧱 Materials</h1>
        <p className="text-gray-500 text-sm mt-1">
          Every thing that flows through the factory. After creating materials here,
          go to Routes to define how each material moves through the factory.
        </p>
      </div>
      <CsvImport templateHeaders={CSV_HEADERS} templateFilename="materials-template.csv" onImport={handleImport} />
      <DataTable columns={COLUMNS} rows={materials} onSave={upsertMaterial} onDelete={deleteMaterial} newRowTemplate={newMaterial} />
      <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 text-sm text-gray-400">
        <strong className="text-gray-300">Note on Packaging Chain:</strong> After adding a material here,
        edit it to add packaging levels (inner box → outer box → pallet). Each level references a Packaging Master entry.
        The last level is always the pallet. This chain is needed for the engine to compute pallet quantities.
      </div>
    </div>
  );
}
