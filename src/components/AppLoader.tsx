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
