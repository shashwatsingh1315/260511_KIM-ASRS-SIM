"use client";
import { useAppStore } from "@/store/useAppStore";

export function UndoBar() {
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const undoPast = useAppStore((s) => s.undoPast);
  const undoFuture = useAppStore((s) => s.undoFuture);

  return (
    <div className="fixed bottom-0 left-64 right-0 h-14 bg-[#1c1c1e]/60 backdrop-blur-2xl border-t border-white/[0.08] flex items-center px-8 gap-6 z-50">
      <button
        onClick={() => undo()}
        disabled={undoPast.length === 0}
        className="text-sm text-gray-400 hover:text-white disabled:opacity-30 flex items-center gap-1"
      >
        ↩ Undo ({undoPast.length})
      </button>
      <button
        onClick={() => redo()}
        disabled={undoFuture.length === 0}
        className="text-sm text-gray-400 hover:text-white disabled:opacity-30 flex items-center gap-1"
      >
        ↪ Redo ({undoFuture.length})
      </button>
    </div>
  );
}
