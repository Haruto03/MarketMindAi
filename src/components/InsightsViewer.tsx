import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import {
  Sparkle, RefreshCw, Users, Activity, HelpCircle,
  HeartHandshake, LayoutGrid, FileText, AlertTriangle, Loader2
} from 'lucide-react';
import type { Persona } from '../lib/types';

interface InsightsViewerProps {
  insights: string | null;
  streamingReport: string;
  personas: Persona[];
  progressMsg: string;
  errorMsg?: string | null;
  onRegenerate: () => void;
  isLoading: boolean;
}

export function InsightsViewer({
  insights,
  streamingReport,
  personas,
  progressMsg,
  errorMsg,
  onRegenerate,
  isLoading,
}: InsightsViewerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'report'>('roster');

  // Auto-switch to report tab once streaming starts
  const hasStartedStreaming = streamingReport.length > 0;
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (hasStartedStreaming && !prevStreamingRef.current) {
      setActiveSubTab('report');
    }
    prevStreamingRef.current = hasStartedStreaming;
  }, [hasStartedStreaming]);

  // Auto-scroll the streaming report container as text arrives
  const reportScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reportScrollRef.current && streamingReport) {
      reportScrollRef.current.scrollTop = reportScrollRef.current.scrollHeight;
    }
  }, [streamingReport]);

  // ── Error screen ─────────────────────────────────────────────────────────
  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh] bg-rose-500/5 rounded-2xl border border-rose-500/30 shadow-sm">
        <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-rose-300 mb-2">Simulation Failed</h3>
        <p className="text-slate-300 max-w-md mb-6">{errorMsg}</p>
        <button
          onClick={onRegenerate}
          className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-md font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  // ── Idle (no data, not loading) ───────────────────────────────────────────
  if (!insights && !streamingReport && !isLoading && personas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh] bg-[#0B0F19]/50 rounded-2xl border border-slate-800 shadow-sm border-dashed">
        <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mb-4">
          <Sparkle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate-200 mb-2">Simulation Idle</h3>
        <p className="text-slate-400 max-w-md">
          Define your target market parameters on the first tab and start the simulation. MarketMind will generate 10 unique focus group personas and run parallel cognitive interviews.
        </p>
      </div>
    );
  }

  // ── Step 1 loading (before personas arrive) ───────────────────────────────
  if (isLoading && personas.length === 0 && !streamingReport) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh] bg-[#0B0F19] rounded-2xl border border-slate-800 shadow-sm">
        <div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin mb-6" />
        <h3 className="text-xl font-semibold text-slate-200 mb-2 animate-pulse">
          {progressMsg || "Initializing virtual participants..."}
        </h3>
        <p className="text-slate-400 max-w-md">
          The neural focus group of 10 fictional personas is analyzing your questions, pricing models, and lifestyle vectors.
        </p>
      </div>
    );
  }

  // ── Compute KPI metrics ────────────────────────────────────────────────────
  const avgSentiment = personas.length > 0
    ? Math.round(personas.reduce((acc, p) => acc + p.sentimentScore, 0) / personas.length)
    : 0;
  const highSentimentCount = personas.filter(p => p.sentimentScore >= 75).length;
  const criticalCount = personas.filter(p => p.sentimentScore < 50).length;

  const getSentimentColor = (score: number) => {
    if (score >= 75) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  // The text to render in the report pane:
  // show finalised insights if done, otherwise show live streaming partial
  const reportText = insights ?? streamingReport;
  const isStreamingNow = !insights && streamingReport.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">

      {/* KPI Bento Grid — appears as soon as personas arrive */}
      {personas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0B0F19] p-5 rounded-2xl border border-slate-800/80 flex items-center gap-4 bg-gradient-to-tr from-white/[0.015] to-transparent">
            <div className="p-3 bg-blue-500/15 text-blue-400 rounded-xl border border-blue-500/10">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-450 tracking-wide uppercase">Sample Cohort</p>
              <p className="text-2xl font-bold text-slate-100">{personas.length} Active Agents</p>
            </div>
          </div>

          <div className="bg-[#0B0F19] p-5 rounded-2xl border border-slate-800/80 flex items-center gap-4 bg-gradient-to-tr from-white/[0.015] to-transparent">
            <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/10">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-450 tracking-wide uppercase">Avg. Sentiment Score</p>
              <p className="text-2xl font-bold text-slate-100">{avgSentiment} / 100</p>
            </div>
          </div>

          <div className="bg-[#0B0F19] p-5 rounded-2xl border border-slate-800/80 flex items-center gap-4 bg-gradient-to-tr from-white/[0.015] to-transparent">
            <div className="p-3 bg-indigo-500/15 text-indigo-400 rounded-xl border border-indigo-500/10">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-450 tracking-wide uppercase">Direct Reception</p>
              <p className="text-2xl font-bold text-slate-100">
                {highSentimentCount} Warm • {criticalCount} Skeptic
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab selectors */}
      <div className="flex border-b border-slate-800 justify-between items-center pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('roster')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSubTab === 'roster'
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            1. Simulated focus group (10 profiles)
          </button>

          <button
            onClick={() => setActiveSubTab('report')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSubTab === 'report'
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            2. Macro-level report
            {/* Live streaming badge */}
            {isStreamingNow && (
              <span className="flex items-center gap-1 ml-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                LIVE
              </span>
            )}
          </button>
        </div>

        <button
          onClick={onRegenerate}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-350 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-all border border-slate-800 hover:border-blue-500/35 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Re-simulate Focus Group
        </button>
      </div>

      {/* ── ROSTER TAB ────────────────────────────────────────────────────── */}
      {activeSubTab === 'roster' ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-1">
            <Sparkle className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
              Fictional Focus Group Transcripts & Answers
            </h4>
          </div>

          {personas.length === 0 && isLoading && (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">{progressMsg || "Generating personas..."}</span>
            </div>
          )}

          {personas.map((persona, idx) => (
            <div
              key={persona.id || idx}
              className="bg-[#0B0F19] rounded-2xl border border-slate-850 bg-gradient-to-b from-white/[0.012] to-transparent p-6 space-y-5 shadow-md flex flex-col justify-between"
            >
              {/* Header profile */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-850">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center text-slate-350 font-semibold text-sm">
                    {persona.name.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-100 text-lg leading-tight">{persona.name}</h3>
                      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">AGENT #{persona.id}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {persona.age} y/o • {persona.gender} • {persona.location} • {persona.incomeLevel}
                    </p>
                  </div>
                </div>

                <div className={`self-start sm:self-center px-3 py-1 rounded-full text-xs font-bold border ${getSentimentColor(persona.sentimentScore)}`}>
                  Enthusiasm Score: {persona.sentimentScore}/100
                </div>
              </div>

              {/* Roster Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="space-y-1.5">
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block">1. Profile & Background</span>
                  <p className="text-slate-350 leading-relaxed font-sans">{persona.background}</p>
                  <p className="text-xs text-slate-450 italic mt-1 font-mono">{persona.habits}</p>
                </div>

                <div className="space-y-1.5 p-4 rounded-xl bg-slate-950/40 border border-slate-850">
                  <span className="text-xs uppercase tracking-wider text-blue-400 font-semibold block flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    2. Answer to Specific Question
                  </span>
                  <p className="text-slate-300 italic leading-relaxed">"{persona.answerToQuestion}"</p>
                </div>

                <div className="space-y-1.5 p-4 rounded-xl bg-slate-950/40 border border-slate-850">
                  <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold block">3. Concept Resonance Feedback</span>
                  <p className="text-slate-300 leading-relaxed">"{persona.feedback}"</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {persona.keywords?.map((tag, tIdx) => (
                      <span key={tIdx} className="text-[10px] bg-slate-900 text-slate-450 px-2 py-0.5 rounded border border-slate-800/80">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      ) : (
        /* ── REPORT TAB ────────────────────────────────────────────────── */
        <div className="bg-[#0B0F19] rounded-2xl shadow-xl border border-slate-800 overflow-hidden">

          {/* Report header */}
          <div className="p-6 border-b border-slate-800/60 bg-gradient-to-r from-blue-500/5 to-transparent flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-400 shadow-[inset_0_0_12px_rgba(59,130,246,0.15)]">
              {isStreamingNow
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Sparkle className="w-5 h-5 fill-blue-400" />
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">Executive Strategic Report</h2>
                {isStreamingNow && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full animate-pulse">
                    ● STREAMING
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">
                {isStreamingNow
                  ? "Generating macro behavioral evaluation in real-time..."
                  : "Macro behavioral evaluation and strategic synthesized insights."
                }
              </p>
            </div>
          </div>

          {/* Report body — scrollable streaming pane */}
          <div
            ref={reportScrollRef}
            className="p-8 prose prose-invert prose-blue max-w-none
              prose-headings:font-semibold prose-headings:text-slate-150
              prose-h2:text-xl prose-h2:text-slate-100
              text-slate-300 prose-a:text-blue-400 leading-relaxed font-sans
              overflow-y-auto max-h-[70vh]"
          >
            {reportText ? (
              <>
                <Markdown>{reportText}</Markdown>
                {/* Blinking cursor while streaming */}
                {isStreamingNow && (
                  <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-[blink_1s_step-end_infinite] align-middle" />
                )}
              </>
            ) : (
              /* Waiting for stream to start (personas done, report not yet started) */
              <div className="flex items-center gap-3 text-slate-500 py-8">
                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                <span className="text-sm">{progressMsg || "Preparing strategic analysis..."}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}