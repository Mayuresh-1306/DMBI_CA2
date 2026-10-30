import React, { useState } from 'react';
import {
  ValuationRecord,
  computePredictedPriceCr,
  classifyOutlierStatus,
} from '../utils/valuationLogic';
import { ArrowUpDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ValuationDataframeProps {
  records: ValuationRecord[];
  selectedPlayerId: string;
  onSelectPlayer: (id: string) => void;
  purseCr: number;
}

type SortField =
  | 'player'
  | 'year'
  | 'dominant_archetype'
  | 'sold_price_cr'
  | 'predicted_price_cr'
  | 'predicted_ln_price'
  | 'gap_percentage'
  | 'z_score'
  | 'is_outlier';

export const ValuationDataframe: React.FC<ValuationDataframeProps> = ({
  records,
  selectedPlayerId,
  onSelectPlayer,
  purseCr,
}) => {
  const [sortField, setSortField] = useState<SortField>('z_score');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'player' || field === 'dominant_archetype');
    }
  };

  const sortedRecords = [...records].sort((a, b) => {
    let valA: string | number;
    let valB: string | number;

    if (sortField === 'predicted_price_cr') {
      valA = computePredictedPriceCr(a, purseCr);
      valB = computePredictedPriceCr(b, purseCr);
    } else {
      valA = a[sortField];
      valB = b[sortField];
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc
      ? Number(valA) - Number(valB)
      : Number(valB) - Number(valA);
  });

  return (
    <section
      aria-label="Valuation Results Dataframe"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Valuation Pipeline Dataframe (valuation_results.csv)
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Click any player row to load their profile into the Bid Ceiling Recommender. Statistical outliers (is_outlier = 1) are highlighted in semantic Green (Undervalued, z &lt; 0) and Red (Overvalued, z &gt; 0).
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-100 border border-emerald-600 inline-block" />
            <span>Undervalued Outlier (z &lt; -1.96)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-red-100 border border-red-600 inline-block" />
            <span>Overvalued Outlier (z &gt; +1.96)</span>
          </span>
        </div>
      </div>

      {sortedRecords.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No player records match your active archetype or year filters.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Use the sidebar filter controls to select additional years or archetypes.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('player')}
                    className="flex items-center gap-1 hover:text-slate-900 whitespace-nowrap"
                  >
                    <span>Player</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleSort('year')}
                    className="flex items-center gap-1 hover:text-slate-900 whitespace-nowrap"
                  >
                    <span>Year</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleSort('dominant_archetype')}
                    className="flex items-center gap-1 hover:text-slate-900 whitespace-nowrap"
                  >
                    <span>Dominant Archetype</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('sold_price_cr')}
                    className="flex items-center justify-end gap-1 ml-auto hover:text-slate-900 whitespace-nowrap"
                  >
                    <span>Sold Price (Cr)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('predicted_price_cr')}
                    className="flex items-center justify-end gap-1 ml-auto hover:text-slate-900 whitespace-nowrap"
                  >
                    <span>Predicted Fair (Cr)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('predicted_ln_price')}
                    className="flex items-center justify-end gap-1 ml-auto hover:text-slate-900 whitespace-nowrap"
                  >
                    <span>pred_ln_price</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('gap_percentage')}
                    className="flex items-center justify-end gap-1 ml-auto hover:text-slate-900 whitespace-nowrap"
                  >
                    <span>Valuation Gap %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('z_score')}
                    className="flex items-center justify-end gap-1 ml-auto hover:text-slate-900 whitespace-nowrap"
                  >
                    <span>z_score</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-4 text-left">
                  <button
                    type="button"
                    onClick={() => handleSort('is_outlier')}
                    className="flex items-center gap-1 hover:text-slate-900 whitespace-nowrap"
                  >
                    <span>Outlier Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {sortedRecords.map((row) => {
                const fairCr = computePredictedPriceCr(row, purseCr);
                const status = classifyOutlierStatus(row);
                const isSelected = row.id === selectedPlayerId;

                const rowBgClass =
                  status === 'undervalued'
                    ? 'bg-emerald-50/90 hover:bg-emerald-100/80 text-emerald-950'
                    : status === 'overvalued'
                    ? 'bg-red-50/90 hover:bg-red-100/80 text-red-950'
                    : 'bg-white hover:bg-slate-50 text-slate-800';

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectPlayer(row.id)}
                    data-outlier-status={status}
                    className={`cursor-pointer transition-colors ${rowBgClass} ${
                      isSelected ? 'ring-2 ring-inset ring-slate-900 font-semibold' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-medium whitespace-nowrap">
                      {row.player}
                      <span className="text-[11px] text-slate-500 ml-1.5 font-normal">
                        {row.is_overseas ? 'OS' : 'IND'} · {row.is_capped ? 'Capped' : 'Uncapped'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                      {row.year}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                      {row.dominant_archetype}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap font-medium">
                      ₹{row.sold_price_cr.toFixed(2)} Cr
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      ₹{fairCr.toFixed(2)} Cr
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-600">
                      {row.predicted_ln_price.toFixed(4)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap font-semibold ${
                        row.gap_percentage > 25
                          ? 'text-red-700'
                          : row.gap_percentage < -25
                          ? 'text-emerald-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {row.gap_percentage >= 0
                        ? `+${row.gap_percentage.toFixed(2)}%`
                        : `${row.gap_percentage.toFixed(2)}%`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap font-medium">
                      {row.z_score >= 0
                        ? `+${row.z_score.toFixed(3)}`
                        : row.z_score.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {status === 'undervalued' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                          <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                          <span>1 · Undervalued Outlier</span>
                        </span>
                      ) : status === 'overvalued' ? (
                        <span className="inline-flex items-center gap-1 text-red-800 font-semibold">
                          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                          <span>1 · Overvalued Outlier</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Minus className="w-3.5 h-3.5 shrink-0" />
                          <span>0 · Fair Band</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
