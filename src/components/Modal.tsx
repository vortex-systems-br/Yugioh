"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Diálogo modal nativo: foco preso, Esc fecha e devolve o foco ao elemento anterior. */
export function Modal({ open, title, onClose, children, size = "md" }: { open: boolean; title: string; onClose: () => void; children: ReactNode; size?: "md" | "lg" }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" style={{ maxWidth: size === "lg" ? 720 : 480 }} aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-xl">{title}</h2>
            <button type="button" className="icon-btn -mr-2 -mt-2" aria-label="Fechar" onClick={() => ref.current?.close()}><Icon name="close" /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
