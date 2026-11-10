"use client";
import { useState } from "react";
const fields = [
  { key: "read", label: "Cache-read input tokens", usage: "cache_read_input_tokens" },
  { key: "write", label: "Cache-write input tokens", usage: "cache_creation_input_tokens" },
  { key: "uncached", label: "Uncached input tokens", usage: "input_tokens" },
] as const;
export function CacheAccountingExample() {
  const [values, setValues] = useState({ read: "8000", write: "0", uncached: "500" });
  const numbers = fields.map(field => Number(values[field.key]));
  const valid = numbers.every(value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000);
  const total = numbers.reduce((sum, value) => sum + value, 0);
  return <aside data-cache-accounting className="mt-10 max-w-3xl rounded-xl border border-slate-200 bg-panel p-5 sm:p-6" aria-labelledby="cache-example-title">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Interactive hypothetical example</p>
    <h2 id="cache-example-title" className="mt-2 font-serif text-3xl">Read the complete input-token ledger</h2>
    <p className="mt-3 text-sm leading-relaxed text-secondary">Change these illustrative counters to see how the input total is composed. This counts tokens, not money or speed. All calculations stay in your browser; no model request is made.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-3">{fields.map(field => <label key={field.key} htmlFor={`cache-example-${field.key}`} className="min-w-0 text-sm text-secondary"><span className="block font-medium text-primary">{field.label}</span><code className="mt-1 block break-all text-[11px]">{field.usage}</code><input id={`cache-example-${field.key}`} data-counter={field.key} type="number" min="0" max="1000000000" step="1" inputMode="numeric" value={values[field.key]} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} className="mt-2 block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-primary" /></label>)}</div>
    <div aria-live="polite" className="mt-5 border-t border-slate-200 pt-4">{valid ? <><p className="text-sm text-secondary">Total input tokens: <output data-token-total className="ml-1 text-lg font-semibold tabular-nums text-primary">{total.toLocaleString("en-US")}</output></p><p className="mt-2 break-words text-xs leading-relaxed text-secondary">{numbers[0].toLocaleString("en-US")} read + {numbers[1].toLocaleString("en-US")} written + {numbers[2].toLocaleString("en-US")} uncached. Generated output tokens are separate.</p></> : <p role="status" className="text-sm text-red-700">Enter non-negative whole numbers up to one billion.</p>}</div>
    <p className="mt-4 text-xs text-secondary">Formula source: <a href="https://platform.claude.com/docs/en/build-with-claude/prompt-caching#tracking-cache-performance" target="_blank" rel="noopener noreferrer" className="text-accent underline">Claude&apos;s input-token usage definitions ↗</a>.</p>
  </aside>;
}
