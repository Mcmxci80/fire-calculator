import React, { useMemo, useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

function formatCurrency(x) {
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function toPct(x) {
  if (x === "" || x === null || x === undefined) return 0;
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function nval(x, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function buildCSV(rows) {
  if (!rows || !rows.length) return "";
  const process = (r) => r.map((c) => (typeof c === "string" ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",");
  return [rows[0].map((h) => `"${h}"`).join(","), ...rows.slice(1).map(process)].join("\n");
}

function downloadCSV(filename, rows) {
  const csv = buildCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function requiredPrincipalByFormula({ firstWithdrawal, r, g, N, timing }) {
  if (N <= 0) return 0;
  let pv;
  if (Math.abs(r - g) < 1e-9) {
    pv = (firstWithdrawal * N) / (1 + r);
  } else {
    const ratio = Math.pow((1 + g) / (1 + r), N);
    pv = (firstWithdrawal * (1 - ratio)) / (r - g);
  }
  if (timing === "begin") pv *= 1 + r;
  return Math.max(0, pv);
}

function simulateCashflow({ initialPrincipal, years, expense0, r, g, timing }) {
  const rows = [];
  let principal = initialPrincipal;
  for (let y = 1; y <= years; y++) {
    const expense = expense0 * Math.pow(1 + g, y - 1);
    let growth;
    if (timing === "end") {
      growth = principal * r;
      principal = principal + growth - expense;
    } else {
      principal = principal - expense;
      growth = principal * r;
      principal = principal + growth;
    }
    rows.push({ year: y, expense, growth, endPrincipal: principal });
  }
  return rows;
}

function simulateUntilDepleted({ initialPrincipal, expense0, r, g, timing, maxYears = 200 }) {
  const rows = [];
  let principal = initialPrincipal;
  let y = 0;
  while (y < maxYears && principal > 0) {
    y += 1;
    const expense = expense0 * Math.pow(1 + g, y - 1);
    let growth;
    if (timing === "end") {
      growth = principal * r;
      principal = principal + growth - expense;
    } else {
      principal = principal - expense;
      growth = principal * r;
      principal = principal + growth;
    }
    rows.push({ year: y, expense, growth, endPrincipal: principal });
  }
  return rows;
}

function simulateCompound({ years, principal0, monthly, r }) {
  const rows = [];
  let balance = principal0;
  const monthlyRate = r / 12;
  for (let y = 1; y <= years; y++) {
    for (let m = 1; m <= 12; m++) {
      balance = balance * (1 + monthlyRate) + monthly;
    }
    rows.push({ year: y, expense: 0, growth: balance, endPrincipal: balance });
  }
  return rows;
}

function almostEqual(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function runTests() {
  const r = 0.07;
  const g = 0.03;
  const N = 30;
  const W1 = 100000;
  const pvEnd = requiredPrincipalByFormula({ firstWithdrawal: W1, r, g, N, timing: "end" });
  const simEnd = simulateCashflow({ initialPrincipal: pvEnd, years: N, expense0: W1, r, g, timing: "end" });
  console.assert(almostEqual(simEnd[simEnd.length - 1].endPrincipal, 0, 1), "end timing fails");
  const pvBegin = requiredPrincipalByFormula({ firstWithdrawal: W1, r, g, N, timing: "begin" });
  const simBegin = simulateCashflow({ initialPrincipal: pvBegin, years: N, expense0: W1, r, g, timing: "begin" });
  console.assert(almostEqual(simBegin[simBegin.length - 1].endPrincipal, 0, 1), "begin timing fails");
  const csv = buildCSV([["a","b"],[1,2],[3,4]]);
  console.assert(csv.split("\n").length === 3, "csv rows count");
  const esc = buildCSV([["h1","h2"],["x,y","q\"q"]]);
  console.assert(esc.includes('"x,y"') && esc.includes('"q""q"'), "csv escaping");
  const comp = simulateCompound({ years: 2, principal0: 1000, monthly: 100, r: 0.12 });
  console.assert(comp.length === 2 && comp[1].endPrincipal > comp[0].endPrincipal, "compound growth");
  const comp0 = simulateCompound({ years: 1, principal0: 0, monthly: 100, r: 0 });
  console.assert(almostEqual(comp0[0].endPrincipal, 1200, 1e-9), "compound zero-rate");
  console.assert(simEnd.length === N, "rows length");
}

const translations = {
  en: {
    title: "Retirement Expense Calculator",
    subtitle: "Enter conditions → Calculate required initial principal, supported years, or compound growth.",
    mode: "Mode",
    byYears: "Target Years",
    byPrincipal: "Given Principal",
    byCompound: "Compound",
    basic: "Basic Parameters",
    years: "Years",
    firstExpense: "First Year Expense",
    inflation: "Inflation (%/yr)",
    timing: "Withdrawal Timing",
    end: "End of Year",
    begin: "Beginning of Year",
    allocation: "Asset Allocation",
    etf: "ETF (%)",
    bond: "Bond (%)",
    cash: "Cash (%)",
    warning: "⚠️ Allocation sum is currently {sum}%, please adjust to 100%.",
    return: "Expected Returns",
    returnInfo: "Weighted nominal return ≈ {ret}% (r), inflation g = {inf}%, r − g = {diff}%",
    lowReturn: "⚠️ Nominal return ≤ inflation, capital may deplete faster.",
    required: "Required Initial Principal",
    yearsResult: "Years Supported",
    initialPrincipal: "Initial Principal",
    monthly: "Monthly Contribution",
    compoundBalance: "Compound Final Balance",
    formula: "Formula: PV_end = W₁ · [1 - ((1+g)/(1+r))^N] / (r - g). Beginning withdrawals multiply by (1+r).",
    chart: "Chart",
    table: "Table",
    download: "Download CSV",
    year: "Year",
    expense: "Expense",
    growth: "Return",
    principal: "End Principal",
    balance: "Estimated final balance at year {years}: {balance}",
    notes: "Notes & Assumptions",
    compYears: "Years",
    compInitial: "Initial Principal",
    compMonthly: "Monthly Contribution",
    noteList: [
      "Toggle beginning/end withdrawals.",
      "First year withdrawal = first expense, grows by g annually.",
      "Nominal return r from allocation weights.",
      "Compound assumes monthly contributions and monthly compounding.",
      "Educational use only."
    ]
  },
  zh: {
    title: "退休支出試算器",
    subtitle: "輸入條件 → 計算所需起始本金、可支撐年數，或複利成長。",
    mode: "模式",
    byYears: "輸入年數",
    byPrincipal: "輸入本金",
    byCompound: "複利計算",
    basic: "基本參數",
    years: "期間（年）",
    firstExpense: "首年支出",
    inflation: "通膨（%/年）",
    timing: "提領時點",
    end: "期末提領",
    begin: "期初提領",
    allocation: "資產配置",
    etf: "ETF (%)",
    bond: "債券 (%)",
    cash: "現金 (%)",
    warning: "⚠️ 配置加總目前為 {sum}%，請調整至 100%。",
    return: "預期名目報酬",
    returnInfo: "加權名目報酬 ≈ {ret}% (r)，通膨 g = {inf}% ，r − g = {diff}%",
    lowReturn: "⚠️ 名目報酬 ≤ 通膨，理論上本金會加速耗盡。",
    required: "所需起始本金",
    yearsResult: "可支撐年數",
    initialPrincipal: "起始本金",
    monthly: "每月投入",
    compoundBalance: "複利期末資產",
    formula: "公式：PV_end = W₁ · [1 - ((1+g)/(1+r))^N] / (r - g)。期初提領乘以 (1+r)。",
    chart: "圖表",
    table: "表格",
    download: "下載 CSV",
    year: "年份",
    expense: "年度支出",
    growth: "投資報酬",
    principal: "年末本金",
    balance: "第 {years} 年期末預估餘額：{balance}",
    notes: "說明與假設",
    compYears: "期間（年）",
    compInitial: "起始本金",
    compMonthly: "每月投入",
    noteList: [
      "可切換期初/期末提領。",
      "第一年提領額等於首年支出，之後每年按通膨成長。",
      "名目報酬由配置權重加權計算。",
      "複利模式採每月投入、每月複利。",
      "僅供教育用途。"
    ]
  },
  ja: {
    title: "退職支出シミュレーター",
    subtitle: "条件を入力 → 必要元本、使用可能年数、または複利成長を計算。",
    mode: "モード",
    byYears: "年数を指定",
    byPrincipal: "元本を指定",
    byCompound: "複利",
    basic: "基本パラメータ",
    years: "期間（年）",
    firstExpense: "初年度支出",
    inflation: "インフレ率（%/年）",
    timing: "引き出しタイミング",
    end: "期末引き出し",
    begin: "期首引き出し",
    allocation: "資産配分",
    etf: "ETF (%)",
    bond: "債券 (%)",
    cash: "現金 (%)",
    warning: "⚠️ 配分の合計は現在 {sum}% です。100%に調整してください。",
    return: "期待収益率",
    returnInfo: "加重名目収益率 ≈ {ret}% (r)、インフレ g = {inf}% 、r − g = {diff}%",
    lowReturn: "⚠️ 名目収益率 ≤ インフレ",
    required: "必要な初期元本",
    yearsResult: "使用可能年数",
    initialPrincipal: "初期元本",
    monthly: "毎月の積立",
    compoundBalance: "複利期末資產",
    formula: "式: PV_end = W₁ · [1 - ((1+g)/(1+r))^N] / (r - g)。期首は (1+r) を乗じる。",
    chart: "グラフ",
    table: "テーブル",
    download: "CSV ダウンロード",
    year: "年",
    expense: "年間支出",
    growth: "投資収益",
    principal: "期末元本",
    balance: "{years} 年目期末予想残高：{balance}",
    notes: "説明と前提",
    compYears: "期間（年）",
    compInitial: "初期元本",
    compMonthly: "毎月の積立",
    noteList: [
      "期首/期末の切り替え。",
      "初年度支出は入力額、以降はインフレで成長。",
      "名目収益率は配分の加重平均。",
      "複利モードは毎月積立・毎月複利。",
      "教育目的のみ。"
    ]
  }
};

function detectLang() {
  if (typeof navigator === "undefined") return "en";
  const codes = Array.from(new Set([(navigator.language || "").toLowerCase(), ...(navigator.languages || []).map((x) => x.toLowerCase())]));
  if (codes.some((c) => c.startsWith("zh") || c.includes("-cn") || c.includes("-sg") || c.includes("-my"))) return "zh";
  if (codes.some((c) => c.startsWith("ja"))) return "ja";
  return "en";
}

export default function App() {
  const [mode, setMode] = useState("years");
  const [years, setYears] = useState(30);
  const [initialPrincipalInput, setInitialPrincipalInput] = useState(2600000);
  const [annualExpense, setAnnualExpense] = useState(100000);
  const [inflationPct, setInflationPct] = useState(4);
  const [timing, setTiming] = useState("end");
  const [pctETF, setPctETF] = useState(50);
  const [pctBond, setPctBond] = useState(40);
  const [pctCash, setPctCash] = useState(10);
  const [retETF, setRetETF] = useState(7);
  const [retBond, setRetBond] = useState(3);
  const [retCash, setRetCash] = useState(0);
  const [lang, setLang] = useState("en");

  const [compYears, setCompYears] = useState(30);
  const [compInitial, setCompInitial] = useState(10000);
  const [compMonthly, setCompMonthly] = useState(500);

  const t = translations[lang];
  const allocSum = toPct(pctETF) + toPct(pctBond) + toPct(pctCash);
  const allocWarn = Math.abs(allocSum - 100) > 0.001;

  const weightedReturnPct = useMemo(() => {
    const wETF = toPct(pctETF) / 100;
    const wBond = toPct(pctBond) / 100;
    const wCash = toPct(pctCash) / 100;
    const v = (wETF * toPct(retETF) + wBond * toPct(retBond) + wCash * toPct(retCash)) / 100;
    return v * 100;
  }, [pctETF, pctBond, pctCash, retETF, retBond, retCash]);

  const nominalR = weightedReturnPct / 100;
  const inflationR = toPct(inflationPct) / 100;

  const neededPrincipal = useMemo(() => {
    if (mode !== "years") return 0;
    if (!Number.isFinite(nominalR) || !Number.isFinite(inflationR) || !Number.isFinite(years) || years <= 0) return 0;
    return requiredPrincipalByFormula({ firstWithdrawal: Number(annualExpense), r: nominalR, g: inflationR, N: Number(years), timing });
  }, [mode, annualExpense, nominalR, inflationR, years, timing]);

  const rowsYears = useMemo(() => {
    if (mode !== "years") return [];
    if (!Number.isFinite(neededPrincipal)) return [];
    return simulateCashflow({ initialPrincipal: neededPrincipal, years: Number(years), expense0: Number(annualExpense), r: nominalR, g: inflationR, timing });
  }, [mode, neededPrincipal, years, annualExpense, nominalR, inflationR, timing]);

  const rowsPrincipal = useMemo(() => {
    if (mode !== "principal") return [];
    const p0 = Number(initialPrincipalInput);
    if (!Number.isFinite(p0) || p0 <= 0) return [];
    return simulateUntilDepleted({ initialPrincipal: p0, expense0: Number(annualExpense), r: nominalR, g: inflationR, timing, maxYears: 200 });
  }, [mode, initialPrincipalInput, annualExpense, nominalR, inflationR, timing]);

  const rowsCompound = useMemo(() => {
    if (mode !== "compound") return [];
    return simulateCompound({ years: Number(compYears), principal0: Number(compInitial), monthly: Number(compMonthly), r: nominalR });
  }, [mode, compYears, compInitial, compMonthly, nominalR]);

  const rows = mode === "years" ? rowsYears : mode === "principal" ? rowsPrincipal : rowsCompound;
  const finalBalance = rows.length ? rows[rows.length - 1].endPrincipal : 0;
  const rMinusG = (weightedReturnPct - toPct(inflationPct)).toFixed(2);

  const headersYears = [t.year, t.expense, t.growth, t.principal];
  const headersCompound = [t.year, t.principal];
  const csvRows = mode === "compound"
    ? [headersCompound, ...rows.map((rec) => [rec.year, Math.round(rec.endPrincipal)])]
    : [headersYears, ...rows.map((rec) => [rec.year, Math.round(rec.expense), Math.round(rec.growth), Math.round(rec.endPrincipal)])];

  useEffect(() => { runTests(); }, []);
  useEffect(() => { setLang(detectLang()); }, []);

  const yearsSupported = mode === "principal" ? rowsPrincipal.length : Number(years);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">{t.title}</h1>
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="border rounded-xl px-3 py-2 w-full sm:w-auto min-w-[140px]">
                <option value="en">English</option>
                <option value="zh">繁體中文</option>
                <option value="ja">日本語</option>
              </select>
            </div>
            <p className="text-sm text-gray-600">{t.subtitle}</p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <div className="text-sm">
              <div className="font-medium mb-1">{t.mode}</div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="mode" value="years" checked={mode === "years"} onChange={() => setMode("years")} /> {t.byYears}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="mode" value="principal" checked={mode === "principal"} onChange={() => setMode("principal")} /> {t.byPrincipal}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="mode" value="compound" checked={mode === "compound"} onChange={() => setMode("compound")} /> {t.byCompound}
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="text-lg font-medium">{t.basic}</h2>
            {mode === "compound" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">{t.compYears}
                  <input type="number" min={1} className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(compYears) ? compYears : 0} onChange={(e) => setCompYears(nval(e.target.value, 0))} />
                </label>
                <label className="text-sm">{t.compInitial}
                  <input type="number" min={0} className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(compInitial) ? compInitial : 0} onChange={(e) => setCompInitial(nval(e.target.value, 0))} />
                </label>
                <label className="text-sm">{t.compMonthly}
                  <input type="number" min={0} className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(compMonthly) ? compMonthly : 0} onChange={(e) => setCompMonthly(nval(e.target.value, 0))} />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {mode === "years" ? (
                  <label className="text-sm">{t.years}
                    <input type="number" min={1} className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(years) ? years : 0} onChange={(e) => setYears(nval(e.target.value, 0))} />
                  </label>
                ) : (
                  <label className="text-sm">{t.initialPrincipal}
                    <input type="number" min={0} className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(initialPrincipalInput) ? initialPrincipalInput : 0} onChange={(e) => setInitialPrincipalInput(nval(e.target.value, 0))} />
                  </label>
                )}
                <label className="text-sm">{t.firstExpense}
                  <input type="number" min={0} className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(annualExpense) ? annualExpense : 0} onChange={(e) => setAnnualExpense(nval(e.target.value, 0))} />
                </label>
                <label className="text-sm">{t.inflation}
                  <input type="number" step="0.1" className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(inflationPct) ? inflationPct : 0} onChange={(e) => setInflationPct(nval(e.target.value, 0))} />
                </label>
              </div>
            )}
            {mode !== "compound" && (
              <div className="mt-2 text-sm">
                <div className="font-medium mb-1">{t.timing}</div>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="timing" value="end" checked={timing === "end"} onChange={() => setTiming("end")} /> {t.end}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="timing" value="begin" checked={timing === "begin"} onChange={() => setTiming("begin")} /> {t.begin}
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="text-lg font-medium">{t.allocation}</h2>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm">{t.etf}
                <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(pctETF) ? pctETF : 0} onChange={(e) => setPctETF(nval(e.target.value, 0))} />
              </label>
              <label className="text-sm">{t.bond}
                <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(pctBond) ? pctBond : 0} onChange={(e) => setPctBond(nval(e.target.value, 0))} />
              </label>
              <label className="text-sm">{t.cash}
                <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(pctCash) ? pctCash : 0} onChange={(e) => setPctCash(nval(e.target.value, 0))} />
              </label>
            </div>
            {allocWarn && (
              <p className="text-sm text-amber-600">{t.warning.replace("{sum}", allocSum.toFixed(1))}</p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="text-lg font-medium">{t["return"]}</h2>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm">ETF (%)
                <input type="number" step="0.1" className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(retETF) ? retETF : 0} onChange={(e) => setRetETF(nval(e.target.value, 0))} />
              </label>
              <label className="text-sm">Bond (%)
                <input type="number" step="0.1" className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(retBond) ? retBond : 0} onChange={(e) => setRetBond(nval(e.target.value, 0))} />
              </label>
              <label className="text-sm">Cash (%)
                <input type="number" step="0.1" className="mt-1 w-full border rounded-xl px-3 py-2" value={Number.isFinite(retCash) ? retCash : 0} onChange={(e) => setRetCash(nval(e.target.value, 0))} />
              </label>
            </div>
            <div className="text-sm text-gray-600">{t.returnInfo.replace("{ret}", weightedReturnPct.toFixed(2)).replace("{inf}", Number(inflationPct).toFixed(2)).replace("{diff}", rMinusG)}</div>
            {nominalR <= inflationR && (
              <div className="text-sm text-red-600">{t.lowReturn}</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-semibold mb-2">
              {mode === "years" ? t.required : mode === "principal" ? t.yearsResult : t.compoundBalance}
            </h2>
            <div className="text-3xl font-bold">
              {mode === "years" ? formatCurrency(neededPrincipal) : mode === "principal" ? yearsSupported : formatCurrency(finalBalance)}
            </div>
            {mode === "years" && (<p className="text-sm text-gray-600 mt-1">{t.formula}</p>)}
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h3 className="text-lg font-medium mb-3">{t.chart}</h3>
            <div className="w-full h-80">
              <ResponsiveContainer>
                <LineChart data={rows} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tickFormatter={(v) => `Y${v}`} />
                  <YAxis tickFormatter={(v) => `${Math.round(v/1000)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} labelFormatter={(l) => `Y${l}`} />
                  <Legend />
                  <Line type="monotone" dataKey="endPrincipal" name={t.principal} stroke="#1f77b4" dot={false} />
                  {mode !== "compound" && <Line type="monotone" dataKey="expense" name={t.expense} stroke="#ff7f0e" dot={false} />}
                  {mode !== "compound" && <Line type="monotone" dataKey="growth" name={t.growth} stroke="#2ca02c" dot={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">{t.table}</h3>
              <button onClick={() => downloadCSV("cashflow.csv", csvRows)} className="px-4 py-2 rounded-2xl shadow hover:shadow-md transition border">{t.download}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left p-2 rounded-l-xl">{t.year}</th>
                    {mode !== "compound" && <th className="text-right p-2">{t.expense}</th>}
                    {mode !== "compound" && <th className="text-right p-2">{t.growth}</th>}
                    <th className="text-right p-2 rounded-r-xl">{t.principal}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.year} className="border-b last:border-0">
                      <td className="p-2">{row.year}</td>
                      {mode !== "compound" && <td className="p-2 text-right">{formatCurrency(row.expense)}</td>}
                      {mode !== "compound" && <td className="p-2 text-right">{formatCurrency(row.growth)}</td>}
                      <td className={`p-2 text-right ${row.endPrincipal < 0 ? 'text-red-600 font-semibold' : ''}`}>{formatCurrency(row.endPrincipal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-sm text-gray-700">{t.balance.replace("{years}", String(mode === "principal" ? yearsSupported : rows.length)).replace("{balance}", formatCurrency(finalBalance))}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h3 className="text-lg font-medium mb-2">{t.notes}</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              {t.noteList.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
