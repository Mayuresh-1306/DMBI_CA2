import React, { useState, useMemo, useRef } from 'react';
import {
  VALUATION_RESULTS_DATA,
  RF_FEATURE_IMPORTANCES,
  generateCsvFromRecords,
} from './data/valuationData';
import {
  ValuationRecord,
  RiskPosture,
  filterValuationRecords,
  parseValuationCsv,
  DEFAULT_PURSE_CR,
} from './utils/valuationLogic';
import { BidCeilingRecommender } from './components/BidCeilingRecommender';
import { ValuationDataframe } from './components/ValuationDataframe';
import { CA2VisualizationsView } from './components/CA2VisualizationsView';
import { PythonCodeDeliverables } from './components/PythonCodeDeliverables';
import {
  Upload,
  RotateCcw,
  Search,
  Filter,
  Download,
} from 'lucide-react';

type ActiveSection = 'dashboard' | 'visualizations' | 'python_code';

export function App() {
  const [records, setRecords] = useState<ValuationRecord[]>(VALUATION_RESULTS_DATA);
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [selectedYears, setSelectedYears] = useState<number[]>([2022, 2023, 2024]);
  const [selectedArchetypes, setSelectedArchetypes] = useState<string[]>([
    'Middle-order finishers',
    'Anchor openers',
    'Powerplay aggressors',
    'Death-overs specialists',
    'Middle-overs spinners',
    'New-ball specialists',
    'Part-time/low-volume',
  ]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [outlierFilter, setOutlierFilter] = useState<
    'all' | 'outliers_only' | 'undervalued_outliers' | 'overvalued_outliers'
  >('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('lokesh-rahul-2022');
  const [riskPosture, setRiskPosture] = useState<RiskPosture>('balanced');
  const [purseCr, setPurseCr] = useState<number>(DEFAULT_PURSE_CR);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allYears = useMemo(
    () => Array.from(new Set(records.map((r) => r.year))).sort((a, b) => a - b),
    [records]
  );

  const allArchetypes = useMemo(
    () => Array.from(new Set(records.map((r) => r.dominant_archetype))).sort(),
    [records]
  );

  const filteredRecords = useMemo(
    () =>
      filterValuationRecords(records, {
        years: selectedYears,
        archetypes: selectedArchetypes,
        searchQuery,
        outlierFilter,
      }),
    [records, selectedYears, selectedArchetypes, searchQuery, outlierFilter]
  );

  const toggleYear = (yr: number) => {
    setSelectedYears((prev) =>
      prev.includes(yr) ? prev.filter((y) => y !== yr) : [...prev, yr].sort()
    );
  };

  const toggleArchetype = (arch: string) => {
    setSelectedArchetypes((prev) =>
      prev.includes(arch) ? prev.filter((a) => a !== arch) : [...prev, arch]
    );
  };

  const handleResetFilters = () => {
    setSelectedYears(allYears);
    setSelectedArchetypes(allArchetypes);
    setSearchQuery('');
    setOutlierFilter('all');
    setPurseCr(DEFAULT_PURSE_CR);
    setUploadStatus(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const parsed = parseValuationCsv(text);
        setRecords(parsed);
        const yrs = Array.from(new Set(parsed.map((r) => r.year))).sort();
        const archs = Array.from(new Set(parsed.map((r) => r.dominant_archetype))).sort();
        setSelectedYears(yrs);
        setSelectedArchetypes(archs);
        if (parsed.length > 0) {
          setSelectedPlayerId(parsed[0].id);
        }
        setUploadStatus({
          type: 'success',
          message: `Loaded ${parsed.length} player records from ${file.name}.`,
        });
      } catch (err) {
        setUploadStatus({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Could not parse uploaded CSV file.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadCsv = () => {
    const csvContent = generateCsvFromRecords(filteredRecords);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'valuation_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSelectPlayerAndFocus = (id: string) => {
    setSelectedPlayerId(id);
    if (activeSection !== 'dashboard') {
      setActiveSection('dashboard');
    }
  };

  // Summary metrics
  const totalOutliers = filteredRecords.filter((r) => r.is_outlier === 1).length;
  const undervaluedOutliers = filteredRecords.filter(
    (r) => r.is_outlier === 1 && r.z_score < 0
  ).length;
  const overvaluedOutliers = filteredRecords.filter(
    (r) => r.is_outlier === 1 && r.z_score > 0
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8 sticky top-0 z-30">
        {/* Zone 1: Brand Title, single line */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('dashboard');
          }}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
        >
          IPL Valuation &amp; Bid Ceiling Lab
        </a>

        {/* Zone 2: 3 Concise Single-Line Navigation Links */}
        <nav
          aria-label="Primary Workspace Views"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'dashboard'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Streamlit Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('visualizations')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'visualizations'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            CA2 Visualizations
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('python_code')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'python_code'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Python Code Suite
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileUpload}
            className="hidden"
            aria-label="Upload custom valuation_results.csv"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Load valuation_results.csv</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Container: Sidebar + Content Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        {/* Sidebar Filter Panel (Matches Streamlit st.sidebar specification) */}
        <aside
          aria-label="Sidebar Filters"
          className="w-full lg:w-64 xl:w-72 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 shrink-0 space-y-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Filter className="w-4 h-4 text-slate-600" />
              <span>Sidebar Filters (app.py)</span>
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          </div>

          {uploadStatus && (
            <div
              role="status"
              className={`p-3 rounded-md text-xs border ${
                uploadStatus.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {uploadStatus.message}
            </div>
          )}

          {/* Search Input */}
          <div>
            <label
              htmlFor="sidebar-player-search"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Search Player or Role
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="sidebar-player-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Kohli, Rahul, Bumrah..."
                className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Year Filter (year column) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Auction Year (year)
              </span>
              <button
                type="button"
                onClick={() => setSelectedYears(allYears)}
                className="text-[11px] text-slate-500 hover:text-slate-900"
              >
                Select All
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {allYears.map((yr) => {
                const active = selectedYears.includes(yr);
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => toggleYear(yr)}
                    aria-pressed={active}
                    className={`py-1.5 px-2 text-xs font-mono font-medium rounded border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dominant Archetype Filter (dominant_archetype column) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Dominant Archetype
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedArchetypes(allArchetypes)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  All
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedArchetypes([allArchetypes[0]])}
                  className="text-slate-500 hover:text-slate-900"
                >
                  Single
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {allArchetypes.map((arch) => {
                const checked = selectedArchetypes.includes(arch);
                const count = records.filter(
                  (r) =>
                    r.dominant_archetype === arch &&
                    selectedYears.includes(r.year)
                ).length;

                return (
                  <label
                    key={arch}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer border transition-colors ${
                      checked
                        ? 'bg-slate-100/90 border-slate-300 text-slate-900 font-medium'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleArchetype(arch)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="truncate">{arch}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums ml-2">
                      {count}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Outlier Display Mode */}
          <div>
            <label
              htmlFor="outlier-mode-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Outlier Regime Filter (is_outlier)
            </label>
            <select
              id="outlier-mode-select"
              value={outlierFilter}
              onChange={(e) =>
                setOutlierFilter(
                  e.target.value as
                    | 'all'
                    | 'outliers_only'
                    | 'undervalued_outliers'
                    | 'overvalued_outliers'
                )
              }
              className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Records ({records.length})</option>
              <option value="outliers_only">Outliers Only (is_outlier = 1)</option>
              <option value="undervalued_outliers">
                Undervalued Bargains (Green, z &lt; -1.96)
              </option>
              <option value="overvalued_outliers">
                Overvalued Premiums (Red, z &gt; +1.96)
              </option>
            </select>
          </div>

          {/* Franchise Purse Slider */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label
                htmlFor="purse-slider"
                className="font-semibold text-slate-700"
              >
                Auction Purse Cap
              </label>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                ₹{purseCr.toFixed(0)} Cr
              </span>
            </div>
            <input
              id="purse-slider"
              type="range"
              min={80}
              max={150}
              step={5}
              value={purseCr}
              onChange={(e) => setPurseCr(Number(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-0.5">
              <span>₹80 Cr</span>
              <span>₹120 Cr (Std)</span>
              <span>₹150 Cr</span>
            </div>
          </div>

          {/* Export Filtered CSV */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="w-full h-9 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Filtered CSV ({filteredRecords.length} rows)</span>
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-6 lg:p-7 space-y-6">
          {/* Mobile / Tablet Quick View Switcher */}
          <div className="flex md:hidden items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveSection('dashboard')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                activeSection === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('visualizations')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                activeSection === 'visualizations'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              CA2 Charts
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('python_code')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                activeSection === 'python_code'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              Python Code
            </button>
          </div>

          {/* Summary Telemetry Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">
                Filtered Player-Seasons
              </div>
              <div
                data-testid="filtered-count"
                className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1"
              >
                {filteredRecords.length}{' '}
                <span className="text-xs font-normal text-slate-400">
                  / {records.length}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Years: {selectedYears.join(', ') || 'None'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">
                Statistical Outliers (is_outlier = 1)
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                {totalOutliers}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Threshold: |z_score| ≥ 1.96
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">
                Undervalued Bargains (Green)
              </div>
              <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
                {undervaluedOutliers}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                High-surplus acquisitions (z &lt; -1.96)
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">
                Overvalued Premiums (Red)
              </div>
              <div className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
                {overvaluedOutliers}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Severe auction overpays (z &gt; +1.96)
              </div>
            </div>
          </div>

          {/* Active Workspace View */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              <BidCeilingRecommender
                records={filteredRecords}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayerId={setSelectedPlayerId}
                riskPosture={riskPosture}
                onChangeRiskPosture={setRiskPosture}
                purseCr={purseCr}
              />

              <ValuationDataframe
                records={filteredRecords}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={setSelectedPlayerId}
                purseCr={purseCr}
              />
            </div>
          )}

          {activeSection === 'visualizations' && (
            <CA2VisualizationsView
              records={filteredRecords}
              allRecords={records}
              featureImportances={RF_FEATURE_IMPORTANCES}
              purseCr={purseCr}
              onSelectPlayer={handleSelectPlayerAndFocus}
            />
          )}

          {activeSection === 'python_code' && (
            <PythonCodeDeliverables records={filteredRecords} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
