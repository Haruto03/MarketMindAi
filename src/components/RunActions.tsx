import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Download, FileText, Table, Printer, Link2, Copy, Check, Users, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Panel, SavedRun } from '../lib/types';
import { createPanel, setSharing } from '../lib/api';
import { downloadFile, exportFileName, toCsv, toMarkdown } from '../lib/exporters';
import { PrintReport } from './PrintReport';

interface RunActionsProps {
  run: SavedRun;
  panels: Panel[];
  onRunUpdated: (run: SavedRun) => void;
  onPanelCreated: (panel: Panel) => void;
}

const buttonClass =
  "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 rounded-xl border border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

/** Export, share and save-as-panel controls for a saved run. */
export function RunActions({ run, panels, onRunUpdated, onPanelCreated }: RunActionsProps) {
  const [open, setOpen] = useState<'export' | 'share' | 'panel' | null>(null);
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [panelName, setPanelName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const shareUrl = run.shareId ? `${window.location.origin}/share/${run.shareId}` : null;
  const panel = run.panelId ? panels.find((p) => p.id === run.panelId) : undefined;

  // Close the open popover on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (which: NonNullable<typeof open>) => {
    setError(null);
    setOpen(open === which ? null : which);
  };

  const exportPdf = () => {
    setOpen(null);
    // Render the print document synchronously, then open the print dialog
    flushSync(() => setPrinting(true));
    window.print();
    setPrinting(false);
  };

  const changeSharing = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      onRunUpdated(await setSharing(run.id, enabled));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update sharing.');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Copy failed — select the link and copy it manually.');
    }
  };

  const savePanel = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = panelName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createPanel(run.id, name);
      onPanelCreated(created);
      onRunUpdated({ ...run, panelId: created.id });
      setPanelName('');
      setOpen(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the panel.');
    } finally {
      setBusy(false);
    }
  };

  const popover = "absolute right-0 top-full mt-2 z-20 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 space-y-2";

  return (
    <div ref={rootRef} className="flex flex-wrap gap-2">
      {/* Save as panel */}
      <div className="relative">
        {run.panelId ? (
          <span className={cn(buttonClass, "cursor-default hover:bg-transparent hover:text-slate-300")} title="These personas belong to a saved panel">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            {panel ? `Panel: ${panel.name}` : 'Saved panel'}
          </span>
        ) : (
          <button className={buttonClass} onClick={() => toggle('panel')} aria-expanded={open === 'panel'}>
            <Users className="w-3.5 h-3.5" />
            Save panel
          </button>
        )}
        {open === 'panel' && (
          <form onSubmit={savePanel} className={popover}>
            <p className="text-xs text-slate-400">
              Save these {run.personas.length} people so you can ask them new questions later and compare answers from the same panel.
            </p>
            <input
              autoFocus
              value={panelName}
              onChange={(e) => setPanelName(e.target.value)}
              maxLength={120}
              placeholder="Panel name, e.g. Urban renters 28–40"
              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={busy || !panelName.trim()}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save panel
            </button>
            {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
          </form>
        )}
      </div>

      {/* Export */}
      <div className="relative">
        <button className={buttonClass} onClick={() => toggle('export')} aria-expanded={open === 'export'}>
          <Download className="w-3.5 h-3.5" />
          Export
          <ChevronDown className="w-3 h-3" />
        </button>
        {open === 'export' && (
          <div className={cn(popover, "w-56 p-1.5 space-y-0")} role="menu">
            {[
              { label: 'PDF (print dialog)', icon: Printer, action: exportPdf },
              {
                label: 'Markdown (.md)', icon: FileText, action: () => {
                  downloadFile(exportFileName(run, 'md'), toMarkdown(run), 'text/markdown;charset=utf-8');
                  setOpen(null);
                },
              },
              {
                label: 'CSV — personas (.csv)', icon: Table, action: () => {
                  downloadFile(exportFileName(run, 'csv'), toCsv(run), 'text/csv;charset=utf-8');
                  setOpen(null);
                },
              },
            ].map(({ label, icon: Icon, action }) => (
              <button
                key={label}
                role="menuitem"
                onClick={action}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-lg text-left"
              >
                <Icon className="w-3.5 h-3.5 text-slate-400" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Share link */}
      <div className="relative">
        <button className={buttonClass} onClick={() => toggle('share')} aria-expanded={open === 'share'}>
          <Link2 className={cn("w-3.5 h-3.5", run.shareId && "text-emerald-400")} />
          {run.shareId ? 'Shared' : 'Share'}
        </button>
        {open === 'share' && (
          <div className={popover}>
            {shareUrl ? (
              <>
                <p className="text-xs text-slate-400">
                  Anyone with this link can view the results and report (not your interview transcripts).
                </p>
                <div className="flex gap-1.5">
                  <input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-0 p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300 outline-none"
                  />
                  <button onClick={copyLink} className="px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200" aria-label="Copy link">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  onClick={() => changeSharing(false)}
                  disabled={busy}
                  className="w-full py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 disabled:opacity-50"
                >
                  Stop sharing (link stops working)
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400">
                  Create a read-only link to this simulation. Interview transcripts are never shared.
                </p>
                <button
                  onClick={() => changeSharing(true)}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create share link
                </button>
              </>
            )}
            {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
          </div>
        )}
      </div>

      {printing && <PrintReport run={run} />}
    </div>
  );
}
