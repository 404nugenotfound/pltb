export const PYTHON_API_URL =
  process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:5000";

export async function uploadDataset(formData: FormData) {
  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const text = await res.text();
  if (!text) throw { message: "Server tidak merespons" };

  try {
    return JSON.parse(text);
  } catch {
    throw { message: "Response server tidak valid" };
  }
}

export function downloadCsv(mode: "general" | "best") {
  window.location.href = `/api/download?mode=${mode}`;
}

export async function fetchTrainProgress() {
  const res = await fetch("/api/train-progress", {
    cache: "no-store",
  });

  return await res.json();
}

export async function cancelTraining() {
  const res = await fetch("/api/cancel-training", {
    method: "POST",
  });

  return await res.json();
}

export async function clearTrainProgress() {
  const res = await fetch("/api/clear-training-progress", {
    method: "POST",
  });

  return await res.json();
}