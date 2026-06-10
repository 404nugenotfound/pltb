"use client";
import { createContext, useContext, useRef, useState, useCallback } from "react";

interface GenerateState {
  visible: boolean;
  percent: number;
  status: string;
  eta: string;
  elapsed: string;
}

interface GenerateContextValue {
  generate: GenerateState;
  startGenerate: (
    model: string,
    onDone?: (nlp: string, ensembleSummary: Record<string, any>) => void,
    selectedVar?: string
  ) => void;
}

const DEFAULT: GenerateState = {
  visible: false,
  percent: 0,
  status: "Preparing...",
  eta: "--",
  elapsed: "--",
};

const GenerateContext = createContext<GenerateContextValue | null>(null);

export function GenerateProvider({ children }: { children: React.ReactNode }) {
  const [generate, setGenerate] = useState<GenerateState>(DEFAULT);
  const pollActive = useRef(false);

  const pollOnce = useCallback(async (
    onDone?: (nlp: string, ensembleSummary: Record<string, any>) => void
  ) => {
    if (!pollActive.current) return;
    try {
      const res = await fetch("/api/generate-progress");
      const prog = await res.json();

      setGenerate({
        visible: true,
        percent: Math.floor((prog.day / prog.total) * 100),
        status: `Generating Day ${prog.day}/${prog.total}`,
        eta: prog.eta,
        elapsed: prog.elapsed,
      });

      if (prog.error) {
        pollActive.current = false;
        setGenerate(DEFAULT);
        return;
      }

      if (prog.done) {
        pollActive.current = false;
        setGenerate(prev => ({ ...prev, percent: 100 }));

        await fetch("http://localhost:5000/generate_commit", {
          method: "POST",
          credentials: "include",
        });

        setTimeout(() => {
          setGenerate(DEFAULT);
          onDone?.(
            prog.nlp_report ?? "",
            prog.ensemble_summary ?? {}   // ← pass ensemble_summary
          );
        }, 1000);
        return;
      }

      setTimeout(() => pollOnce(onDone), 1500);
    } catch (err) {
      pollActive.current = false;
      setGenerate(DEFAULT);
      console.error("Poll error:", err);
    }
  }, []);

  const startGenerate = useCallback(async (
    selectedModel: string,
    onDone?: (nlp: string, ensembleSummary: Record<string, any>) => void,
    selectedVar: string = "WS10M",
  ) => {
    console.log("selectedVar dikirim:", selectedVar);
    setGenerate({ ...DEFAULT, visible: true });
    try {
      const formData = new FormData();
      formData.append("model", selectedModel);
      formData.append("var", selectedVar);

      const endpoint = selectedModel === "best" ? "/api/generate-best" : "/api/generate";
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();

      if (data.status === "already_running") {
        setGenerate(DEFAULT);
        alert("Generate masih berjalan, tunggu sebentar.");
        return;
      }

      pollActive.current = true;
      pollOnce(onDone);
    } catch (err) {
      setGenerate(DEFAULT);
      console.error("Generate error:", err);
    }
  }, [pollOnce]);

  return (
    <GenerateContext.Provider value={{ generate, startGenerate }}>
      {children}
    </GenerateContext.Provider>
  );
}

export function useGenerateContext() {
  const ctx = useContext(GenerateContext);
  if (!ctx) throw new Error("useGenerateContext must be used inside GenerateProvider");
  return ctx;
}