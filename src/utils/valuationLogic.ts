export interface ValuationRecord {
  id: string;
  player: string;
  year: number;
  ln_price_to_purse: number;
  sold_price_cr: number;
  is_overseas: number;
  is_capped: number;
  strike_rate: number;
  average: number;
  boundary_pct: number;
  six_pct: number;
  economy_rate: number;
  bowling_strike_rate: number;
  dot_ball_pct: number;
  wickets_per_match: number;
  matches_played: number;
  predicted_ln_price: number;
  residual: number;
  gap_percentage: number;
  dominant_archetype: string;
  z_score: number;
  is_outlier: number;
}

export interface FeatureImportanceItem {
  feature: string;
  label: string;
  category: 'Batting' | 'Bowling' | 'Status & Experience' | 'Archetype Encoding';
  importance: number;
  std: number;
}

export type RiskPosture = 'conservative' | 'balanced' | 'aggressive';

export interface BidRecommendation {
  player: string;
  year: number;
  dominantArchetype: string;
  actualSoldPriceCr: number;
  fairValueCr: number;
  conservativeBidCr: number;
  recommendedCeilingCr: number;
  hardWalkAwayCr: number;
  zScore: number;
  gapPercentage: number;
  isOutlier: boolean;
  outlierDirection: 'overvalued' | 'undervalued' | 'fair';
  impliedPurseSharePct: number;
  ceilingPurseSharePct: number;
  valuationVerdict: string;
  tacticalRationale: string;
}

export const DEFAULT_PURSE_CR = 120.0;

/**
 * Derives the model's predicted fair price in ₹ Crores.
 * Uses sold_price_cr / (1 + gap_percentage / 100) when available for exact consistency
 * with the pipeline's year-specific purse, falling back to purseCr * exp(predicted_ln_price).
 */
export function computePredictedPriceCr(
  record: Pick<ValuationRecord, 'sold_price_cr' | 'gap_percentage' | 'predicted_ln_price'>,
  purseCr: number = DEFAULT_PURSE_CR
): number {
  const denominator = 1 + record.gap_percentage / 100;
  if (denominator > 0.0001 && Number.isFinite(record.sold_price_cr) && record.sold_price_cr > 0) {
    return Number((record.sold_price_cr / denominator).toFixed(4));
  }
  return Number((purseCr * Math.exp(record.predicted_ln_price)).toFixed(4));
}

/**
 * Classifies a player row into 'overvalued', 'undervalued', or 'fair'
 * based on is_outlier flag and z_score sign.
 */
export function classifyOutlierStatus(
  record: Pick<ValuationRecord, 'is_outlier' | 'z_score'>
): 'overvalued' | 'undervalued' | 'fair' {
  if (record.is_outlier === 1) {
    return record.z_score >= 0 ? 'overvalued' : 'undervalued';
  }
  return 'fair';
}

/**
 * Computes recommended bid ceiling and tactical auction thresholds for a player
 * based on their predicted_ln_price, residual z_score, archetype, and franchise risk posture.
 *
 * Formula:
 * - Base Fair Value: P_fair = Purse * exp(predicted_ln_price)
 * - Archetype Residual Volatility (sigma_res): estimated from residual / z_score (or 0.68 default in log-price space)
 * - Z-Score dampening factor:
 *   - If player was historically undervalued (z < 0), market inefficiency allows capturing surplus value near fair value.
 *   - If player commands a marquee premium (z > 0), ceiling incorporates bounded market premium up to risk posture cap.
 */
