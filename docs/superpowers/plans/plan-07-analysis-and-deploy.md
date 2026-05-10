# ASRS-Choker — Plan Part 7: Analysis Dashboard + Reports + Deploy

> **Prerequisite:** Plans 01–06 complete.
> **Goal:** Build the Analysis Dashboard (runs the engine, shows results), the Markdown report export, and deploy to Vercel.

---

## Task 17: Analysis Dashboard (`/analysis`)

**Step 17.1** — Replace `src/app/analysis/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { runAnalysis } from "@/lib/engine";
import type { AnalysisResult } from "@/types";

export default function AnalysisPage() {
  const store = useAppStore();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [running, setRunning] = useState(false);

  function handleRun() {
    setRunning(true);
    setTimeout(() => {
      const r = runAnalysis({
        cells: store.cells,
        materials: store.materials,
        processes: store.processes,
        routes: store.routes,
        stations: store.stations,
        edges: store.edges,
        familyStatuses: store.familyStatuses,
        engineConfig: store.engineConfig,
      });
      setResult(r);
      store.setAnalysisResult(r);
      setRunning(false);
    }, 50); // small delay to let UI re-render "running" state
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">📊 Analysis</h1>
          <p className="text-gray-500 text-sm mt-1">
            Runs demand propagation, Little's Law WIP, station capacity checks, and cell footprint checks.
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          {running ? "Running…" : "▶ Run Analysis"}
        </button>
      </div>

      {result && (
        <>
          {/* Validation errors */}
          {!result.is_valid && (
            <Section title="❌ Validation Errors (analysis blocked)">
              <ul className="space-y-1">
                {result.validation_errors.map((e, i) => (
                  <li key={i} className="text-sm text-red-400">• {e}</li>
                ))}
              </ul>
            </Section>
          )}

          {result.is_valid && (
            <>
              {/* Alerts */}
              {result.alerts.length > 0 && (
                <Section title={`🚨 Alerts (${result.alerts.length})`}>
                  <div className="space-y-2">
                    {result.alerts.map((a, i) => (
                      <div
                        key={i}
                        className={`text-sm px-4 py-2 rounded-lg border ${
                          a.severity === "error"
                            ? "bg-red-950/40 border-red-800 text-red-300"
                            : "bg-yellow-950/40 border-yellow-800 text-yellow-300"
                        }`}
                      >
                        [{a.category.toUpperCase()}] {a.message}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Station checks */}
              <Section title="Station Capacity">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="text-left px-3 py-2">Station</th>
                      <th className="text-right px-3 py-2">Required pph</th>
                      <th className="text-right px-3 py-2">Capacity pph</th>
                      <th className="text-right px-3 py-2">Gap pph</th>
                      <th className="text-right px-3 py-2">WIP needed</th>
                      <th className="text-right px-3 py-2">Holding cap</th>
                      <th className="text-right px-3 py-2">Holding gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.station_checks.map((sc) => (
                      <tr key={sc.station_id} className={`border-b border-gray-800 ${sc.throughput_bottleneck || sc.holding_bottleneck ? "bg-red-950/20" : ""}`}>
                        <td className="px-3 py-2 text-gray-300">{sc.station_name}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{sc.throughput_required_pph.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{sc.throughput_capacity_pph}</td>
                        <td className={`px-3 py-2 text-right font-medium ${sc.throughput_gap_pph < 0 ? "text-red-400" : "text-green-400"}`}>
                          {sc.throughput_gap_pph.toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-300">{sc.holding_required_pallets.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{sc.holding_capacity_pallets}</td>
                        <td className={`px-3 py-2 text-right font-medium ${sc.holding_gap_pallets < 0 ? "text-red-400" : "text-green-400"}`}>
                          {sc.holding_gap_pallets.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {/* Cell footprint checks */}
              <Section title="Cell Footprint">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="text-left px-3 py-2">Cell</th>
                      <th className="text-right px-3 py-2">Required m²</th>
                      <th className="text-right px-3 py-2">Available m²</th>
                      <th className="text-right px-3 py-2">Gap m²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cell_checks.map((cc) => (
                      <tr key={cc.cell_id} className={`border-b border-gray-800 ${cc.footprint_bottleneck ? "bg-red-950/20" : ""}`}>
                        <td className="px-3 py-2 text-gray-300">{cc.cell_name}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{(cc.footprint_required_mm2 / 1e6).toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{(cc.footprint_available_mm2 / 1e6).toFixed(1)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${cc.footprint_gap_mm2 < 0 ? "text-red-400" : "text-green-400"}`}>
                          {(cc.footprint_gap_mm2 / 1e6).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {/* Pallet pool */}
              <Section title="Pallet Pool">
                <p className="text-gray-300 text-sm">
                  Total pallets needed across all stations: <strong className="text-white">{result.total_pallets_needed.toFixed(0)}</strong>
                </p>
                {result.pallet_pool_gap !== null && (
                  <p className={`text-sm mt-1 ${result.pallet_pool_gap < 0 ? "text-red-400" : "text-green-400"}`}>
                    Gap vs declared pool: {result.pallet_pool_gap.toFixed(0)} pallets
                    {result.pallet_pool_gap < 0 ? " ← SHORTAGE" : " ← OK"}
                  </p>
                )}
              </Section>

              {/* WIP table */}
              <Section title="WIP by Material and Process">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="text-left px-3 py-2">Material ID</th>
                      <th className="text-left px-3 py-2">Process ID</th>
                      <th className="text-right px-3 py-2">WIP (pallets)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.step_wips.map((w, i) => (
                      <tr key={i} className="border-b border-gray-800">
                        <td className="px-3 py-2 text-gray-400">{w.material_id}</td>
                        <td className="px-3 py-2 text-gray-400">{w.process_id}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{w.wip_pallets.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {/* Download report button */}
              <div className="flex justify-end">
                <DownloadReportButton result={result} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-300 border-b border-gray-800 pb-2">{title}</h2>
      {children}
    </div>
  );
}

function DownloadReportButton({ result }: { result: AnalysisResult }) {
  const store = useAppStore();

  function handleDownload() {
    const md = generateReport(store, result);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asrs-report-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleDownload}
      className="text-sm text-gray-400 hover:text-gray-200 border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
    >
      ⬇ Download Markdown Report
    </button>
  );
}

function generateReport(store: ReturnType<typeof useAppStore.getState>, result: AnalysisResult): string {
  const date = new Date().toISOString().split("T")[0];
  const lines: string[] = [
    `# ASRS-Choker — Factory Planning Report`,
    `**Generated:** ${date}`,
    ``,
    `## Cells (${store.cells.length})`,
    `| Name | Building | Floor | Block | L×W (m) | H (m) |`,
    `|------|----------|-------|-------|---------|-------|`,
    ...store.cells.map((c) =>
      `| ${c.name} | ${c.building} | ${c.floor} | ${c.block} | ${(c.length_mm/1000).toFixed(1)}×${(c.width_mm/1000).toFixed(1)} | ${(c.height_mm/1000).toFixed(1)} |`
    ),
    ``,
    `## Materials (${store.materials.length})`,
    `| Code | Name | Family | Subfamily | UOM | Weight (kg) |`,
    `|------|------|--------|-----------|-----|-------------|`,
    ...store.materials.map((m) =>
      `| ${m.code} | ${m.name} | ${m.family} | ${m.subfamily} | ${m.uom} | ${m.unit_weight_kg} |`
    ),
    ``,
    `## Stations (${store.stations.length})`,
    `| Name | Cell | Process | Peak pph | Holding cap |`,
    `|------|------|---------|----------|-------------|`,
    ...store.stations.map((s) =>
      `| ${s.name} | ${s.cell_id} | ${s.process_id} | ${s.peak_throughput_pph} | ${s.holding_capacity_pallets} |`
    ),
    ``,
    `## Analysis Results`,
    ``,
    `### Station Capacity`,
    `| Station | Required pph | Capacity pph | Gap pph | WIP needed | Holding cap | Holding gap |`,
    `|---------|-------------|-------------|---------|-----------|------------|------------|`,
    ...result.station_checks.map((sc) =>
      `| ${sc.station_name} | ${sc.throughput_required_pph.toFixed(1)} | ${sc.throughput_capacity_pph} | ${sc.throughput_gap_pph.toFixed(1)} | ${sc.holding_required_pallets.toFixed(0)} | ${sc.holding_capacity_pallets} | ${sc.holding_gap_pallets.toFixed(0)} |`
    ),
    ``,
    `### Cell Footprint`,
    `| Cell | Required m² | Available m² | Gap m² |`,
    `|------|------------|-------------|--------|`,
    ...result.cell_checks.map((cc) =>
      `| ${cc.cell_name} | ${(cc.footprint_required_mm2/1e6).toFixed(1)} | ${(cc.footprint_available_mm2/1e6).toFixed(1)} | ${(cc.footprint_gap_mm2/1e6).toFixed(1)} |`
    ),
    ``,
    `### Pallet Pool`,
    `Total pallets needed: **${result.total_pallets_needed.toFixed(0)}**`,
    result.pallet_pool_gap !== null ? `Gap vs declared: **${result.pallet_pool_gap.toFixed(0)}**` : `*(no pool size declared — enter in Engine Config)*`,
    ``,
    `### Alerts (${result.alerts.length})`,
    ...result.alerts.map((a) => `- **[${a.severity.toUpperCase()} / ${a.category}]** ${a.message}`),
    ``,
    `---`,
    `*Generated by ASRS-Choker — Factory Planning Tool*`,
  ];
  return lines.join("\n");
}
```

**Step 17.2** — Commit:
```powershell
git add .
git commit -m "feat: analysis dashboard with bottleneck tables and MD report download"
```

---

## Task 18: Deploy to Vercel

### Step 18.1 — Create a Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `asrs-choker` → Continue (disable Analytics if you want) → Create project
3. Click **Firestore Database** in the left sidebar → **Create database** → **Start in test mode** → Choose a region → Done
4. Click the gear icon ⚙ → **Project settings** → **General** tab → scroll down to **Your apps** → click the **`</>`** (Web) icon
5. Register app name `asrs-choker-web` → click **Register app**
6. Copy the `firebaseConfig` object shown. You need: `apiKey`, `authDomain`, `projectId`

### Step 18.2 — Fill `.env.local`
Open `.env.local` and replace the placeholders:
```
NEXT_PUBLIC_FB_API_KEY=AIzaSy...your-actual-key...
NEXT_PUBLIC_FB_AUTH_DOMAIN=asrs-choker.firebaseapp.com
NEXT_PUBLIC_FB_PROJECT_ID=asrs-choker
```

### Step 18.3 — Push to GitHub
```powershell
git remote add origin https://github.com/YOUR_USERNAME/asrs-choker.git
git push -u origin main
```

### Step 18.4 — Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub → **Add New Project**
2. Import your `asrs-choker` repository
3. In **Environment Variables**, add the three `NEXT_PUBLIC_FB_*` variables with the same values as your `.env.local`
4. Click **Deploy** → wait ~2 minutes
5. Click the URL Vercel gives you — the app should load

### Step 18.5 — Smoke Test
Do this after the app loads on Vercel:
1. Go to `/cells` → Add one cell named `WH-F0-A`, Building=Warehouse, Floor=0, Block=A, 12000mm × 10000mm × 5000mm
2. Go to `/materials` → Add one material: code=RM-PCB-001, name=Raw PCB, family=RM, subfamily=Electronic, uom=piece, weight=0.05, volume=30000
3. Go to `/processes` → Add one process: name=receive-RM, type=hold, input_status=incoming, output_status=incoming, residence=1, yield=1.0
4. Go to `/routes` → Select Raw PCB → Add step: receive-RM → Save Route
5. Go to `/stations` → Add station: name=ST-recv-RM, cell=WH-F0-A, process=receive-RM, peak=20, holding=30, hours=16, footprint 5000×4000
6. Go to `/analysis` → Click **Run Analysis** → You should see a station check table with no bottlenecks

```powershell
git commit -m "chore: production deployment to Vercel"
```

---

## Checklist

- [ ] `/analysis` page shows Run Analysis button
- [ ] After clicking Run Analysis: shows validation errors OR results tables
- [ ] Station capacity table shows red rows for bottlenecks
- [ ] Cell footprint table shows red rows for layout infeasibilities
- [ ] Pallet pool total is shown
- [ ] Download button creates a `.md` file
- [ ] Firebase project created, Firestore in test mode
- [ ] `.env.local` filled with real Firebase config
- [ ] Pushed to GitHub
- [ ] Deployed to Vercel with env vars set
- [ ] Smoke test passes (add cell → material → process → route → station → run analysis → no crash)
- [ ] `git commit -m "chore: production deployment to Vercel"` done

---

## You're Done! Summary of All Files Created

| File | Purpose |
|------|---------|
| `src/types/index.ts` | All TypeScript interfaces |
| `src/lib/firestore.ts` | Firebase client init |
| `src/lib/collections.ts` | Typed Firestore CRUD helpers |
| `src/lib/validation.ts` | 15 validation rules |
| `src/lib/engine.ts` | Demand propagation, WIP, capacity checks |
| `src/store/useAppStore.ts` | Zustand store + undo/redo |
| `src/app/layout.tsx` | Root layout with sidebar |
| `src/components/Sidebar.tsx` | 8-item dark sidebar |
| `src/components/AppLoader.tsx` | Loads Firestore data on startup |
| `src/components/UndoBar.tsx` | Undo/redo bottom bar |
| `src/components/DataTable.tsx` | Reusable inline-editable table |
| `src/components/CsvImport.tsx` | CSV upload/preview/confirm |
| `src/app/cells/page.tsx` | Cells data entry |
| `src/app/packaging/page.tsx` | Packaging master data entry |
| `src/app/materials/page.tsx` | Materials data entry |
| `src/app/processes/page.tsx` | Processes data entry |
| `src/app/routes/page.tsx` | Route builder (step-by-step) |
| `src/app/stations/page.tsx` | Stations data entry |
| `src/app/edges/page.tsx` | Edges data entry |
| `src/app/analysis/page.tsx` | Run analysis + view results + download report |
