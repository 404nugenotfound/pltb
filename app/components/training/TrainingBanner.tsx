"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { useTraining } from "@/app/context/TrainingContext";

export default function TrainingBanner() {
  const { training, cancelTraining } = useTraining();

  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Reset saat training mulai
  useEffect(() => {
    if (training.isTraining) {
      setMinimized(false);
      setPos({ x: 0, y: 0 });
    }
  }, [training.isTraining]);

  const posRef = useRef({ x: 0, y: 0 }); // ← tambah

  // Sync posRef setiap pos berubah
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // Reset posRef saat training mulai
  useEffect(() => {
    if (training.isTraining) {
      setMinimized(false);
      setPos({ x: 0, y: 0 });
      posRef.current = { x: 0, y: 0 }; // ← tambah
    }
  }, [training.isTraining]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragging.current = true;
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      px: posRef.current.x, // ← pakai posRef
      py: posRef.current.y, // ← pakai posRef
    };
    e.preventDefault();
  }, []); // ← deps kosong karena posRef tidak perlu di-track

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newPos = {
        x: dragStart.current.px + (e.clientX - dragStart.current.mx),
        y: dragStart.current.py + (e.clientY - dragStart.current.my),
      };
      posRef.current = newPos; // ← tambah
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

  if (!training.isTraining) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    bottom: 24 - pos.y,
    right: 24 - pos.x,
    zIndex: 50,
    cursor: dragging.current ? "grabbing" : "grab",
    userSelect: "none",
  };

  if (minimized) {
    return (
      <div
        style={style}
        onMouseDown={onMouseDown}
        onClick={() => setMinimized(false)}
        className="w-12 h-12 bg-indigo-600 rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 transition-colors"
        title={`${training.progress}% — ${training.step}`}
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
            strokeDasharray={`${(training.progress / 100) * 94.2} 94.2`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-white text-[9px] font-bold">
          {training.progress}%
        </span>
      </div>
    );
  }

  return (
    <div
      style={style}
      onMouseDown={onMouseDown}
      className="w-80 bg-gray-900 text-white rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* HEADER */}
      <div className="flex items-center gap-3 px-4 py-3 bg-indigo-600">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span className="text-sm font-semibold">Training Model</span>
        <span className="ml-auto text-xs bg-indigo-500 px-2 py-0.5 rounded-full truncate max-w-28">
          {training.step}
        </span>
        <button
          onClick={() => setMinimized(true)}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-indigo-500 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
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

      {/* PROGRESS BAR */}
      <div className="h-1 bg-gray-700">
        <div
          className="h-1 bg-indigo-400 transition-all duration-500"
          style={{ width: `${training.progress}%` }}
        />
      </div>

      {/* LOGS */}
      <div className="px-4 py-3">
        <p className="text-xs text-gray-400 mb-2">Log Training</p>
        <div className="bg-gray-800 rounded-lg p-2 h-28 overflow-y-auto text-xs font-mono space-y-1">
          {training.logs.length === 0 ? (
            <p className="text-gray-500">Menunggu log...</p>
          ) : (
            training.logs.map((log, idx) => <p key={idx}>{log}</p>)
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-4 py-2 bg-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{training.footer}</span>
          <button
            onClick={cancelTraining}
            className="text-xs px-2 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
