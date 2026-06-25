// app/components/training/GenerateBanner.tsx
"use client";
import { useGenerateContext } from "@/app/context/GenerateContext";
import ProgressToast from "@/app/components/toast/ProgressToast";

export default function GenerateBanner() {
  const { generate, cancelGenerate } = useGenerateContext();
  return (
    <ProgressToast
      visible={generate.visible}
      percent={generate.percent}
      status={generate.status}
      eta={generate.eta}
      elapsed={generate.elapsed}
      onCancel={cancelGenerate}
    />
  );
}