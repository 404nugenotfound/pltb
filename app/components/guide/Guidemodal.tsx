"use client";

import { useEffect, useRef, useCallback } from "react";
import { GuideStep as GuideStepType, HighlightRect } from "@/app/hooks/Useguide";
import GuideStep from "./Gstep";

interface GuideModalProps {
  isOpen: boolean;
  step: GuideStepType;
  currentStep: number;
  totalSteps: number;
  highlightRect: HighlightRect | null;
  isFirstStep: boolean;
  isLastStep: boolean;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
}

const MODAL_WIDTH = 300;
const MARGIN = 16;

export default function GuideModal({
  isOpen,
  step,
  currentStep,
  totalSteps,
  highlightRect,
  isFirstStep,
  isLastStep,
  onNext,
  onBack,
  onFinish,
}: GuideModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // ── Hitung & apply posisi pakai actual modal height ──────────────────
  const updatePosition = useCallback(() => {
    const el = modalRef.current;
    if (!el) return;

    const modalH = el.offsetHeight;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top: number;
    let left: number;

    if (!highlightRect) {
      // Center jika tidak ada target
      top = viewportH / 2 - modalH / 2;
      left = viewportW / 2 - MODAL_WIDTH / 2;
    } else {
      const { top: rTop, left: rLeft, width: rW, height: rH } = highlightRect;

      // Horizontal: tengahin ke elemen
      left = Math.min(
        Math.max(rLeft + rW / 2 - MODAL_WIDTH / 2, MARGIN),
        viewportW - MODAL_WIDTH - MARGIN
      );

      const spaceBelow = viewportH - (rTop + rH);
      const spaceAbove = rTop;
      const wantsBottom = step.position === "bottom";
      const wantsTop = step.position === "top";

      if (wantsBottom || (!wantsTop && spaceBelow >= modalH + MARGIN)) {
        // Taruh di bawah
        top = rTop + rH + MARGIN;
        // Kalau mepet bawah viewport, flip ke atas
        if (top + modalH > viewportH - MARGIN && spaceAbove >= modalH + MARGIN) {
          top = rTop - modalH - MARGIN;
        }
      } else {
        // Taruh di atas
        top = rTop - modalH - MARGIN;
        // Kalau mepet atas viewport, flip ke bawah
        if (top < MARGIN && spaceBelow >= modalH + MARGIN) {
          top = rTop + rH + MARGIN;
        }
      }

      // Hard clamp biar gak keluar viewport
      top = Math.min(Math.max(top, MARGIN), viewportH - modalH - MARGIN);
    }

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.transform = "none";
  }, [highlightRect, step.position]);

  // Re-hitung posisi setiap highlightRect / step berubah
  useEffect(() => {
    if (!isOpen) return;
    // Dua kali: sekali setelah render (dapat height), sekali setelah scroll selesai
    const t1 = setTimeout(updatePosition, 50);
    const t2 = setTimeout(updatePosition, 200);
    const t3 = setTimeout(updatePosition, 500);
    window.addEventListener("resize", updatePosition);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition, currentStep]);

  // ── Keyboard navigation ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        isLastStep ? onFinish() : onNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!isFirstStep) onBack();
      } else if (e.key === "Escape") {
        onFinish();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isFirstStep, isLastStep, onNext, onBack, onFinish]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      id="guide-modal"
      className="fixed z-[70] bg-white rounded-2xl shadow-2xl overflow-hidden"
      style={{ width: MODAL_WIDTH, minWidth: MODAL_WIDTH }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-teal-500">
        <span className="text-white font-bold text-xs tracking-widest uppercase">
          Panduan Penggunaan
        </span>
        <button
          onClick={onFinish}
          className="text-white/80 hover:text-white transition-colors"
          aria-label="Tutup panduan"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <GuideStep step={step} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 pb-4">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === currentStep ? "w-5 h-2 bg-teal-500" : "w-2 h-2 bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              onClick={onBack}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors px-1"
            >
              ← Kembali
            </button>
          )}
          <button
            id="finish-guide-btn"
            onClick={isLastStep ? onFinish : onNext}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {isLastStep ? "Selesai ✓" : "Lanjut →"}
          </button>
        </div>
      </div>
    </div>
  );
}