export function calculateBidRecommendation(
  record: ValuationRecord,
  riskPosture: RiskPosture = 'balanced',
  purseCr: number = DEFAULT_PURSE_CR,
  customZBuffer?: number
): BidRecommendation {
  const fairValueCr = computePredictedPriceCr(record, purseCr);

  // Estimate residual standard error in log space from record's residual & z_score
  const estimatedSigmaLog =
    Math.abs(record.z_score) > 0.05
      ? Math.min(Math.max(Math.abs(record.residual / record.z_score), 0.35), 0.95)
      : 0.65;

  // Risk posture z-allowance
  const postureZMultiplier: Record<RiskPosture, number> = {
    conservative: 0.25,
    balanced: 0.60,
    aggressive: 1.00,
  };

  const alphaZ = customZBuffer !== undefined ? customZBuffer : postureZMultiplier[riskPosture];

  // Historical market sentiment adjustment: bounded z-score influence
  const clampedZ = Math.max(-2.0, Math.min(2.0, record.z_score));
  const sentimentAdjustmentLog =
    clampedZ < 0
      ? clampedZ * 0.12 * estimatedSigmaLog // Slight discount leverage when historically underbid
      : clampedZ * 0.18 * estimatedSigmaLog; // Partial market demand buffer when historically overbid

  const conservativeLn = record.predicted_ln_price - 0.25 * estimatedSigmaLog;
  const ceilingLn = record.predicted_ln_price + alphaZ * estimatedSigmaLog + sentimentAdjustmentLog;
  const walkAwayLn = record.predicted_ln_price + (alphaZ + 0.45) * estimatedSigmaLog + Math.max(0, sentimentAdjustmentLog);

  const conservativeBidCr = Number(Math.max(0.2, purseCr * Math.exp(conservativeLn)).toFixed(2));
  const recommendedCeilingCr = Number(Math.max(conservativeBidCr, purseCr * Math.exp(ceilingLn)).toFixed(2));
  const hardWalkAwayCr = Number(Math.max(recommendedCeilingCr, purseCr * Math.exp(walkAwayLn)).toFixed(2));

  const outlierDirection = classifyOutlierStatus(record);
  const impliedPurseSharePct = Number(((fairValueCr / purseCr) * 100).toFixed(2));
  const ceilingPurseSharePct = Number(((recommendedCeilingCr / purseCr) * 100).toFixed(2));

  let valuationVerdict = 'Fair Market Equilibrium';
  let tacticalRationale = '';

  if (record.is_outlier === 1 && record.z_score < 0) {
    valuationVerdict = 'High-Alpha Value Outlier (Undervalued)';
    tacticalRationale = `${record.player} sold at ₹${record.sold_price_cr.toFixed(2)} Cr versus a Random Forest fair valuation of ₹${fairValueCr.toFixed(2)} Cr (z = ${record.z_score.toFixed(2)}). Priority target: bid aggressively up to ₹${recommendedCeilingCr.toFixed(2)} Cr while retaining positive surplus value.`;
  } else if (record.is_outlier === 1 && record.z_score > 0) {
    valuationVerdict = 'Severe Auction Overpay Outlier (Overvalued)';
    tacticalRationale = `${record.player} cleared at ₹${record.sold_price_cr.toFixed(2)} Cr (+${record.gap_percentage.toFixed(1)}% above model fair value of ₹${fairValueCr.toFixed(2)} Cr, z = +${record.z_score.toFixed(2)}). Enforce strict discipline: cap bidding at ₹${recommendedCeilingCr.toFixed(2)} Cr and walk away above ₹${hardWalkAwayCr.toFixed(2)} Cr.`;
  } else if (record.z_score < -0.5) {
    valuationVerdict = 'Undervalued Market Opportunity';
    tacticalRationale = `Historical clearing price (₹${record.sold_price_cr.toFixed(2)} Cr) sits below archetype-adjusted expectation (₹${fairValueCr.toFixed(2)} Cr). Target acquisition between ₹${conservativeBidCr.toFixed(2)} Cr and ₹${recommendedCeilingCr.toFixed(2)} Cr.`;
  } else if (record.z_score > 0.75) {
    valuationVerdict = 'Scarcity Premium Territory';
    tacticalRationale = `Commands an auction scarcity premium (z = +${record.z_score.toFixed(2)}). Model fair value is ₹${fairValueCr.toFixed(2)} Cr; only stretch to ₹${recommendedCeilingCr.toFixed(2)} Cr if ${record.dominant_archetype} is an immediate starting XI gap.`;
  } else {
    valuationVerdict = 'Fair Market Equilibrium';
    tacticalRationale = `Clearing price (₹${record.sold_price_cr.toFixed(2)} Cr) tracks closely with Random Forest LOGO-CV valuation (₹${fairValueCr.toFixed(2)} Cr, z = ${record.z_score.toFixed(2)}). Maintain disciplined ceiling at ₹${recommendedCeilingCr.toFixed(2)} Cr.`;
  }

  return {
    player: record.player,
    year: record.year,
    dominantArchetype: record.dominant_archetype,
    actualSoldPriceCr: Number(record.sold_price_cr.toFixed(2)),
    fairValueCr: Number(fairValueCr.toFixed(2)),
    conservativeBidCr,
    recommendedCeilingCr,
    hardWalkAwayCr,
    zScore: record.z_score,
    gapPercentage: record.gap_percentage,
    isOutlier: record.is_outlier === 1,
    outlierDirection,
    impliedPurseSharePct,
    ceilingPurseSharePct,
    valuationVerdict,
    tacticalRationale,
  };
}

export interface FilterCriteria {
  years: number[];
  archetypes: string[];
  searchQuery: string;
  outlierFilter: 'all' | 'outliers_only' | 'undervalued_outliers' | 'overvalued_outliers';
}

