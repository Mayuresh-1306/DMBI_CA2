import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePredictedPriceCr,
  classifyOutlierStatus,
  calculateBidRecommendation,
  filterValuationRecords,
  getValuationGapLeaderboard,
  parseValuationCsv,
  ValuationRecord,
} from './valuationLogic';

const sampleRecords: ValuationRecord[] = [
  {
    id: 'virat-kohli-2022',
    player: 'Virat Kohli',
    year: 2022,
    ln_price_to_purse: -2.461202,
    sold_price_cr: 10.239883,
    is_overseas: 0,
    is_capped: 1,
    strike_rate: 127.021884,
    average: 34.230769,
    boundary_pct: 13.796384,
    six_pct: 3.139867,
    economy_rate: 0,
    bowling_strike_rate: 0,
    dot_ball_pct: 0,
    wickets_per_match: 0,
    matches_played: 15,
    predicted_ln_price: -2.980227,
    residual: 0.519025,
    gap_percentage: 68.038842,
    dominant_archetype: 'Middle-order finishers',
    z_score: 0.267069,
    is_outlier: 0,
  },
  {
    id: 'lokesh-rahul-2022',
    player: 'Lokesh Rahul',
    year: 2022,
    ln_price_to_purse: -4.019488,
    sold_price_cr: 2.155459,
    is_overseas: 0,
    is_capped: 1,
    strike_rate: 134.257285,
    average: 57.242424,
    boundary_pct: 16.560057,
    six_pct: 5.543710,
    economy_rate: 0,
    bowling_strike_rate: 0,
    dot_ball_pct: 0,
    wickets_per_match: 0,
    matches_played: 15,
    predicted_ln_price: -2.544770,
    residual: -1.474718,
    gap_percentage: -77.115676,
    dominant_archetype: 'Middle-order finishers',
    z_score: -2.075926,
    is_outlier: 1,
  },
  {
    id: 'ishant-overpay-2023',
    player: 'Mitchell Starc',
    year: 2024,
    ln_price_to_purse: -1.578979,
    sold_price_cr: 24.75,
    is_overseas: 1,
    is_capped: 1,
    strike_rate: 112.0,
    average: 14.0,
    boundary_pct: 11.0,
    six_pct: 3.0,
    economy_rate: 8.95,
    bowling_strike_rate: 16.4,
    dot_ball_pct: 42.1,
    wickets_per_match: 1.5,
    matches_played: 14,
    predicted_ln_price: -2.695628,
    residual: 1.116649,
    gap_percentage: 205.46,
    dominant_archetype: 'New-ball specialists',
    z_score: 2.38,
    is_outlier: 1,
  },
];

test('computePredictedPriceCr derives accurate fair price in Crores from pipeline output', () => {
  const viratFair = computePredictedPriceCr(sampleRecords[0]);
  // 10.239883 / (1 + 0.68038842) = 6.0938
  assert.equal(Math.abs(viratFair - 6.0938) < 0.01, true);

  const rahulFair = computePredictedPriceCr(sampleRecords[1]);
  // 2.155459 / (1 - 0.77115676) = 9.4189
  assert.equal(Math.abs(rahulFair - 9.4189) < 0.01, true);
});

test('classifyOutlierStatus identifies overvalued and undervalued outliers accurately', () => {
  assert.equal(classifyOutlierStatus(sampleRecords[0]), 'fair');
  assert.equal(classifyOutlierStatus(sampleRecords[1]), 'undervalued');
  assert.equal(classifyOutlierStatus(sampleRecords[2]), 'overvalued');
});

test('calculateBidRecommendation produces ordered conservative <= ceiling <= walk-away thresholds', () => {
  const recRahul = calculateBidRecommendation(sampleRecords[1], 'balanced');
  assert.equal(recRahul.isOutlier, true);
  assert.equal(recRahul.outlierDirection, 'undervalued');
  assert.equal(recRahul.conservativeBidCr <= recRahul.recommendedCeilingCr, true);
  assert.equal(recRahul.recommendedCeilingCr <= recRahul.hardWalkAwayCr, true);

  const recConservative = calculateBidRecommendation(sampleRecords[0], 'conservative');
  const recAggressive = calculateBidRecommendation(sampleRecords[0], 'aggressive');
  assert.equal(recConservative.recommendedCeilingCr < recAggressive.recommendedCeilingCr, true);
});

test('filterValuationRecords filters by year, archetype, search query, and outlier mode', () => {
  const only2022 = filterValuationRecords(sampleRecords, {
    years: [2022],
    archetypes: [],
    searchQuery: '',
    outlierFilter: 'all',
  });
  assert.equal(only2022.length, 2);

  const undervaluedOutliers = filterValuationRecords(sampleRecords, {
    years: [],
    archetypes: [],
    searchQuery: '',
    outlierFilter: 'undervalued_outliers',
  });
  assert.equal(undervaluedOutliers.length, 1);
  assert.equal(undervaluedOutliers[0].player, 'Lokesh Rahul');
});

test('getValuationGapLeaderboard returns sorted overvalued and undervalued leaders', () => {
  const board = getValuationGapLeaderboard(sampleRecords, 2);
  assert.equal(board.topOvervalued[0].player, 'Mitchell Starc');
  assert.equal(board.topUndervalued[0].player, 'Lokesh Rahul');
});

test('parseValuationCsv parses valid CSV string and validates required columns', () => {
  const csv = `player,year,sold_price_cr,predicted_ln_price,gap_percentage,dominant_archetype,z_score,is_outlier
Virat Kohli,2022,10.239883,-2.980227,68.038842,Middle-order finishers,0.267069,0`;
  const parsed = parseValuationCsv(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].player, 'Virat Kohli');
  assert.equal(parsed[0].year, 2022);
});
