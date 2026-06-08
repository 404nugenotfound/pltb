// app/forecasting/page.tsx

"use client";

import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";

import UploadState from "@/app/components/upload/UploadState";
import MetricsSection from "@/app/components/metrics/MetricsSection";
import OverfitChart from "@/app/components/overview/OverfitChart";

import ProgressToast from "@/app/components/toast/ProgressToast";
import { useMetrics } from "@/app/hooks/useMetrics";

import { useEffect, useState } from "react";

import { useGenerateContext } from "@/app/context/GenerateContext";


export default function ForecastingPage() {
  const [ selectedModel, setSelectedModel] = useState("all");

  const { dataset_name, metrics, best_models = [], loading, refreshMetrics } = useMetrics();

  const [ generateMode, setGenerateMode] = useState<"general" | "best">("general");

  const { generate, startGenerate } = useGenerateContext();

  const [ uiState, setUiState] = useState<"idle" | "loading" | "nlp">("idle");

  const [ nlpReport, setNlpReport] = useState("");

  async (nlpReport: String) => {
    const username = sessionStorage.getItem("ventara_username");

    setGenerateMode(selectedModel as "general" | "best");
    setUiState("nlp");
    setNlpReport(nlpReport as string);

    const newEntry = {
      id: Date.now(),
      waktu: new Date().toLocaleString("id-ID"),
      file: dataset_name,
      algo: selectedModel,
      periode: "7 Hari",
      hasil: [],
      nlp_report: nlpReport,
      status: "Selesai"
    };


    sessionStorage.setItem(`ventara_ui_state_${username}`, "nlp");
    sessionStorage.setItem(`ventara_nlp_report_${username}`, nlpReport as string);
    sessionStorage.setItem(`ventara_selected_var_${username}`, selectedVars);
  }

  const ALL_VARS = ["RH2M", "WS10M", "WD10M"];
  const [selectedVars, setSelectedVars] = useState("WS10M");

    // 1. useEffect
  useEffect(() => {
    const username = sessionStorage.getItem("ventara_username");
    const savedState = sessionStorage.getItem(`ventara_ui_state_${username}`) as "idle" | "loading" | "nlp" | null;
    const savedReport = sessionStorage.getItem(`ventara_nlp_report_${username}`);
    if (savedState) setUiState(savedState);
    if (savedReport) setNlpReport(savedReport);
  }, []);


  return (
    <div className="flex h-screen">
      <Sidebar />

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto">
        <Header />

        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Perhitungan & Prediksi
              </h2>

              <p className="text-gray-600 text-sm">
                Pilih algoritma dan periode prediksi untuk peramalan energi
              </p>

              <p className="text-xs text-teal-600 mt-1 font-medium">
                Dataset Aktif: {dataset_name}
              </p>

              <div className="flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open("http://localhost:5000/download_template", "_blank");
                }}
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-teal-800 hover:text-teal-500 px-3 py-1.5 transition-colors cursor-pointer underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Template Dataset
              </button>
            </div>
            </div>

            {/* STATUS BOX */}
            <div className="mb-6">
              <UploadState
                uiState={uiState}
                datasetName={dataset_name}
                nlpReport={nlpReport}
                generateMode={generateMode} 
                onUiStateChange={setUiState}
                onReset={() => {
                const username = sessionStorage.getItem("ventara_username");
                setUiState("idle");
                setNlpReport("");
                sessionStorage.removeItem(`ventara_ui_state_${username}`);
                sessionStorage.removeItem(`ventara_nlp_report_${username}`);
              }}
              onTrainingComplete={refreshMetrics}  // ✅ refresh metrics setelah training selesai
              />
            </div>

            {/* CARD */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              {/* PILIH MODEL */}
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-teal-100 rounded-xl pt-2 pl-2.5 w-10 h-10">
                    <svg
                      className="w-5 h-5 text-teal-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>

                  <h3 className="font-semibold text-gray-900">
                    Pilih Algoritma Machine Learning
                  </h3>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                  {/* GENERAL */}
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="model"
                      value="all"
                      checked={selectedModel === "all"}
                      onChange={() => setSelectedModel("all")}
                      className="hidden peer"
                    />
                     <span className="block px-5 py-2.5 rounded-xl font-medium border-2 text-sm transition-all select-none peer-checked:bg-teal-50 peer-checked:border-teal-400 peer-checked:text-teal-700 bg-gray-100 border-gray-200 text-gray-700 hover:border-teal-200">
                    General
                  </span>
                </label>

                  {/* VARIABEL — muncul inline setelah General */}
                  <div className={`flex items-center gap-2 overflow-hidden transition-all duration-600 ease-in-out ${
                    selectedModel === "all" ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
                  }`}>
                    <span className="text-xs text-gray-400 whitespace-nowrap">|</span>
                    {ALL_VARS.map((v) => {
                      const isSelected = selectedVars === v;
                      return (
                        <button
                          key={v}
                          onClick={() => setSelectedVars(v)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border-2 transition-all select-none whitespace-nowrap ${
                            isSelected
                              ? "bg-teal-50 border-teal-400 text-teal-700"
                              : "bg-gray-100 border-gray-200 text-gray-500 hover:border-teal-200"
                          }`}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>

                  {/* BEST */}
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="model"
                      value="best"
                      checked={selectedModel === "best"}
                      onChange={() => setSelectedModel("best")}
                      className="hidden peer"
                    />
                    <span className="block px-5 py-2.5 rounded-xl font-medium border-2 text-sm transition-all select-none bg-gray-100 border-gray-200 text-gray-700 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 peer-checked:bg-amber-50 peer-checked:border-amber-400 peer-checked:text-amber-700">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Best 2 Model
                        <span className="text-xs text-amber-500 font-normal">
                          ({best_models[0] ?? "-"} & {best_models[1] ?? "-"})
                        </span>
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* METRICS */}
              <MetricsSection
                metrics={metrics}
                selectedModel={selectedModel}
                bestModels={best_models}
              />

              {/* BUTTON */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                {/* GENERATE */}
                <button
                  onClick={() =>
                    startGenerate(
                      selectedModel,
                      async (nlpReport: string) => {
                        const username = sessionStorage.getItem("ventara_username");

                        setGenerateMode(selectedModel as "general" | "best");
                        setUiState("nlp");
                        setNlpReport(nlpReport);

                        const newEntry = {
                          id: Date.now(),
                          waktu: new Date().toLocaleString("id-ID"),
                          file: dataset_name,
                          algo: selectedModel,
                          periode: "7 Hari",
                          nlp_report: nlpReport,
                          status: "Selesai"
                        };

                        sessionStorage.setItem(`ventara_ui_state_${username}`, "nlp");
                        sessionStorage.setItem(`ventara_nlp_report_${username}`, nlpReport);
                      },
                       selectedVars  // ← tambah argument ketiga
                    )
                  }
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white font-medium rounded-xl text-sm hover:bg-teal-600 transition-colors"
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
                      strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Generate Full CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* TOAST */}
      <ProgressToast
        visible={generate.visible}
        percent={generate.percent}
        status={generate.status}
        eta={generate.eta}
        elapsed={generate.elapsed}
      />
    </div>
  );
}
