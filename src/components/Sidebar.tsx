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
