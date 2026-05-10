# ASRS-Choker — Plan Part 5: Layout, Sidebar, and Shared UI Components

> **Prerequisite:** Complete plans 01–04 first.
> **Goal:** Build the shell of the app — the sidebar navigation, root layout, and the two reusable components (`DataTable` and `CsvImport`) that every module page uses.
> **When done:** The app shows a dark sidebar with 8 nav items. Clicking each item shows a placeholder page.

---

## App Structure (8 Sidebar Modules)

| # | Nav Label | URL | What the user does there |
|---|-----------|-----|--------------------------|
| 1 | 🏗 Cells | `/cells` | Define physical locations (building, floor, block, dimensions) |
| 2 | 📦 Packaging | `/packaging` | Define box/pallet types used across materials |
| 3 | 🧱 Materials | `/materials` | Define materials (RM, SFG, FG) and their packaging chains |
| 4 | ⚙ Processes | `/processes` | Define named activities (IQC, Assemble, Palletize, etc.) |
| 5 | 🗺 Routes | `/routes` | Assign ordered processes to each material |
| 6 | 🏭 Stations | `/stations` | Place stations in cells; set throughput, holding, footprint |
| 7 | 🛤 Edges | `/edges` | Define elevators, lanes, bridges between cells |
| 8 | 📊 Analysis | `/analysis` | Run the engine; see bottleneck alerts and WIP tables |

---

## Task 6: Root Layout + Sidebar

**Step 6.1** — Replace `src/app/layout.tsx` entirely:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { AppLoader } from "@/components/AppLoader";
import { UndoBar } from "@/components/UndoBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ASRS-Choker — Factory Planning Tool",
  description: "Warehouse and production planning: storage, flow, layout, what-if analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <AppLoader />
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-64 p-8 pb-20">{children}</main>
        </div>
        <UndoBar />
      </body>
    </html>
  );
}
```

**Step 6.2** — Create `src/components/AppLoader.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

