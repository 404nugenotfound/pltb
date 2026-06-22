export interface UsageLog {
  id: string;
  username: string;
  featureName: string;
  timestamp: string;
  location: string;
}

export const trackUsage = (
  username: string,
  featureName: string,
  location: string = "Unknown"
) => {
  try {
    const existingLogs: UsageLog[] = JSON.parse(
      localStorage.getItem("ventara-usage-logs") || "[]"
    );

    const newLog: UsageLog = {
      id: Date.now().toString(),
      username,
      featureName,
      timestamp: new Date().toISOString(),
      location,
    };

    existingLogs.unshift(newLog);

    localStorage.setItem(
      "ventara-usage-logs",
      JSON.stringify(existingLogs.slice(0, 1000))
    );
  } catch (err) {
    console.error("Failed to track usage:", err);
  }
};