"use client";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { Route, RouteStep } from "@/types";

export default function RoutesPage() {
  const materials = useAppStore((s) => s.materials);
  const processes = useAppStore((s) => s.processes);
  const routes = useAppStore((s) => s.routes);
  const upsertRoute = useAppStore((s) => s.upsertRoute);

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");

  const selectedRoute = routes.find((r) => r.material_id === selectedMaterialId);
  const [steps, setSteps] = useState<RouteStep[]>(selectedRoute?.steps ?? []);

  function handleMaterialChange(matId: string) {
    setSelectedMaterialId(matId);
    const r = routes.find((r) => r.material_id === matId);
    setSteps(r?.steps ?? []);
  }

  function addStep() {
    setSteps([...steps, { process_id: "", residence_time_hr_override: null }]);
  }

  function removeStep(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i));
  }

  function updateStep(i: number, key: keyof RouteStep, value: unknown) {
    const next = [...steps];
    (next[i] as any)[key] = value;
    setSteps(next);
  }

  function moveStep(i: number, dir: -1 | 1) {
    const next = [...steps];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  }

  async function handleSave() {
    if (!selectedMaterialId) return;
    await upsertRoute({
      id: selectedRoute?.id,
      material_id: selectedMaterialId,
      steps,
    } as Route);
    alert("Route saved!");
  }

  const processMap = new Map(processes.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🗺 Routes</h1>
        <p className="text-gray-400 text-sm mt-1">
          The ordered list of processes each material goes through — from receipt to dispatch.
          Select a material, build its route step by step, then save.
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Select Material</label>
        <select
          value={selectedMaterialId}
          onChange={(e) => handleMaterialChange(e.target.value)}
          className="bg-gray-50 border border-gray-300 rounded px-3 py-2 text-gray-800 text-sm w-72"
        >
          <option value="">— choose a material —</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name} ({m.family})</option>
          ))}
        </select>
      </div>

      {selectedMaterialId && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">Route Steps (in order)</h2>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
              <span className="text-gray-400 text-sm w-6">{i + 1}.</span>
              <select
                value={step.process_id}
                onChange={(e) => updateStep(i, "process_id", e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-800 text-sm flex-1"
              >
                <option value="">— select process —</option>
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Residence override (hr):</label>
                <input
                  type="number"
                  value={step.residence_time_hr_override ?? ""}
                  placeholder="use default"
                  onChange={(e) => updateStep(i, "residence_time_hr_override", e.target.value ? Number(e.target.value) : null)}
                  className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-800 text-sm w-28"
                />
              </div>
              <button onClick={() => moveStep(i, -1)} className="text-gray-400 hover:text-gray-700 text-sm">↑</button>
              <button onClick={() => moveStep(i, 1)} className="text-gray-400 hover:text-gray-700 text-sm">↓</button>
              <button onClick={() => removeStep(i)} className="text-red-600 hover:text-red-500 text-sm">✕</button>
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={addStep} className="text-sm text-indigo-600 hover:text-indigo-300 border border-indigo-800 px-3 py-1.5 rounded-lg">
              + Add Step
            </button>
            <button onClick={handleSave} className="text-sm text-green-600 hover:text-green-500 border border-green-800 px-3 py-1.5 rounded-lg">
              Save Route
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
