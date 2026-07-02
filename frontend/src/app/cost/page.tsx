"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Zap,
  BarChart2,
  RefreshCw,
  Calendar,
  CreditCard,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Activity,
  Sparkles,
  Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DailySpend { day: string; cost: number; tokens: number; }
interface ModelStat {
  name: string;
  provider: string;
  tokens: number;
  cost: number;
  requests: number;
  avg_latency: number;
  color: string;
  accent: string;
}

// ─── Static demo data (mirrors real API shape) ────────────────────────────────
const DAILY_SPEND: DailySpend[] = [
  { day: "Jun 1",  cost: 0.42,  tokens: 21000 },
  { day: "Jun 2",  cost: 0.61,  tokens: 30500 },
  { day: "Jun 3",  cost: 0.38,  tokens: 19000 },
  { day: "Jun 4",  cost: 0.75,  tokens: 37500 },
  { day: "Jun 5",  cost: 0.54,  tokens: 27000 },
  { day: "Jun 6",  cost: 0.89,  tokens: 44500 },
  { day: "Jun 7",  cost: 0.67,  tokens: 33500 },
  { day: "Jun 8",  cost: 1.12,  tokens: 56000 },
  { day: "Jun 9",  cost: 0.93,  tokens: 46500 },
  { day: "Jun 10", cost: 0.78,  tokens: 39000 },
  { day: "Jun 11", cost: 1.24,  tokens: 62000 },
  { day: "Jun 12", cost: 1.08,  tokens: 54000 },
  { day: "Jun 13", cost: 0.97,  tokens: 48500 },
  { day: "Jun 14", cost: 1.31,  tokens: 65500 },
];

