'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/* =========================================================
   型定義
   ========================================================= */
type Params = {
  visitsPerDay: number; // 1日の来院数（延べ）
  workDays: number; // 月の診療日数
  insuranceUnit: number; // 保険診療 平均単価（円/人）
  insuranceVarRate: number; // 保険診療の変動費率（%）
  selfPayRate: number; // 自費移行率（%）
  selfPayUnit: number; // 自費平均単価（円/件）
  selfPayRepeat: number; // 自費リピート率（%）＝同月内の追加購入・継続
  selfPayCostRate: number; // 自費原価率（%）
  rent: number; // 家賃（円/月）
  labor: number; // 人件費（円/月）
  otherFixed: number; // その他固定費（円/月）
  doctorPay: number; // 院長報酬（円/月）
  loanRepay: number; // 借入返済（円/月）
  initialInvest: number; // 初期投資（自己資金負担分・円）
  rampMonths: number; // 患者数が目標に達するまでの月数
  startRatio: number; // 開業1ヶ月目の達成率（%）
  targetProfit: number; // 目標月間利益（円）
};

type MonthResult = {
  visits: number;
  insRev: number;
  selfCount: number;
  selfRev: number;
  revenue: number;
  insVar: number;
  selfVar: number;
  varCost: number;
  fixed: number;
  profit: number;
};

type Snapshot = {
  label: string;
  profit: number;
  revenue: number;
  beVisitsPerDay: number;
  payback: number | null;
  breakEvenMonth: number | null;
};

/* =========================================================
   初期値・プリセット
   ========================================================= */
const STORAGE_KEY = 'clinic-simulator-params-v1';

const DEFAULT_PARAMS: Params = {
  visitsPerDay: 20,
  workDays: 22,
  insuranceUnit: 5000,
  insuranceVarRate: 8,
  selfPayRate: 20,
  selfPayUnit: 15000,
  selfPayRepeat: 30,
  selfPayCostRate: 25,
  rent: 400000,
  labor: 1200000,
  otherFixed: 300000,
  doctorPay: 800000,
  loanRepay: 400000,
  initialInvest: 10000000,
  rampMonths: 12,
  startRatio: 30,
  targetProfit: 500000,
};

const PRESETS: { name: string; desc: string; params: Params }[] = [
  {
    name: '保守的',
    desc: '自費が伸びにくい・立ち上がりゆっくり',
    params: {
      ...DEFAULT_PARAMS,
      visitsPerDay: 14,
      selfPayRate: 10,
      selfPayUnit: 10000,
      selfPayRepeat: 15,
      rampMonths: 18,
      startRatio: 20,
    },
  },
  {
    name: '標準',
    desc: '初期設定',
    params: { ...DEFAULT_PARAMS },
  },
  {
    name: '自費強化型',
    desc: '栄養療法・カウンセリング等の自費メニューが定着',
    params: {
      ...DEFAULT_PARAMS,
      visitsPerDay: 18,
      selfPayRate: 40,
      selfPayUnit: 20000,
      selfPayRepeat: 50,
      selfPayCostRate: 22,
      labor: 1500000,
      rampMonths: 10,
    },
  },
  {
    name: '自費中心（小規模）',
    desc: '保険は絞り、予約制の自費中心で少人数運営',
    params: {
      ...DEFAULT_PARAMS,
      visitsPerDay: 10,
      insuranceUnit: 4500,
      selfPayRate: 60,
      selfPayUnit: 25000,
      selfPayRepeat: 60,
      selfPayCostRate: 20,
      rent: 300000,
      labor: 600000,
      otherFixed: 250000,
      rampMonths: 14,
    },
  },
];

/* =========================================================
   計算ロジック
   ========================================================= */
function calcMonth(p: Params, visitsPerDay: number, ratio = 1): MonthResult {
  const visits = visitsPerDay * p.workDays * ratio;
  const insRev = visits * p.insuranceUnit;
  const selfCount = visits * (p.selfPayRate / 100);
  const selfRev = selfCount * p.selfPayUnit * (1 + p.selfPayRepeat / 100);
  const revenue = insRev + selfRev;
  const insVar = insRev * (p.insuranceVarRate / 100);
  const selfVar = selfRev * (p.selfPayCostRate / 100);
  const varCost = insVar + selfVar;
  const fixed = p.rent + p.labor + p.otherFixed + p.doctorPay + p.loanRepay;
  const profit = revenue - varCost - fixed;
  return { visits, insRev, selfCount, selfRev, revenue, insVar, selfVar, varCost, fixed, profit };
}

// 来院1人あたり限界利益（売上 − 変動費）
function contributionPerVisit(p: Params): number {
  const ins = p.insuranceUnit * (1 - p.insuranceVarRate / 100);
  const self =
    (p.selfPayRate / 100) * p.selfPayUnit * (1 + p.selfPayRepeat / 100) * (1 - p.selfPayCostRate / 100);
  return ins + self;
}

function fixedTotal(p: Params): number {
  return p.rent + p.labor + p.otherFixed + p.doctorPay + p.loanRepay;
}

// 損益分岐点（1日あたり来院数）
function breakEvenVisitsPerDay(p: Params): number {
  const cm = contributionPerVisit(p);
  if (cm <= 0) return Infinity;
  return fixedTotal(p) / cm / p.workDays;
}

// 立ち上がりを考慮した月次達成率
function rampRatio(p: Params, month: number): number {
  const start = p.startRatio / 100;
  if (p.rampMonths <= 1) return 1;
  if (month >= p.rampMonths) return 1;
  return start + (1 - start) * ((month - 1) / (p.rampMonths - 1));
}

