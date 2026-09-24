import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
  type TooltipContentProps,
} from 'recharts';
import type { Persona } from '../lib/types';
import { SENTIMENT_BANDS, VARIANT_COLORS, VARIANT_LETTERS, responseFor } from '../lib/variants';

// Chart chrome: recessive grid, text tokens for all labels
const GRID = '#1e293b';      // slate-800
const AXIS_TEXT = '#94a3b8'; // slate-400
const tick = { fill: AXIS_TEXT, fontSize: 11 };

interface ChartsProps {
  personas: Persona[];
  variants: string[];
  /** Variant used by single-variant charts (keywords). */
  selectedVariant: number;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#0B0F19] rounded-2xl border border-slate-800/80 p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="text-xs text-slate-400 mt-0.5 mb-4">{subtitle}</p>
      {children}
    </section>
  );
}

function VariantLegend({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <div className="flex flex-wrap gap-4 mb-3" aria-label="Legend">
      {VARIANT_LETTERS.slice(0, count).map((letter, i) => (
        <span key={letter} className="flex items-center gap-1.5 text-xs text-slate-300">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: VARIANT_COLORS[i] }} />
          Variant {letter}
        </span>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label, unit }: Partial<TooltipContentProps<number, string>> & { unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-100 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2 text-slate-300">
          <span className="w-2 h-2 rounded-sm" style={{ background: entry.color }} />
          <span>{payload.length > 1 ? `Variant ${entry.dataKey}` : entry.name}</span>
          <span className="ml-auto pl-3 font-semibold text-slate-100 tabular-nums">
            {entry.value}{unit}
          </span>
        </p>
      ))}
    </div>
  );
}

const cursor = { fill: 'rgba(148, 163, 184, 0.08)' };

// Default export so the Charts tab can lazy-load recharts
export default function SentimentCharts({ personas, variants, selectedVariant }: ChartsProps) {
  const count = variants.length;
  const letters = VARIANT_LETTERS.slice(0, count);

  // Distribution across the rubric bands used to score personas
  const distribution = SENTIMENT_BANDS.map((band) => {
    const row: Record<string, string | number> = { band: `${band.label} ${band.name}` };
    letters.forEach((letter, v) => {
      row[letter] = personas.filter((p) => {
        const s = responseFor(p, v).sentimentScore;
        return s >= band.min && s <= band.max;
      }).length;
    });
    return row;
  });

  // Every persona's score, sorted by variant A so switches between variants stand out
  const perPersona = personas
    .map((p) => {
      const row: Record<string, string | number> = { name: p.name };
      letters.forEach((letter, v) => { row[letter] = responseFor(p, v).sentimentScore; });
      return row;
    })
    .sort((a, b) => Number(b.A) - Number(a.A));

  // Most frequent keywords for the selected variant
  const keywordCounts = new Map<string, number>();
  personas.forEach((p) => {
    responseFor(p, selectedVariant).keywords.forEach((k) => {
      const key = k.trim().toLowerCase().replace(/^#/, '');
      if (key) keywordCounts.set(key, (keywordCounts.get(key) ?? 0) + 1);
    });
  });
  const keywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([keyword, mentions]) => ({ keyword, mentions }));

  const barSize = count > 1 ? 10 : 16;
  const personaRowHeight = count * (barSize + 2) + 14;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Score distribution"
          subtitle="Number of personas in each adoption-likelihood band"
        >
          <VariantLegend count={count} />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={distribution} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="band"
                tick={tick}
                tickLine={false}
                axisLine={{ stroke: GRID }}
                interval={0}
                tickFormatter={(v: string) => v.split(' ')[0]}
              />
              <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
              <Tooltip cursor={cursor} content={(props) => <ChartTooltip {...props} unit=" personas" />} />
              {letters.map((letter, i) => (
                <Bar
                  key={letter}
                  dataKey={letter}
                  name="Personas"
                  fill={VARIANT_COLORS[i]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={count > 1 ? `Top keywords — Variant ${VARIANT_LETTERS[selectedVariant]}` : 'Top keywords'}
          subtitle="How many personas used each theme tag"
        >
          {keywords.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">No keywords yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={keywords} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  type="category"
                  dataKey="keyword"
                  width={120}
                  tick={tick}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip cursor={cursor} content={(props) => <ChartTooltip {...props} unit="" />} />
                <Bar
                  dataKey="mentions"
                  name="Mentions"
                  fill={VARIANT_COLORS[selectedVariant]}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  isAnimationActive={false}
                >
                  <LabelList dataKey="mentions" position="right" fill={AXIS_TEXT} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Adoption likelihood by persona"
        subtitle={count > 1
          ? 'Sorted by Variant A score — look for personas whose score moves between variants'
          : 'Each persona’s sentiment score, highest first'}
      >
        <VariantLegend count={count} />
        <ResponsiveContainer width="100%" height={perPersona.length * personaRowHeight + 30}>
          <BarChart data={perPersona} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis
              type="number"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={tick}
              tickLine={false}
              axisLine={{ stroke: GRID }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={tick}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip cursor={cursor} content={(props) => <ChartTooltip {...props} unit="/100" />} />
            {letters.map((letter, i) => (
              <Bar
                key={letter}
                dataKey={letter}
                name="Score"
                fill={VARIANT_COLORS[i]}
                radius={[0, 4, 4, 0]}
                barSize={barSize}
                isAnimationActive={false}
              >
                {count === 1 && <LabelList dataKey={letter} position="right" fill={AXIS_TEXT} fontSize={11} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
