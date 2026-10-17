"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastData { id: number; text: string; tone: "ok" | "error" }

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<number | null>(null);
  const show = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return { toast, show };
}

export function Toast({ toast }: { toast: ToastData | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6" role="status" aria-live="polite">
      {toast && (
        <p key={toast.id} className={`pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm shadow-2xl ${toast.tone === "error" ? "border-danger/60 bg-[#2a1118] text-[#ffd3d9]" : "border-edge bg-surface-2"}`}>{toast.text}</p>
      )}
    </div>
  );
}
