import React, { useState } from 'react';
import {
  ValuationRecord,
  FeatureImportanceItem,
  computePredictedPriceCr,
  classifyOutlierStatus,
  getValuationGapLeaderboard,
} from '../utils/valuationLogic';

interface CA2VisualizationsViewProps {
  records: ValuationRecord[];
  allRecords: ValuationRecord[];
  featureImportances: FeatureImportanceItem[];
  purseCr: number;
  onSelectPlayer: (id: string) => void;
}

export const CA2VisualizationsView: React.FC<CA2VisualizationsViewProps> = ({
  records,
  allRecords,
  featureImportances,
  purseCr,
  onSelectPlayer,
}) => {
  const [scatterScale, setScatterScale] = useState<'crores' | 'log'>('crores');
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [useFilteredForPlots, setUseFilteredForPlots] = useState<boolean>(true);

  const activeData =
    useFilteredForPlots && records.length >= 2 ? records : allRecords;

  const { topOvervalued, topUndervalued } = getValuationGapLeaderboard(
    activeData,
    5
  );

  const leaderboardCombined = [
    ...topOvervalued,
    ...[...topUndervalued].reverse(),
  ];

  const maxAbsGap = Math.max(
    ...leaderboardCombined.map((r) => Math.abs(r.gap_percentage)),
    100
  );

  // Scatter plot coordinate math
  const svgWidth = 680;
  const svgHeight = 420;
  const padLeft = 64;
  const padRight = 34;
  const padTop = 28;
  const padBottom = 52;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const maxCrores = Math.max(
    ...activeData.map((r) =>
      Math.max(r.sold_price_cr, computePredictedPriceCr(r, purseCr))
    ),
    25
  ) * 1.08;

  const minLog = -6.8;
  const maxLog = -1.2;

  const mapX = (r: ValuationRecord) => {
    if (scatterScale === 'crores') {
      const predCr = computePredictedPriceCr(r, purseCr);
      return padLeft + (predCr / maxCrores) * plotW;
    } else {
      return (
        padLeft +
        ((r.predicted_ln_price - minLog) / (maxLog - minLog)) * plotW
      );
    }
  };

  const mapY = (r: ValuationRecord) => {
    if (scatterScale === 'crores') {
      return padTop + plotH - (r.sold_price_cr / maxCrores) * plotH;
    } else {
      return (
        padTop +
        plotH -
        ((r.ln_price_to_purse - minLog) / (maxLog - minLog)) * plotH
      );
    }
  };

  const hoveredRecord = activeData.find((r) => r.id === hoveredPointId) || null;

  return (
    <div className="space-y-6">
      {/* Visualization Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-lg px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            CA2 Empirical Report Visualizations (Matplotlib &amp; Seaborn Specification)
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Interactive renderings of the 3 required CA2 report figures from Step 5 (LeaveOneGroupOut CV on [2022, 2023, 2024]).
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div
            role="group"
            aria-label="Visualization Dataset Scope"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200"
          >
            <button
              type="button"
              onClick={() => setUseFilteredForPlots(true)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                useFilteredForPlots
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sidebar Filtered ({records.length})
            </button>
            <button
              type="button"
              onClick={() => setUseFilteredForPlots(false)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                !useFilteredForPlots
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Pipeline ({allRecords.length})
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Chart 1 (Feature Importance) and Chart 2 (Predicted vs Actual Scatter) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* CHART 1: Feature Importance Bar Chart */}
        <section
          aria-label="Random Forest Feature Importance Bar Chart"
          className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs text-slate-500">
                  01. CA2 Report Figure 1 · RandomForestRegressor (LOGO-CV)
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Random Forest Feature Importance
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                Mean MDI ± CV Std
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {featureImportances.map((item, idx) => {
                const widthPct = Math.min(100, (item.importance / 21.0) * 100);
                const stdWidthPct = (item.std / 21.0) * 100;
                const barColor =
                  idx < 3
                    ? 'bg-blue-800'
                    : idx < 6
                    ? 'bg-blue-600'
                    : idx < 9
                    ? 'bg-teal-600'
                    : 'bg-slate-500';

                return (
                  <div key={item.feature} className="group">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-800 truncate pr-2">
                        {item.label}
                      </span>
                      <span className="font-mono text-slate-700 tabular-nums shrink-0 font-semibold">
                        {item.importance.toFixed(1)}%{' '}
                        <span className="text-slate-400 font-normal">
                          ±{item.std.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <div className="relative h-5 bg-slate-100 rounded-xs overflow-hidden border border-slate-200/70">
                      <div
                        className={`h-full ${barColor} transition-transform duration-150`}
                        style={{ width: `${widthPct}%` }}
                      />
                      {/* Error whisker bar */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-slate-900"
                        style={{
                          left: `${Math.max(0, widthPct - stdWidthPct)}%`,
                          width: `${stdWidthPct * 2}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Target: ln_price_to_purse · Groups: [2022, 2023, 2024]</span>
            <span>Top Predictor: is_capped (18.4%) &amp; strike_rate (15.6%)</span>
          </div>
        </section>

        {/* CHART 2: Predicted vs Actual Price Scatter Plot */}
        <section
          aria-label="Predicted vs Actual Price Scatter Plot"
          className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs text-slate-500">
                  02. CA2 Report Figure 2 · Parity &amp; Outlier Diagnostics
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Predicted vs. Actual Auction Price Scatter Plot
                </h3>
              </div>

              <div
                role="group"
                aria-label="Scatter Plot Scale"
                className="flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200"
              >
                <button
                  type="button"
                  onClick={() => setScatterScale('crores')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    scatterScale === 'crores'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ₹ Crores Scale
                </button>
                <button
                  type="button"
                  onClick={() => setScatterScale('log')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    scatterScale === 'log'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Log Ratio (ln)
                </button>
              </div>
            </div>

            <div className="mt-4 relative">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto bg-slate-50/50 border border-slate-200 rounded"
                role="img"
                aria-label="Scatter plot comparing model predicted price on X axis against actual sold price on Y axis"
              >
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                  const yPos = padTop + plotH * (1 - t);
                  const xPos = padLeft + plotW * t;
                  const tickVal =
                    scatterScale === 'crores'
                      ? `₹${(t * maxCrores).toFixed(0)}`
                      : (minLog + t * (maxLog - minLog)).toFixed(1);

                  return (
                    <g key={t}>
                      <line
                        x1={padLeft}
                        y1={yPos}
                        x2={padLeft + plotW}
                        y2={yPos}
                        stroke="#E2E8F0"
                        strokeDasharray="4 4"
                      />
                      <line
                        x1={xPos}
                        y1={padTop}
                        x2={xPos}
                        y2={padTop + plotH}
                        stroke="#E2E8F0"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={padLeft - 8}
                        y={yPos + 4}
                        textAnchor="end"
                        className="text-[10px] fill-slate-500 font-mono"
                      >
                        {tickVal}
                      </text>
                      <text
                        x={xPos}
                        y={padTop + plotH + 16}
                        textAnchor="middle"
                        className="text-[10px] fill-slate-500 font-mono"
                      >
                        {tickVal}
                      </text>
                    </g>
                  );
                })}

                {/* 1:1 Fair Parity Diagonal Line */}
                <line
                  x1={padLeft}
                  y1={padTop + plotH}
                  x2={padLeft + plotW}
                  y2={padTop}
                  stroke="#0F172A"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
                <text
                  x={padLeft + plotW - 10}
                  y={padTop + 18}
                  textAnchor="end"
                  className="text-[10px] fill-slate-700 font-semibold"
                >
                  1:1 Fair Value Parity Line (Actual = Predicted)
                </text>

                {/* Data Points */}
                {activeData.map((r) => {
                  const cx = mapX(r);
                  const cy = mapY(r);
                  const status = classifyOutlierStatus(r);
                  const fill =
                    status === 'overvalued'
                      ? '#DC2626'
                      : status === 'undervalued'
                      ? '#16A34A'
                      : '#334155';

                  const labelOffsets: Record<string, { dx: number; dy: number; anchor?: 'start' | 'end' }> = {
                    'mitchell-starc-2024': { dx: 8, dy: 4 },
                    'jasprit-bumrah-2022': { dx: 8, dy: -4 },
                    'pat-cummins-2024': { dx: -8, dy: 5, anchor: 'end' },
                    'sam-curran-2023': { dx: 8, dy: 4 },
                    'ben-stokes-2023': { dx: 8, dy: 4 },
                    'ishan-kishan-2022': { dx: -8, dy: 4, anchor: 'end' },
                    'alzarri-joseph-2024': { dx: -8, dy: 4, anchor: 'end' },
                    'virat-kohli-2022': { dx: -8, dy: -5, anchor: 'end' },
                    'lokesh-rahul-2022': { dx: 8, dy: -4 },
                    'tilak-varma-2022': { dx: -8, dy: -5, anchor: 'end' },
                    'rinku-singh-2023': { dx: 8, dy: 4 },
                    'shashank-singh-2024': { dx: -8, dy: -5, anchor: 'end' },
                  };

                  const labelCfg = labelOffsets[r.id];

                  return (
                    <g
                      key={r.id}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPointId(r.id)}
                      onMouseLeave={() => setHoveredPointId(null)}
                      onClick={() => onSelectPlayer(r.id)}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r.is_outlier === 1 ? 6.5 : 5}
                        fill={fill}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      {labelCfg && (
                        <text
                          x={cx + labelCfg.dx}
                          y={cy + labelCfg.dy}
                          textAnchor={labelCfg.anchor || 'start'}
                          className="text-[9.5px] fill-slate-800 font-medium select-none"
                        >
                          {r.player.split(' ').pop()} ({String(r.year).slice(2)})
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Axis Titles */}
                <text
                  x={padLeft + plotW / 2}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  className="text-[11px] fill-slate-700 font-semibold"
                >
                  {scatterScale === 'crores'
                    ? 'Model Predicted Fair Price (₹ Crores)'
                    : 'Model Predicted Log Ratio (predicted_ln_price)'}
                </text>
                <text
                  x={16}
                  y={padTop + plotH / 2}
                  textAnchor="middle"
                  transform={`rotate(-90, 16, ${padTop + plotH / 2})`}
                  className="text-[11px] fill-slate-700 font-semibold"
                >
                  {scatterScale === 'crores'
                    ? 'Actual Sold Price (₹ Crores)'
                    : 'Actual Log Ratio (ln_price_to_purse)'}
                </text>
              </svg>

              {/* Hover Inspector Readout */}
              <div className="mt-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs flex flex-wrap items-center justify-between gap-2">
                {hoveredRecord ? (
                  <>
                    <span className="font-semibold text-slate-900">
                      {hoveredRecord.player} ({hoveredRecord.year}) ·{' '}
                      {hoveredRecord.dominant_archetype}
                    </span>
                    <span className="font-mono tabular-nums text-slate-700">
                      Sold: ₹{hoveredRecord.sold_price_cr.toFixed(2)}Cr · Fair: ₹
                      {computePredictedPriceCr(hoveredRecord, purseCr).toFixed(2)}Cr ·
                      Gap: {hoveredRecord.gap_percentage >= 0 ? '+' : ''}
                      {hoveredRecord.gap_percentage.toFixed(1)}% · z=
                      {hoveredRecord.z_score >= 0 ? '+' : ''}
                      {hoveredRecord.z_score.toFixed(2)}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-600">
                    Hover or click any point on the scatter plot to inspect player residual diagnostics and load their bid ceiling.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                <span>Overvalued Outlier (z &gt; +1.96)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                <span>Undervalued Outlier (z &lt; -1.96)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
                <span>Fair Band</span>
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* CHART 3: Valuation Gap Leaderboard (Horizontal Bar Chart of Top 5 Overvalued & Top 5 Undervalued) */}
      <section
        aria-label="Valuation Gap Leaderboard"
        className="bg-white border border-slate-200 rounded-lg p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <span className="text-xs text-slate-500">
              03. CA2 Report Figure 3 · Diverging Horizontal Bar Chart
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Valuation Gap Leaderboard: Top 5 Most Overvalued vs. Top 5 Most Undervalued Players
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-red-600 inline-block" />
              <span>Top 5 Overvalued (+Gap %)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" />
              <span>Top 5 Undervalued (-Gap %)</span>
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {leaderboardCombined.map((row) => {
            const isOvervalued = row.gap_percentage >= 0;
            const barWidthPct = Math.min(
              48,
              (Math.abs(row.gap_percentage) / maxAbsGap) * 48
            );
            const fairPrice = computePredictedPriceCr(row, purseCr);

            return (
              <div
                key={row.id}
                onClick={() => onSelectPlayer(row.id)}
                className="grid grid-cols-12 items-center gap-3 py-1.5 px-2 rounded hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {/* Player Label */}
                <div className="col-span-4 sm:col-span-3 text-xs font-medium text-slate-900 truncate">
                  {row.player}{' '}
                  <span className="text-slate-500 font-mono">({row.year})</span>
                  <div className="text-[11px] text-slate-500 truncate">
                    {row.dominant_archetype}
                  </div>
                </div>

                {/* Diverging Horizontal Bar Canvas */}
                <div className="col-span-5 sm:col-span-6 relative h-7 bg-slate-100 rounded-xs border border-slate-200/80 flex items-center">
                  {/* Center Zero Axis */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-800 z-10" />

                  {isOvervalued ? (
                    <div
                      className="absolute h-5 bg-red-600 rounded-r-xs"
                      style={{
                        left: '50%',
                        width: `${barWidthPct}%`,
                      }}
                    />
                  ) : (
                    <div
                      className="absolute h-5 bg-emerald-600 rounded-l-xs"
                      style={{
                        right: '50%',
                        width: `${barWidthPct}%`,
                      }}
                    />
                  )}
                </div>

                {/* Telemetry Readout */}
                <div className="col-span-3 text-right font-mono tabular-nums text-xs">
                  <span
                    className={`font-bold ${
                      isOvervalued ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {row.gap_percentage >= 0
                      ? `+${row.gap_percentage.toFixed(1)}%`
                      : `${row.gap_percentage.toFixed(1)}%`}
                  </span>
                  <div className="text-[11px] text-slate-500">
                    ₹{row.sold_price_cr.toFixed(2)}Cr vs ₹{fairPrice.toFixed(2)}Cr (z=
                    {row.z_score >= 0 ? `+${row.z_score.toFixed(2)}` : row.z_score.toFixed(2)})
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
