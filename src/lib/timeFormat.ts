export const formatElapsedMs = (valueMs: number | null | undefined) => {
  if (valueMs === null || valueMs === undefined) return "尚未產生";

  const safeValueMs = Math.max(0, valueMs);
  if (safeValueMs < 1000) return `${Math.round(safeValueMs)} ms`;
  if (safeValueMs < 10000) return `${(safeValueMs / 1000).toFixed(2)} 秒`;
  if (safeValueMs < 60000) return `${(safeValueMs / 1000).toFixed(1)} 秒`;

  const minutes = Math.floor(safeValueMs / 60000);
  const seconds = ((safeValueMs % 60000) / 1000).toFixed(1);
  return `${minutes} 分 ${seconds} 秒`;
};

export const formatClockTime = (isoValue: string | null | undefined) => {
  if (!isoValue) return "尚未產生";

  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(isoValue));
};
