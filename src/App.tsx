import React, { useMemo, useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

function formatCurrency(x) {
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function toPct(x) {
  if (x === "" || x === null || x === undefined) return 0;
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function buildCSV(rows) {
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
  console.assert(simEnd.length === N, "rows length");
}

const translations = {
  en: {
    title: "Retirement Expense Calculator",
    subtitle: "Enter conditions → Calculate required initial principal and generate cashflow table.",
    mode: "Mode",
    byYears: "Target Years",
    byPrincipal: "Given Principal",
    basic: "Basic Parameters",
    years: "Years",
    firstExpense: "First Year Expense (USD)",
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
    initialPrincipal: "Initial Principal (USD)",
    formula: "Formula: PV_end = W₁ · [1 - ((1+g)/(1+r))^N] / (r - g). Beginning withdrawals multiply by (1+r).",
    chart: "Chart: End Principal, Annual Expense, Investment Return",
    table: "Annual Cashflow Table",
    download: "Download CSV",
    year: "Year",
    expense: "Expense",
    growth: "Return",
    principal: "End Principal",
    balance: "Estimated final balance at year {years}: {balance}",
    notes: "Notes & Assumptions",
    noteList: [
      "Toggle beginning/end withdrawals.",
      "First year withdrawal = first expense, grows by g annually.",
      "Nominal return r from allocation weights.",
      "Principal calculated with growing annuity PV formula.",
      "If r ≤ g, long-term sustainability is difficult.",
      "Educational use only, not financial advice."
    ]
  },
  zh: {
    title: "退休支出試算器",
    subtitle: "輸入條件 → 計算所需起始本金，或在固定本金下推估可支撐年數。",
    mode: "模式",
    byYears: "輸入年數",
    byPrincipal: "輸入本金",
    basic: "基本參數",
    years: "期間（年）",
    firstExpense: "首年支出（USD）",
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
    initialPrincipal: "起始本金（USD）",
    formula: "公式：PV_end = W₁ · [1 - ((1+g)/(1+r))^N] / (r - g)。期初提領則乘以 (1+r)。",
    chart: "走勢圖：年末本金、年度支出與投資報酬",
    table: "逐年現金流表",
    download: "下載 CSV",
    year: "年份",
    expense: "年度支出",
    growth: "投資報酬",
    principal: "年末本金",
    balance: "第 {years} 年期末預估餘額：{balance}",
    notes: "說明與假設",
    noteList: [
      "可切換期初/期末提領。",
      "第一年提領額等於首年支出，之後每年按通膨成長。",
      "名目報酬由配置權重加權計算。",
      "所需本金以成長年金現值計算。",
      "若 r ≤ g，長期難以維持購買力。",
      "本工具為教育用途，不構成投資建議。"
    ]
  },
  ja: {
    title: "退職支出シミュレーター",
    subtitle: "条件を入力 → 必要元本を計算、または元本固定で使用可能年数を推定します。",
    mode: "モード",
    byYears: "年数を指定",
    byPrincipal: "元本を指定",
    basic: "基本パラメータ",
    years: "期間（年）",
    firstExpense: "初年度支出（USD）",
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
    lowReturn: "⚠️ 名目収益率 ≤ インフレ、資金が早く尽きる可能性。",
    required: "必要な初期元本",
    yearsResult: "使用可能年数",
    initialPrincipal: "初期元本（USD）",
    formula: "式: PV_end = W₁ · [1 - ((1+g)/(1+r))^N] / (r - g)。期首引き出しは (1+r) を掛けます。",
    chart: "推移グラフ：期末元本、年間支出、投資収益",
    table: "年間キャッシュフローテーブル",
    download: "CSV ダウンロード",
    year: "年",
    expense: "年間支出",
    growth: "投資収益",
    principal: "期末元本",
    balance: "{years} 年目期末予想残高：{balance}",
    notes: "説明と前提",
    noteList: [
      "期首/期末引き出しを切り替え可能。",
      "初年度支出は入力額、以降はインフレで成長。",
      "名目収益率は配分加重平均。",
      "必要元本は成長年金の現価で計算。",
      "r ≤ g の場合、持続は困難。",
      "教育目的のみであり、投資助言ではありません。"
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

  const rows = mode === "years" ? rowsYears : rowsPrincipal;
  const finalBalance = rows.length ? rows[rows.length - 1].endPrincipal : 0;
  const rMinusG = (weightedReturnPct - toPct(inflationPct)).toFixed(2);

  const headers = [t.year, t.expense, t.growth, t.principal];
  const csvRows = [headers, ...rows.map((rec) => [rec.year, Math.round(rec.expense), Math.round(rec.growth), Math.round(rec.endPrincipal)])];

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
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="mode" value="years" checked={mode === "years"} onChange={() => setMode("years")} /> {t.byYears}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="mode" value="principal" checked={mode === "principal"} onChange={() => setMode("principal")} /> {t.byPrincipal}
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="text-lg font-medium">{t.basic}</h2>
            <div className="grid grid-cols-2 gap-3">
              {mode === "years" ? (
                <label className="text-sm">{t.years}
                  <input type="number" min={1} className="mt-1 w-full border rounded-xl px-3 py-2" value={years} onChange={(e) => setYears(Number(e.target.value))} />
                </label>
              ) : (
                <label className="text-sm">{t.initialPrincipal}
                  <input type="number" min={0} className="mt-1 w-full border rounded-xl px-3 py-2" value={initialPrincipalInput} onChange={(e) => setInitialPrincipalInput(Number(e.target.value))} />
                </label>
              )}
              <label className="text-sm">{t.firstExpense}
                <input type="number" min={0} className="mt-1 w-full border rounded-xl px-3 py-2" value={annualExpense} onChange={(e) => setAnnualExpense(Number(e.target.value))} />
              </label>
              <label className="text-sm">{t.inflation}
                <input type="number" step="0.1" className="mt-1 w-full border rounded-xl px-3 py-2" value={inflationPct} onChange={(e) => setInflationPct(Number(e.target.value))} />
              </label>
            </div>
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
          </div>

          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="text-lg font-medium">{t.allocation}</h2>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm">{t.etf}
                <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" value={pctETF} onChange={(e) => setPctETF(Number(e.target.value))} />
              </label>
              <label className="text-sm">{t.bond}
                <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" value={pctBond} onChange={(e) => setPctBond(Number(e.target.value))} />
              </label>
              <label className="text-sm">{t.cash}
                <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" value={pctCash} onChange={(e) => setPctCash(Number(e.target.value))} />
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
                <input type="number" step="0.1" className="mt-1 w-full border rounded-xl px-3 py-2" value={retETF} onChange={(e) => setRetETF(Number(e.target.value))} />
              </label>
              <label className="text-sm">Bond (%)
                <input type="number" step="0.1" className="mt-1 w-full border rounded-xl px-3 py-2" value={retBond} onChange={(e) => setRetBond(Number(e.target.value))} />
              </label>
              <label className="text-sm">Cash (%)
                <input type="number" step="0.1" className="mt-1 w-full border rounded-xl px-3 py-2" value={retCash} onChange={(e) => setRetCash(Number(e.target.value))} />
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
            <h2 className="text-xl font-semibold mb-2">{mode === "years" ? t.required : t.yearsResult}</h2>
            <div className="text-3xl font-bold">
              {mode === "years" ? formatCurrency(neededPrincipal) : yearsSupported}
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
                  <YAxis tickFormatter={(v) => `$${Math.round(v/1000)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} labelFormatter={(l) => `Y${l}`} />
                  <Legend />
                  <Line type="monotone" dataKey="endPrincipal" name={t.principal} stroke="#1f77b4" dot={false} />
                  <Line type="monotone" dataKey="expense" name={t.expense} stroke="#ff7f0e" dot={false} />
                  <Line type="monotone" dataKey="growth" name={t.growth} stroke="#2ca02c" dot={false} />
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
                    <th className="text-right p-2">{t.expense}</th>
                    <th className="text-right p-2">{t.growth}</th>
                    <th className="text-right p-2 rounded-r-xl">{t.principal}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.year} className="border-b last:border-0">
                      <td className="p-2">{row.year}</td>
                      <td className="p-2 text-right">{formatCurrency(row.expense)}</td>
                      <td className="p-2 text-right">{formatCurrency(row.growth)}</td>
                      <td className={`p-2 text-right ${row.endPrincipal < 0 ? 'text-red-600 font-semibold' : ''}`}>{formatCurrency(row.endPrincipal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-sm text-gray-700">{t.balance.replace("{years}", String(yearsSupported)).replace("{balance}", formatCurrency(finalBalance))}</div>
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
