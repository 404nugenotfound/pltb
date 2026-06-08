// app/components/metrics/MetricsSection.tsx

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
}

export default function MetricsSection({
  metrics,
  selectedModel,
  bestModels,
}: MetricsSectionProps) {
  const orderedMetrics = ["GBR", "XGB", "KNN", "LSTM", "BiLSTM"];

  return (
    <div className="mb-6">
      <h4 className="font-medium text-gray-700 mb-3 text-sm">
        Model Ensemble yang Digunakan
      </h4>

      {/* TOP ROW */}
      <div className="grid grid-cols-3 gap-4">
        {orderedMetrics.slice(0, 3).map((model) => {
          const m = metrics[model];

          if (!m) return null;

          const isBest = bestModels.includes(model);

          return (
            <div
              key={model}
              className={`border rounded-xl p-4 transition-all ${
                selectedModel === "best" && !isBest
                  ? "opacity-30 grayscale"
                  : ""
              } ${
                isBest
                  ? "bg-amber-50 border-amber-300"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className={`font-bold text-base ${
                    isBest ? "text-amber-700" : "text-teal-700"
                  }`}
                >
                  {model}
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>MAE</span>
                  <span className="font-semibold text-gray-800">{m.MAE}</span>
                </div>

                <div className="flex justify-between">
                  <span>RMSE</span>
                  <span className="font-semibold text-gray-800">{m.RMSE}</span>
                </div>

                <div className="flex justify-between">
                  <span>sMAPE</span>
                  <span className="font-semibold text-gray-800">{m.sMAPE}%</span>
                </div>

                <div className="flex justify-between">
                  <span>R²</span>
                  <span className="font-semibold text-gray-800">{m.R2}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* BOTTOM ROW */}
      <div className="flex justify-center gap-4 mt-4">
        {orderedMetrics.slice(3).map((model) => {
          const m = metrics[model];

          if (!m) return null;

          const isBest = bestModels.includes(model);

          return (
            <div
              key={model}
              className={`w-full md:w-1/3 border rounded-xl p-4 transition-all ${
                selectedModel === "best" && !isBest
                  ? "opacity-30 grayscale"
                  : ""
              } ${
                isBest
                  ? "bg-amber-50 border-amber-300"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className={`font-bold text-base ${
                    isBest ? "text-amber-700" : "text-teal-700"
                  }`}
                >
                  {model}
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>MAE</span>
                  <span className="font-semibold text-gray-800">{m.MAE}</span>
                </div>

                <div className="flex justify-between">
                  <span>RMSE</span>
                  <span className="font-semibold text-gray-800">{m.RMSE}</span>
                </div>

                <div className="flex justify-between">
                  <span>sMAPE</span>
                  <span className="font-semibold text-gray-800">{m.sMAPE}%</span>
                </div>

                <div className="flex justify-between">
                  <span>R²</span>
                  <span className="font-semibold text-gray-800">{m.R2}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
