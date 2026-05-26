import { Sparkles } from "lucide-react";
import { formatDistance } from "../lib/geo";
import type { StarResultAggregateStats } from "../types";
import { ResultMetric } from "./ResultMetric";

type ResultAggregateSummaryProps = {
  stats: StarResultAggregateStats;
};

export const ResultAggregateSummary = ({
  stats
}: ResultAggregateSummaryProps) => (
  <div className="result-summary">
    <div className="subsection-title">
      <Sparkles aria-hidden="true" />
      <strong>平均統計</strong>
    </div>
    <div className="metrics-row">
      <ResultMetric label="結果數" value={`${stats.count} 組`} />
      <ResultMetric
        label="平均半徑"
        value={formatDistance(stats.averageRadiusMeters)}
      />
      <ResultMetric
        label="平均圓周誤差"
        value={formatDistance(stats.averageCircumferenceErrorMeters)}
      />
      <ResultMetric
        label="平均角度誤差"
        value={`${stats.averageAngleErrorDeg.toFixed(1)}°`}
      />
      <ResultMetric
        label="平均中心誤差"
        value={formatDistance(stats.averageCenterErrorMeters)}
      />
      <ResultMetric label="平均分數" value={stats.averageScore.toFixed(3)} />
    </div>
  </div>
);
