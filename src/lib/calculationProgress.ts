import type { SolveProgress } from "./solver";
import type { SearchStrategy } from "../types";

export type CalculationProgress = {
  label: string;
  percent: number;
};

export const interpolateProgress = (
  startPercent: number,
  endPercent: number,
  completed: number,
  total: number
) => {
  const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, completed / total));
  return startPercent + (endPercent - startPercent) * ratio;
};

export const getCategoryDownloadProgressPercent = (
  searchStrategy: SearchStrategy,
  completedCategories: number,
  totalCategories: number
) =>
  searchStrategy === "honeycomb"
    ? interpolateProgress(34, 58, completedCategories, totalCategories)
    : interpolateProgress(34, 66, completedCategories, totalCategories);

export const getAnalyzeProgressPercent = (searchStrategy: SearchStrategy) =>
  searchStrategy === "honeycomb" ? 62 : 68;

export const getSolveProgressPercent = (
  searchStrategy: SearchStrategy,
  progress: SolveProgress
) =>
  searchStrategy === "honeycomb"
    ? interpolateProgress(64, 90, progress.completedSteps, progress.totalSteps)
    : interpolateProgress(70, 88, progress.completedSteps, progress.totalSteps);

export const getSolveProgressLabel = (progress: SolveProgress) => {
  const resultText =
    progress.results.length > 0 ? ` · 暫得 ${progress.results.length} 組` : "";
  return `${progress.label}${resultText}`;
};
