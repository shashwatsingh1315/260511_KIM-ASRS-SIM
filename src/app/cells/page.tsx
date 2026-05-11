"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import { CsvImport } from "@/components/CsvImport";
import type { Cell } from "@/types";

const COLUMNS: ColDef[] = [
  { key: "name",      header: "Name",       type: "text" },
  { key: "building",  header: "Building",   type: "select", options: ["Production", "Warehouse"] },
  { key: "floor",     header: "Floor",      type: "number" },
  { key: "block",     header: "Block",      type: "text" },
  { key: "length_mm", header: "Length (mm)",type: "number" },
  { key: "width_mm",  header: "Width (mm)", type: "number" },
  { key: "height_mm", header: "Height (mm)",type: "number" },
];

const CSV_HEADERS = ["name","building","floor","block","length_mm","width_mm","height_mm"];

function newCell(): Cell {
  return { id: undefined as any, name: "", building: "Production", floor: 0, block: "A", length_mm: 0, width_mm: 0, height_mm: 0 };
}

export default function CellsPage() {
  const cells = useAppStore((s) => s.cells);
  const upsertCell = useAppStore((s) => s.upsertCell);
  const deleteCell = useAppStore((s) => s.deleteCell);

  function handleImport(rows: Record<string, string>[]) {
    rows.forEach((row) => upsertCell({
      id: undefined as any,
      name: row.name,
      building: row.building as "Production" | "Warehouse",
      floor: Number(row.floor),
      block: row.block,
      length_mm: Number(row.length_mm),
      width_mm: Number(row.width_mm),
      height_mm: Number(row.height_mm),
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🏗 Cells</h1>
        <p className="text-gray-400 text-sm mt-1">
          Physical locations in the factory. Every station must live in a cell.
          Cell dimensions are used to check that station footprints fit (Rule 15).
        </p>
      </div>
      <CsvImport templateHeaders={CSV_HEADERS} templateFilename="cells-template.csv" onImport={handleImport} />
      <DataTable columns={COLUMNS} rows={cells} onSave={upsertCell} onDelete={deleteCell} newRowTemplate={newCell} />
    </div>
  );
}
