"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import { useStorage } from "@/app/context/StorageContext";
import PaymentModal from "@/app/components/payments/PaymentModal";
import UpgradeModal from "@/app/components/payments/UpgradeModal";

// ─── Guide ───
import { useGuide, HISTORIS_STEPS } from "@/app/hooks/Useguide";
import { GuideModal, GuideOverlay, GuideButton } from "@/app/components/guide";

const HISTORIS_STORAGE_KEY = "ventara_guide_historis_done";

type AlgoKey = "Best Model" | "General Model" | "Best";
type StatusKey = "Selesai" | "Error" | "Berjalan";

interface HasilItem {
  label: string;
  value: string;
}

interface HistorisItem {
  id: number;
  waktu: string;
  file: string;
  algo: string;
  periode: string;
  status: StatusKey;
  nlp_report?: string;
  forecast_data?: object | null;
}

const ALGO_STYLE: Record<AlgoKey, string> = {
  "Best Model": "bg-amber-50 text-amber-600 border border-amber-200",
  "General Model": "bg-blue-50 text-blue-700",
  Best: "bg-amber-50 text-amber-600 border border-amber-200",
};

const STATUS_STYLE: Record<StatusKey, string> = {
  Selesai: "bg-green-50 text-green-700",
  Error: "bg-red-50 text-red-700",
  Berjalan: "bg-amber-50 text-amber-700",
};

const STATUS_DOT: Record<StatusKey, string> = {
  Selesai: "bg-green-500",
  Error: "bg-red-500",
  Berjalan: "bg-amber-500",
};

export default function HistorisPage() {
  const [search, setSearch] = useState("");
  const [data, setData] = useState<HistorisItem[]>([]);
  const [detailItem, setDetailItem] = useState<HistorisItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { storageInfo, refreshStorage } = useStorage();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // ─── Guide ───
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
    steps: HISTORIS_STEPS,
    storageKey: HISTORIS_STORAGE_KEY,
  });

  useEffect(() => {
    async function init() {
      try {
        const username = sessionStorage.getItem("ventara_username") || "";
        const [res] = await Promise.all([
          fetch(`/api/get-history?username=${username}`),
          refreshStorage(),
        ]);
        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      }
    }

    init();
  }, []);

  console.log("DATA STATE =", data);

  const filtered = data.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.file.toLowerCase().includes(q) ||
      d.algo.toLowerCase().includes(q) ||
      d.status.toLowerCase().includes(q)
    );
  });

  async function handleDownload(row: HistorisItem) {
    const username = sessionStorage.getItem("ventara_username") || "";
    const mode = row.algo === "Best Model" ? "best" : "general";

    const res = await fetch(
      `http://localhost:5000/download_forecast?mode=${mode}`,
      {
        credentials: "include",
        headers: { "X-Username": username },
      },
    );

    if (!res.ok) {
      alert("File belum tersedia");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hasil_prediksi_${mode}_${row.file}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: number) {
    const username = sessionStorage.getItem("ventara_username") || "";
    setDeletingId(id);
    try {
      await fetch(`/api/delete-history?username=${username}&id=${id}`, {
        method: "DELETE",
      });
      setData((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <Header />

        <div className="p-8">
          <div className="max-w-5xl mx-auto cursor-default">
            {/* Page header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Historis Perhitungan
              </h2>
              <p className="text-gray-600 text-sm">
                Riwayat semua perhitungan dan prediksi energi angin
              </p>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1" data-guide="search-historis">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari berdasarkan algoritma atau file..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl whitespace-nowrap">
                Total: {filtered.length} Perhitungan
              </div>
            </div>

            {/* Storage Bar */}
            <div
              className="bg-white border border-gray-200 rounded-xl px-5 py-3.5 mb-5 flex items-center gap-4"
              data-guide="storage-bar"
            >
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-500">
                    Penggunaan Penyimpanan —{" "}
                    <span className="font-semibold text-gray-700 capitalize">
                      {storageInfo.tier}
                    </span>
                  </span>
                  <span className="text-xs text-gray-500">
                    {storageInfo.usage_mb.toFixed(2)} /{" "}
                    {storageInfo.limit_mb.toFixed(2)} MB (
                    {storageInfo.percent.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      storageInfo.percent >= 90
                        ? "bg-red-500"
                        : storageInfo.percent >= 70
                          ? "bg-amber-400"
                          : "bg-teal-500"
                    }`}
                    style={{ width: `${Math.min(storageInfo.percent, 100)}%` }}
                  />
                </div>
              </div>
              <button
                data-guide="btn-upgrade"
                onClick={() => setShowUpgradeModal(true)}
                className="text-sm text-teal-600 font-medium hover:text-teal-700 whitespace-nowrap border border-teal-200 px-4 py-2 rounded-xl hover:bg-teal-50 cursor-pointer transition"
              >
                Upgrade
              </button>
            </div>

            {/* Table */}
            <div
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              data-guide="table-historis"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center px-4 py-4 text-xs font-medium text-gray-500 w-[20%]">
                      Waktu
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-medium text-gray-500 w-[28%]">
                      File Data
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-medium text-gray-500 w-[15%]">
                      Algoritma
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-medium text-gray-500 w-[12%]">
                      Periode
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-medium text-gray-500 w-[12%]">
                      Status
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-medium text-gray-500 w-[13%]">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-12 text-gray-400 text-sm"
                      >
                        Tidak ada data yang cocok
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-4 text-xs text-gray-500 text-center">
                          {row.waktu}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700 text-center">
                          {row.file}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${ALGO_STYLE[row.algo as AlgoKey] ?? "bg-gray-50 text-gray-700"}`}
                          >
                            {row.algo}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 text-center">
                          {row.periode}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[row.status]}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[row.status]}`}
                            />
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div
                            className="flex items-center justify-center gap-2"
                            data-guide="btn-aksi"
                          >
                            <button
                              onClick={() => {
                                const username =
                                  sessionStorage.getItem("ventara_username");
                                sessionStorage.setItem(
                                  `ventara_ui_state_${username}`,
                                  "nlp",
                                );
                                sessionStorage.setItem(
                                  `ventara_nlp_report_${username}`,
                                  row.nlp_report || "",
                                );
                                sessionStorage.setItem(
                                  `ventara_generate_mode_${username}`,
                                  row.algo === "Best Model"
                                    ? "best"
                                    : "general",
                                );
                                sessionStorage.setItem(
                                  `ventara_forecast_data_${username}`,
                                  JSON.stringify(row.forecast_data ?? null),
                                );
                                window.location.href = "/overview";
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer"
                              title="Lihat detail"
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
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(row.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                              title="Hapus"
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
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Detail */}
        {detailItem && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">Detail Prediksi</h3>
                <button
                  onClick={() => setDetailItem(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                {detailItem.waktu} • {detailItem.file}
              </p>
              <div className="mt-3 p-4 bg-teal-50 rounded-xl border border-teal-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {detailItem.nlp_report || "Tidak ada laporan AI tersedia."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Popup Delete History */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Hapus Riwayat</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Apakah Anda yakin ingin menghapus riwayat ini?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    handleDelete(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }}
                  disabled={deletingId === deleteConfirmId}
                  className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {deletingId === deleteConfirmId ? "Menghapus..." : "Hapus"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <UpgradeModal
            storageInfo={storageInfo}
            onClose={() => setShowUpgradeModal(false)}
            onSuccess={async () => {
              await refreshStorage();
            }}
          />
        )}
      </main>
      {/* ─── USER GUIDE ─── */}
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
