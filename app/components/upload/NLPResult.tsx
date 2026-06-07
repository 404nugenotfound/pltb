import { downloadCsv } from "@/app/lib/api";

interface Props {
  nlpReport: string;
  generateMode?: "general" | "best"; // ← tambah
  onReset?: () => void; // ← tambah
  hideActions?: boolean; // ← tambah
}

export default function NLPResult({
  nlpReport,
  generateMode = "general", 
  onReset,
  hideActions = false,
}: Props) {
  return (
    <div className="bg-white border-2 border-teal-300 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-teal-100 rounded-xl flex justify-center shrink-0">
          <svg
            className="w-5 h-5 mt-2 text-teal-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-teal-800 mb-2">
            AI Forecast Summary
          </h3>

          <p className="text-sm text-gray-700 leading-relaxed text-justify">
            {nlpReport}
          </p>

          {/* ACTIONS */}
          {!hideActions && (  
          <div className="mt-4 pt-4 border-t border-teal-100 flex gap-3">
            <button
              onClick={() => downloadCsv(generateMode)}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg text-sm hover:bg-teal-700 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Full CSV
            </button>

            <button
              onClick={() => window.location.href = "/overview"}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg text-sm hover:bg-teal-700 transition-colors cursor-pointer"
            >
              View Overall
            </button>

            <button
              onClick={onReset}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
          )}
        </div>
      </div>
    </div> 
  );
}