"use client";

import { useRouter } from "next/navigation";

interface SnapshotFullModalProps {
  visible: boolean;
  snapshotCount: number;
  snapshotLimit: number;
  tier: string;
  pendingFilename: string;
  onContinueWithoutSnapshot: () => void;
  onDismiss: () => void;
}

export default function SnapshotFullModal({
  visible,
  snapshotCount,
  snapshotLimit,
  tier,
  pendingFilename,
  onContinueWithoutSnapshot,
  onDismiss,
}: SnapshotFullModalProps) {
  const router = useRouter();

  if (!visible) return null;

  const handleKelolaSnapshot = () => {
    onDismiss();
    router.push("/settings?tab=snapshots");
  };

  const handleLanjutTanpaSnapshot = () => {
    onContinueWithoutSnapshot();
  };

  return (
    /* Backdrop blur overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onDismiss}
    >
      {/* Modal card — stop propagation biar klik dalam modal ga nutup */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar teal */}
        <div className="h-1 w-full bg-teal-500" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <div className="shrink-0 w-10 h-10 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
              {/* Storage icon */}
              <svg
                className="w-5 h-5 text-teal-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"
                />
                <circle cx="12" cy="13" r="1" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">
                Slot Snapshot Penuh
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                File <span className="font-medium text-gray-700">{pendingFilename}</span> siap di-train
              </p>
            </div>
          </div>

          {/* Slot usage bar */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Penggunaan Snapshot
              </span>
              <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                Tier {tier}
              </span>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold text-gray-900">{snapshotCount}</span>
              <span className="text-sm text-gray-400 mb-0.5">/ {snapshotLimit} slot</span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all"
                style={{ width: `${Math.min((snapshotCount / snapshotLimit) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Semua slot terpakai. Hapus snapshot lama untuk menyimpan yang baru.
            </p>
          </div>

          {/* Pilihan aksi */}
          <div className="space-y-3 mb-5">
            {/* Opsi 1 — Kelola Snapshot */}
            <button
              onClick={handleKelolaSnapshot}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors group text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-teal-800">Kelola Snapshot</p>
                <p className="text-xs text-teal-600 mt-0.5">
                  Hapus snapshot lama, lalu training akan disimpan sebagai snapshot baru
                </p>
              </div>
              <svg className="w-4 h-4 text-teal-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Opsi 2 — Lanjut Tanpa Snapshot */}
            <button
              onClick={handleLanjutTanpaSnapshot}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors group text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-700">Lanjut Tanpa Snapshot</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Training tetap jalan, tapi model ini tidak bisa di-restore nanti
                </p>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Footer — batalkan */}
          <button
            onClick={onDismiss}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Batalkan upload
          </button>
        </div>
      </div>
    </div>
  );
}