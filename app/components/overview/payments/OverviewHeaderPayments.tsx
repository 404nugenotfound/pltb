import Link from "next/link";
import { useState } from "react";
import { useSaveHistory } from "@/app/hooks/useSaveHistory";

interface Props {
  datasetName: string;
  generateMode: "general" | "best";
  nlpReport: string;
}

export default function OverviewHeader({
  datasetName,
  generateMode,
  nlpReport,
}: Props) {

  const { saveHistory } = useSaveHistory();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);  // ← di sini

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
        </div>

        {/* RIGHT */}
        <div className="flex gap-3">
          <button
            onClick={() =>
              saveHistory({
                file: datasetName,
                algo: generateMode === "best" ? "Best Model" : "General Model",
                periode: "168 Jam",
                nlp_report: nlpReport,
                onStorageFull: () => setShowUpgradeModal(true),  // ← tambah
              })
            }
            className="bg-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-600 transition"
          >
            Simpan ke Historis
          </button>

          <Link
            href="/history"
            className="flex items-center gap-3 bg-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-500 transition"
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
              <h3 className="font-semibold text-gray-900 text-lg">Upgrade Penyimpanan</h3>
              <button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <p className="text-sm text-gray-500 mb-5">
              Storage kamu penuh. Upgrade untuk menyimpan lebih banyak histori prediksi.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { key: "basic",    label: "Basic",    mb: "100.00 MB + 3 Cache", price: "Rp1.500 / bulan" },
                { key: "business", label: "Business", mb: "2048.00 MB", price: "Rp 299.000 / bulan" },
              ].map((tier) => (
                <div
                  key={tier.key}
                  className="border-2 border-gray-200 rounded-xl p-4"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-gray-800">{tier.label}</span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Bayar</span>
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