// This component loads all data from Firestore into the store on startup.
// It renders nothing visible — it just triggers the data load.
export function AppLoader() {
  const loadAll = useAppStore((s) => s.loadAll);
  useEffect(() => {
    loadAll();
  }, [loadAll]);
  return null;
}
```

**Step 6.3** — Create `src/components/Sidebar.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/cells",     icon: "🏗", label: "Cells" },
  { href: "/packaging", icon: "📦", label: "Packaging" },
  { href: "/materials", icon: "🧱", label: "Materials" },
  { href: "/processes", icon: "⚙️", label: "Processes" },
  { href: "/routes",    icon: "🗺", label: "Routes" },
  { href: "/stations",  icon: "🏭", label: "Stations" },
  { href: "/edges",     icon: "🛤", label: "Edges" },
  { href: "/analysis",  icon: "📊", label: "Analysis" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-indigo-400 tracking-wide">ASRS-Choker</h1>
        <p className="text-xs text-gray-500 mt-1">Factory Planning Tool</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

**Step 6.4** — Create `src/components/UndoBar.tsx`:

```tsx
"use client";
import { useAppStore } from "@/store/useAppStore";

export function UndoBar() {
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const undoPast = useAppStore((s) => s.undoPast);
  const undoFuture = useAppStore((s) => s.undoFuture);

  return (
    <div className="fixed bottom-0 left-64 right-0 h-12 bg-gray-900 border-t border-gray-800 flex items-center px-6 gap-4 z-50">
      <button
        onClick={() => undo()}
        disabled={undoPast.length === 0}
        className="text-sm text-gray-400 hover:text-white disabled:opacity-30 flex items-center gap-1"
      >
        ↩ Undo ({undoPast.length})
      </button>
      <button
        onClick={() => redo()}
        disabled={undoFuture.length === 0}
        className="text-sm text-gray-400 hover:text-white disabled:opacity-30 flex items-center gap-1"
      >
        ↪ Redo ({undoFuture.length})
      </button>
    </div>
  );
}
```

**Step 6.5** — Create the root redirect. Replace `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/cells");
}
```

**Step 6.6** — Commit:
```powershell
git add .
git commit -m "feat: root layout, sidebar, undo bar"
```

---

## Task 7: Reusable DataTable Component

Every module page uses this. It shows a table with inline editing, an Add Row button, and a Delete button per row.

**Step 7.1** — Create `src/components/DataTable.tsx`:

```tsx
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
    setEditingRow((prev) => prev ? { ...prev, [key]: value } : null);
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
```

**Step 7.2** — Commit:
```powershell
git add .
git commit -m "feat: DataTable reusable component"
```

---

## Task 8: CsvImport Component

**Step 8.1** — Create `src/components/CsvImport.tsx`:

```tsx
"use client";
import { useState, useRef } from "react";
import Papa from "papaparse";
import type { ColDef } from "./DataTable";

interface CsvImportProps {
  templateHeaders: string[];     // e.g. ["name","code","family","subfamily"]
  templateFilename: string;      // e.g. "materials-template.csv"
  onImport: (rows: Record<string, string>[]) => void;
}

export function CsvImport({ templateHeaders, templateFilename, onImport }: CsvImportProps) {
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const csv = templateHeaders.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setError(`CSV parse error: ${result.errors[0].message}`);
          return;
        }
        setPreview(result.data);
      },
    });
  }

  function handleConfirm() {
    if (!preview) return;
    onImport(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleCancel() {
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={downloadTemplate}
          className="text-sm text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg"
        >
          ⬇ Download CSV Template
        </button>
        <label className="text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-800 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-950/40 transition-colors">
          ⬆ Import CSV
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {preview && (
        <div className="border border-indigo-800 rounded-lg p-4 bg-indigo-950/20 space-y-3">
          <p className="text-sm text-indigo-300 font-medium">
            Preview: {preview.length} row(s) to import
          </p>
          <div className="overflow-x-auto max-h-48">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  {Object.keys(preview[0] || {}).map((h) => (
                    <th key={h} className="text-left px-2 py-1 text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-2 py-1 text-gray-300">{v}</td>
                    ))}
                  </tr>
                ))}
                {preview.length > 5 && (
                  <tr><td colSpan={99} className="px-2 py-1 text-gray-500">... and {preview.length - 5} more rows</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button onClick={handleConfirm} className="text-sm text-green-400 hover:text-green-300 border border-green-800 px-3 py-1.5 rounded-lg">
              ✓ Confirm Import
            </button>
            <button onClick={handleCancel} className="text-sm text-gray-500 hover:text-gray-300 border border-gray-700 px-3 py-1.5 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 8.2** — Commit:
```powershell
git add .
git commit -m "feat: CsvImport reusable component"
```

---

## Task 9: Create All 8 Placeholder Pages

Create these files so the sidebar links don't 404. Each page gets a real implementation in Plan 06.

For each path below, create the file with this minimal content (replace `Cells` with the module name):

```tsx
// src/app/cells/page.tsx
export default function CellsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-100 mb-6">🏗 Cells</h1>
      <p className="text-gray-500">Coming soon — see plan-06-module-pages.md</p>
    </div>
  );
}
```

Create these files:
- `src/app/cells/page.tsx`
- `src/app/packaging/page.tsx`
- `src/app/materials/page.tsx`
- `src/app/processes/page.tsx`
- `src/app/routes/page.tsx`
- `src/app/stations/page.tsx`
- `src/app/edges/page.tsx`
- `src/app/analysis/page.tsx`

**Step 9.2** — Run the app and verify:
```powershell
npm run dev
```
Open `http://localhost:3000`. You should see:
- The dark sidebar on the left with 8 nav items
- Clicking each item shows the placeholder page
- Undo bar at the bottom
Press `Ctrl+C` to stop.

**Step 9.3** — Commit:
```powershell
git add .
git commit -m "feat: placeholder pages for all 8 modules"
```

---

## Checklist

- [ ] `src/app/layout.tsx` updated with sidebar layout
- [ ] `src/components/AppLoader.tsx` created
- [ ] `src/components/Sidebar.tsx` created with 8 nav items
- [ ] `src/components/UndoBar.tsx` created
- [ ] `src/app/page.tsx` redirects to `/cells`
- [ ] `src/components/DataTable.tsx` created
- [ ] `src/components/CsvImport.tsx` created
- [ ] All 8 placeholder pages created
- [ ] `npm run dev` shows sidebar + placeholder pages
- [ ] All commits done

**➡ Continue with: `plan-06-module-pages.md`**
