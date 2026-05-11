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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 Analysis Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Run the mathematical engine to check for bottlenecks and footprint violations.
          </p>
        </div>
        <button onClick={handleRun} className="text-sm text-green-950 bg-green-500 hover:bg-green-400 font-bold px-6 py-2 rounded-lg transition-all shadow-lg shadow-green-500/20">
          Run Engine
        </button>
      </div>

      {!result ? (
        <div className="p-12 text-center text-gray-400 border border-dashed border-black/10 rounded-2xl bg-white/[0.02]">
          Click "Run Engine" to analyze your current network.
        </div>
      ) : !result.is_valid ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-4 backdrop-blur-md">
          <h2 className="text-lg font-bold text-red-500">Validation Failed</h2>
          <ul className="list-disc pl-5 text-sm text-red-500 space-y-2">
            {result.validation_errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ALERTS SECTION */}
          <CollapsibleSection title="Critical Alerts" badge={result.alerts.length} defaultOpen={true}>
            {result.alerts.length === 0 ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600">
                ✅ No bottlenecks or violations found. The network is capable.
              </div>
            ) : (
              <div className="space-y-2">
                {result.alerts.map((a, i) => (
                  <div key={i} className={`p-4 border rounded-xl text-sm backdrop-blur-sm ${a.severity === "error" ? "bg-red-50 border-red-200 text-red-600" : "bg-yellow-50 border-yellow-200 text-yellow-400"}`}>
                    <strong className="uppercase mr-2">[{a.category}]</strong> {a.message}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* BOM LEVEL ANALYSIS */}
          <CollapsibleSection title="BOM Level Analysis (Flow & Pallets)">
            <div className="overflow-x-auto rounded-xl border border-black/10 bg-white/[0.02]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/[0.02] border-b border-black/10">
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Material</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Process</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Units/hr</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Pallets/hr</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Daily Pallets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.step_demands.map((sd, i) => {
                    const mat = store.materials.find(m => m.id === sd.material_id);
                    const proc = store.processes.find(p => p.id === sd.process_id);
                    return (
                      <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3 text-gray-800">
                          {mat?.name} <span className="text-xs text-gray-400 ml-1">({mat?.code})</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 italic">
                          {proc?.name} {sd.is_reject_branch && <span className="text-red-600 text-[10px] ml-1 uppercase">Reject</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-800">{sd.throughput_units_pph.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right font-mono text-indigo-600">{sd.throughput_pallets_pph}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{sd.throughput_daily_pallets}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* STATION BOTTLENECKS */}
          <CollapsibleSection title="Station Capacities">
            <div className="overflow-x-auto rounded-xl border border-black/10 bg-white/[0.02]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/[0.02] border-b border-black/10">
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Station</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Req pph</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Cap pph</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Req Slots</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Cap Slots</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.station_checks.map((sc, i) => (
                    <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 text-gray-800">{sc.station_name}</td>
                      <td className={`px-4 py-3 text-right font-medium ${sc.throughput_bottleneck ? "text-red-600" : "text-green-600"}`}>
                        {sc.throughput_required_pph.toFixed(1)} / {sc.throughput_capacity_pph}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{sc.throughput_gap_pph.toFixed(1)} gap</td>
                      <td className={`px-4 py-3 text-right font-medium ${sc.holding_bottleneck ? "text-red-600" : "text-green-600"}`}>
                        {sc.holding_required_pallets.toFixed(0)} / {sc.holding_capacity_pallets}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{sc.holding_gap_pallets.toFixed(0)} gap</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* EDGE UTILIZATION */}
          <CollapsibleSection title="Edge & Transport Utilization">
            <div className="overflow-x-auto rounded-xl border border-black/10 bg-white/[0.02]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/[0.02] border-b border-black/10">
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Edge</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Connection</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Load (pph)</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Cap (pph)</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.edge_checks.map((ec, i) => {
                    const from = store.cells.find(c => c.id === ec.from_cell_id)?.name;
                    const to = store.cells.find(c => c.id === ec.to_cell_id)?.name;
                    return (
                      <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3 text-gray-800 font-medium">{ec.edge_name}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">{from} → {to}</td>
                        <td className="px-4 py-3 text-right text-gray-800">{ec.throughput_required_pph.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{ec.throughput_capacity_pph}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-sm font-bold ${ec.bottleneck ? "text-red-600" : "text-indigo-600"}`}>
                              {ec.utilization_percent.toFixed(1)}%
                            </span>
                            <div className="w-24 h-1 bg-black/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${ec.bottleneck ? "bg-red-500" : "bg-indigo-500"}`}
                                style={{ width: `${Math.min(ec.utilization_percent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {result.edge_checks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">
                        No edges defined to analyze.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* FOOTPRINT */}
          <CollapsibleSection title="Cell Footprint">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.cell_checks.map((cc, i) => (
                <div key={i} className="p-4 rounded-xl border border-black/10 bg-white/[0.02] flex justify-between items-center">
                  <div>
                    <h3 className="text-gray-800 font-medium">{cc.cell_name}</h3>
                    <p className="text-xs text-gray-400 mt-1">Available: {(cc.footprint_available_mm2 / 1e6).toFixed(1)} m²</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${cc.footprint_bottleneck ? "text-red-600" : "text-green-600"}`}>
                      {(cc.footprint_required_mm2 / 1e6).toFixed(1)} m²
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest">Required</div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ title, children, badge, defaultOpen = false }: { title: string; children: React.ReactNode; badge?: number; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-black/10 rounded-2xl overflow-hidden bg-[#FFFFFF]/70 backdrop-blur-md shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex justify-between items-center bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          {badge !== undefined && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge > 0 ? "bg-red-500/20 text-red-600 border border-red-500/30" : "bg-green-500/20 text-green-600 border border-green-500/30"}`}>
              {badge}
            </span>
          )}
        </div>
        <span className={`text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="p-6 border-t border-black/10">
          {children}
        </div>
      )}
    </div>
  );
}
