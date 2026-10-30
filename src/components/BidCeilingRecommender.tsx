import React from 'react';
import {
  ValuationRecord,
  RiskPosture,
  calculateBidRecommendation,
} from '../utils/valuationLogic';
import { Sliders, TrendingUp, TrendingDown, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface BidCeilingRecommenderProps {
  records: ValuationRecord[];
  selectedPlayerId: string;
  onSelectPlayerId: (id: string) => void;
  riskPosture: RiskPosture;
  onChangeRiskPosture: (posture: RiskPosture) => void;
  purseCr: number;
}

export const BidCeilingRecommender: React.FC<BidCeilingRecommenderProps> = ({
  records,
  selectedPlayerId,
  onSelectPlayerId,
  riskPosture,
  onChangeRiskPosture,
  purseCr,
}) => {
  const activeRecord =
    records.find((r) => r.id === selectedPlayerId) || records[0] || null;

  if (!activeRecord) {
    return (
      <section
        aria-label="Bid Ceiling Recommender"
        className="bg-white border border-slate-200 rounded-lg p-6"
      >
        <h2 className="text-base font-semibold text-slate-900">
          Tactical Bid Ceiling Recommender
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          No players match the current filter selection. Reset or broaden the sidebar filters to compute bid recommendations.
        </p>
      </section>
    );
  }

  const rec = calculateBidRecommendation(activeRecord, riskPosture, purseCr);

  const maxScaleCr = Math.max(
    rec.hardWalkAwayCr * 1.15,
    rec.actualSoldPriceCr * 1.15,
    15
  );

  const toPct = (val: number) => Math.min(98, Math.max(2, (val / maxScaleCr) * 100));

  return (
    <section
      aria-label="Bid Ceiling Recommender"
      className="bg-white border border-slate-200 rounded-lg p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Step 5 Random Forest Pricing Engine</span>
            <span aria-hidden="true">·</span>
            <span>Purse Baseline: ₹{purseCr.toFixed(0)} Cr</span>
            <span aria-hidden="true">·</span>
            <span>Archetype Z-Score Calibration</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            Tactical Bid Ceiling Recommender
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <label
              htmlFor="player-bid-select"
              className="text-xs font-medium text-slate-600 mb-1"
            >
              Target Player &amp; Auction Year
            </label>
            <select
              id="player-bid-select"
              value={activeRecord.id}
              onChange={(e) => onSelectPlayerId(e.target.value)}
              className="h-10 px-3 py-1.5 text-sm font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.player} ({r.year}) — {r.dominant_archetype}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-600 mb-1">
              Franchise Risk Posture
            </span>
            <div
              role="group"
              aria-label="Franchise Risk Posture"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200 h-10"
            >
              {(['conservative', 'balanced', 'aggressive'] as RiskPosture[]).map(
                (posture) => (
                  <button
                    key={posture}
                    type="button"
                    onClick={() => onChangeRiskPosture(posture)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 capitalize ${
                      riskPosture === posture
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {posture}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Primary Bid Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
          <div className="text-xs font-medium text-slate-600">
            Model Fair Value (Predicted)
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            ₹{rec.fairValueCr.toFixed(2)} Cr
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
            ln(P/Purse) = {activeRecord.predicted_ln_price.toFixed(4)} · {rec.impliedPurseSharePct.toFixed(1)}% purse
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
          <div className="text-xs font-medium text-slate-600">
            Conservative Entry Target (-0.25σ)
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            ₹{rec.conservativeBidCr.toFixed(2)} Cr
          </div>
          <div className="text-xs text-slate-500 mt-1">
            High-margin value acquisition floor
          </div>
        </div>

        <div className="p-4 bg-slate-900 text-white rounded-md">
          <div className="text-xs font-medium text-slate-300">
            Recommended Bid Ceiling
          </div>
          <div
            data-testid="recommended-ceiling-value"
            className="text-2xl font-bold text-white font-mono tabular-nums mt-1"
          >
            ₹{rec.recommendedCeilingCr.toFixed(2)} Cr
          </div>
          <div className="text-xs text-slate-300 font-mono tabular-nums mt-1">
            {rec.ceilingPurseSharePct.toFixed(1)}% of ₹{purseCr.toFixed(0)} Cr Purse ({riskPosture})
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
          <div className="text-xs font-medium text-slate-600">
            Hard Walk-Away Limit
          </div>
          <div className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
            ₹{rec.hardWalkAwayCr.toFixed(2)} Cr
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
            Actual Sold ({activeRecord.year}): ₹{rec.actualSoldPriceCr.toFixed(2)} Cr
          </div>
        </div>
      </div>

      {/* Bid Spectrum Ruler */}
      <div className="mt-6 pt-5 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold text-slate-700">
            Auction Valuation &amp; Bid Ceiling Spectrum (₹0 Cr — ₹{maxScaleCr.toFixed(1)} Cr)
          </span>
          <div className="flex items-center gap-4 text-xs text-slate-600 font-mono tabular-nums">
            <span>z-score: {rec.zScore >= 0 ? `+${rec.zScore.toFixed(3)}` : rec.zScore.toFixed(3)}</span>
            <span>·</span>
            <span>Gap: {rec.gapPercentage >= 0 ? `+${rec.gapPercentage.toFixed(1)}%` : `${rec.gapPercentage.toFixed(1)}%`}</span>
            <span>·</span>
            <span>Residual: {activeRecord.residual >= 0 ? `+${activeRecord.residual.toFixed(3)}` : activeRecord.residual.toFixed(3)}</span>
          </div>
        </div>

        <div className="relative h-12 bg-slate-100 rounded-md border border-slate-200 overflow-hidden">
          {/* Fair to Ceiling Recommended Zone */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/20 border-x border-emerald-600/40"
            style={{
              left: `${toPct(rec.conservativeBidCr)}%`,
              width: `${Math.max(2, toPct(rec.recommendedCeilingCr) - toPct(rec.conservativeBidCr))}%`,
            }}
            title="Recommended Bidding Zone"
          />

          {/* Stretch to Walk-Away Caution Zone */}
          <div
            className="absolute top-0 bottom-0 bg-amber-500/20 border-r border-red-600/40"
            style={{
              left: `${toPct(rec.recommendedCeilingCr)}%`,
              width: `${Math.max(1, toPct(rec.hardWalkAwayCr) - toPct(rec.recommendedCeilingCr))}%`,
            }}
            title="Stretch / Overpay Caution Zone"
          />

          {/* Marker: Fair Value */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-700"
            style={{ left: `${toPct(rec.fairValueCr)}%` }}
          >
            <span className="absolute top-1 left-1.5 text-[11px] font-mono font-semibold text-slate-700 whitespace-nowrap">
              Fair ₹{rec.fairValueCr.toFixed(1)}Cr
            </span>
          </div>

          {/* Marker: Recommended Ceiling */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-950"
            style={{ left: `${toPct(rec.recommendedCeilingCr)}%` }}
          >
            <span className="absolute bottom-1 left-1.5 text-[11px] font-mono font-bold text-slate-950 whitespace-nowrap">
              Ceiling ₹{rec.recommendedCeilingCr.toFixed(1)}Cr
            </span>
          </div>

          {/* Marker: Actual Sold Price */}
          <div
            className={`absolute top-0 bottom-0 w-1 ${
              rec.outlierDirection === 'overvalued'
                ? 'bg-red-600'
                : rec.outlierDirection === 'undervalued'
                ? 'bg-emerald-600'
                : 'bg-blue-600'
            }`}
            style={{ left: `${toPct(rec.actualSoldPriceCr)}%` }}
          >
            <span
              className={`absolute top-1 right-1.5 text-[11px] font-mono font-bold whitespace-nowrap px-1 rounded ${
                rec.outlierDirection === 'overvalued'
                  ? 'text-red-800 bg-red-100'
                  : rec.outlierDirection === 'undervalued'
                  ? 'text-emerald-800 bg-emerald-100'
                  : 'text-blue-800 bg-blue-100'
              }`}
            >
              Sold ₹{rec.actualSoldPriceCr.toFixed(2)}Cr
            </span>
          </div>
        </div>
      </div>

      {/* Verdict & Underlying Player Telemetry */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className={`lg:col-span-2 p-4 rounded-md border ${
            rec.outlierDirection === 'undervalued'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : rec.outlierDirection === 'overvalued'
              ? 'bg-red-50/70 border-red-200 text-red-950'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            {rec.outlierDirection === 'undervalued' ? (
              <TrendingDown className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : rec.outlierDirection === 'overvalued' ? (
              <ShieldAlert className="w-4 h-4 text-red-700 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0" />
            )}
            <span>{rec.valuationVerdict}</span>
          </div>
          <p className="text-sm mt-1.5 leading-relaxed opacity-90">
            {rec.tacticalRationale}
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-md flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Random Forest Input Features ({activeRecord.player})</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Strike Rate:</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {activeRecord.strike_rate.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Batting Avg:</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {activeRecord.average.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Boundary %:</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {activeRecord.boundary_pct.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Six %:</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {activeRecord.six_pct.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Capped / Overseas:</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {activeRecord.is_capped ? 'Capped' : 'Uncapped'} · {activeRecord.is_overseas ? 'OS' : 'IND'}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Economy / Wkts:</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {activeRecord.economy_rate > 0
                  ? `${activeRecord.economy_rate.toFixed(2)} (${activeRecord.wickets_per_match.toFixed(1)}/m)`
                  : 'Bat-Primary'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