const MODEL_STATS: ModelStat[] = [
  { name: "GPT-4o",            provider: "OpenAI",    tokens: 198000, cost: 5.94,  requests: 312, avg_latency: 1240, color: "#10B981", accent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { name: "GPT-4o-mini",       provider: "OpenAI",    tokens: 312000, cost: 1.87,  requests: 891, avg_latency: 430,  color: "#3B82F6", accent: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { name: "Claude 3.5 Sonnet", provider: "Anthropic", tokens: 156000, cost: 4.68,  requests: 234, avg_latency: 980,  color: "#8B5CF6", accent: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { name: "Claude 3 Haiku",    provider: "Anthropic", tokens: 88000,  cost: 0.22,  requests: 445, avg_latency: 320,  color: "#F59E0B", accent: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { name: "Gemini 1.5 Pro",    provider: "Google",    tokens: 74000,  cost: 1.11,  requests: 178, avg_latency: 760,  color: "#EC4899", accent: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  { name: "Llama 3.1 70B",     provider: "Groq",      tokens: 42000,  cost: 0.084, requests: 98,  avg_latency: 190,  color: "#06B6D4", accent: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
];

const TODAY_COST   = 1.31;
const YESTERDAY_COST = 0.97;
const MONTHLY_COST = DAILY_SPEND.reduce((s, d) => s + d.cost, 0);
const MONTHLY_BUDGET = 25.00;
const TOTAL_TOKENS  = MODEL_STATS.reduce((s, m) => s + m.tokens, 0);
const TOTAL_REQUESTS = MODEL_STATS.reduce((s, m) => s + m.requests, 0);

const RANGES = ["Today", "7 Days", "30 Days", "This Month"] as const;
type Range = typeof RANGES[number];

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 0.001);
  const w = 120, h = 36;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts} />
      <polyline
        fill={`${color}22`}
        stroke="none"
        points={`0,${h} ${pts} ${w},${h}`}
      />
    </svg>
  );
}

// ─── Bar Chart (daily spend) ──────────────────────────────────────────────────
function DailyBarChart({ data, activeIdx, setActiveIdx }: {
  data: DailySpend[];
  activeIdx: number | null;
  setActiveIdx: (i: number | null) => void;
}) {
  const maxCost = Math.max(...data.map(d => d.cost));
  const chartH = 160;

  return (
    <div className="relative flex items-end gap-1.5 w-full" style={{ height: chartH + 40 }}>
      {data.map((d, i) => {
        const barH = (d.cost / maxCost) * chartH;
        const isActive = activeIdx === i;
        const isToday = i === data.length - 1;
        return (
          <div
            key={i}
            className="relative flex flex-col items-center flex-1 group cursor-pointer"
            onMouseEnter={() => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(null)}
          >
            {/* Tooltip */}
            {isActive && (
              <div className="absolute bottom-full mb-2 z-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center shadow-2xl whitespace-nowrap pointer-events-none">
                <p className="text-[10px] text-slate-400 font-bold">{d.day}</p>
                <p className="text-sm font-black text-white">${d.cost.toFixed(2)}</p>
                <p className="text-[10px] text-slate-400">{(d.tokens / 1000).toFixed(1)}k tokens</p>
              </div>
            )}
            {/* Bar */}
            <div
              className="w-full rounded-t-lg transition-all duration-200"
              style={{
                height: barH,
                background: isActive
                  ? "linear-gradient(to top, #3B82F6, #60a5fa)"
                  : isToday
                  ? "linear-gradient(to top, #6366f1, #818cf8)"
                  : "linear-gradient(to top, #1e40af44, #3b82f644)",
              }}
            />
            {/* Label */}
            <span className="text-[8px] text-slate-600 dark:text-slate-500 mt-1.5 font-bold tracking-tight">
              {d.day.split(" ")[1]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Donut Chart (model share) ────────────────────────────────────────────────
function DonutChart({ models }: { models: ModelStat[] }) {
  const total = models.reduce((s, m) => s + m.cost, 0);
  let offset = 0;
  const r = 60, cx = 72, cy = 72;
  const circumference = 2 * Math.PI * r;

  const slices = models.map((m) => {
    const pct = m.cost / total;
    const dash = pct * circumference;
    const gap  = circumference - dash;
    const slice = { ...m, pct, dashOffset: offset * circumference };
    offset += pct;
    return { slice, dash, gap };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={144} height={144} viewBox="0 0 144 144" className="shrink-0">
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="18" />
        {slices.map(({ slice, dash, gap }, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={slice.color}
            strokeWidth="18"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-slice.dashOffset}
            style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dasharray 0.6s ease" }}
          />
        ))}
        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="font-black" fontSize="13" fill="#f1f5f9" fontWeight="900">
          ${total.toFixed(2)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="700">
          TOTAL COST
        </text>
      </svg>
      {/* Legend */}
      <div className="space-y-2 flex-1 min-w-0">
        {models.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: m.color }} />
            <span className="text-[11px] text-slate-400 truncate flex-1">{m.name}</span>
            <span className="text-[11px] font-bold text-slate-300 shrink-0">{((m.cost / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AICostDashboard() {
  const [range, setRange] = useState<Range>("This Month");
  const [activeBarIdx, setActiveBarIdx] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rangeRef.current && !rangeRef.current.contains(e.target as Node)) setRangeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const todayDelta  = ((TODAY_COST - YESTERDAY_COST) / YESTERDAY_COST) * 100;
  const budgetPct   = (MONTHLY_COST / MONTHLY_BUDGET) * 100;
  const totalCost   = MODEL_STATS.reduce((s, m) => s + m.cost, 0);
  const sparkData   = DAILY_SPEND.map(d => d.cost);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">AI Cost Dashboard</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time spend tracking · Token consumption · Model billing breakdown
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date range picker */}
          <div className="relative" ref={rangeRef}>
            <button
              onClick={() => setRangeOpen(!rangeOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:border-indigo-500/50 transition"
            >
              <Calendar className="h-3.5 w-3.5 text-indigo-400" />
              {range}
              <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${rangeOpen ? "rotate-180" : ""}`} />
            </button>
            {rangeOpen && (
              <div className="absolute top-full right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[130px]">
                {RANGES.map(r => (
                  <button
                    key={r}
                    onClick={() => { setRange(r); setRangeOpen(false); }}
                    className={`w-full px-4 py-2.5 text-left text-xs font-bold transition ${range === r ? "bg-indigo-600/20 text-indigo-400" : "text-slate-300 hover:bg-slate-800"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:border-indigo-500/50 transition">
            <Download className="h-3.5 w-3.5 text-slate-400" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Top KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

        {/* Today's Cost */}
        <div className={`glass-card p-5 rounded-2xl border border-slate-800 space-y-4 transition-all duration-700 ${animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "0ms" }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today&apos;s Cost</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black tracking-tight text-white">${TODAY_COST.toFixed(2)}</p>
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-bold ${todayDelta >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {todayDelta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(todayDelta).toFixed(1)}% vs yesterday
            </div>
          </div>
          <Sparkline data={sparkData.slice(-7)} color="#3B82F6" />
        </div>

        {/* Monthly Cost */}
        <div className={`glass-card p-5 rounded-2xl border border-slate-800 space-y-4 transition-all duration-700 ${animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "80ms" }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly Spend</span>
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black tracking-tight text-white">${MONTHLY_COST.toFixed(2)}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-500 font-bold">of ${MONTHLY_BUDGET.toFixed(0)} budget</span>
              <span className={`text-[10px] font-black ${budgetPct > 80 ? "text-rose-400" : budgetPct > 60 ? "text-amber-400" : "text-emerald-400"}`}>
                {budgetPct.toFixed(0)}%
              </span>
            </div>
          </div>
          {/* Budget progress */}
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${budgetPct > 80 ? "bg-rose-500" : budgetPct > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: animated ? `${Math.min(budgetPct, 100)}%` : "0%" }}
            />
          </div>
        </div>

        {/* Tokens Used */}
        <div className={`glass-card p-5 rounded-2xl border border-slate-800 space-y-4 transition-all duration-700 ${animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "160ms" }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tokens Used</span>
            <div className="h-8 w-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black tracking-tight text-white">{(TOTAL_TOKENS / 1000).toFixed(0)}K</p>
            <p className="text-[11px] text-slate-500 mt-1.5 font-semibold">{TOTAL_TOKENS.toLocaleString()} total tokens</p>
          </div>
          {/* Token bar breakdown */}
          <div className="space-y-1.5">
            <div className="flex gap-0.5 w-full h-2 rounded-full overflow-hidden">
              {MODEL_STATS.map((m, i) => (
                <div key={i} style={{ width: `${(m.tokens / TOTAL_TOKENS) * 100}%`, background: m.color }} className="h-full transition-all duration-700" />
              ))}
            </div>
            <p className="text-[9px] text-slate-600 font-bold">by model · {MODEL_STATS.length} active</p>
          </div>
        </div>

        {/* Total Requests */}
        <div className={`glass-card p-5 rounded-2xl border border-slate-800 space-y-4 transition-all duration-700 ${animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "240ms" }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">API Requests</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black tracking-tight text-white">{TOTAL_REQUESTS.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {((TOTAL_REQUESTS * 0.994)).toFixed(0)} succeeded
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-slate-500">Avg cost/req</span>
            <span className="text-slate-300">${(totalCost / TOTAL_REQUESTS).toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* ── Daily Spend Chart + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Daily Spend Bar Chart */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200">Daily Spend Trend</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Cost breakdown per day · hover bars for detail</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1.5 text-indigo-400">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Today
              </span>
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500/40" /> Prior days
              </span>
            </div>
          </div>
          <DailyBarChart data={DAILY_SPEND} activeIdx={activeBarIdx} setActiveIdx={setActiveBarIdx} />
        </div>

        {/* Cost by Model Donut */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Cost by Model</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Monthly spend distribution</p>
          </div>
          <DonutChart models={MODEL_STATS} />
        </div>
      </div>

      {/* ── Model Usage Table ── */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Model Usage Breakdown</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Per-model token consumption, cost, and performance</p>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-400">{MODEL_STATS.length} models active</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Model</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tokens</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requests</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Latency</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cost (USD)</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Usage Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {MODEL_STATS.sort((a, b) => b.cost - a.cost).map((m, i) => {
                const pct = (m.cost / totalCost) * 100;
                return (
                  <tr
                    key={i}
                    className={`hover:bg-slate-800/20 transition-all duration-200 ${animated ? "opacity-100" : "opacity-0"}`}
                    style={{ transitionDelay: `${i * 60}ms` }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}66` }} />
                        <span className="font-bold text-slate-200">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${m.accent}`}>
                        {m.provider}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-300">
                      {m.tokens.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-400">{m.requests}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${m.avg_latency < 500 ? "text-emerald-400" : m.avg_latency < 1000 ? "text-amber-400" : "text-rose-400"}`}>
                        {m.avg_latency}ms
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-white text-sm">${m.cost.toFixed(3)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5 min-w-[100px]">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{ width: animated ? `${pct}%` : "0%", background: m.color }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer totals */}
            <tfoot>
              <tr className="border-t border-slate-700 bg-slate-900/40">
                <td className="px-6 py-3 font-black text-slate-200 text-xs" colSpan={2}>Total</td>
                <td className="px-6 py-3 font-bold text-slate-300 text-xs">{TOTAL_TOKENS.toLocaleString()}</td>
                <td className="px-6 py-3 font-bold text-slate-400 text-xs">{TOTAL_REQUESTS}</td>
                <td className="px-6 py-3 text-slate-500 text-xs">—</td>
                <td className="px-6 py-3 font-black text-white text-sm">${totalCost.toFixed(3)}</td>
                <td className="px-6 py-3 font-bold text-slate-400 text-xs">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Budget Alert + Cost Forecast ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Budget Alert */}
        <div className={`glass-card p-6 rounded-2xl border space-y-4 ${
          budgetPct > 80 ? "border-rose-500/30 bg-rose-500/5" :
          budgetPct > 60 ? "border-amber-500/30 bg-amber-500/5" :
          "border-emerald-500/20 bg-emerald-500/5"
        }`}>
          <div className="flex items-center gap-3">
            {budgetPct > 80
              ? <AlertTriangle className="h-5 w-5 text-rose-400" />
              : budgetPct > 60
              ? <AlertTriangle className="h-5 w-5 text-amber-400" />
              : <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            <div>
              <h3 className="text-sm font-bold text-slate-200">Budget Status</h3>
              <p className="text-[11px] text-slate-500">Monthly budget: ${MONTHLY_BUDGET.toFixed(0)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400">Spent</span>
              <span className="text-white">${MONTHLY_COST.toFixed(2)}</span>
            </div>
            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 relative overflow-hidden ${
                  budgetPct > 80 ? "bg-rose-500" : budgetPct > 60 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: animated ? `${Math.min(budgetPct, 100)}%` : "0%" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
              </div>
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
              <span>${MONTHLY_COST.toFixed(2)} used</span>
              <span>${(MONTHLY_BUDGET - MONTHLY_COST).toFixed(2)} remaining</span>
            </div>
          </div>

          <div className={`text-[11px] font-semibold px-3 py-2 rounded-lg ${
            budgetPct > 80
              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              : budgetPct > 60
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          }`}>
            {budgetPct > 80
              ? `⚠ Budget threshold exceeded. Consider adding spend limits.`
              : budgetPct > 60
              ? `⚡ Moderate usage detected. Projected to hit $${(MONTHLY_COST / 14 * 30).toFixed(2)} this month.`
              : `✓ On track. Projected monthly spend: $${(MONTHLY_COST / 14 * 30).toFixed(2)}`}
          </div>
        </div>

        {/* Cost Efficiency Metrics */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">Cost Efficiency</h3>
          </div>

          <div className="space-y-3">
            {[
              { label: "Cost per 1K tokens",    value: `$${((totalCost / TOTAL_TOKENS) * 1000).toFixed(4)}`,  sub: "avg across all models",   color: "text-blue-400" },
              { label: "Cost per request",       value: `$${(totalCost / TOTAL_REQUESTS).toFixed(4)}`,        sub: "avg API call cost",        color: "text-violet-400" },
              { label: "Cheapest model/1K tok",  value: "$0.002",                                             sub: "Llama 3.1 70B (Groq)",     color: "text-emerald-400" },
              { label: "Most expensive model",   value: "$0.030",                                             sub: "GPT-4o (OpenAI)",          color: "text-rose-400" },
              { label: "Fastest avg response",   value: "190ms",                                              sub: "Llama 3.1 70B (Groq)",     color: "text-cyan-400" },
              { label: "Projected monthly",      value: `$${(MONTHLY_COST / 14 * 30).toFixed(2)}`,           sub: "based on 14-day trend",    color: "text-amber-400" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                <div>
                  <p className="text-xs font-semibold text-slate-300">{item.label}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{item.sub}</p>
                </div>
                <span className={`text-sm font-black ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
