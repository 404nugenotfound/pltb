import { Metric } from "@/app/types/forecast";

interface Props {
  model: string;
  metric: Metric;
  isBest?: boolean;
  rank?: number;
  selectedModel?: string;
}

export default function MetricCard({
  model,
  metric,
  isBest,
  rank,
  selectedModel,
}: Props) {
  return (
    <div
      className={`border rounded-xl p-4 transition-all
        ${selectedModel === "best" && !isBest ? "opacity-30 grayscale" : ""}
        ${
          isBest ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"
        }
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className={`font-bold text-base ${
            isBest ? "text-amber-700" : "text-teal-700"
          }`}
        >
          {model}
        </p>

        {isBest && (
          <span
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              rank === 1
                ? "bg-amber-100 text-amber-600"
                : "bg-orange-100 text-orange-500"
            }`}
          >
            ⭐ {rank === 1 ? "#1 Best" : "#2 Best"}
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>MAE</span>
          <span className="font-semibold text-gray-800">{metric.MAE}</span>
        </div>

        <div className="flex justify-between">
          <span>RMSE</span>
          <span className="font-semibold text-gray-800">{metric.RMSE}</span>
        </div>

        {/* Primary metric — dinamis per variabel */}
        {metric.primary_metric === "CircularMAE" ? (
          <div className="flex justify-between">
            <span>CircularMAE</span>
            <span
              className={`font-semibold ${rank === 1 ? "text-amber-600" : rank === 2 ? "text-orange-500" : "text-gray-800"}`}
            >
              {metric.CircularMAE}° ({metric.CircularMAE_pct}%)
            </span>
          </div>
        ) : metric.primary_metric === "MAE" ? null : (
          <div className="flex justify-between">
            <span>sMAPE</span>
            <span
              className={`font-semibold ${rank === 1 ? "text-amber-600" : rank === 2 ? "text-orange-500" : "text-gray-800"}`}
            >
              {metric.sMAPE}%
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span>R²</span>
          <span className="font-semibold text-gray-800">{metric.R2}</span>
        </div>
      </div>
    </div>
  );
}
