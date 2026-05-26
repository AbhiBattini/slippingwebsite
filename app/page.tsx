"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";

type Result = {
  market: { id: string; title: string };
  side: "yes" | "no";
  book: {
    best_bid: number | null;
    best_ask: number | null;
    mid: number | null;
    ask_depth_levels: number;
    ask_total_notional: number;
  };
  buy: {
    shares: number;
    spent: number;
    remaining: number;
    avg_price: number | null;
    filled: boolean;
    slippage_vs_touch_pct: number | null;
    slippage_vs_mid_pct: number | null;
  };
  max_budget: null | {
    budget: number;
    feasible: boolean;
    book_bound: boolean;
    slippage_at_cap_pct: number | null;
    reference_price: number | null;
    reference_kind: string;
    threshold_pct: number;
  };
};

type ApiResponse = {
  venue: string;
  event: { id: string; title: string };
  budget_usd: number;
  threshold: { pct: number; reference: string } | null;
  results: Result[];
  skipped?: { market: string; side: string; reason: string }[];
};

const fmtPrice = (p: number | null) =>
  p == null ? "—" : p.toFixed(3);
const fmtPct = (p: number | null) =>
  p == null ? "—" : `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`;
const fmtMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function Page() {
  const [url, setUrl] = useState("");
  const [budget, setBudget] = useState("500");
  const [threshold, setThreshold] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    try {
      const now = Date.now();
      const DAY = 86_400_000;
      let vid = localStorage.getItem("sl_vid");
      const isNew = !vid;
      if (!vid) {
        vid =
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${now}-${Math.random().toString(36).slice(2)}`);
        localStorage.setItem("sl_vid", vid);
      }

      const lastVisit = parseInt(localStorage.getItem("sl_last_visit") || "0", 10);
      const firstVisit = parseInt(
        localStorage.getItem("sl_first_visit") || `${now}`,
        10,
      );
      if (!localStorage.getItem("sl_first_visit")) {
        localStorage.setItem("sl_first_visit", `${now}`);
      }

      const visitCount =
        (parseInt(localStorage.getItem("sl_visit_count") || "0", 10) || 0) + 1;
      localStorage.setItem("sl_visit_count", `${visitCount}`);

      const daysSinceLast = lastVisit ? Math.floor((now - lastVisit) / DAY) : -1;
      const daysSinceFirst = Math.floor((now - firstVisit) / DAY);

      let cohort: "new" | "returning_today" | "returning_week" | "returning_month" | "dormant_revival";
      if (isNew) cohort = "new";
      else if (daysSinceLast <= 0) cohort = "returning_today";
      else if (daysSinceLast <= 7) cohort = "returning_week";
      else if (daysSinceLast <= 30) cohort = "returning_month";
      else cohort = "dormant_revival";

      track("session_start", {
        cohort,
        visit_count: visitCount,
        days_since_last_visit: daysSinceLast,
        days_since_first_visit: daysSinceFirst,
        is_new: isNew,
      });

      localStorage.setItem("sl_last_visit", `${now}`);
    } catch {
      // localStorage unavailable (private mode, SSR edge) — skip silently
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setData(null);
    setLoading(true);
    try {
      const res = await fetch("/api/slippage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          budget: parseFloat(budget),
          threshold: threshold.trim() ? parseFloat(threshold) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `request failed (${res.status})`);
      setData(json);
      try {
        const total =
          (parseInt(localStorage.getItem("sl_quote_count") || "0", 10) || 0) + 1;
        localStorage.setItem("sl_quote_count", `${total}`);
        track("quote_run", {
          venue: json.venue,
          total_quotes: total,
          is_first_quote: total === 1,
        });
      } catch {
        track("quote_run", { venue: json.venue });
      }
    } catch (err: any) {
      setError(err.message || "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <nav className="mb-8 flex justify-end">
        <Link
          href="/how-to-use"
          className="text-sm text-neutral-300 hover:text-white underline underline-offset-4"
        >
          How to use this tool
        </Link>
      </nav>
      <header className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight">slippage-labs</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Honest liquidity & slippage analytics for prediction markets. Paste a
          Polymarket or Kalshi URL, enter an order size, get what you&apos;d
          actually pay.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">
            Market URL
          </label>
          <input
            type="text"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://polymarket.com/event/... or kalshi.com/... or KXHIGHNY-26MAY05"
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">
              Budget (USD)
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="any"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">
              Max slippage % (optional)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="e.g. 2"
              className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-600"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Walking the book…" : "Calculate slippage"}
        </button>
      </form>

      {error && (
        <div className="mt-8 rounded-md border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {data && (
        <section className="mt-12">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              {data.venue} · {fmtMoney(data.budget_usd)} budget
            </div>
            <h2 className="text-lg font-medium mt-1">{data.event.title}</h2>
          </div>

          <div className="overflow-x-auto rounded-md border border-neutral-800">
            <table className="w-full text-sm font-mono">
              <thead className="bg-neutral-900/60 text-neutral-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-normal">Market</th>
                  <th className="text-left px-3 py-2 font-normal">Side</th>
                  <th className="text-right px-3 py-2 font-normal">Mid</th>
                  <th className="text-right px-3 py-2 font-normal">Avg fill</th>
                  <th className="text-right px-3 py-2 font-normal">Slip vs mid</th>
                  <th className="text-right px-3 py-2 font-normal">Shares</th>
                  <th className="text-right px-3 py-2 font-normal">Filled</th>
                  {data.threshold && (
                    <th className="text-right px-3 py-2 font-normal">
                      Max @ {data.threshold.pct}%
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.results.map((r, i) => (
                  <tr key={i} className="border-t border-neutral-800">
                    <td className="px-3 py-2 font-sans text-neutral-200">
                      {r.market.title}
                    </td>
                    <td className="px-3 py-2 uppercase">{r.side}</td>
                    <td className="px-3 py-2 text-right">{fmtPrice(r.book.mid)}</td>
                    <td className="px-3 py-2 text-right">
                      {fmtPrice(r.buy.avg_price)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${
                        (r.buy.slippage_vs_mid_pct ?? 0) > 5
                          ? "text-red-400"
                          : (r.buy.slippage_vs_mid_pct ?? 0) > 1
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {fmtPct(r.buy.slippage_vs_mid_pct)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.buy.shares.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-400">
                      {r.buy.filled ? "full" : "partial"}
                    </td>
                    {data.threshold && (
                      <td className="px-3 py-2 text-right">
                        {r.max_budget == null || !r.max_budget.feasible
                          ? <span className="text-neutral-500">infeasible</span>
                          : <span>
                              {fmtMoney(r.max_budget.budget)}
                              <span className="text-neutral-500">
                                {" "}({fmtPct(r.max_budget.slippage_at_cap_pct)})
                              </span>
                            </span>
                        }
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.skipped && data.skipped.length > 0 && (
            <div className="mt-4 text-xs text-neutral-500">
              Skipped {data.skipped.length} book{data.skipped.length > 1 ? "s" : ""}:{" "}
              {data.skipped.map((s) => `${s.market} (${s.side})`).join(", ")}
            </div>
          )}

          <details className="mt-8 text-xs text-neutral-500">
            <summary className="cursor-pointer hover:text-neutral-300">
              Assumptions & limitations
            </summary>
            <ul className="mt-3 space-y-1 list-disc pl-5">
              <li>Buy-only. Exit slippage is not modeled and can be worse.</li>
              <li>Marketable IOC. Leftover budget is cancelled, not rested as a limit bid.</li>
              <li>Pre-fee. Venue fees, deposit/withdrawal, and bridge costs are ignored.</li>
              <li>Snapshot, not stream. Books are fetched sequentially per sub-market.</li>
              <li>Mid is mechanical: wide spreads can produce huge slippage-vs-mid numbers — treat them as a signal that the book isn&apos;t real, not a precise measure.</li>
              <li>Minimum order sizes are ignored.</li>
            </ul>
          </details>
        </section>
      )}

      <footer className="mt-24 text-xs text-neutral-600">
        Powered by{" "}
        <a href="https://github.com/AbhiBattini/slipping" className="underline hover:text-neutral-400">
          slippage-labs
        </a>
        .
      </footer>
    </main>
  );
}