function buildTimeline(p: Params, months = 36) {
  const rows: { month: number; ratio: number; profit: number; revenue: number; cumulative: number }[] = [];
  let cum = -p.initialInvest;
  for (let m = 1; m <= months; m++) {
    const ratio = rampRatio(p, m);
    const r = calcMonth(p, p.visitsPerDay, ratio);
    cum += r.profit;
    rows.push({ month: m, ratio, profit: r.profit, revenue: r.revenue, cumulative: cum });
  }
  const payback = rows.find((r) => r.cumulative >= 0)?.month ?? null;
  const breakEvenMonth = rows.find((r) => r.profit >= 0)?.month ?? null;
  return { rows, payback, breakEvenMonth };
}

/* =========================================================
   フォーマット系
   ========================================================= */
const nf = (n: number, digits = 0) =>
  n.toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const yen = (n: number) => `${nf(Math.round(n))}円`;
const man = (n: number) => `${nf(n / 10000)}万円`;
const signedMan = (n: number) => `${n >= 0 ? '+' : ''}${nf(n / 10000)}万円`;

function niceStep(raw: number): number {
  if (raw <= 0 || !isFinite(raw)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  const step = niceStep((max - min) / count);
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

/* =========================================================
   スライダー部品
   ========================================================= */
function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  hint?: string;
}) {
  const { label, value, min, max, step, onChange, format, hint } = props;
  return (
    <div className="sl">
      <div className="sl-head">
        <span className="sl-label">{label}</span>
        <span className="sl-value">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      {hint && <div className="sl-hint">{hint}</div>}
    </div>
  );
}

function Kpi(props: { title: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const { title, value, sub, tone = 'neutral' } = props;
  return (
    <div className={`kpi kpi-${tone}`}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

/* =========================================================
   グラフ1：損益分岐点チャート（来院数 × 金額）
   ========================================================= */
function BreakEvenChart({ p }: { p: Params }) {
  const W = 720;
  const H = 380;
  const ml = 64;
  const mr = 24;
  const mt = 24;
  const mb = 48;

  const fixed = fixedTotal(p);
  const cm = contributionPerVisit(p);
  const be = breakEvenVisitsPerDay(p);

  const maxX = useMemo(() => {
    let m = Math.max(40, p.visitsPerDay * 1.5);
    if (isFinite(be)) m = Math.max(m, be * 1.4);
    return Math.min(200, Math.ceil(m / 10) * 10);
  }, [p.visitsPerDay, be]);

  const rev = (x: number) => calcMonth(p, x).revenue;
  const cost = (x: number) => {
    const r = calcMonth(p, x);
    return r.varCost + r.fixed;
  };

  const yMaxRaw = Math.max(rev(maxX), cost(maxX), cost(0)) * 1.05;
  const yTicks = niceTicks(0, yMaxRaw, 5);
  const yMax = yTicks[yTicks.length - 1] || 1;

  const xs = (x: number) => ml + (x / maxX) * (W - ml - mr);
  const ys = (y: number) => H - mb - (y / yMax) * (H - mt - mb);

  const xStep = niceStep(maxX / 8);
  const xTicks: number[] = [];
  for (let v = 0; v <= maxX; v += xStep) xTicks.push(v);

  const beInRange = isFinite(be) && be <= maxX;

  // 領域（赤字ゾーン／黒字ゾーン）
  let lossPoly = '';
  let profitPoly = '';
  if (beInRange) {
    const yBe = rev(be);
    lossPoly = `${xs(0)},${ys(0)} ${xs(be)},${ys(yBe)} ${xs(0)},${ys(cost(0))}`;
    profitPoly = `${xs(be)},${ys(yBe)} ${xs(maxX)},${ys(rev(maxX))} ${xs(maxX)},${ys(cost(maxX))}`;
  } else {
    lossPoly = `${xs(0)},${ys(0)} ${xs(maxX)},${ys(rev(maxX))} ${xs(maxX)},${ys(cost(maxX))} ${xs(0)},${ys(cost(0))}`;
  }

  const curRev = rev(p.visitsPerDay);
  const curCost = cost(p.visitsPerDay);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="損益分岐点チャート">
      {/* グリッド */}
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={ml} x2={W - mr} y1={ys(t)} y2={ys(t)} stroke="#e5e7eb" />
          <text x={ml - 8} y={ys(t) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
            {nf(t / 10000)}万
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={xs(t)} x2={xs(t)} y1={mt} y2={H - mb} stroke="#f3f4f6" />
          <text x={xs(t)} y={H - mb + 18} textAnchor="middle" fontSize="11" fill="#6b7280">
            {t}
          </text>
        </g>
      ))}
      <text x={(ml + W - mr) / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="#374151">
        1日の来院数（人）
      </text>

      {/* 領域 */}
      <polygon points={lossPoly} fill="rgba(239,68,68,0.12)" />
      {profitPoly && <polygon points={profitPoly} fill="rgba(16,185,129,0.15)" />}

      {/* 固定費ライン */}
      <line x1={xs(0)} x2={xs(maxX)} y1={ys(fixed)} y2={ys(fixed)} stroke="#9ca3af" strokeDasharray="5 4" />
      <text x={W - mr - 4} y={ys(fixed) - 6} textAnchor="end" fontSize="11" fill="#6b7280">
        固定費 {man(fixed)}
      </text>

      {/* 総コスト・売上 */}
      <line x1={xs(0)} y1={ys(cost(0))} x2={xs(maxX)} y2={ys(cost(maxX))} stroke="#ef4444" strokeWidth="2.5" />
      <line x1={xs(0)} y1={ys(rev(0))} x2={xs(maxX)} y2={ys(rev(maxX))} stroke="#0d9488" strokeWidth="2.5" />

      {/* 損益分岐点 */}
      {beInRange && (
        <g>
          <line x1={xs(be)} x2={xs(be)} y1={mt} y2={H - mb} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth="1.5" />
          <circle cx={xs(be)} cy={ys(rev(be))} r="6" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
          <text x={xs(be) + 8} y={mt + 14} fontSize="12" fontWeight="700" fill="#b45309">
            損益分岐点 {nf(be, 1)}人/日
          </text>
        </g>
      )}

      {/* 現在地 */}
      <line x1={xs(p.visitsPerDay)} x2={xs(p.visitsPerDay)} y1={mt} y2={H - mb} stroke="#2563eb" strokeWidth="1.5" />
      <circle cx={xs(p.visitsPerDay)} cy={ys(curRev)} r="5" fill="#0d9488" stroke="#fff" strokeWidth="2" />
      <circle cx={xs(p.visitsPerDay)} cy={ys(curCost)} r="5" fill="#ef4444" stroke="#fff" strokeWidth="2" />
      <text
        x={xs(p.visitsPerDay) + (p.visitsPerDay > maxX * 0.75 ? -8 : 8)}
        y={H - mb - 8}
        textAnchor={p.visitsPerDay > maxX * 0.75 ? 'end' : 'start'}
        fontSize="12"
        fontWeight="700"
        fill="#1d4ed8"
      >
        現在 {p.visitsPerDay}人/日
      </text>

      {/* 凡例 */}
      <g transform={`translate(${ml + 8}, ${mt + 4})`}>
        <rect width="208" height="62" rx="6" fill="#fff" stroke="#e5e7eb" />
        <line x1="10" x2="34" y1="16" y2="16" stroke="#0d9488" strokeWidth="3" />
        <text x="40" y="20" fontSize="11" fill="#374151">売上（保険＋自費）</text>
        <line x1="10" x2="34" y1="32" y2="32" stroke="#ef4444" strokeWidth="3" />
        <text x="40" y="36" fontSize="11" fill="#374151">総コスト（変動費＋固定費）</text>
        <line x1="10" x2="34" y1="48" y2="48" stroke="#9ca3af" strokeWidth="2" strokeDasharray="5 4" />
        <text x="40" y="52" fontSize="11" fill="#374151">固定費（返済・院長報酬込み）</text>
      </g>

      {cm <= 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="14" fill="#b91c1c" fontWeight="700">
          限界利益がマイナスのため、来院数を増やしても黒字化しません
        </text>
      )}
    </svg>
  );
}

