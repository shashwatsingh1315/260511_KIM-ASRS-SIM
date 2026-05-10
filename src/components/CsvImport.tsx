"use client";
import { useState, useRef } from "react";
import Papa from "papaparse";

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
