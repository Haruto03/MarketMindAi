import React from 'react';
import { History, Trash2, FolderOpen, MessageCircle, GitCompare, Link2, Users, Repeat } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Panel, SavedRun } from '../lib/types';
import { VARIANT_LETTERS, variantCount, variantStats, variantTexts } from '../lib/variants';

interface HistoryPanelProps {
  runs: SavedRun[];
  panels: Panel[];
  currentRunId: string | null;
  onOpen: (run: SavedRun) => void;
  onDelete: (id: string) => void;
  onUsePanel: (panelId: string) => void;
  onDeletePanel: (id: string) => void;
  isLoading: boolean;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const iconButton =
  "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg border border-slate-800 hover:border-rose-500/30 transition-colors";
const primaryButton =
  "flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

function SectionHeading({ icon: Icon, title, count }: { icon: typeof History; title: string; count: number }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
      <Icon className="w-4 h-4 text-blue-400" />
      {title}
      <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded tabular-nums">{count}</span>
    </h2>
  );
}

export function HistoryPanel({
  runs, panels, currentRunId, onOpen, onDelete, onUsePanel, onDeletePanel, isLoading,
}: HistoryPanelProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* ── Panels ───────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading icon={Users} title="Saved panels" count={panels.length} />
        {panels.length === 0 ? (
          <p className="text-sm text-slate-500 bg-[#0B0F19]/50 border border-dashed border-slate-800 rounded-2xl p-5">
            Use <strong className="text-slate-400">Save panel</strong> on any result to keep those 10 people. You can then ask the same panel new questions and compare their answers over time.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {panels.map((panel) => {
              const runsWithPanel = runs.filter((r) => r.panelId === panel.id).length;
              return (
                <article key={panel.id} className="bg-[#0B0F19] rounded-2xl border border-slate-800/80 p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{panel.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {panel.personas.length} people · saved {dateFormat.format(new Date(panel.createdAt))} · used in {runsWithPanel} simulation{runsWithPanel === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{panel.personas.map((p) => p.name).join(', ')}</p>
                  <div className="flex gap-2">
                    <button onClick={() => onUsePanel(panel.id)} disabled={isLoading} className={primaryButton}>
                      <Repeat className="w-3.5 h-3.5" />
                      Ask this panel
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete the panel "${panel.name}"? Past simulations stay saved.`)) onDeletePanel(panel.id);
                      }}
                      aria-label={`Delete panel ${panel.name}`}
                      className={iconButton}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Simulations ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading icon={History} title="Simulations" count={runs.length} />
        {runs.length === 0 ? (
          <p className="text-sm text-slate-500 bg-[#0B0F19]/50 border border-dashed border-slate-800 rounded-2xl p-5">
            Every completed simulation is saved to your account automatically, including its report and your interview transcripts.
          </p>
        ) : runs.map((run) => {
          const variants = variantTexts(run.customerData).slice(0, variantCount(run.personas));
          const isAbTest = variants.length > 1;
          const interviewCount = Object.values(run.chats ?? {}).filter((m) => m.some((t) => t.role === 'user')).length;
          const isCurrent = run.id === currentRunId;
          const panel = run.panelId ? panels.find((p) => p.id === run.panelId) : undefined;

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
                  {panel && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                      <Users className="w-3 h-3" /> {panel.name}
                    </span>
                  )}
                  {run.shareId && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      <Link2 className="w-3 h-3" /> Shared
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
                <button onClick={() => onOpen(run)} disabled={isLoading} className={primaryButton}>
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this simulation? This cannot be undone, and any share link stops working.')) onDelete(run.id);
                  }}
                  aria-label="Delete simulation"
                  className={iconButton}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
