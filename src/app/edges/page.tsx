"use client";
import { useAppStore } from "@/store/useAppStore";
import { DataTable, ColDef } from "@/components/DataTable";
import type { Edge } from "@/types";

export default function EdgesPage() {
  const edges = useAppStore((s) => s.edges);
  const cells = useAppStore((s) => s.cells);
  const upsertEdge = useAppStore((s) => s.upsertEdge);
  const deleteEdge = useAppStore((s) => s.deleteEdge);

  const cellOptions = cells.map((c) => ({ label: c.name, value: c.id }));

  const COLUMNS: ColDef[] = [
    { key: "name",           header: "Name",          type: "text" },
    { key: "type",           header: "Type",          type: "select", options: ["lane","elevator","bridge","dock-link"] },
    { key: "from_cell_id",   header: "From Cell",     type: "select", options: cellOptions },
    { key: "to_cell_id",     header: "To Cell",       type: "select", options: cellOptions },
    { key: "bidirectional",  header: "Bidirectional", type: "boolean" },
    { key: "capacity_pph",   header: "Capacity (pph)",type: "number" },
  ];

  function newEdge(): Edge {
    return {
      id: undefined as any, name: "",
      from_cell_id: "", to_cell_id: "",
      type: "lane", bidirectional: true,
      capacity_pph: 0, materials_allowed: [],
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🛤 Edges</h1>
        <p className="text-gray-400 text-sm mt-1">
          Physical connections between cells: elevators, lanes, bridges.
          In v1, edges are stored but not used in calculations (lane traversal is instantaneous).
          Enter them now so v2 routing works without data migration.
        </p>
      </div>
      <DataTable columns={COLUMNS} rows={edges} onSave={upsertEdge} onDelete={deleteEdge} newRowTemplate={newEdge} />
    </div>
  );
}
