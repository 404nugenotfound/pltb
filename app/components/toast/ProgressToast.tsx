"use client";
import { useRef, useState, useEffect, useCallback } from "react";

interface ProgressToastProps {
  visible: boolean;
  percent: number;
  status: string;
  eta: string;
  elapsed: string;
  onCancel?: () => void;
}

export default function ProgressToast({
  visible,
  percent,
  status,
  eta,
  elapsed,
  onCancel,
}: ProgressToastProps) {
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const toastRef = useRef<HTMLDivElement>(null);

  // Reset posisi & minimize state saat toast muncul lagi
  useEffect(() => {
    if (visible) {
      setMinimized(false);
      setPos({ x: 0, y: 0 });
      posRef.current = { x: 0, y: 0 }; // ← tambah ini
    }
  }, [visible]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragging.current = true;
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      px: posRef.current.x,
      py: posRef.current.y,
    };
    e.preventDefault();
  }, [minimized]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      const newPos = {
        x: dragStart.current.px + dx,
        y: dragStart.current.py + dy,
      };
      posRef.current = newPos;
      setPos(newPos);
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  if (!visible) return null;

  // Default anchor: bottom-right (20px dari tepi)
  // pos adalah offset dari anchor
  const style: React.CSSProperties = {
    position: "fixed",
    bottom: 20 - pos.y,
    right: 20 - pos.x,
    zIndex: 50,
    cursor: dragging.current ? "grabbing" : "grab",
    userSelect: "none",
  };

  if (minimized) {
    return (
      <div
        ref={toastRef}
        style={style}
        onMouseDown={onMouseDown}
        className="w-12 h-12 bg-teal-600 rounded-full shadow-2xl flex items-center justify-center hover:bg-teal-700 transition-colors"
        title={`${percent}% — ${status}`}
        onClick={(e) => { e.stopPropagation(); setMinimized(false); }}
      >
        {/* Circular progress */}
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeDasharray={`${(percent / 100) * 94.2} 94.2`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-white text-[9px] font-bold">
          {percent}%
        </span>
      </div>
    );
  }

  return (
    <div
      ref={toastRef}
      style={style}
      onMouseDown={onMouseDown}
      className="w-80 bg-white border border-teal-200 shadow-2xl rounded-2xl p-4 transition-all duration-300"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-teal-700">
            Generating Forecast
          </h3>
          <p className="text-xs text-gray-500">AI Forecast Progress</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-teal-600">
            {percent}%
          </span>
          <button
            onClick={() => setMinimized(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
            title="Minimize"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 12H4"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* BAR */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-teal-500 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* STATUS */}
      <p className="text-sm text-gray-700 font-medium">{status}</p>

      {/* ETA */}
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-gray-500">
          ETA {eta} • Elapsed {elapsed}
        </p>
        <button
          onClick={onCancel}
          className="text-xs px-2 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
