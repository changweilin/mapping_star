import type { DrawSummary } from "../types";
import { getSearchStrategyLabel } from "../lib/drawSummary";
import { starModeLabel } from "../lib/starPatterns";
import { formatClockTime, formatElapsedMs } from "../lib/timeFormat";
import { ResultMetric } from "./ResultMetric";

export const DrawSummaryDetails = ({ summary }: { summary: DrawSummary }) => (
  <>
    <div className="draw-summary__metrics">
      <ResultMetric
        label="首個魔法陣"
        value={formatElapsedMs(summary.firstResultElapsedMs)}
      />
      <ResultMetric label="總耗時" value={formatElapsedMs(summary.totalElapsedMs)} />
      <ResultMetric
        label="找到數量"
        value={`${summary.resultCount} 組 / 上限 ${summary.resultLimit}`}
      />
      <ResultMetric
        label="候選點"
        value={`${summary.eligiblePoiCount} / ${summary.totalPoiCount}`}
      />
      <ResultMetric
        label="搜尋下載"
        value={
          summary.searchElapsedMs === null
            ? "不適用"
            : formatElapsedMs(summary.searchElapsedMs)
        }
      />
      <ResultMetric label="最終計算" value={formatElapsedMs(summary.solveElapsedMs)} />
      <ResultMetric
        label="預覽計算"
        value={
          summary.previewSolveCount > 0
            ? `${summary.previewSolveCount} 次 / ${formatElapsedMs(
                summary.previewSolveElapsedMs
              )}`
            : "0 次"
        }
      />
      <ResultMetric label="地圖渲染" value={formatElapsedMs(summary.renderElapsedMs)} />
      <ResultMetric
        label="動畫估計"
        value={formatElapsedMs(summary.estimatedAnimationMs)}
      />
    </div>
    <dl className="draw-summary__details">
      <div>
        <dt>首個完成時間</dt>
        <dd>
          {formatClockTime(summary.firstResultAtIso)}
          {summary.firstResultSourceLabel
            ? ` · ${summary.firstResultSourceLabel}`
            : ""}
        </dd>
      </div>
      <div>
        <dt>中心</dt>
        <dd>
          {summary.centerLabel} · {summary.centerCoordinate}
        </dd>
      </div>
      <div>
        <dt>範圍與模式</dt>
        <dd>
          {summary.radiusRangeLabel} · {starModeLabel(summary.mode)} ·{" "}
          {getSearchStrategyLabel(summary)}
        </dd>
      </div>
      <div>
        <dt>搜尋參數</dt>
        <dd>
          角度 ±{summary.angleToleranceDeg.toFixed(0)}° · 每角{" "}
          {summary.candidatesPerSlot} 點 · 旋轉步距 {summary.rotationStepDeg}°
        </dd>
      </div>
      <div>
        <dt>資料統計</dt>
        <dd>
          {summary.fetchedPoiCount === null
            ? "使用目前點位"
            : `本次取得 ${summary.fetchedPoiCount} 筆，新增 ${summary.addedPoiCount} 筆`}
          {summary.categoryCount === null
            ? ""
            : ` · 類別 ${summary.categoryCount} 個`}
          {summary.warningCount > 0 ? ` · 提醒 ${summary.warningCount} 則` : ""}
        </dd>
      </div>
      <div>
        <dt>動畫設定</dt>
        <dd>
          {summary.animationLabel} · {summary.magicSpeed}x
        </dd>
      </div>
    </dl>
    {summary.notes.length > 0 && (
      <p className="draw-summary__notes">{summary.notes.join(" ")}</p>
    )}
  </>
);