/* =========================================================
   グラフ2：累積キャッシュ推移（36ヶ月）
   ========================================================= */
function CumulativeChart({
  rows,
  initialInvest,
  payback,
  breakEvenMonth,
}: {
  rows: { month: number; profit: number; cumulative: number }[];
  initialInvest: number;
  payback: number | null;
  breakEvenMonth: number | null;
}) {
  const W = 720;
  const H = 330;
  const ml = 64;
  const mr = 24;
  const mt = 20;
  const mb = 44;
  const months = rows.length;

  const values = [-initialInvest, ...rows.map((r) => r.cumulative), ...rows.map((r) => r.profit), 0];
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const yTicks = niceTicks(Math.min(vMin, 0), Math.max(vMax, 0), 5);
  const yLo = yTicks[0];
  const yHi = yTicks[yTicks.length - 1] || 1;

  const xs = (m: number) => ml + (m / months) * (W - ml - mr);
  const ys = (v: number) => H - mb - ((v - yLo) / (yHi - yLo || 1)) * (H - mt - mb);

  const cumPath = [`M ${xs(0)} ${ys(-initialInvest)}`, ...rows.map((r) => `L ${xs(r.month)} ${ys(r.cumulative)}`)].join(' ');
  const barW = Math.max(3, ((W - ml - mr) / months) * 0.55);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="累積キャッシュ推移">
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={ml} x2={W - mr} y1={ys(t)} y2={ys(t)} stroke={t === 0 ? '#6b7280' : '#e5e7eb'} strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={ml - 8} y={ys(t) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
            {nf(t / 10000)}万
          </text>
        </g>
      ))}
      {[0, 6, 12, 18, 24, 30, 36].map((m) => (
        <text key={`x${m}`} x={xs(m)} y={H - mb + 18} textAnchor="middle" fontSize="11" fill="#6b7280">
          {m}
        </text>
      ))}
      <text x={(ml + W - mr) / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="#374151">
        開業からの月数
      </text>

      {/* 月次利益（棒） */}
      {rows.map((r) => {
        const y0 = ys(0);
        const y1 = ys(r.profit);
        return (
          <rect
            key={r.month}
            x={xs(r.month) - barW / 2}
            y={Math.min(y0, y1)}
            width={barW}
            height={Math.abs(y1 - y0)}
            fill={r.profit >= 0 ? 'rgba(16,185,129,0.55)' : 'rgba(239,68,68,0.5)'}
          />
        );
      })}

      {/* 累積キャッシュ（線） */}
      <path d={cumPath} fill="none" stroke="#2563eb" strokeWidth="2.5" />

      {breakEvenMonth && (
        <g>
          <line x1={xs(breakEvenMonth)} x2={xs(breakEvenMonth)} y1={mt} y2={H - mb} stroke="#f59e0b" strokeDasharray="4 4" />
          <text x={xs(breakEvenMonth) + 4} y={mt + 12} fontSize="11" fontWeight="700" fill="#b45309">
            月次黒字化 {breakEvenMonth}ヶ月目
          </text>
        </g>
      )}
      {payback && (
        <g>
          <circle cx={xs(payback)} cy={ys(rows[payback - 1].cumulative)} r="6" fill="#2563eb" stroke="#fff" strokeWidth="2" />
          <text x={xs(payback) - 8} y={ys(rows[payback - 1].cumulative) - 12} textAnchor="end" fontSize="11" fontWeight="700" fill="#1d4ed8">
            投資回収 {payback}ヶ月目
          </text>
        </g>
      )}

      <g transform={`translate(${ml + 8}, ${H - mb - 58})`}>
        <rect width="188" height="48" rx="6" fill="#fff" stroke="#e5e7eb" />
        <line x1="10" x2="34" y1="16" y2="16" stroke="#2563eb" strokeWidth="3" />
        <text x="40" y="20" fontSize="11" fill="#374151">累積キャッシュ（初期投資控除後）</text>
        <rect x="10" y="29" width="24" height="9" fill="rgba(16,185,129,0.55)" />
        <text x="40" y="38" fontSize="11" fill="#374151">月次利益（緑：黒字／赤：赤字）</text>
      </g>
    </svg>
  );
}

