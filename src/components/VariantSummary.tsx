import React from 'react';
import { Trophy, Scale } from 'lucide-react';
import type { Persona } from '../lib/types';
import {
  ADOPTER_THRESHOLD, REJECTER_THRESHOLD, VARIANT_COLORS, VARIANT_LETTERS, variantStats,
} from '../lib/variants';

/** Leading variant must beat the runner-up by at least this many points. */
const WINNER_MARGIN = 5;

/** Stat tiles comparing variants side by side, with the leading variant called out. */
export function VariantSummary({ personas, variants }: { personas: Persona[]; variants: string[] }) {
  const stats = variants.map((_, i) => variantStats(personas, i));
  const ranked = stats.map((s, i) => ({ i, avg: s.average })).sort((a, b) => b.avg - a.avg);
  const hasWinner = ranked.length > 1 && ranked[0].avg - ranked[1].avg >= WINNER_MARGIN;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {hasWinner ? (
          <>
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-slate-200">
              <strong>Variant {VARIANT_LETTERS[ranked[0].i]}</strong> leads by {ranked[0].avg - ranked[1].avg} points on average adoption likelihood.
            </span>
          </>
        ) : (
          <>
            <Scale className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300">Too close to call — the variants are within {WINNER_MARGIN} points of each other.</span>
          </>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-3 ${variants.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {variants.map((text, i) => {
          const s = stats[i];
          const isLeader = hasWinner && ranked[0].i === i;
          return (
            <div
              key={i}
              className={`bg-[#0B0F19] rounded-2xl border p-4 ${isLeader ? 'border-amber-500/40' : 'border-slate-800/80'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: VARIANT_COLORS[i] }} />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Variant {VARIANT_LETTERS[i]}</span>
                {isLeader && <span className="ml-auto text-[10px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">LEADING</span>}
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 mb-3" title={text}>{text}</p>
              <p className="text-3xl font-semibold text-slate-100 tabular-nums">
                {s.average}<span className="text-base text-slate-500 font-normal"> / 100 avg</span>
              </p>
              <dl className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div>
                  <dt className="text-slate-500">Median</dt>
                  <dd className="text-slate-200 font-semibold tabular-nums">{s.median}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Likely adopters</dt>
                  <dd className="text-slate-200 font-semibold tabular-nums">{s.adopters}/{s.total}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Rejecters</dt>
                  <dd className="text-slate-200 font-semibold tabular-nums">{s.rejecters}/{s.total}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">
        Likely adopters score {ADOPTER_THRESHOLD}+; rejecters score below {REJECTER_THRESHOLD}.
      </p>
    </div>
  );
}
