"use client";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { runAnalysis, EngineInput } from "@/lib/engine";
import type { AnalysisResult } from "@/types";

export default function AnalysisPage() {
  const store = useAppStore();
  const [result, setResult] = useState<AnalysisResult | null>(null);

  function handleRun() {
    const input: EngineInput = {
      cells: store.cells,
      materials: store.materials,
      processes: store.processes,
      routes: store.routes,
      stations: store.stations,
      edges: store.edges,
      familyStatuses: store.familyStatuses,
      engineConfig: store.engineConfig,
    };
    const res = runAnalysis(input);
    setResult(res);
  }

  function downloadReport() {
    if (!result) return;
    let md = `# ASRS-Choker Analysis Report\n\n`;

    if (!result.is_valid) {
      md += `## Validation Failed\n\n`;
      result.validation_errors.forEach((e) => md += `- ${e}\n`);
    } else {
      md += `## Alerts\n\n`;
      if (result.alerts.length === 0) md += `No alerts. System is fully capable.\n\n`;
      else result.alerts.forEach((a) => md += `- **${a.severity.toUpperCase()}** (${a.category}): ${a.message}\n`);

      md += `\n## Station Capacity Checks\n\n`;
      md += `| Station | Required (pph) | Capacity (pph) | Gap (pph) | Holding Req | Holding Cap | Holding Gap |\n`;
      md += `|---------|---------------|---------------|-----------|-------------|-------------|-------------|\n`;
      result.station_checks.forEach((sc) => {
        md += `| ${sc.station_name} | ${sc.throughput_required_pph.toFixed(1)} | ${sc.throughput_capacity_pph} | ${sc.throughput_gap_pph.toFixed(1)} | ${sc.holding_required_pallets.toFixed(0)} | ${sc.holding_capacity_pallets} | ${sc.holding_gap_pallets.toFixed(0)} |\n`;
      });

      md += `\n## Cell Footprint Checks\n\n`;
      md += `| Cell | Required (m²) | Available (m²) | Gap (m²) |\n`;
      md += `|------|---------------|----------------|----------|\n`;
      result.cell_checks.forEach((cc) => {
        md += `| ${cc.cell_name} | ${(cc.footprint_required_mm2 / 1e6).toFixed(1)} | ${(cc.footprint_available_mm2 / 1e6).toFixed(1)} | ${(cc.footprint_gap_mm2 / 1e6).toFixed(1)} |\n`;
      });
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asrs-choker-report-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">📊 Analysis Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Run the mathematical engine to check for bottlenecks and footprint violations.
          </p>
        </div>
        <div className="space-x-3">
          {result && (
            <button onClick={downloadReport} className="text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-800 px-4 py-2 rounded-lg">
              Download Markdown Report
            </button>
          )}
          <button onClick={handleRun} className="text-sm text-green-950 bg-green-500 hover:bg-green-400 font-bold px-6 py-2 rounded-lg">
            Run Engine
          </button>
        </div>
      </div>

      {!result ? (
        <div className="p-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-lg">
          Click "Run Engine" to analyze your current network.
        </div>
      ) : !result.is_valid ? (
        <div className="bg-red-950/30 border border-red-900 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-red-500">Validation Failed</h2>
          <p className="text-sm text-red-400">The engine cannot run because the network configuration violates physics rules:</p>
          <ul className="list-disc pl-5 text-sm text-red-300 space-y-2">
            {result.validation_errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ALERTS */}
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">Alerts</h2>
            {result.alerts.length === 0 ? (
              <div className="p-4 bg-green-950/20 border border-green-900 rounded-lg text-sm text-green-400">
                ✅ No bottlenecks or violations found. The network is capable.
              </div>
            ) : (
              <div className="space-y-2">
                {result.alerts.map((a, i) => (
                  <div key={i} className={`p-4 border rounded-lg text-sm ${a.severity === "error" ? "bg-red-950/20 border-red-900 text-red-400" : "bg-yellow-950/20 border-yellow-900 text-yellow-400"}`}>
                    <strong className="uppercase">{a.category}:</strong> {a.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PALLET POOL */}
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">Pallet Pool Sizing</h2>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 space-y-1">
              <p>Total active pallets required (WIP): <strong className="text-white">{result.total_pallets_needed.toFixed(0)}</strong></p>
              {result.pallet_pool_gap !== null && (
                <p>
                  User Declared Pool: <strong className="text-white">{store.engineConfig.pallet_pool_declared}</strong>
                  <span className="ml-4">Gap: <strong className={result.pallet_pool_gap < 0 ? "text-red-400" : "text-green-400"}>{result.pallet_pool_gap.toFixed(0)}</strong></span>
                </p>
              )}
            </div>
          </div>

          {/* STATION CHECKS */}
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">Station Capacity (Bottleneck Analysis)</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800">
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Station</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Req pph</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Cap pph</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Gap pph</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium border-l border-gray-800">Req slots</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Cap slots</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Gap slots</th>
                  </tr>
                </thead>
                <tbody>
                  {result.station_checks.map((sc, i) => (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-900/50">
                      <td className="px-3 py-2 text-gray-300">{sc.station_name}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{sc.throughput_required_pph.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{sc.throughput_capacity_pph.toFixed(1)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${sc.throughput_bottleneck ? "text-red-400" : "text-green-400"}`}>
                        {sc.throughput_gap_pph.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300 border-l border-gray-800">{sc.holding_required_pallets.toFixed(0)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{sc.holding_capacity_pallets}</td>
                      <td className={`px-3 py-2 text-right font-medium ${sc.holding_bottleneck ? "text-red-400" : "text-green-400"}`}>
                        {sc.holding_gap_pallets.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CELL CHECKS */}
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">Cell Footprint</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800">
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Cell</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Req m²</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Avail m²</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Gap m²</th>
                  </tr>
                </thead>
                <tbody>
                  {result.cell_checks.map((cc, i) => (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-900/50">
                      <td className="px-3 py-2 text-gray-300">{cc.cell_name}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{(cc.footprint_required_mm2 / 1e6).toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{(cc.footprint_available_mm2 / 1e6).toFixed(1)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${cc.footprint_bottleneck ? "text-red-400" : "text-green-400"}`}>
                        {(cc.footprint_gap_mm2 / 1e6).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