/* =========================================================
   ヒートマップ：来院数 × 自費移行率
   ========================================================= */
function Heatmap({ p }: { p: Params }) {
  const visitsList = [8, 12, 16, 20, 25, 30, 40, 50];
  const rateList = [0, 10, 20, 30, 40, 50, 60];

  const grid = rateList.map((rate) =>
    visitsList.map((v) => calcMonth({ ...p, selfPayRate: rate }, v).profit)
  );
  const maxAbs = Math.max(1, ...grid.flat().map((v) => Math.abs(v)));

  return (
    <div className="heat-wrap">
      <table className="heat">
        <thead>
          <tr>
            <th>自費移行率＼来院数/日</th>
            {visitsList.map((v) => (
              <th key={v}>{v}人</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rateList.map((rate, i) => (
            <tr key={rate}>
              <th>{rate}%</th>
              {grid[i].map((val, j) => {
                const a = Math.min(0.85, 0.12 + (Math.abs(val) / maxAbs) * 0.73);
                const bg = val >= 0 ? `rgba(16,185,129,${a})` : `rgba(239,68,68,${a})`;
                return (
                  <td key={j} style={{ background: bg }}>
                    {nf(val / 10000)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="note">単位：万円／月（返済・院長報酬後の利益）。他の条件は現在のスライダー設定を使用。</div>
    </div>
  );
}

/* =========================================================
   メインページ
   ========================================================= */
export default function SimulatorPage() {
  const [p, setP] = useState<Params>(DEFAULT_PARAMS);
  const [loaded, setLoaded] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  // localStorage から復元
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setP({ ...DEFAULT_PARAMS, ...parsed });
      }
    } catch {
      // 読み込み失敗時は初期値のまま
    }
    setLoaded(true);
  }, []);

  // localStorage へ保存
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // 保存失敗は無視
    }
  }, [p, loaded]);

  const set = <K extends keyof Params>(key: K, value: Params[K]) => setP((prev) => ({ ...prev, [key]: value }));

  const steady = useMemo(() => calcMonth(p, p.visitsPerDay), [p]);
  const cm = useMemo(() => contributionPerVisit(p), [p]);
  const be = useMemo(() => breakEvenVisitsPerDay(p), [p]);
  const fixed = useMemo(() => fixedTotal(p), [p]);
  const timeline = useMemo(() => buildTimeline(p, 36), [p]);

  const beRevenue = isFinite(be) ? calcMonth(p, be).revenue : Infinity;
  const marginOfSafety = steady.revenue > 0 && isFinite(beRevenue) ? (steady.revenue - beRevenue) / steady.revenue : null;
  const selfShare = steady.revenue > 0 ? steady.selfRev / steady.revenue : 0;

  const requiredVisits = cm > 0 ? (fixed + p.targetProfit) / cm / p.workDays : Infinity;

  const whatIfs = useMemo(() => {
    const base = steady.profit;
    const items = [
      { label: '1日の来院数 +5人', profit: calcMonth(p, p.visitsPerDay + 5).profit },
      { label: '自費移行率 +5pt', profit: calcMonth({ ...p, selfPayRate: p.selfPayRate + 5 }, p.visitsPerDay).profit },
      { label: '自費平均単価 +5,000円', profit: calcMonth({ ...p, selfPayUnit: p.selfPayUnit + 5000 }, p.visitsPerDay).profit },
      { label: '自費リピート率 +10pt', profit: calcMonth({ ...p, selfPayRepeat: p.selfPayRepeat + 10 }, p.visitsPerDay).profit },
      { label: '人件費 −20万円', profit: calcMonth({ ...p, labor: Math.max(0, p.labor - 200000) }, p.visitsPerDay).profit },
      { label: '家賃 −10万円', profit: calcMonth({ ...p, rent: Math.max(0, p.rent - 100000) }, p.visitsPerDay).profit },
    ];
    return items.map((i) => ({ ...i, diff: i.profit - base }));
  }, [p, steady.profit]);

  const saveSnapshot = () => {
    setSnapshot({
      label: `保存時（${p.visitsPerDay}人/日・自費${p.selfPayRate}%・単価${nf(p.selfPayUnit)}円）`,
      profit: steady.profit,
      revenue: steady.revenue,
      beVisitsPerDay: be,
      payback: timeline.payback,
      breakEvenMonth: timeline.breakEvenMonth,
    });
  };

  const downloadCsv = () => {
    const lines: string[] = [];
    lines.push('統合医療クリニック 収支シミュレーション');
    lines.push('');
    lines.push('【前提条件】');
    lines.push(`1日の来院数,${p.visitsPerDay}`);
    lines.push(`月の診療日数,${p.workDays}`);
    lines.push(`保険診療 平均単価,${p.insuranceUnit}`);
    lines.push(`保険診療 変動費率(%),${p.insuranceVarRate}`);
    lines.push(`自費移行率(%),${p.selfPayRate}`);
    lines.push(`自費平均単価,${p.selfPayUnit}`);
    lines.push(`自費リピート率(%),${p.selfPayRepeat}`);
    lines.push(`自費原価率(%),${p.selfPayCostRate}`);
    lines.push(`家賃,${p.rent}`);
    lines.push(`人件費,${p.labor}`);
    lines.push(`その他固定費,${p.otherFixed}`);
    lines.push(`院長報酬,${p.doctorPay}`);
    lines.push(`借入返済(月),${p.loanRepay}`);
    lines.push(`初期投資(自己資金),${p.initialInvest}`);
    lines.push(`立ち上がり月数,${p.rampMonths}`);
    lines.push(`開業1ヶ月目の達成率(%),${p.startRatio}`);
    lines.push('');
    lines.push('【定常月の結果】');
    lines.push(`月間売上,${Math.round(steady.revenue)}`);
    lines.push(`保険売上,${Math.round(steady.insRev)}`);
    lines.push(`自費売上,${Math.round(steady.selfRev)}`);
    lines.push(`変動費,${Math.round(steady.varCost)}`);
    lines.push(`固定費合計,${Math.round(steady.fixed)}`);
    lines.push(`月間利益,${Math.round(steady.profit)}`);
    lines.push(`損益分岐点(人/日),${isFinite(be) ? be.toFixed(1) : '到達不可'}`);
    lines.push('');
    lines.push('【月次推移】');
    lines.push('月,達成率(%),売上,月次利益,累積キャッシュ');
    timeline.rows.forEach((r) => {
      lines.push(`${r.month},${Math.round(r.ratio * 100)},${Math.round(r.revenue)},${Math.round(r.profit)},${Math.round(r.cumulative)}`);
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clinic-simulation.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const profitable = steady.profit >= 0;

  const breakdown = [
    { label: '保険診療売上', value: steady.insRev, color: '#0d9488', sign: '+' },
    { label: '自費診療売上', value: steady.selfRev, color: '#14b8a6', sign: '+' },
    { label: '変動費（薬剤・材料・原価）', value: steady.varCost, color: '#f97316', sign: '−' },
    { label: '人件費', value: p.labor, color: '#ef4444', sign: '−' },
    { label: '家賃', value: p.rent, color: '#f87171', sign: '−' },
    { label: 'その他固定費', value: p.otherFixed, color: '#fb923c', sign: '−' },
    { label: '院長報酬', value: p.doctorPay, color: '#a78bfa', sign: '−' },
    { label: '借入返済', value: p.loanRepay, color: '#94a3b8', sign: '−' },
  ];
  const breakdownMax = Math.max(1, steady.revenue, steady.varCost + fixed);

  return (
    <div className="page">
      <style>{css}</style>

      <header className="top">
        <div>
          <h1>統合医療クリニック 収支・損益分岐点シミュレーター</h1>
          <p className="lead">
            保険診療の「来院数 × 単価」に、自費（栄養療法・カウンセリング・サプリ等）の「移行率 × 単価 × リピート」を掛け合わせて、
            月間利益と黒字化ラインをリアルタイムに確認できます。
          </p>
        </div>
        <Link href="/" className="back">← ホームに戻る</Link>
      </header>

      <div className="layout">
        {/* ============ 左：入力 ============ */}
        <aside className="panel controls">
          <div className="preset-row">
            {PRESETS.map((pr) => (
              <button key={pr.name} className="chip" title={pr.desc} onClick={() => setP({ ...pr.params })}>
                {pr.name}
              </button>
            ))}
          </div>

          <h3>患者数・診療日</h3>
          <Slider label="1日の来院数（延べ）" value={p.visitsPerDay} min={1} max={80} step={1} onChange={(v) => set('visitsPerDay', v)} format={(v) => `${v}人`} />
          <Slider label="月の診療日数" value={p.workDays} min={12} max={30} step={1} onChange={(v) => set('workDays', v)} format={(v) => `${v}日`} />

          <h3>保険診療</h3>
          <Slider label="保険診療 平均単価" value={p.insuranceUnit} min={2000} max={15000} step={100} onChange={(v) => set('insuranceUnit', v)} format={yen} hint="再診中心の心療内科は4,000〜6,000円程度が目安" />
          <Slider label="保険診療 変動費率" value={p.insuranceVarRate} min={0} max={30} step={1} onChange={(v) => set('insuranceVarRate', v)} format={(v) => `${v}%`} hint="薬剤・検査外注・医療材料など" />

          <h3>自由診療（自費）</h3>
          <Slider label="自費移行率" value={p.selfPayRate} min={0} max={100} step={1} onChange={(v) => set('selfPayRate', v)} format={(v) => `${v}%`} hint="来院患者のうち自費メニューを利用する割合" />
          <Slider label="自費平均単価" value={p.selfPayUnit} min={3000} max={100000} step={500} onChange={(v) => set('selfPayUnit', v)} format={yen} />
          <Slider label="自費リピート率" value={p.selfPayRepeat} min={0} max={200} step={5} onChange={(v) => set('selfPayRepeat', v)} format={(v) => `${v}%`} hint="同月内の追加購入・継続プログラム分（売上に +x% 上乗せ）" />
          <Slider label="自費原価率" value={p.selfPayCostRate} min={0} max={80} step={1} onChange={(v) => set('selfPayCostRate', v)} format={(v) => `${v}%`} hint="サプリ・点滴・検査原価など" />

          <h3>固定費</h3>
          <Slider label="家賃" value={p.rent} min={0} max={2000000} step={10000} onChange={(v) => set('rent', v)} format={yen} />
          <Slider label="人件費（看護師・受付・心理士等）" value={p.labor} min={0} max={5000000} step={50000} onChange={(v) => set('labor', v)} format={yen} hint="社会保険料などの会社負担込み" />
          <Slider label="その他固定費" value={p.otherFixed} min={0} max={2000000} step={10000} onChange={(v) => set('otherFixed', v)} format={yen} hint="広告費・リース・保守・水道光熱・システム等" />
          <Slider label="院長報酬（役員報酬）" value={p.doctorPay} min={0} max={3000000} step={50000} onChange={(v) => set('doctorPay', v)} format={yen} />
          <Slider label="借入返済（月）" value={p.loanRepay} min={0} max={2000000} step={10000} onChange={(v) => set('loanRepay', v)} format={yen} />

          <h3>開業計画</h3>
          <Slider label="初期投資（自己資金負担分）" value={p.initialInvest} min={0} max={50000000} step={500000} onChange={(v) => set('initialInvest', v)} format={man} />
          <Slider label="目標達成までの月数" value={p.rampMonths} min={1} max={36} step={1} onChange={(v) => set('rampMonths', v)} format={(v) => `${v}ヶ月`} hint="患者数が設定値に到達するまでの立ち上がり期間" />
          <Slider label="開業1ヶ月目の達成率" value={p.startRatio} min={5} max={100} step={5} onChange={(v) => set('startRatio', v)} format={(v) => `${v}%`} />
          <Slider label="目標月間利益" value={p.targetProfit} min={0} max={5000000} step={50000} onChange={(v) => set('targetProfit', v)} format={yen} hint="返済・院長報酬を払った後に残したい利益" />

          <div className="btn-row">
            <button className="btn" onClick={() => setP({ ...DEFAULT_PARAMS })}>初期値に戻す</button>
            <button className="btn btn-primary" onClick={downloadCsv}>CSV出力</button>
          </div>
        </aside>

        {/* ============ 右：結果 ============ */}
        <main className="results">
          <section className={`verdict ${profitable ? 'verdict-good' : 'verdict-bad'}`}>
            {profitable ? (
              <>
                現在の設定では <b>月間 {man(steady.profit)} の黒字</b> です。損益分岐点（{isFinite(be) ? `${nf(be, 1)}人/日` : '—'}）に対して
                {marginOfSafety !== null ? ` 安全余裕率は ${nf(marginOfSafety * 100, 0)}%` : ''} です。
              </>
            ) : (
              <>
                現在の設定では <b>月間 {man(Math.abs(steady.profit))} の赤字</b> です。
                {isFinite(be) ? ` 黒字化には1日あたり ${nf(be, 1)}人（あと ${nf(Math.max(0, be - p.visitsPerDay), 1)}人）が必要です。` : ' 限界利益がマイナスのため、単価・原価率の見直しが必要です。'}
              </>
            )}
          </section>

          <section className="kpis">
            <Kpi title="月間売上" value={man(steady.revenue)} sub={`保険 ${man(steady.insRev)} ／ 自費 ${man(steady.selfRev)}`} />
            <Kpi title="月間利益（定常）" value={signedMan(steady.profit)} sub="返済・院長報酬後" tone={profitable ? 'good' : 'bad'} />
            <Kpi title="損益分岐点" value={isFinite(be) ? `${nf(be, 1)}人/日` : '到達不可'} sub={isFinite(beRevenue) ? `月商 ${man(beRevenue)}` : undefined} />
            <Kpi title="自費売上比率" value={`${nf(selfShare * 100, 0)}%`} sub={`自費件数 ${nf(steady.selfCount, 0)}件/月`} />
            <Kpi title="月次黒字化" value={timeline.breakEvenMonth ? `${timeline.breakEvenMonth}ヶ月目` : '36ヶ月以内なし'} tone={timeline.breakEvenMonth ? 'good' : 'bad'} />
            <Kpi title="初期投資の回収" value={timeline.payback ? `${timeline.payback}ヶ月目` : '36ヶ月以内なし'} sub={`初期投資 ${man(p.initialInvest)}`} tone={timeline.payback ? 'good' : 'bad'} />
          </section>

          <section className="panel">
            <h2>① 損益分岐点チャート</h2>
            <p className="desc">来院数が増えるほど売上線がコスト線を上回る地点が黒字化ラインです。青線が現在の設定です。</p>
            <BreakEvenChart p={p} />
          </section>

          <section className="panel">
            <h2>② 開業後36ヶ月の累積キャッシュ</h2>
            <p className="desc">立ち上がり（初月{p.startRatio}% → {p.rampMonths}ヶ月で100%）を考慮し、初期投資の回収時期を見ます。</p>
            <CumulativeChart rows={timeline.rows} initialInvest={p.initialInvest} payback={timeline.payback} breakEvenMonth={timeline.breakEvenMonth} />
          </section>

          <section className="panel">
            <h2>③ 目標利益から逆算</h2>
            <div className="reverse">
              <div>
                目標月間利益 <b>{man(p.targetProfit)}</b> を達成するには
              </div>
              <div className="reverse-big">{isFinite(requiredVisits) ? `${nf(requiredVisits, 1)}人/日` : '到達不可'}</div>
              <div className="desc">
                {isFinite(requiredVisits)
                  ? `現在の設定（${p.visitsPerDay}人/日）との差：${requiredVisits - p.visitsPerDay >= 0 ? '+' : ''}${nf(requiredVisits - p.visitsPerDay, 1)}人/日`
                  : '限界利益がマイナスです。単価・原価率を見直してください。'}
              </div>
              {isFinite(requiredVisits) && requiredVisits > 40 && (
                <div className="warn">
                  ⚠ 1日40人超は、1人の医師では診察時間の確保が難しい水準です。自費移行率・単価の改善で必要来院数を下げる方法も検討してください。
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>④ 来院数 × 自費移行率 の利益マップ</h2>
            <Heatmap p={p} />
          </section>

          <section className="panel">
            <h2>⑤ もしも分析（月間利益へのインパクト）</h2>
            <p className="desc">現在の設定から1項目だけ変えた場合の、月間利益の変化です。</p>
            <div className="whatif">
              {[...whatIfs]
                .sort((a, b) => b.diff - a.diff)
                .map((w) => (
                  <div key={w.label} className="whatif-row">
                    <span>{w.label}</span>
                    <span className={w.diff >= 0 ? 'pos' : 'neg'}>{signedMan(w.diff)}</span>
                  </div>
                ))}
            </div>
          </section>

          <section className="panel">
            <h2>⑥ 月次の収支内訳（定常月）</h2>
            {breakdown.map((b) => (
              <div key={b.label} className="bd-row">
                <div className="bd-label">{b.label}</div>
                <div className="bd-bar-wrap">
                  <div className="bd-bar" style={{ width: `${Math.min(100, (b.value / breakdownMax) * 100)}%`, background: b.color }} />
                </div>
                <div className="bd-val">
                  {b.sign}
                  {man(b.value)}
                </div>
              </div>
            ))}
            <div className="bd-total">
              <span>月間利益</span>
              <span className={profitable ? 'pos' : 'neg'}>{signedMan(steady.profit)}</span>
            </div>
            <div className="note">※ 税金（法人税・所得税等）は含まれていません。実際の手残りは税引後で別途ご確認ください。</div>
          </section>

          <section className="panel">
            <h2>⑦ シナリオ比較</h2>
            <p className="desc">条件を保存してからスライダーを動かすと、保存時点との差を確認できます。</p>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={saveSnapshot}>現在の条件を比較用に保存</button>
              {snapshot && <button className="btn" onClick={() => setSnapshot(null)}>保存を削除</button>}
            </div>
            {snapshot && (
              <table className="cmp">
                <thead>
                  <tr>
                    <th>項目</th>
                    <th>保存時</th>
                    <th>現在</th>
                    <th>差</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={4} className="cmp-label">{snapshot.label}</td>
                  </tr>
                  <tr>
                    <td>月間売上</td>
                    <td>{man(snapshot.revenue)}</td>
                    <td>{man(steady.revenue)}</td>
                    <td>{signedMan(steady.revenue - snapshot.revenue)}</td>
                  </tr>
                  <tr>
                    <td>月間利益</td>
                    <td>{man(snapshot.profit)}</td>
                    <td>{man(steady.profit)}</td>
                    <td className={steady.profit - snapshot.profit >= 0 ? 'pos' : 'neg'}>{signedMan(steady.profit - snapshot.profit)}</td>
                  </tr>
                  <tr>
                    <td>損益分岐点（人/日）</td>
                    <td>{isFinite(snapshot.beVisitsPerDay) ? nf(snapshot.beVisitsPerDay, 1) : '—'}</td>
                    <td>{isFinite(be) ? nf(be, 1) : '—'}</td>
                    <td>
                      {isFinite(be) && isFinite(snapshot.beVisitsPerDay)
                        ? `${be - snapshot.beVisitsPerDay >= 0 ? '+' : ''}${nf(be - snapshot.beVisitsPerDay, 1)}`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td>月次黒字化</td>
                    <td>{snapshot.breakEvenMonth ? `${snapshot.breakEvenMonth}ヶ月目` : 'なし'}</td>
                    <td>{timeline.breakEvenMonth ? `${timeline.breakEvenMonth}ヶ月目` : 'なし'}</td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <td>投資回収</td>
                    <td>{snapshot.payback ? `${snapshot.payback}ヶ月目` : 'なし'}</td>
                    <td>{timeline.payback ? `${timeline.payback}ヶ月目` : 'なし'}</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            )}
          </section>

          <p className="foot">
            ※ 本シミュレーターは簡易モデルによる試算です。診療報酬改定、実際の患者動態、税金・社会保険、減価償却等は反映していません。
            開業計画の最終判断は、税理士・医業コンサルタント等の専門家にご相談ください。
          </p>
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   スタイル
   ========================================================= */
const css = `
  .page {
    min-height: 100vh;
    background: #f3f6f8;
    color: #1f2937;
    padding: 20px 16px 60px;
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "Segoe UI", sans-serif;
  }
  .top {
    max-width: 1280px;
    margin: 0 auto 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }
  .top h1 { font-size: 22px; margin: 0 0 6px; color: #0f766e; }
  .lead { margin: 0; font-size: 13px; color: #4b5563; max-width: 760px; line-height: 1.6; }
  .back {
    font-size: 13px; color: #0f766e; text-decoration: none; border: 1px solid #99f6e4;
    padding: 6px 12px; border-radius: 999px; background: #fff; white-space: nowrap;
  }
  .back:hover { background: #f0fdfa; }

  .layout {
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 960px) {
    .layout { grid-template-columns: 1fr; }
  }

  .panel {
    background: #fff;
    border-radius: 14px;
    padding: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.07);
    margin-bottom: 16px;
  }
  .panel h2 { font-size: 16px; margin: 0 0 4px; color: #0f172a; }
  .panel h3 {
    font-size: 13px; margin: 18px 0 8px; color: #0f766e;
    border-bottom: 2px solid #ccfbf1; padding-bottom: 4px;
  }
  .controls { position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow-y: auto; margin-bottom: 0; }
  @media (max-width: 960px) {
    .controls { position: static; max-height: none; margin-bottom: 16px; }
  }

  .preset-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    border: 1px solid #99f6e4; background: #f0fdfa; color: #0f766e; border-radius: 999px;
    padding: 5px 10px; font-size: 12px; cursor: pointer;
  }
  .chip:hover { background: #ccfbf1; }

  .sl { margin-bottom: 12px; }
  .sl-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .sl-label { font-size: 12.5px; color: #374151; }
  .sl-value { font-size: 13px; font-weight: 700; color: #0f766e; white-space: nowrap; }
  .sl input[type=range] { width: 100%; accent-color: #0d9488; margin: 4px 0 0; }
  .sl-hint { font-size: 11px; color: #9ca3af; margin-top: 1px; }

  .btn-row { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
  .btn {
    border: 1px solid #d1d5db; background: #fff; color: #374151; padding: 8px 14px;
    border-radius: 8px; font-size: 13px; cursor: pointer;
  }
  .btn:hover { background: #f9fafb; }
  .btn-primary { background: #0d9488; border-color: #0d9488; color: #fff; }
  .btn-primary:hover { background: #0f766e; }

  .verdict { border-radius: 14px; padding: 14px 16px; margin-bottom: 16px; font-size: 14px; line-height: 1.7; }
  .verdict-good { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
  .verdict-bad { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .kpi { background: #fff; border-radius: 12px; padding: 12px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); border-left: 4px solid #cbd5e1; }
  .kpi-good { border-left-color: #10b981; }
  .kpi-bad { border-left-color: #ef4444; }
  .kpi-title { font-size: 11.5px; color: #6b7280; }
  .kpi-value { font-size: 20px; font-weight: 800; margin-top: 2px; color: #0f172a; }
  .kpi-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }

  .desc { font-size: 12.5px; color: #6b7280; margin: 2px 0 10px; line-height: 1.6; }
  .chart { width: 100%; height: auto; display: block; }

  .heat-wrap { overflow-x: auto; }
  .heat { border-collapse: collapse; width: 100%; font-size: 12px; min-width: 560px; }
  .heat th { background: #f3f4f6; padding: 6px 8px; font-weight: 600; color: #374151; text-align: center; border: 1px solid #fff; }
  .heat td { text-align: center; padding: 8px 6px; border: 1px solid #fff; font-weight: 600; color: #111827; }

  .reverse { text-align: center; padding: 6px 0; }
  .reverse-big { font-size: 34px; font-weight: 800; color: #0f766e; margin: 4px 0; }
  .warn { margin-top: 8px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 8px 10px; border-radius: 8px; font-size: 12.5px; text-align: left; }

  .whatif-row { display: flex; justify-content: space-between; padding: 9px 4px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; }
  .pos { color: #059669; font-weight: 700; }
  .neg { color: #dc2626; font-weight: 700; }

  .bd-row { display: grid; grid-template-columns: 180px 1fr 100px; gap: 10px; align-items: center; padding: 5px 0; font-size: 12.5px; }
  @media (max-width: 600px) { .bd-row { grid-template-columns: 110px 1fr 84px; } }
  .bd-bar-wrap { background: #f1f5f9; border-radius: 6px; height: 14px; overflow: hidden; }
  .bd-bar { height: 100%; border-radius: 6px; transition: width .2s; }
  .bd-val { text-align: right; font-variant-numeric: tabular-nums; color: #374151; }
  .bd-total { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px solid #e5e7eb; font-weight: 700; font-size: 15px; }

  .cmp { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
  .cmp th, .cmp td { padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right; }
  .cmp th:first-child, .cmp td:first-child { text-align: left; }
  .cmp th { background: #f8fafc; color: #475569; }
  .cmp-label { text-align: left !important; font-size: 12px; color: #6b7280; background: #fafafa; }

  .note { font-size: 11.5px; color: #9ca3af; margin-top: 8px; }
  .foot { font-size: 11.5px; color: #9ca3af; line-height: 1.7; padding: 0 4px; }
`;