'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface GuideButtonProps {
  onClick: () => void;
  showFlyAnimation?: boolean;
  startCoords?: { x: number; y: number };
  onAnimationComplete?: () => void;
}

export default function GuideButton({
  onClick,
  showFlyAnimation = false,
  startCoords = { x: 0, y: 0 },
  onAnimationComplete,
}: GuideButtonProps) {
  const [targetCoords, setTargetCoords] = useState({ x: 0, y: 0 });
  const [readyToAnimate, setReadyToAnimate] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);

  // Hitung target coords dulu, baru set readyToAnimate = true
  useEffect(() => {
    if (!showFlyAnimation) {
      setReadyToAnimate(false);
      return;
    }

    const targetBtn = document.getElementById('guide-floating-btn');
    if (targetBtn) {
      const rect = targetBtn.getBoundingClientRect();
      setTargetCoords({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }

    // Kasih 1 frame biar setTargetCoords kebaca dulu sebelum AnimatePresence render
    const t = setTimeout(() => setReadyToAnimate(true), 30);
    return () => clearTimeout(t);
  }, [showFlyAnimation]);

  const handleFlyComplete = () => {
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 600);
    onAnimationComplete?.();
  };

  return (
    <>
      <button
        id="guide-floating-btn"
        onClick={onClick}
        aria-label="Tampilkan panduan penggunaan"
        className={`
          fixed bottom-6 right-6 z-50
          w-10 h-10
          flex items-center justify-center
          rounded-full
          border border-teal-400
          bg-teal-500
          text-white
          shadow-md
          transition-all duration-200
          hover:bg-teal-600 hover:border-teal-500 hover:shadow-lg hover:scale-110
          active:scale-95
          group
          ${isPulsing ? 'animate-bounce scale-110 ring-4 ring-teal-400/50' : ''}
        `}
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-.99 4.242.083a3 3 0 010 4.242c-.563.562-1.316.875-2.121.875M12 17h.01" />
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
        </svg>

        <span className="
          absolute right-12
          whitespace-nowrap rounded-lg
          bg-gray-800 px-2.5 py-1.5
          text-xs font-medium text-white
          opacity-0 translate-x-1
          shadow-lg pointer-events-none
          transition-all duration-200
          group-hover:opacity-100 group-hover:translate-x-0
        ">
          Panduan penggunaan
          <span className="
            absolute top-1/2 -right-1 -translate-y-1/2
            w-0 h-0
            border-t-4 border-b-4 border-l-4
            border-transparent border-l-gray-800
          " />
        </span>
      </button>

      {/* Fly Animation — render hanya setelah targetCoords siap */}
      <AnimatePresence>
        {showFlyAnimation && readyToAnimate && (
          <motion.div
            key="fly-dot"
            initial={{
              position: 'fixed',
              top: startCoords.y,
              left: startCoords.x,
              x: '-50%',
              y: '-50%',
              width: 14,
              height: 14,
              borderRadius: '50%',
              opacity: 1,
              scale: 1,
            }}
            animate={{
              top: targetCoords.y,
              left: targetCoords.x,
              opacity: [1, 1, 0],
              scale: [1, 1.4, 0.4],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: [0.25, 1, 0.5, 1] }}
            onAnimationComplete={handleFlyComplete}
            className="fixed bg-teal-500 rounded-full z-999 pointer-events-none shadow-[0_0_12px_rgba(20,184,166,0.8)]"
          />
        )}
      </AnimatePresence>
    </>
  );
}