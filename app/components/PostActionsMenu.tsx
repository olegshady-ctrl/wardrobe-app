import React, { useEffect, useRef, useState } from "react";
import { useOnClickOutside } from "@/src/lib/useOnClickOutside"; // поправь импорт под свой alias

export default function PostActionsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(menuRef, () => setOpen(false));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="menu">⋯</button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 rounded-xl border bg-white shadow-lg">
          {/* пункты меню */}
          <button role="menuitem" onClick={() => setOpen(false)}>Report</button>
        </div>
      )}
    </div>
  );
}
