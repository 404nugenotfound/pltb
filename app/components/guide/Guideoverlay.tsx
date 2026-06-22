"use client";

import { HighlightRect } from "@/app/hooks/Useguide";

interface GuideOverlayProps {
  highlightRect: HighlightRect | null;
  onSkip: () => void;
}

export default function GuideOverlay({ highlightRect, onSkip }: GuideOverlayProps) {
  if (!highlightRect) {
    return (
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onSkip}
      />
    );
  }

  const { top, left, width, height } = highlightRect;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        xmlns="http://www.w3.org/2000/svg"
        onClick={onSkip}
      >
        <defs>
          <mask id="guide-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={left} y={top} width={width} height={height} rx="12" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#guide-mask)" />
      </svg>

      <div
        className="absolute rounded-xl border-2 border-teal-400 pointer-events-none transition-all duration-300"
        style={{
          top,
          left,
          width,
          height,
          boxShadow: "0 0 0 3px rgba(20, 184, 166, 0.25)",
        }}
      />
    </div>
  );
}