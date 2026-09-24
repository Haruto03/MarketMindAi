import React from 'react';
import { History, Trash2, FolderOpen, MessageCircle, GitCompare } from 'lucide-react';
import { cn } from '../lib/utils';
import type { SavedRun } from '../lib/history';
import { VARIANT_LETTERS, variantStats, variantTexts } from '../lib/variants';

interface HistoryPanelProps {
  runs: SavedRun[];
  currentRunId: string | null;
  onOpen: (run: SavedRun) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function HistoryPanel({ runs, currentRunId, onOpen, onDelete, isLoading }: HistoryPanelProps) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-[50vh] bg-[#0B0F19]/50 rounded-2xl border border-slate-800 shadow-sm border-dashed">
        <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mb-4">
          <History className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-semibold text-slate-200 mb-2">No Saved Simulations</h3>
        <p className="text-slate-400 max-w-md text-sm">
          Every completed simulation is saved here automatically, including its report and your interview transcripts.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <p className="text-xs text-slate-500">
        Saved in this browser only. Clearing site data removes them.
      </p>

      {runs.map((run) => {
        const variants = variantTexts(run.customerData);
        const isAbTest = variants.length > 1;
        const interviewCount = Object.values(run.chats ?? {}).filter((m) => m.some((t) => t.role === 'user')).length;
        const isCurrent = run.id === currentRunId;

        return (
          <article
            key={run.id}
            className={cn(
              "bg-[#0B0F19] rounded-2xl border p-5 flex flex-col sm:flex-row gap-4 sm:items-center",
              isCurrent ? "border-blue-500/40" : "border-slate-800/80"
            )}
          >
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <time dateTime={run.createdAt}>{dateFormat.format(new Date(run.createdAt))}</time>
                {isCurrent && (
                  <span className="text-[10px] font-bold text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">OPEN</span>
                )}
                {isAbTest && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                    <GitCompare className="w-3 h-3" /> A/B · {variants.length} variants
                  </span>
                )}
                {interviewCount > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> {interviewCount} interview{interviewCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-200 line-clamp-2" title={variants[0]}>{variants[0] || 'Untitled simulation'}</p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 tabular-nums">
                {variants.map((_, i) => {
                  const s = variantStats(run.personas, i);
                  return (
                    <span key={i}>
                      {isAbTest && <strong className="text-slate-300">{VARIANT_LETTERS[i]}: </strong>}
                      avg {s.average}/100 · {s.adopters}/{s.total} likely adopters
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onOpen(run)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Open
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Delete this saved simulation? This cannot be undone.')) onDelete(run.id);
                }}
                aria-label="Delete saved simulation"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg border border-slate-800 hover:border-rose-500/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
