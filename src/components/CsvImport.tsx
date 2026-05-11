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
          className="text-sm font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-all shadow-sm"
        >
          ⬇ Download CSV Template
        </button>
        <label className="text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 rounded-xl cursor-pointer transition-all shadow-sm">
          ⬆ Import CSV
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {preview && (
        <div className="border border-white/10 rounded-xl p-5 bg-[#1c1c1e]/40 backdrop-blur-md shadow-sm space-y-4">
          <p className="text-sm text-white/90 font-medium">
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
          <div className="flex gap-3 pt-2">
            <button onClick={handleConfirm} className="text-sm font-medium text-black bg-white hover:bg-gray-100 px-4 py-2 rounded-xl shadow-sm transition-all">
              ✓ Confirm Import
            </button>
            <button onClick={handleCancel} className="text-sm font-medium text-white/70 hover:text-white bg-transparent hover:bg-white/5 border border-white/10 px-4 py-2 rounded-xl transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
