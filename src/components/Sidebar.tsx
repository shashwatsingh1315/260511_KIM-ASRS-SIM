"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

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
  const dbConnected = useAppStore((s) => s.dbConnected);
  const checkConnection = useAppStore((s) => s.checkConnection);

  // Poll connection status every 30 seconds
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  // Offline Backup Functionality
  function handleBackup() {
    const keys = ["cells", "packagingMasters", "materials", "familyStatuses", "processes", "routes", "stations", "edges", "engineConfig"];
    const backupData: Record<string, any> = {};
    keys.forEach(k => {
      const data = localStorage.getItem(`asrs_${k}`);
      if (data) backupData[k] = JSON.parse(data);
    });
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asrs-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#1c1c1e]/60 backdrop-blur-2xl border-r border-white/[0.08] flex flex-col z-50">
      <div className="px-6 py-6 border-b border-white/[0.08]">
        <h1 className="text-lg font-semibold text-white tracking-tight">ASRS-Choker</h1>
        <p className="text-xs text-gray-400 mt-1 font-medium">Factory Planning Tool</p>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-white/10 text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              <span className="text-base opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      {/* Connection Indicator & Backup */}
      <div className="p-4 border-t border-white/[0.08] space-y-3">
        <div className="flex items-center gap-2 px-2">
          <div className={`w-2 h-2 rounded-full ${dbConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"}`} />
          <span className="text-xs font-medium text-gray-300">
            {dbConnected ? "Cloud Connected" : "Offline Mode"}
          </span>
        </div>
        <button
          onClick={handleBackup}
          className="w-full text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <span>💾</span> Download Backup
        </button>
      </div>
    </aside>
  );
}
