interface MetricItem {
  MAE: number;
  RMSE: number;
  sMAPE: number;
  R2: number;
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
}

export default function MetricsSection({
  metrics,
  selectedModel,
  bestModels,
  stackingMetrics = {},
}: MetricsSectionProps) {

  // ========================
  // BEST 2 MODEL VIEW
  // ========================
  if (selectedModel === "best") {
    const bestCards = [
      { label: "XGB",          data: stackingMetrics.xgb      ?? metrics["XGB"] },
      { label: "LSTM",          data: stackingMetrics.Lstm      ?? metrics["LSTM"] },
      { label: "Bi-LSTM",          data: stackingMetrics.biLstm      ?? metrics["BiLSTM"] },
      { label: "XGB + LSTM",   data: stackingMetrics.xgbLstm                    },
      { label: "XGB + BiLSTM", data: stackingMetrics.xgbBiLstm                  },
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