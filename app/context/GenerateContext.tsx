"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";

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
    selectedVar?: string,
  ) => void;
  cancelGenerate: () => Promise<void>;
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
  const pollGeneration = useRef(0); // ← tambah
  const hasResumed = useRef(false); // ← tambah
  // FIX: tambah flag untuk tahu apakah generate dipanggil manual
  // sehingga useEffect resume tidak bentrok dengan startGenerate
  const didStartManually = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollOnce = useCallback(
    async (
      onDone?: (nlp: string, ensembleSummary: Record<string, any>) => void,
      generation?: number,
    ) => {
      console.log("pollOnce called, pollActive:", pollActive.current); // ← tambah
      const myGen = generation ?? pollGeneration.current;
      if (!pollActive.current || myGen !== pollGeneration.current) return;
      try {
        const res = await fetch("/api/generate-progress");
        const prog = await res.json();

        const isBest = prog.mode === "best";
        const currentVar = prog.current_var || "";
        const dayInVar = isBest ? ((prog.day - 1) % 7) + 1 : prog.day;

        setGenerate({
          visible: true,
          percent: Math.floor((prog.day / prog.total) * 100),
          status: isBest
            ? `Generating ${currentVar} — Day ${dayInVar}/7`
            : `Generating Day ${prog.day}/${prog.total}`,
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
          setGenerate((prev) => ({ ...prev, percent: 100 }));
          await fetch("http://localhost:5000/generate_commit", {
            method: "POST",
            credentials: "include",
          });
          setTimeout(() => {
            setGenerate(DEFAULT);
            onDone?.(prog.nlp_report ?? "", prog.ensemble_summary ?? {});
          }, 1000);
          return;
        }

        pollTimer.current = setTimeout(() => pollOnce(onDone, myGen), 1500);
      } catch (err) {
        pollActive.current = false;
        setGenerate(DEFAULT);
        console.error("Poll error:", err);
      }
    },
    [],
  );

  // Resume toast otomatis saat refresh — tanya BE dulu, bukan localStorage
  useEffect(() => {
    const resume = async () => {
      // FIX: skip resume kalau startGenerate sudah dipanggil duluan
      console.log(
        "resume check, didStartManually:",
        didStartManually.current,
        "pollActive:",
        pollActive.current,
      ); // ← tambah
      if (hasResumed.current) return; // ← tambah
      hasResumed.current = true; // ← tambah
      const wasCancelled =
        sessionStorage.getItem("ventara_cancelled") === "true"; // ← tambah
      if (wasCancelled) {
        // ← tambah
        sessionStorage.removeItem("ventara_cancelled"); // ← tambah
        return; // ← tambah
      } // ← tambah
      if (didStartManually.current) return;
      if (pollActive.current) return;

      try {
        const res = await fetch("/api/generate-progress");
        const prog = await res.json();

        if (prog.running && !prog.done && !prog.error) {
          // FIX: cek lagi setelah await, karena startGenerate mungkin
          // sudah jalan selama fetch berlangsung (race condition)
          if (pollActive.current) return;
          if (didStartManually.current) return;
          if (pollGeneration.current > 0) return; // ← tambah: kalau startGenerate sudah jalan duluan

          pollActive.current = true;
          const isBest = prog.mode === "best";
          const currentVar = prog.current_var || "";
          const dayInVar = isBest ? ((prog.day - 1) % 7) + 1 : prog.day;

          setGenerate({
            visible: true,
            percent: Math.floor((prog.day / prog.total) * 100),
            status: isBest
              ? `Generating ${currentVar} — Day ${dayInVar}/7`
              : `Generating Day ${prog.day}/${prog.total}`,
            eta: prog.eta,
            elapsed: prog.elapsed,
          });
          pollOnce(); // resume tanpa onDone — refresh = gak ada callback
        }
      } catch {
        // Gagal fetch → diam, jangan tampilin apa-apa
      }
    };
    resume();
  }, [pollOnce]);

  const startGenerate = useCallback(
    async (
      selectedModel: string,
      onDone?: (nlp: string, ensembleSummary: Record<string, any>) => void,
      selectedVar: string = "WS10M",
    ) => {
      // FIX: tandai bahwa generate dipanggil manual supaya resume di useEffect
      // tidak ikut jalan dan menyebabkan dua pollOnce berjalan bersamaan
      console.log("startGenerate called"); // ← tambah
      didStartManually.current = true;
      sessionStorage.removeItem("ventara_cancelled"); // ← tambah
      console.log("selectedVar dikirim:", selectedVar);
      setGenerate({ ...DEFAULT, visible: true });
      try {
        const formData = new FormData();
        formData.append("model", selectedModel);
        formData.append("var", selectedVar);
        const endpoint =
          selectedModel === "best" ? "/api/generate-best" : "/api/generate";
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
    },
    [pollOnce],
  );

  const cancelGenerate = useCallback(async () => {
    pollActive.current = false;
    const username = sessionStorage.getItem("ventara_username") || "";
    sessionStorage.setItem("ventara_cancelled", "true"); // ← tambah
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    didStartManually.current = false;
    try {
      await fetch(`/api/cancel-generate?username=${username}`, {
        method: "POST",
      });

      // Tunggu BE konfirmasi berhenti, max 10 detik
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const res = await fetch("/api/generate-progress");
        const prog = await res.json();
        if (!prog.running || prog.done || prog.error) break;
      }
    } catch (e) {
      console.error("Cancel generate failed:", e);
    } finally {
      setGenerate(DEFAULT);
    }
  }, []);

  return (
    <GenerateContext.Provider
      value={{ generate, startGenerate, cancelGenerate }}
    >
      {children}
    </GenerateContext.Provider>
  );
}

export function useGenerateContext() {
  const ctx = useContext(GenerateContext);
  if (!ctx)
    throw new Error("useGenerateContext must be used inside GenerateProvider");
  return ctx;
}
