import { ChevronDown, ChevronUp } from "lucide-react";

export type StarResultSortKey =
  | "score"
  | "radius"
  | "angle"
  | "circumference-error"
  | "center-error";
export type StarResultSortDirection = "asc" | "desc";

const STAR_RESULT_SORT_OPTIONS = [
  { id: "score", label: "分數" },
  { id: "radius", label: "半徑" },
  { id: "angle", label: "角度" },
  { id: "circumference-error", label: "圓周誤差" },
  { id: "center-error", label: "中心誤差" }
] satisfies Array<{ id: StarResultSortKey; label: string }>;

type ResultSortToolbarProps = {
  count: number;
  sortKey: StarResultSortKey;
  sortDirection: StarResultSortDirection;
  onSortSelect: (sortKey: StarResultSortKey) => void;
};

export const ResultSortToolbar = ({
  count,
  sortKey,
  sortDirection,
  onSortSelect
}: ResultSortToolbarProps) => (
  <div className="result-toolbar">
    <div
      className="result-sort-grid"
      role="group"
      aria-label="星形結果排序"
    >
      <span className="result-sort-label">排序</span>
      {STAR_RESULT_SORT_OPTIONS.map((option) => (
        <button
          aria-pressed={sortKey === option.id}
          className={`result-sort-button ${
            sortKey === option.id ? "active" : ""
          }`}
          key={option.id}
          type="button"
          title={`依${option.label}${
            sortKey === option.id && sortDirection === "asc"
              ? "反向"
              : "順向"
          }排序`}
          onClick={() => onSortSelect(option.id)}
        >
          <span>{option.label}</span>
          {sortKey === option.id ? (
            sortDirection === "asc" ? (
              <ChevronUp aria-hidden="true" size={14} />
            ) : (
              <ChevronDown aria-hidden="true" size={14} />
            )
          ) : null}
        </button>
      ))}
    </div>
    <span className="result-toolbar__count">
      內外半徑內 {count} 組
    </span>
  </div>
);