export function filterValuationRecords(
  records: ValuationRecord[],
  criteria: FilterCriteria
): ValuationRecord[] {
  const query = criteria.searchQuery.trim().toLowerCase();

  return records.filter((row) => {
    if (criteria.years.length > 0 && !criteria.years.includes(row.year)) {
      return false;
    }
    if (criteria.archetypes.length > 0 && !criteria.archetypes.includes(row.dominant_archetype)) {
      return false;
    }
    if (query.length > 0) {
      const matchPlayer = row.player.toLowerCase().includes(query);
      const matchArch = row.dominant_archetype.toLowerCase().includes(query);
      const matchYear = String(row.year).includes(query);
      if (!matchPlayer && !matchArch && !matchYear) {
        return false;
      }
    }
    if (criteria.outlierFilter === 'outliers_only' && row.is_outlier !== 1) {
      return false;
    }
    if (criteria.outlierFilter === 'undervalued_outliers' && !(row.is_outlier === 1 && row.z_score < 0)) {
      return false;
    }
    if (criteria.outlierFilter === 'overvalued_outliers' && !(row.is_outlier === 1 && row.z_score > 0)) {
      return false;
    }
    return true;
  });
}

export interface GapLeaderboardResult {
  topOvervalued: ValuationRecord[];
  topUndervalued: ValuationRecord[];
}

/**
 * Computes the Top N Most Overvalued (highest positive gap_percentage)
 * and Top N Most Undervalued (most negative gap_percentage) player records.
 */
export function getValuationGapLeaderboard(
  records: ValuationRecord[],
  topN: number = 5
): GapLeaderboardResult {
  const sortedAsc = [...records].sort((a, b) => a.gap_percentage - b.gap_percentage);
  const sortedDesc = [...records].sort((a, b) => b.gap_percentage - a.gap_percentage);

  const topUndervalued = sortedAsc.slice(0, topN);
  const topOvervalued = sortedDesc.slice(0, topN);

  return {
    topOvervalued,
    topUndervalued,
  };
}

/**
 * Parses CSV text (matching valuation_results.csv schema) into ValuationRecord[].
 */
export function parseValuationCsv(csvText: string): ValuationRecord[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must contain a header row and at least one data row.');
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim());

  const requiredCols = [
    'player',
    'year',
    'sold_price_cr',
    'predicted_ln_price',
    'gap_percentage',
    'dominant_archetype',
    'z_score',
    'is_outlier',
  ];

  for (const col of requiredCols) {
    if (!headers.includes(col)) {
      throw new Error(`Missing required column "${col}" in uploaded CSV.`);
    }
  }

  const idx = (name: string) => headers.indexOf(name);

  return lines.slice(1).map((line, rowIdx) => {
    const cells = line.split(delimiter).map((c) => c.trim());
    const player = cells[idx('player')] || `Player ${rowIdx + 1}`;
    const year = Number(cells[idx('year')]) || 2022;
    const sold_price_cr = Number(cells[idx('sold_price_cr')]) || 0;
    const predicted_ln_price = Number(cells[idx('predicted_ln_price')]) || -2.5;
    const gap_percentage = Number(cells[idx('gap_percentage')]) || 0;
    const dominant_archetype = cells[idx('dominant_archetype')] || 'All-rounders';
    const z_score = Number(cells[idx('z_score')]) || 0;
    const is_outlier = Number(cells[idx('is_outlier')]) === 1 || String(cells[idx('is_outlier')]).toLowerCase() === 'true' ? 1 : 0;

    const ln_price_to_purse =
      idx('ln_price_to_purse') >= 0
        ? Number(cells[idx('ln_price_to_purse')])
        : Math.log(Math.max(sold_price_cr, 0.2) / DEFAULT_PURSE_CR);

    const residual =
      idx('residual') >= 0
        ? Number(cells[idx('residual')])
        : ln_price_to_purse - predicted_ln_price;

    return {
      id: `${player.toLowerCase().replace(/\s+/g, '-')}-${year}-${rowIdx}`,
      player,
      year,
      ln_price_to_purse,
      sold_price_cr,
      is_overseas: idx('is_overseas') >= 0 ? Number(cells[idx('is_overseas')]) : 0,
      is_capped: idx('is_capped') >= 0 ? Number(cells[idx('is_capped')]) : 1,
      strike_rate: idx('strike_rate') >= 0 ? Number(cells[idx('strike_rate')]) : 130.0,
      average: idx('average') >= 0 ? Number(cells[idx('average')]) : 28.0,
      boundary_pct: idx('boundary_pct') >= 0 ? Number(cells[idx('boundary_pct')]) : 15.0,
      six_pct: idx('six_pct') >= 0 ? Number(cells[idx('six_pct')]) : 4.5,
      economy_rate: idx('economy_rate') >= 0 ? Number(cells[idx('economy_rate')]) : 8.2,
      bowling_strike_rate: idx('bowling_strike_rate') >= 0 ? Number(cells[idx('bowling_strike_rate')]) : 21.0,
      dot_ball_pct: idx('dot_ball_pct') >= 0 ? Number(cells[idx('dot_ball_pct')]) : 36.0,
      wickets_per_match: idx('wickets_per_match') >= 0 ? Number(cells[idx('wickets_per_match')]) : 1.1,
      matches_played: idx('matches_played') >= 0 ? Number(cells[idx('matches_played')]) : 14,
      predicted_ln_price,
      residual,
      gap_percentage,
      dominant_archetype,
      z_score,
      is_outlier,
    };
  });
}
