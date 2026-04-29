"use client";

import { useUiStore } from "@/lib/stores/uiStore";

/**
 * Three-panel layout matching the mockup: document list (left),
 * document viewer (center), codebook + summary (right).
 *
 * Uses CSS Grid with collapsible side panels. The center panel
 * takes all remaining space.
 */
export function AppShell({
  left,
  center,
  right,
  header,
}: {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  header: React.ReactNode;
}) {
  const leftVisible = useUiStore((s) => s.leftPanelVisible);
  const rightVisible = useUiStore((s) => s.rightPanelVisible);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex h-11 shrink-0 items-center border-b border-stone-200 px-4">
        {header}
      </header>

      {/* Three-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: document list */}
        {leftVisible && (
          <aside className="w-56 shrink-0 overflow-y-auto border-r border-stone-200 bg-white">
            {left}
          </aside>
        )}

        {/* Center panel: document viewer */}
        <main className="flex-1 overflow-y-auto bg-white">{center}</main>

        {/* Right panel: codebook + summary */}
        {rightVisible && (
          <aside className="w-64 shrink-0 overflow-y-auto border-l border-stone-200 bg-white">
            {right}
          </aside>
        )}
      </div>
    </div>
  );
}
