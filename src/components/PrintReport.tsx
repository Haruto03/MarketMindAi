import React from 'react';
import { createPortal } from 'react-dom';
import Markdown from 'react-markdown';
import type { SharedRun } from '../lib/types';
import { ADOPTER_THRESHOLD, REJECTER_THRESHOLD, VARIANT_LETTERS, responseFor, variantCount, variantStats, variantTexts } from '../lib/variants';

/**
 * Print-only version of a simulation, used for "Export PDF" via the browser's
 * print dialog (Save as PDF). Hidden on screen; index.css hides the app and
 * shows this when printing.
 */
export function PrintReport({ run }: { run: SharedRun }) {
  const variants = variantTexts(run.customerData).slice(0, variantCount(run.personas));
  const isAbTest = variants.length > 1;

  return createPortal(
    <article className="print-only print-report">
      <header>
        <h1>MarketMind AI — Simulated Focus Group</h1>
        <p className="muted">
          {new Date(run.createdAt).toLocaleString()} · {run.personas.length} AI-simulated personas.
          Results are a simulation, not real consumer research.
        </p>
      </header>

      <section>
        <h2>{isAbTest ? 'Variants tested' : 'Question / concept'}</h2>
        {variants.map((text, i) => (
          <p key={i}>{isAbTest && <strong>Variant {VARIANT_LETTERS[i]}: </strong>}{text}</p>
        ))}
      </section>

      <section>
        <h2>Results</h2>
        <table>
          <thead>
            <tr><th>Variant</th><th>Average</th><th>Median</th><th>Likely adopters</th><th>Rejecters</th></tr>
          </thead>
          <tbody>
            {variants.map((_, i) => {
              const s = variantStats(run.personas, i);
              return (
                <tr key={i}>
                  <td>{isAbTest ? VARIANT_LETTERS[i] : '—'}</td>
                  <td>{s.average}/100</td>
                  <td>{s.median}</td>
                  <td>{s.adopters}/{s.total}</td>
                  <td>{s.rejecters}/{s.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted">Likely adopters score {ADOPTER_THRESHOLD}+; rejecters score below {REJECTER_THRESHOLD}.</p>
      </section>

      <section>
        <h2>Personas</h2>
        <table>
          <thead>
            <tr>
              <th>Persona</th>
              {variants.map((_, i) => <th key={i}>{isAbTest ? `Score ${VARIANT_LETTERS[i]}` : 'Score'}</th>)}
              <th>{isAbTest ? 'Answer (Variant A)' : 'Answer'}</th>
            </tr>
          </thead>
          <tbody>
            {run.personas.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><br />{p.age}, {p.gender}, {p.location}<br />{p.incomeLevel}</td>
                {variants.map((_, i) => <td key={i}>{responseFor(p, i).sentimentScore}</td>)}
                <td>{p.answerToQuestion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report">
        <h2>Strategic report</h2>
        <Markdown>{run.report}</Markdown>
      </section>
    </article>,
    document.body,
  );
}
