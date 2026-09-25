import React, { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { BrainCircuit, Loader2, AlertTriangle, Printer, Eye } from 'lucide-react';
import { getSharedRun } from '../lib/api';
import type { SharedRun } from '../lib/types';
import { variantCount, variantTexts } from '../lib/variants';
import { InsightsViewer } from './InsightsViewer';
import { PrintReport } from './PrintReport';

/** Public, read-only view of a shared simulation at /share/:shareId. */
export function SharePage({ shareId }: { shareId: string }) {
  const [run, setRun] = useState<SharedRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    getSharedRun(shareId)
      .then(setRun)
      .catch((err) => setError(err instanceof Error ? err.message : 'This link is not available.'));
  }, [shareId]);

  const printPdf = () => {
    flushSync(() => setPrinting(true));
    window.print();
    setPrinting(false);
  };

  const variants = run ? variantTexts(run.customerData).slice(0, variantCount(run.personas)) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60 bg-[#0B0F19]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <BrainCircuit className="w-5 h-5" />
            </span>
            <span className="font-bold tracking-tight">MarketMind AI</span>
          </a>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Eye className="w-3.5 h-3.5" /> Shared read-only view
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {error ? (
          <div className="flex flex-col items-center justify-center text-center py-24 gap-3">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <h1 className="text-xl font-semibold">This share link isn’t available</h1>
            <p className="text-sm text-slate-400 max-w-md">It may have been turned off by its owner, or the simulation was deleted.</p>
          </div>
        ) : !run ? (
          <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading shared simulation...
          </div>
        ) : (
          <>
            <div className="mb-8 space-y-2">
              <p className="text-xs text-slate-500">
                {new Date(run.createdAt).toLocaleString()} · {run.personas.length} AI-simulated personas
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{variants[0]}</h1>
              <p className="text-sm text-slate-400">
                A simulated focus group generated with AI. Results are indicative, not real consumer research.
              </p>
            </div>
            <InsightsViewer
              insights={run.report}
              streamingReport=""
              personas={run.personas}
              variants={variants}
              progressMsg=""
              isLoading={false}
              actions={
                <button
                  onClick={printPdf}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 rounded-xl border border-slate-800 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Download PDF
                </button>
              }
            />
            {printing && <PrintReport run={run} />}
          </>
        )}
      </main>
    </div>
  );
}
