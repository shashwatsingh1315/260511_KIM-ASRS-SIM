"use client";
import { useAppStore } from "@/store/useAppStore";

export function UndoBar() {
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const undoPast = useAppStore((s) => s.undoPast);
  const undoFuture = useAppStore((s) => s.undoFuture);

  return (
    <div className="fixed bottom-0 left-64 right-0 h-12 bg-gray-900 border-t border-gray-800 flex items-center px-6 gap-4 z-50">
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
