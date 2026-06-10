"use client";
import dynamic from "next/dynamic";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import OverviewHeader from "@/app/components/overview/OverviewHeader";
import NLPResult from "@/app/components/upload/NLPResult";
import EDASection from "@/app/components/overview/EdaSection";
import { useEffect, useState } from "react";
import { useMetrics } from "@/app/hooks/useMetrics";

const OverfitChart = dynamic(
  () => import("@/app/components/overview/OverfitChart"),
  { ssr: false },
);

type AnalysisTab = "eda" | "overfit" | "prediksi";

const ANALYSIS_TABS = [
  {
    id: "eda",
    label: "Exploratory Data Analysis",
    shortLabel: "EDA",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    id: "overfit",
    label: "Overfit Check",
    shortLabel: "Overfit",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  {
    id: "prediksi",
    label: "Prediksi vs Aktual",
    shortLabel: "Prediksi",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
] as const;

const ForecastChart = dynamic(
  () => import("@/app/components/overview/ForecastChart"),
  { ssr: false },
);

export default function OverviewPage() {
  const [nlpReport, setNlpReport]     = useState("");
  const [generateMode, setGenerateMode] = useState<"general" | "best">("general");
  const [activeVar, setActiveVar]     = useState("WS10M");
  const [activeTab, setActiveTab]     = useState<AnalysisTab>("eda");

  const { dataset_name } = useMetrics();

  useEffect(() => {
    const username    = sessionStorage.getItem("ventara_username");
    const savedReport = sessionStorage.getItem(`ventara_nlp_report_${username}`);
    const savedMode   = sessionStorage.getItem(`ventara_generate_mode_${username}`);
    const savedVar    = sessionStorage.getItem(`ventara_active_var_${username}`);

    if (savedReport) setNlpReport(savedReport);
    if (savedMode)   setGenerateMode(savedMode as "general" | "best");
    if (savedVar)    setActiveVar(savedVar);

    fetch("http://localhost:5000/overview_data", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.nlp_report)    setNlpReport(data.nlp_report);
        if (data.generate_mode) setGenerateMode(data.generate_mode);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <Header />

        <div className="p-8">
          <div className="max-w-6xl mx-auto space-y-8">

            <OverviewHeader
              datasetName={dataset_name}
              generateMode={generateMode}
              nlpReport={nlpReport}
            />

            {/* NLP Result tetap di luar card */}
            <NLPResult
              nlpReport={nlpReport}
              generateMode={generateMode}
              onReset={() => setNlpReport("")}
              hideActions
            />

            {/* ── ANALYSIS CARD ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

              {/* Tab Navbar */}
              <div className="border-b border-gray-100 px-6 pt-4">
                <div className="flex gap-1 w-full">
                  {ANALYSIS_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex flex-1 justify-center items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all border-b-2 ${
                        activeTab === tab.id
                          ? "border-teal-500 text-teal-700 bg-teal-50"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                      </svg>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Konten Tab */}
              <div className="p-6">

                {/* EDA */}
                {activeTab === "eda" && (
                  <EDASection />
                )}

                {/* OVERFIT */}
                {activeTab === "overfit" && (
                  <OverfitChart
                    selectedVar={generateMode === "general" ? activeVar : undefined}
                    mode={generateMode}
                  />
                )}

                {/* PREDIKSI — placeholder dulu */}
                {activeTab === "prediksi" && (
                  <ForecastChart
                    mode={generateMode}
                    varParam={activeVar}
                  />
                )}

              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}