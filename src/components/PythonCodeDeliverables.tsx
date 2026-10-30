import React, { useState } from 'react';
import {
  CA2_VISUALIZATION_PYTHON_CODE,
  STREAMLIT_APP_PYTHON_CODE,
} from '../data/pythonScripts';
import { generateCsvFromRecords } from '../data/valuationData';
import { ValuationRecord } from '../utils/valuationLogic';
import { Copy, Check, Download, FileCode, Database } from 'lucide-react';

interface PythonCodeDeliverablesProps {
  records: ValuationRecord[];
}

export const PythonCodeDeliverables: React.FC<PythonCodeDeliverablesProps> = ({
  records,
}) => {
  const [activeFile, setActiveFile] = useState<'ca2_script' | 'streamlit_app' | 'csv_data'>('ca2_script');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const csvString = generateCsvFromRecords(records);

  const getActiveContent = () => {
    if (activeFile === 'ca2_script') return CA2_VISUALIZATION_PYTHON_CODE;
    if (activeFile === 'streamlit_app') return STREAMLIT_APP_PYTHON_CODE;
    return csvString;
  };

  const getActiveFilename = () => {
    if (activeFile === 'ca2_script') return 'generate_ca2_visualizations.py';
    if (activeFile === 'streamlit_app') return 'app.py';
    return 'valuation_results.csv';
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback copy
    }
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="Python Deliverables & Scripts"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Python Deliverable Suite (Matplotlib/Seaborn CA2 Script &amp; Single-File Streamlit App)
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Production-ready Python scripts saved directly in your workspace root and ready for local execution or CA2 submission.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Python Deliverable Files"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200"
          >
            <button
              role="tab"
              aria-selected={activeFile === 'ca2_script'}
              type="button"
              onClick={() => setActiveFile('ca2_script')}
              className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeFile === 'ca2_script'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>1. generate_ca2_visualizations.py</span>
            </button>

            <button
              role="tab"
              aria-selected={activeFile === 'streamlit_app'}
              type="button"
              onClick={() => setActiveFile('streamlit_app')}
              className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeFile === 'streamlit_app'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>2. app.py (Streamlit)</span>
            </button>

            <button
              role="tab"
              aria-selected={activeFile === 'csv_data'}
              type="button"
              onClick={() => setActiveFile('csv_data')}
              className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeFile === 'csv_data'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>valuation_results.csv</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(getActiveContent(), activeFile)}
            className="h-9 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {copiedId === activeFile ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy {getActiveFilename()}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleDownload(getActiveContent(), getActiveFilename())}
            className="h-9 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {getActiveFilename()}</span>
          </button>
        </div>
      </div>

      {/* Execution Quick-Start Bar */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        {activeFile === 'ca2_script' && (
          <div>
            <span className="font-semibold text-slate-800">CLI Command:</span>{' '}
            <code className="font-mono bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-900">
              python generate_ca2_visualizations.py
            </code>{' '}
            — Exports 300 DPI PNG figures: <code className="font-mono">ca2_feature_importance.png</code>,{' '}
            <code className="font-mono">ca2_predicted_vs_actual.png</code>, and{' '}
            <code className="font-mono">ca2_valuation_gap_leaderboard.png</code>.
          </div>
        )}
        {activeFile === 'streamlit_app' && (
          <div>
            <span className="font-semibold text-slate-800">CLI Command:</span>{' '}
            <code className="font-mono bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-900">
              streamlit run app.py
            </code>{' '}
            — Launches the Streamlit dashboard with sidebar filters (<code className="font-mono">dominant_archetype</code>,{' '}
            <code className="font-mono">year</code>), red/green outlier Styler dataframe, and Bid Ceiling Recommender.
          </div>
        )}
        {activeFile === 'csv_data' && (
          <div>
            <span className="font-semibold text-slate-800">Pipeline Dataset:</span>{' '}
            Contains your Step 5 Random Forest LeaveOneGroupOut CV output columns (<code className="font-mono">player</code>,{' '}
            <code className="font-mono">year</code>, <code className="font-mono">sold_price_cr</code>,{' '}
            <code className="font-mono">predicted_ln_price</code>, <code className="font-mono">gap_percentage</code>,{' '}
            <code className="font-mono">dominant_archetype</code>, <code className="font-mono">z_score</code>,{' '}
            <code className="font-mono">is_outlier</code>).
          </div>
        )}
      </div>

      {/* Code Viewer */}
      <div className="bg-slate-950 text-slate-100 p-6 overflow-x-auto max-h-[580px] overflow-y-auto">
        <pre className="text-xs font-mono leading-relaxed select-all">
          <code>{getActiveContent()}</code>
        </pre>
      </div>
    </section>
  );
};
