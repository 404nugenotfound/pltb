"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  fetchTrainProgress,
  clearTrainProgress,
  cancelTraining as cancelTrainingApi,
} from "@/app/lib/api";

interface TrainingState {
  isTraining: boolean;
  step: string;
  progress: number;
  logs: string[];
  footer: string;
}

interface TrainingContextValue {
  training: TrainingState;
  startTraining: (onComplete?: () => void) => void;
  stopTraining: () => void;
  cancelTraining: () => Promise<void>;
}

const DEFAULT_STATE: TrainingState = {
  isTraining: false,
  step: "",
  progress: 0,
  logs: [],
  footer: "",
};

const TRAIN_STEPS = [
  "Load dataset",
  "Training GBR",
  "Training XGBoost",
  "Training KNN",
  "Training LSTM",
  "Training BiLSTM",
  "Update globals",
  "Selesai",
];

function calcProgress(step: string, done: boolean): number {
  if (done) return 100;
  const idx = TRAIN_STEPS.findIndex((s) =>
    step.toLowerCase().includes(s.toLowerCase())
  );
  return idx >= 0 ? Math.round(((idx + 1) / TRAIN_STEPS.length) * 100) : 10;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const [training, setTraining] = useState<TrainingState>(DEFAULT_STATE);


  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTraining = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setTraining(DEFAULT_STATE);
  }, []);

  const poll = useCallback((onComplete?: () => void) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      try {
        const username = sessionStorage.getItem("ventara_username");
      if (!username) { 
        stopTraining();
        return;
      }
        const data = await fetchTrainProgress();

        const next: TrainingState = {
          isTraining: true,
          step: data.step || "Berjalan...",
          progress: calcProgress(data.step ?? "", data.done),
          logs: data.log?.length ? data.log : [],
          footer: "Jangan tutup halaman ini",
        };

        if (data.done && !data.running) {
          clearInterval(intervalRef.current!);

          if (data.cancelled) {
            await clearTrainProgress();
            stopTraining();
            return;
          }

          if (data.error) {
            stopTraining();
          } else {
            const doneState: TrainingState = {
              ...next,
              progress: 100,
              footer: "✅ Training selesai!",
            };
            setTraining(doneState);

            setTimeout(async () => {
              try { await clearTrainProgress(); } catch {}
              stopTraining();
              onComplete?.();
              window.dispatchEvent(new Event("training-complete"));
            }, 2000);
          }
          return;
        }

        setTraining(next);
      } catch (e) {
        console.log("Train polling skip:", e);
      }
    }, 2000);
  }, [stopTraining]);

  const startTraining = useCallback((onComplete?: () => void) => {
    const initial: TrainingState = {
      isTraining: true,
      step: "Memulai...",
      progress: 0,
      logs: [],
      footer: "Jangan tutup halaman ini",
    };
    setTraining(initial);
    poll(onComplete);
  }, [poll]);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await fetchTrainProgress();

        if (data.running) {
          poll(() => {
            window.dispatchEvent(new Event("training-complete"));  // tetap reload kalau resume dari tab lain
          });
        }
      } catch (err) {
        console.error(err);
      }
    };

    init();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [poll]);
  
  const cancelTraining = useCallback(async () => {
  // Stop polling dulu biar tidak override state
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  try {
    await cancelTrainingApi();
    await clearTrainProgress();
  } catch (e) {
    console.error("Cancel failed:", e);
  } finally {
    // Reset state apapun yang terjadi
    setTraining(DEFAULT_STATE);
  }
}, []);

  return (
    <TrainingContext.Provider
        value={{
          training,
          startTraining,
          stopTraining,
          cancelTraining
        }}
      >
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error("useTraining must be used inside TrainingProvider");
  return ctx;
}