"use client";
import { useState } from "react";

export interface ColDef {
  key: string;
  header: string;
  type: "text" | "number" | "boolean" | "select";
  options?: (string | { label: string; value: string })[]; // Support labels and values
  readOnly?: boolean;
  width?: string;
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
      <div className="overflow-x-auto rounded-xl border border-black/10 bg-[#FFFFFF]/70 backdrop-blur-md shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-black/[0.02] border-b border-black/10">
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
                <tr key={row.id ?? Math.random()} className="border-b border-black/5 hover:bg-black/[0.02] transition-colors duration-150">
                  {columns.map((col) => {
                    const val = (row as any)[col.key];
                    let displayValue = String(val ?? "—");
                    if (col.type === "select" && col.options) {
                      const opt = col.options.find(o => typeof o === "object" ? o.value === val : o === val);
                      if (opt && typeof opt === "object") displayValue = opt.label;
                    }
                    return (
                      <td key={col.key} className="px-3 py-2">
                        {isEditing && !col.readOnly ? (
                          <CellInput col={col} value={val} onChange={(v) => handleChange(col.key, v)} />
                        ) : (
                          <span className="text-gray-700">{displayValue}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right space-x-2">
                    {isEditing ? (
                      <>
                        <button onClick={handleSave} className="text-xs text-green-600 hover:text-green-500">Save</button>
                        <button onClick={handleCancel} className="text-xs text-gray-400 hover:text-gray-700">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(row)} className="text-xs text-black/70 hover:text-black font-medium transition-colors">Edit</button>
                        <button onClick={() => onDelete(row.id!)} className="text-xs text-red-600 hover:text-red-500 font-medium transition-colors">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* New row form */}
            {isNew && editingRow && (
              <tr className="border-b border-black/10 bg-black/5 backdrop-blur-sm">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2">
                    <CellInput col={col} value={(editingRow as any)[col.key]} onChange={(v) => handleChange(col.key, v)} />
                  </td>
                ))}
                <td className="px-3 py-2 text-right space-x-2">
                  <button onClick={handleSave} className="text-xs text-green-600 hover:text-green-500">Save</button>
                  <button onClick={handleCancel} className="text-xs text-gray-400 hover:text-gray-700">Cancel</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={handleAdd}
        className="text-sm font-medium text-black bg-black/5 hover:bg-white/15 border border-black/10 px-4 py-2 rounded-xl transition-all duration-200 shadow-sm"
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
        className="bg-black/20 border border-black/10 rounded-lg px-2.5 py-1.5 text-black text-sm w-full focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all shadow-inner"
      >
        <option value="">— select —</option>
        {col.options.map((o) => {
          const label = typeof o === "object" ? o.label : o;
          const val = typeof o === "object" ? o.value : o;
          return <option key={val} value={val}>{label}</option>;
        })}
      </select>
    );
  }
  return (
    <input
      type={col.type === "number" ? "number" : "text"}
      value={String(value ?? "")}
      onChange={(e) => onChange(col.type === "number" ? Number(e.target.value) : e.target.value)}
      className="bg-black/20 border border-black/10 rounded-lg px-2.5 py-1.5 text-black text-sm w-full focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all shadow-inner"
    />
  );
}
