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
      <body className={`${inter.className} bg-[#000000] text-[#f5f5f7] min-h-screen antialiased selection:bg-indigo-500/30`}>
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
