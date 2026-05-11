"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import { CsvImport } from "@/components/CsvImport";
import type { PackagingMaster } from "@/types";

const COLUMNS: ColDef[] = [
  { key: "name",        header: "Name",         type: "text" },
  { key: "code",        header: "Code",         type: "text" },
  { key: "length_mm",   header: "Length (mm)",  type: "number" },
  { key: "breadth_mm",  header: "Breadth (mm)", type: "number" },
  { key: "height_mm",   header: "Height (mm)",  type: "number" },
  { key: "collapsible", header: "Collapsible",  type: "boolean" },
  { key: "returnable",  header: "Returnable",   type: "boolean" },
];

const CSV_HEADERS = ["name","code","length_mm","breadth_mm","height_mm","collapsible","returnable"];

function newPkg(): PackagingMaster {
  return { id: undefined as any, name: "", code: "", length_mm: 0, breadth_mm: 0, height_mm: 0, collapsible: false, returnable: false };
}

export default function PackagingPage() {
  const packagingMasters = useAppStore((s) => s.packagingMasters);
  const upsertPackagingMaster = useAppStore((s) => s.upsertPackagingMaster);
  const deletePackagingMaster = useAppStore((s) => s.deletePackagingMaster);

  function handleImport(rows: Record<string, string>[]) {
    rows.forEach((row) => upsertPackagingMaster({
      id: undefined as any,
      name: row.name, code: row.code,
      length_mm: Number(row.length_mm), breadth_mm: Number(row.breadth_mm), height_mm: Number(row.height_mm),
      collapsible: row.collapsible === "true", returnable: row.returnable === "true",
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📦 Packaging Master</h1>
        <p className="text-gray-400 text-sm mt-1">
          Reusable box and container types. Each material references these in its packaging chain.
        </p>
      </div>
      <CsvImport templateHeaders={CSV_HEADERS} templateFilename="packaging-template.csv" onImport={handleImport} />
      <DataTable columns={COLUMNS} rows={packagingMasters} onSave={upsertPackagingMaster} onDelete={deletePackagingMaster} newRowTemplate={newPkg} />
    </div>
  );
}
