import Link from "next/link";
import { useState } from "react";
import { useSaveHistory } from "@/app/hooks/useSaveHistory";
import type { ForecastData } from "@/app/components/overview/ForecastChart";

interface Props {
  datasetName: string;
  generateMode: "general" | "best";
  nlpReport: string;
  forecastData?: object | null;
}

export default function OverviewHeader({
  datasetName,
  generateMode,
  nlpReport,
  forecastData,
}: Props) {
  const { saveHistory } = useSaveHistory();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        {/* LEFT */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Tampilan Overview dari Forecasting
          </h2>
          <p className="text-sm text-gray-600 pt-3">
            Hasil tampilan secara keseluruhan dari proses
          </p>
          <Link
            href="/forecasting"
            className="text-md font-bold font-italic text-teal-600 hover:text-teal-800 hover:underline transition mt-1 inline-block"
          >
            ← Kembali ke Forecasting
          </Link>
        </div>
        {/* RIGHT */}
        <div className="flex gap-3 items-center">
          <button
            onClick={() =>
              saveHistory({
                file: datasetName,
                algo: generateMode === "best" ? "Best" : "General Model",
                periode: "168 Jam",
                nlp_report: nlpReport,
                forecast_data: forecastData ?? null,
                onStorageFull: () => setShowUpgradeModal(true),
              })
            }
            className="bg-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 transition cursor-pointer"
          >
            Simpan ke Historis
          </button>
          <Link
            href="/history"
            className="flex items-center gap-3 bg-gray-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-600 transition cursor-pointer"
          >
            <span>Page Data Histories</span>
          </Link>
        </div>
      </div>

      {/* Modal Upgrade */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">
                Upgrade Penyimpanan
              </h3>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Storage kamu penuh. Upgrade untuk menyimpan lebih banyak histori
              prediksi.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                {
                  key: "basic",
                  label: "Basic",
                  mb: "100.00 MB",
                  price: "Rp 29.000 / bulan",
                },
                {
                  key: "pro",
                  label: "Pro",
                  mb: "500.00 MB",
                  price: "Rp 99.000 / bulan",
                },
                {
                  key: "business",
                  label: "Business",
                  mb: "2048.00 MB",
                  price: "Rp 299.000 / bulan",
                },
              ].map((tier) => (
                <div
                  key={tier.key}
                  className="border-2 border-gray-200 rounded-xl p-4"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-gray-800">
                      {tier.label}
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      Bayar
                    </span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{tier.mb}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{tier.price}</p>
                </div>
              ))}
            </div>
            <Link
              href="/history"
              onClick={() => setShowUpgradeModal(false)}
              className="block w-full py-3 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 transition text-center"
            >
              Lihat Paket di Halaman Historis
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
