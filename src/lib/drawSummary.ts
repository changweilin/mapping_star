import { starModeLabel } from "./starPatterns";
import { formatClockTime, formatElapsedMs } from "./timeFormat";
import type { CalculationRecord, DrawSummary, SearchStrategy } from "../types";

export const getSearchStrategyLabel = ({
  searchStrategy,
  hexCellRadiusKm
}: {
  searchStrategy: SearchStrategy;
  hexCellRadiusKm: number;
}) => (searchStrategy === "honeycomb" ? `蜂巢 ${hexCellRadiusKm} km` : "角度");

export const formatDrawSummaryProgressLabel = (summary: DrawSummary) =>
  summary.resultCount > 0
    ? `魔法陣完成 · ${summary.resultCount} 組 · ${formatElapsedMs(
        summary.totalElapsedMs
      )}`
    : `計算完成 · 0 組 · ${formatElapsedMs(summary.totalElapsedMs)}`;

export const formatDrawSummaryStatus = (summary: DrawSummary) => {
  const starLabel = starModeLabel(summary.mode);
  const firstResultText =
    summary.firstResultElapsedMs === null
      ? "未產生第一個魔法陣"
      : `${formatElapsedMs(summary.firstResultElapsedMs)}（${formatClockTime(
          summary.firstResultAtIso
        )}）`;
  const resultText =
    summary.resultCount > 0
      ? `共找到 ${summary.resultCount} 組${starLabel}魔法陣`
      : `未找到符合條件的${starLabel}魔法陣`;
  const warningText =
    summary.warningCount > 0 ? `；另有 ${summary.warningCount} 則提醒` : "";

  return `${summary.sourceLabel}完成：首個 ${firstResultText}，總耗時 ${formatElapsedMs(
    summary.totalElapsedMs
  )}，${resultText}。候選點 ${summary.eligiblePoiCount}/${
    summary.totalPoiCount
  }，範圍 ${summary.radiusRangeLabel}，策略 ${getSearchStrategyLabel(
    summary
  )}${warningText}。`;
};

export const makeCalculationRecordFromSummary = (
  summary: DrawSummary
): CalculationRecord => {
  const status = summary.resultCount > 0 ? "completed" : "empty";

  return {
    id: summary.id,
    status,
    sourceLabel: summary.sourceLabel,
    title:
      status === "completed"
        ? `${summary.sourceLabel}完成`
        : `${summary.sourceLabel}完成，尚無魔法陣`,
    message: formatDrawSummaryStatus(summary),
    startedAtIso: summary.startedAtIso,
    finishedAtIso: summary.finishedAtIso,
    totalElapsedMs: summary.totalElapsedMs,
    summary
  };
};

export const makeCalculationMessageRecord = ({
  status,
  sourceLabel,
  title,
  message,
  startedAtIso,
  startedAtMs,
  finishedAtMs
}: {
  status: "cancelled" | "failed";
  sourceLabel: string;
  title: string;
  message: string;
  startedAtIso: string;
  startedAtMs: number;
  finishedAtMs: number;
}): CalculationRecord => ({
  id: `calculation-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  status,
  sourceLabel,
  title,
  message,
  startedAtIso,
  finishedAtIso: new Date().toISOString(),
  totalElapsedMs: finishedAtMs - startedAtMs,
  summary: null
});
