"use client";
import { useState } from "react";

export interface ColDef {
  key: string;
  header: string;
  type: "text" | "number" | "boolean" | "select";
  options?: string[];       // Only for type="select"
  readOnly?: boolean;       // If true, show as text (not editable)
  width?: string;           // Tailwind width class e.g. "w-32"
}

interface DataTableProps<T extends { id?: string }> {
  columns: ColDef[];
  rows: T[];
  onSave: (row: T) => void;
  onDelete: (id: string) => void;
  newRowTemplate: () => T;  // Returns a blank row with default values
}

export function DataTable<T extends { id?: string }>({
  columns, rows, onSave, onDelete, newRowTemplate,
}: DataTableProps<T>) {
  const [editingRow, setEditingRow] = useState<T | null>(null);
  const [isNew, setIsNew] = useState(false);

  function handleEdit(row: T) {
    setEditingRow({ ...row });
    setIsNew(false);
  }

  function handleAdd() {
    setEditingRow(newRowTemplate());
    setIsNew(true);
  }

  function handleChange(key: string, value: unknown) {
    setEditingRow((prev) => prev ? { ...prev, [key]: value } as T : null);
  }

  function handleSave() {
    if (!editingRow) return;
    onSave(editingRow);
    setEditingRow(null);
  }

  function handleCancel() {
    setEditingRow(null);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 border-b border-gray-800">
              {columns.map((col) => (
                <th key={col.key} className={`px-3 py-2 text-left text-gray-400 font-medium ${col.width ?? ""}`}>
                  {col.header}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-gray-400 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isEditing = editingRow?.id === row.id && !isNew;
              return (
                <tr key={row.id ?? Math.random()} className="border-b border-gray-800 hover:bg-gray-900/50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2">
                      {isEditing && !col.readOnly ? (
                        <CellInput col={col} value={(editingRow as any)[col.key]} onChange={(v) => handleChange(col.key, v)} />
                      ) : (
                        <span className="text-gray-300">
                          {String((row as any)[col.key] ?? "—")}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right space-x-2">
                    {isEditing ? (
                      <>
                        <button onClick={handleSave} className="text-xs text-green-400 hover:text-green-300">Save</button>
                        <button onClick={handleCancel} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(row)} className="text-xs text-indigo-400 hover:text-indigo-300">Edit</button>
                        <button onClick={() => onDelete(row.id!)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* New row form */}
            {isNew && editingRow && (
              <tr className="border-b border-indigo-800 bg-indigo-950/30">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2">
                    <CellInput col={col} value={(editingRow as any)[col.key]} onChange={(v) => handleChange(col.key, v)} />
                  </td>
                ))}
                <td className="px-3 py-2 text-right space-x-2">
                  <button onClick={handleSave} className="text-xs text-green-400 hover:text-green-300">Save</button>
                  <button onClick={handleCancel} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={handleAdd}
        className="text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-950/40 transition-colors"
      >
        + Add Row
      </button>
    </div>
  );
}

function CellInput({ col, value, onChange }: { col: ColDef; value: unknown; onChange: (v: unknown) => void }) {
  if (col.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-indigo-500"
      />
    );
  }
  if (col.type === "select" && col.options) {
    return (
      <select
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 text-sm w-full"
      >
        <option value="">— select —</option>
        {col.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <input
      type={col.type === "number" ? "number" : "text"}
      value={String(value ?? "")}
      onChange={(e) => onChange(col.type === "number" ? Number(e.target.value) : e.target.value)}
      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 text-sm w-full"
    />
  );
}
