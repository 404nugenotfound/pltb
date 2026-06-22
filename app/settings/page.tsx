"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import { useStorage } from "@/app/context/StorageContext";

import { useGuide, SETTINGS_STEPS } from "@/app/hooks/Useguide";
import { GuideModal, GuideOverlay, GuideButton } from "@/app/components/guide";

const DEFAULT_AVATAR = "/icon/default-avatar-profile.jpg";

const SETTINGS_STORAGE_KEY = "ventara_guide_settings_done";

interface Snapshot {
  id: string;
  dataset: string;
  trained_at: string;
  hash?: string;
  metrics?: Record<string, unknown>;
}

export default function SettingsPage() {
  const router = useRouter();
  const { storageInfo } = useStorage();
  console.log("storageInfo.tier =", storageInfo.tier);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);

  const [clearingCache, setClearingCache] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [cacheEnabled, setCacheEnabled] = useState(true);

  // ── SNAPSHOT STATE ──
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotLimit, setSnapshotLimit] = useState(0);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotError, setSnapshotError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  const {
    isOpen: guideOpen,
    currentStep,
    totalSteps,
    step,
    highlightRect,
    isFirstStep,
    isLastStep,
    next,
    back,
    finish,
    openGuide,
    showFlyAnimation,
    startCoords,
    resetFlyAnimation,
  } = useGuide({
    steps: SETTINGS_STEPS,
    storageKey: SETTINGS_STORAGE_KEY,
  });

  useEffect(() => {
    setName(sessionStorage.getItem("ventara_name") || "");
    setEmail(sessionStorage.getItem("ventara_email") || "");
    setAvatar(sessionStorage.getItem("ventara_avatar") || DEFAULT_AVATAR);
  }, []);

  useEffect(() => {
    async function loadCacheSettings() {
      try {
        const username = sessionStorage.getItem("ventara_username") || "";
        const res = await fetch(`/api/cache-settings?username=${username}`);
        const data = await res.json();
        setCacheEnabled(data.model_cache || data.metrics_cache);
      } catch (err) {
        console.error("Failed load cache settings", err);
      }
    }
    loadCacheSettings();
  }, []);

  // ── LOAD SNAPSHOTS ──
  useEffect(() => {
    loadSnapshots();
  }, []);

  async function loadSnapshots() {
    setSnapshotLoading(true);
    setSnapshotError("");
    try {
      const username = sessionStorage.getItem("ventara_username") || "";
      const res = await fetch(`/api/snapshots?username=${username}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Gagal memuat snapshot");
      const data = await res.json();
      setSnapshots(data.snapshots ?? []);
      setSnapshotLimit(data.limit ?? 0);
    } catch {
      setSnapshotError("Tidak dapat memuat daftar snapshot.");
    } finally {
      setSnapshotLoading(false);
    }
  }

  async function handleDeleteSnapshot(id: string) {
    setDeletingId(id);
    try {
      const username = sessionStorage.getItem("ventara_username") || "";
      const res = await fetch(`/api/snapshots/${id}?username=${username}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setSnapshotError("Gagal menghapus snapshot. Coba lagi.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRestoreSnapshot(id: string, dataset: string) {
    setRestoringId(id);
    setRestoreSuccess(null);
    try {
      const username = sessionStorage.getItem("ventara_username") || "";
      const res = await fetch(
        `/api/snapshots/${id}/restore?username=${username}`,
        {
          method: "POST",
        },
      );
      if (!res.ok) throw new Error();
      setRestoreSuccess(dataset);
      setTimeout(() => {
        router.push("/forecasting");
        router.refresh();
      }, 1500);
    } catch {
      setSnapshotError("Gagal restore snapshot. Coba lagi.");
    } finally {
      setRestoringId(null);
    }
  }

  async function handleClearCache() {
    setClearingCache(true);
    await new Promise((r) => setTimeout(r, 1200));
    setClearingCache(false);
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  }

  // Hitung persen + status penuh untuk slot usage bar snapshot
  const snapshotPercent =
    snapshotLimit > 0
      ? Math.min((snapshots.length / snapshotLimit) * 100, 100)
      : 0;
  const snapshotIsFull = snapshots.length >= snapshotLimit && snapshotLimit > 0;

  return (
    <div className="flex h-screen">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <Header />

        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 cursor-default">
              Settings
            </h2>

            {/* ── EDIT PROFILE ── */}
            <section className="mb-10 px-6">
              <h3 className="text-base font-bold text-gray-800 mb-5 cursor-default">
                Edit Profile
              </h3>
              <div className="space-y-0 divide-y divide-gray-100 border-t border-gray-100">
                <div className="flex items-center justify-between py-4 px-6">
                  <div className="cursor-default">
                    <p className="text-sm text-gray-700">Manage Profile</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Tampilan foto profil, email, username, dan password
                    </p>
                  </div>
                  <button
                    data-guide="edit-profile"
                    onClick={() => router.push("/settings/edit-profile")}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Profile
                  </button>
                </div>
              </div>
            </section>

            {/* ── MANAGE CACHE ── */}
            <section className="mb-10 px-6">
              <h3 className="text-base font-bold text-gray-800 mb-5 cursor-default">
                Manage Cache
              </h3>
              <div className="space-y-0 divide-y divide-gray-100 border-t border-gray-100">
                {/* Cache toggle — 1 toggle untuk model + metrics */}
                <div
                  className="flex items-center justify-between py-4 px-6"
                  data-guide="cache-toggle"
                >
                  <div className="cursor-default">
                    <p className="text-sm text-gray-700">
                      Cache Model & Metrics
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Simpan model terlatih dan hasil metrics agar tidak perlu
                      retrain ulang
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const newValue = !cacheEnabled;
                      const username =
                        sessionStorage.getItem("ventara_username") || "";
                      setCacheEnabled(newValue);
                      try {
                        const res = await fetch(
                          `/api/cache-settings?username=${username}`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              model_cache: newValue,
                              metrics_cache: newValue,
                            }),
                          },
                        );
                        if (!res.ok) throw new Error();
                      } catch {
                        setCacheEnabled(!newValue); // revert kalau gagal
                      }
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                      cacheEnabled ? "bg-teal-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                        cacheEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* ── KELOLA SNAPSHOT ── */}
            <section className="px-6" data-guide="snapshot-management">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-gray-800 cursor-default">
                  Kelola Snapshot
                </h3>
                <button
                  onClick={loadSnapshots}
                  disabled={snapshotLoading}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-teal-700 transition-colors cursor-pointer"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${snapshotLoading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
              </div>

              {/* Slot usage bar — inline, tanpa component terpisah */}
              {!snapshotLoading && snapshotLimit > 0 && (
                <div
                  className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100 cursor-default"
                  data-guide="snapshot-usage"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Penggunaan Snapshot
                    </span>
                    <span className="text-xs capitalize font-bold text-teal-700 bg-teal-50 px-4 py-0.5 rounded-full border border-teal-200 tracking-wider">
                      {storageInfo.tier === "gratis"
                        ? "free"
                        : storageInfo.tier}
                    </span>
                  </div>

                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {snapshots.length}
                    </span>
                    <span className="text-sm text-gray-400 mb-0.5">
                      / {snapshotLimit} slot
                    </span>
                  </div>

                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${snapshotIsFull ? "bg-red-400" : "bg-teal-500"}`}
                      style={{ width: `${snapshotPercent}%` }}
                    />
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    {snapshotIsFull
                      ? "Semua slot terpakai. Hapus snapshot lama untuk menyimpan yang baru."
                      : `Sisa ${snapshotLimit - snapshots.length} slot tersedia.`}
                  </p>
                </div>
              )}

              {/* Restore success */}
              {restoreSuccess && (
                <div className="mb-4 flex items-center gap-2 text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>
                    <span className="font-medium">{restoreSuccess}</span>{" "}
                    berhasil di-restore sebagai model aktif.
                  </span>
                </div>
              )}

              {/* Error */}
              {snapshotError && (
                <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {snapshotError}
                </div>
              )}

              <div className="divide-y divide-gray-100 border-t border-gray-100">
                {/* Loading */}
                {snapshotLoading && (
                  <div className="py-8 flex flex-col items-center gap-2">
                    <svg
                      className="w-5 h-5 text-teal-400 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <p className="text-xs text-gray-400">Memuat snapshot...</p>
                  </div>
                )}

                {/* Empty state */}
                {!snapshotLoading &&
                  snapshots.length === 0 &&
                  !snapshotError && (
                    <div className="py-10 flex flex-col items-center gap-2 text-center cursor-default">
                      <svg
                        className="w-8 h-8 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
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
                      </svg>
                      <p className="text-sm text-gray-400">
                        Belum ada snapshot tersimpan
                      </p>
                      <p className="text-xs text-gray-300">
                        Snapshot dibuat otomatis saat training berhasil
                      </p>
                    </div>
                  )}

                {/* Snapshot rows */}
                {!snapshotLoading &&
                  snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="flex items-center justify-between py-4 px-6"
                    >
                      <div className="flex items-center gap-3 min-w-0 cursor-default">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                          <svg
                            className="w-4 h-4 text-teal-500"
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
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">
                            {snap.dataset}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {snap.trained_at}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        {/* Restore */}
                        <button
                          onClick={() =>
                            handleRestoreSnapshot(snap.id, snap.dataset)
                          }
                          disabled={
                            restoringId === snap.id || deletingId === snap.id
                          }
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-teal-200 text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {restoringId === snap.id ? (
                            <svg
                              className="w-3.5 h-3.5 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v8H4z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          )}
                          Restore
                        </button>

                        {/* Hapus */}
                        <button
                          onClick={() => handleDeleteSnapshot(snap.id)}
                          disabled={
                            deletingId === snap.id || restoringId === snap.id
                          }
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {deletingId === snap.id ? (
                            <svg
                              className="w-3.5 h-3.5 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v8H4z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        </div>
      </main>
      {/* USER GUIDE */}
      {guideOpen && (
        <>
          <GuideOverlay highlightRect={highlightRect} onSkip={finish} />

          <GuideModal
            isOpen={guideOpen}
            step={step}
            currentStep={currentStep}
            totalSteps={totalSteps}
            highlightRect={highlightRect}
            isFirstStep={isFirstStep}
            isLastStep={isLastStep}
            onNext={next}
            onBack={back}
            onFinish={finish}
          />
        </>
      )}

      <GuideButton
        onClick={openGuide}
        showFlyAnimation={showFlyAnimation}
        startCoords={startCoords}
        onAnimationComplete={resetFlyAnimation}
      />
    </div>
  );
}
