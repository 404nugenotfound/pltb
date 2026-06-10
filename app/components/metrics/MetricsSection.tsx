interface MetricItem {
  MAE: number;
  RMSE: number;
  sMAPE: number;
  R2: number;
}

interface EnsembleVar {
  ml: string;
  dl: string;
  ensemble: string;
  metrics?: MetricItem;
}

interface MetricsSectionProps {
  metrics: Record<string, MetricItem>;
  selectedModel: string;
  bestModels: string[];
  stackingMetrics?: {
    xgb?: MetricItem;
    Lstm?: MetricItem;
    biLstm?: MetricItem;
    xgbLstm?: MetricItem;
    xgbBiLstm?: MetricItem;
  };
  ensembleSummary?: Record<string, EnsembleVar>; // ← tambah
}

export default function MetricsSection({
  metrics,
  selectedModel,
  bestModels,
  stackingMetrics = {},
  ensembleSummary = {}, // ← tambah
}: MetricsSectionProps) {

  // ========================
  // BEST 2 MODEL VIEW
  // ========================
  if (selectedModel === "best") {
    const hasEnsemble = Object.keys(ensembleSummary).length > 0;

    // ── Card per variabel (NEW) ──
    if (hasEnsemble) {
      return (
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3 text-sm">
            Ensemble Forecasting yang Digunakan
          </h4>
          <div className="flex flex-col gap-3">
            {Object.entries(ensembleSummary).map(([variable, data]) => (
              <div
                key={variable}
                className="border border-amber-200 rounded-xl p-4 bg-amber-50"
              >
                {/* Header variabel */}
                <p className="text-xs font-semibold text-amber-600 mb-3 tracking-wide uppercase">
                  {variable}
                </p>

                {/* Alur: Best ML + Best DL → Ensemble */}
                <div className="flex items-center gap-3">
                  {/* Best ML */}
                  <div className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-gray-400 mb-1">Best ML</p>
                    <p className="font-bold text-sm text-teal-700">{data.ml}</p>
                  </div>

                  {/* + */}
                  <span className="text-amber-400 font-bold text-lg">+</span>

                  {/* Best DL */}
                  <div className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-gray-400 mb-1">Best DL</p>
                    <p className="font-bold text-sm text-teal-700">{data.dl}</p>
                  </div>

                  {/* → */}
                  <span className="text-amber-400 font-bold text-lg">→</span>

                  {/* Ensemble */}
                  <div className="flex-1 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-gray-400 mb-1">Ensemble</p>
                    <p className="font-bold text-sm text-amber-700">{data.ensemble}</p>
                  </div>

                  {/* sMAPE kalau ada */}
                  {data.metrics?.sMAPE !== undefined && (
                    <>
                      <span className="text-gray-300 font-bold text-lg">|</span>
                      <div className="text-center min-w-15">
                        <p className="text-xs text-gray-400 mb-1">sMAPE</p>
                        <p className="font-bold text-sm text-gray-700">
                          {data.metrics.sMAPE}%
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── Fallback lama kalau ensembleSummary kosong ──
    const bestCards = [
      { label: "XGB",          data: stackingMetrics.xgb      ?? metrics["XGB"] },
      { label: "LSTM",         data: stackingMetrics.Lstm      ?? metrics["LSTM"] },
      { label: "Bi-LSTM",      data: stackingMetrics.biLstm    ?? metrics["BiLSTM"] },
      { label: "XGB + LSTM",   data: stackingMetrics.xgbLstm },
      { label: "XGB + BiLSTM", data: stackingMetrics.xgbBiLstm },
    ];

    return (
      <div className="mb-6">
        <h4 className="font-medium text-gray-700 mb-3 text-sm">
          Model Ensemble yang Digunakan
        </h4>
        <div className="grid grid-cols-3 gap-4">
          {bestCards.map(({ label, data }) => {
            if (!data) return null;
            return (
              <div key={label} className="border rounded-xl p-4 bg-amber-50 border-amber-300">
                <p className="font-bold text-base text-amber-700 mb-3">{label}</p>
                <div className="space-y-1.5 text-xs text-gray-600">
                  {(["MAE", "RMSE", "sMAPE", "R2"] as const).map((key) => (
                    <div key={key} className="flex justify-between">
                      <span>{key === "R2" ? "R²" : key}</span>
                      <span className="font-semibold text-gray-800">
                        {key === "sMAPE" ? `${data[key]}%` : data[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ========================
  // GENERAL VIEW (tidak berubah)
  // ========================
  const orderedMetrics = ["GBR", "XGB", "KNN", "LSTM", "BiLSTM"];

  return (
    <div className="mb-6">
      <h4 className="font-medium text-gray-700 mb-3 text-sm">
        Model Ensemble yang Digunakan
      </h4>
      <div className="grid grid-cols-3 gap-4">
        {orderedMetrics.slice(0, 3).map((model) => {
          const m = metrics[model];
          if (!m) return null;
          const isBest = bestModels.includes(model);
          return (
            <div
              key={model}
              className={`border rounded-xl p-4 transition-all ${
                !isBest ? "opacity-30 grayscale" : ""
              } ${isBest ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"}`}
            >
              <p className={`font-bold text-base mb-3 ${isBest ? "text-amber-700" : "text-teal-700"}`}>
                {model}
              </p>
              <div className="space-y-1.5 text-xs text-gray-600">
                {(["MAE", "RMSE", "sMAPE", "R2"] as const).map((key) => (
                  <div key={key} className="flex justify-between">
                    <span>{key === "R2" ? "R²" : key}</span>
                    <span className="font-semibold text-gray-800">
                      {key === "sMAPE" ? `${m[key]}%` : m[key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4 mt-4">
        {orderedMetrics.slice(3).map((model) => {
          const m = metrics[model];
          if (!m) return null;
          const isBest = bestModels.includes(model);
          return (
            <div
              key={model}
              className={`w-full md:w-1/3 border rounded-xl p-4 transition-all ${
                !isBest ? "opacity-30 grayscale" : ""
              } ${isBest ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"}`}
            >
              <p className={`font-bold text-base mb-3 ${isBest ? "text-amber-700" : "text-teal-700"}`}>
                {model}
              </p>
              <div className="space-y-1.5 text-xs text-gray-600">
                {(["MAE", "RMSE", "sMAPE", "R2"] as const).map((key) => (
                  <div key={key} className="flex justify-between">
                    <span>{key === "R2" ? "R²" : key}</span>
                    <span className="font-semibold text-gray-800">
                      {key === "sMAPE" ? `${m[key]}%` : m[key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}