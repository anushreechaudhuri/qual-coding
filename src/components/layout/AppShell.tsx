"use client";

import { useUiStore } from "@/lib/stores/uiStore";

/**
 * Three-panel layout matching the mockup: document list (left),
 * document viewer (center), codebook + summary (right).
 *
 * Side panels are collapsible via toggle buttons at the panel edges.
 * The center panel takes all remaining space.
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
  const toggleLeft = useUiStore((s) => s.toggleLeftPanel);
  const toggleRight = useUiStore((s) => s.toggleRightPanel);

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

        {/* Left toggle */}
        <button
          onClick={toggleLeft}
          className="flex h-full w-4 shrink-0 items-center justify-center text-stone-300 hover:text-stone-500 hover:bg-stone-50"
          title={leftVisible ? "Hide sidebar" : "Show sidebar"}
        >
          <span className="text-[10px]">{leftVisible ? "◂" : "▸"}</span>
        </button>

        {/* Center panel: document viewer */}
        <main className="flex-1 overflow-y-auto bg-white">{center}</main>

        {/* Right toggle */}
        <button
          onClick={toggleRight}
          className="flex h-full w-4 shrink-0 items-center justify-center text-stone-300 hover:text-stone-500 hover:bg-stone-50"
          title={rightVisible ? "Hide codebook" : "Show codebook"}
        >
          <span className="text-[10px]">{rightVisible ? "▸" : "◂"}</span>
        </button>

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
