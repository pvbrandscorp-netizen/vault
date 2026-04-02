"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { createClient } from "@/utils/supabase/client";

const ACCT_CATS: Record<string, { l: string; i: string; c: string }> = { bank: { l: "Bank", i: "🏦", c: "#4ECDC4" }, cash: { l: "Cash", i: "💵", c: "#95E77E" }, ewallet: { l: "E-Wallet", i: "📱", c: "#C896E0" }, invest: { l: "Investment", i: "📈", c: "#F4A261" } };
const DEBT_TYPES: Record<string, { l: string; i: string }> = { credit_card: { l: "Credit Card", i: "💳" }, personal_loan: { l: "Personal Loan", i: "🏦" }, business_loan: { l: "Business Loan", i: "📊" }, other: { l: "Other", i: "📋" } };
const CRYPTO_DEF: Record<string, { l: string; i: string; c: string; cg: string }> = { BTC: { l: "Bitcoin", i: "₿", c: "#F7931A", cg: "bitcoin" }, ETH: { l: "Ethereum", i: "Ξ", c: "#627EEA", cg: "ethereum" }, USDT: { l: "Tether", i: "₮", c: "#26A17B", cg: "tether" }, USDC: { l: "USD Coin", i: "◎", c: "#2775CA", cg: "usd-coin" }, SOL: { l: "Solana", i: "◑", c: "#9945FF", cg: "solana" }, BNB: { l: "BNB", i: "⬡", c: "#F3BA2F", cg: "binancecoin" } };
const FIAT = ["PHP", "USD", "HKD"];
const ALL_CUR = [...FIAT, ...Object.keys(CRYPTO_DEF)];
const DR: Record<string, number> = { PHP: 1, USD: 58, HKD: 7.4, BTC: 4900000, ETH: 180000, USDT: 58, USDC: 58, SOL: 7800, BNB: 34000 };

const TX_CATS: Record<string, Array<{ k: string; l: string }>> = {
  personal_expense: [
    { k: "food", l: "🍔 Food & Dining" }, { k: "grocery", l: "🛒 Grocery" }, { k: "shopping", l: "🛍️ Shopping" },
    { k: "transport", l: "🚗 Transport" }, { k: "utilities", l: "💡 Utilities & Bills" }, { k: "rent", l: "🏠 Rent / Housing" },
    { k: "health", l: "🏥 Health / Medical" }, { k: "entertainment", l: "🎬 Entertainment" }, { k: "education", l: "📚 Education" },
    { k: "insurance", l: "🛡️ Insurance" }, { k: "travel", l: "✈️ Travel" }, { k: "gift", l: "🎁 Gifts" },
    { k: "personal_other", l: "📋 Other" },
  ],
  business_expense: [
    { k: "ads", l: "📢 Ads / Marketing" }, { k: "salaries", l: "👥 Salaries / Payroll" }, { k: "opex", l: "⚙️ OpEx / Operations" },
    { k: "shipping", l: "📦 Shipping / Logistics" }, { k: "inventory", l: "🏭 Inventory / COGS" }, { k: "tools", l: "🔧 Tools / Software" },
    { k: "rent_office", l: "🏢 Rent / Office" }, { k: "taxes", l: "🧾 Taxes / Gov Fees" }, { k: "professional", l: "⚖️ Professional Services" },
    { k: "travel_biz", l: "✈️ Business Travel" }, { k: "commission", l: "💰 Commission / Referral" },
    { k: "biz_other", l: "📋 Other" },
  ],
  personal_income: [
    { k: "salary", l: "💼 Salary" }, { k: "freelance", l: "💻 Freelance" }, { k: "investment_ret", l: "📈 Investment Returns" },
    { k: "gift_in", l: "🎁 Gift Received" }, { k: "refund", l: "↩️ Refund" }, { k: "income_other", l: "📋 Other" },
  ],
  business_income: [
    { k: "sales", l: "🛒 Sales Revenue" }, { k: "services", l: "🔧 Service Revenue" }, { k: "commission_in", l: "💰 Commission" },
    { k: "refund_biz", l: "↩️ Refund / Credit" }, { k: "biz_income_other", l: "📋 Other" },
  ],
};
const getTxCatLabel = (k: string) => { for (const cats of Object.values(TX_CATS)) { const f = cats.find(c => c.k === k); if (f) return f.l; } return k || ""; };

const gid = () => Math.random().toString(36).slice(2, 9);
const cv = (a: number, f: string, t: string, r: Record<string, number>) => f === t ? a : (a * (r[f] || 1)) / (r[t] || 1);

const fmtNum = (v: string | number | undefined | null) => {
  if (v === "" || v === undefined || v === null) return "";
  const s = String(v).replace(/,/g, "");
  if (s === "" || s === "-" || s === ".") return s;
  const parts = s.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};
const parseN = (v: string | number) => parseFloat(String(v).replace(/,/g, "")) || 0;
const rawN = (v: string | number) => String(v).replace(/,/g, "");

const fm = (a: number, c = "PHP", s?: boolean) => {
  const sy: Record<string, string> = { PHP: "₱", USD: "$", HKD: "HK$", BTC: "₿", ETH: "Ξ", USDT: "₮", USDC: "◎", SOL: "◑", BNB: "⬡" };
  const p = sy[c] || c; const n = a < 0; const ab = Math.abs(a);
  if (s && ab >= 1e6) return `${n ? "-" : ""}${p}${(ab / 1e6).toFixed(1)}M`;
  if (s && ab >= 1e3) return `${n ? "-" : ""}${p}${(ab / 1e3).toFixed(1)}K`;
  return `${n ? "-" : ""}${p}${ab.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const dTo = (d: string) => { if (!d) return null; const t = new Date(); t.setHours(0,0,0,0); const x = new Date(d); x.setHours(0,0,0,0); return Math.ceil((x.getTime() - t.getTime()) / 864e5); };
const uClr = (d: number | null) => { if (d === null) return "#555"; if (d < 0) return "#FF4444"; if (d <= 3) return "#FF6B6B"; if (d <= 7) return "#FFD93D"; return "#95E77E"; };

const NumIn = ({ value, onChange, style, placeholder }: { value: string | number; onChange: (v: string) => void; style: React.CSSProperties; placeholder?: string; step?: string }) => (
  <input
    style={style}
    type="text"
    inputMode="decimal"
    value={fmtNum(value)}
    placeholder={placeholder}
    onChange={e => {
      const raw = e.target.value.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
      onChange(raw);
    }}
  />
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyState = any;

export default function Vault() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [accounts, setAccounts] = useState<AnyState[]>([]);
  const [debts, setDebts] = useState<AnyState[]>([]);
  const [receivables, setReceivables] = useState<AnyState[]>([]);
  const [cryptos, setCryptos] = useState<AnyState[]>([]);
  const [txns, setTxns] = useState<AnyState[]>([]);
  const [pipelines, setPipelines] = useState<AnyState[]>([]);
  const [assets, setAssets] = useState<AnyState[]>([]);
  const [inventory, setInventory] = useState<AnyState[]>([]);
  const [pnlBatches, setPnlBatches] = useState<AnyState[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({ ...DR });
  const [snaps, setSnaps] = useState<AnyState[]>([]);
  const [rStat, setRStat] = useState("loading");
  const [csvPreview, setCsvPreview] = useState<AnyState>(null);
  const [csvPlatform, setCsvPlatform] = useState("shopee");

  const [view, setView] = useState("dash");
  const [scope, setScope] = useState("all");
  const [dCur, setDCur] = useState("PHP");
  const [darkMode, setDarkMode] = useState(true);
  const [hideBalances, setHideBalances] = useState(false);
  const [sf, setSf] = useState<string | null>(null);
  const [eId, setEId] = useState<string | null>(null);
  const [showRates, setShowRates] = useState(false);
  const [nwToggles, setNwToggles] = useState<Record<string, boolean>>({ cash: true, crypto: true, receivable: false, pipeline: false, debtAll: false, dueNow: false, due60: false, fixedAssets: false, inventory: false });
  const [assetSub, setAssetSub] = useState("fixed");
  const [scanResult, setScanResult] = useState<AnyState>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanImg, setScanImg] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<AnyState[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askMessages, setAskMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [askLoading, setAskLoading] = useState(false);
  const askEndRef = useRef<HTMLDivElement>(null);
  const [businesses, setBusinesses] = useState<AnyState[]>([
    { id: "auressen", name: "Auressen", color: "#C896E0", nature: "ecommerce", paymentMethod: "cod", industry: "Skincare" },
    { id: "serai", name: "TikTok SERAI", color: "#4ECDC4", nature: "ecommerce", paymentMethod: "cod", industry: "Skincare" },
    { id: "relay", name: "Relay Balance", color: "#F4A261", nature: "retail", paymentMethod: "direct_deposit", industry: "Finance" },
    { id: "edc", name: "EDC Philippines", color: "#FFD93D", nature: "retail", paymentMethod: "direct_deposit", industry: "Energy" },
  ]);
  const [showBizMgr, setShowBizMgr] = useState(false);
  const [newBizName, setNewBizName] = useState("");
  const [newBizNature, setNewBizNature] = useState("ecommerce");
  const [newBizPayment, setNewBizPayment] = useState("direct_deposit");
  const [newBizIndustry, setNewBizIndustry] = useState("");
  const [confirmBiz, setConfirmBiz] = useState<AnyState | null>(null);
  const [removeBiz, setRemoveBiz] = useState<AnyState | null>(null);
  const [removeBizPw, setRemoveBizPw] = useState("");
  const [ddScope, setDdScope] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<string[]>(["all"]);
  const [rptBiz, setRptBiz] = useState<Record<string, boolean>>({});
  const [rptSections, setRptSections] = useState<Record<string, boolean>>({ summary: true, pnl: true, expenses: true, income: true, topExpenses: true, debts: true, receivables: true, assets: true, pipeline: true });
  const [rptFrom, setRptFrom] = useState("");
  const [rptTo, setRptTo] = useState("");

  // Refs to avoid stale closures in snap/save
  const accountsRef = useRef(accounts);
  const debtsRef = useRef(debts);
  const receivablesRef = useRef(receivables);
  const cryptosRef = useRef(cryptos);
  const txnsRef = useRef(txns);
  const pipelinesRef = useRef(pipelines);
  const assetsRef = useRef(assets);
  const inventoryRef = useRef(inventory);
  const pnlBatchesRef = useRef(pnlBatches);
  const snapsRef = useRef(snaps);
  const ratesRef = useRef(rates);
  const businessesRef = useRef(businesses);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);
  useEffect(() => { debtsRef.current = debts; }, [debts]);
  useEffect(() => { receivablesRef.current = receivables; }, [receivables]);
  useEffect(() => { cryptosRef.current = cryptos; }, [cryptos]);
  useEffect(() => { txnsRef.current = txns; }, [txns]);
  useEffect(() => { pipelinesRef.current = pipelines; }, [pipelines]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  useEffect(() => { pnlBatchesRef.current = pnlBatches; }, [pnlBatches]);
  useEffect(() => { snapsRef.current = snaps; }, [snaps]);
  useEffect(() => { ratesRef.current = rates; }, [rates]);
  useEffect(() => { businessesRef.current = businesses; }, [businesses]);

  const [af, setAf] = useState<AnyState>({ name: "", category: "bank", scope: "personal", balance: "", currency: "PHP", notes: "" });
  const [df, setDf] = useState<AnyState>({ name: "", type: "credit_card", scope: "personal", creditLimit: "", outstanding: "", dueAmount: "", dueDate: "", currency: "PHP", notes: "", holder: "", statementDate: "" });
  const [rf, setRf] = useState<AnyState>({ name: "", amount: "", dueDate: "", scope: "personal", currency: "PHP", notes: "", from: "" });
  const [crf, setCrf] = useState<AnyState>({ coin: "BTC", amount: "", scope: "personal", wallet: "" });
  const [tf, setTf] = useState<AnyState>({ accountId: "", toAccountId: "", type: "expense", amount: "", description: "", date: new Date().toISOString().slice(0, 10), receivableId: "", debtId: "", txCat: "", txScope: "personal" });
  const [pf, setPf] = useState<AnyState>({ name: "", grossValue: "", deliveryRate: "70", shippingCost: "", codFees: "", returnCost: "", otherExpenses: "", parcels: "", date: new Date().toISOString().slice(0, 10), expectedDate: "", scope: "business", currency: "PHP", notes: "", status: "active" });
  const [axf, setAxf] = useState<AnyState>({ name: "", category: "vehicle", purchasePrice: "", purchaseDate: "", usefulLife: "5", salvageValue: "0", marketValue: "", appreciationRate: "5", scope: "personal", currency: "PHP", notes: "" });
  const [ivf, setIvf] = useState<AnyState>({ name: "", qty: "", unitCost: "", scope: "business", currency: "PHP", notes: "", sku: "" });

  // ── Load from Supabase ──
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const { data } = await supabase
          .from("user_data")
          .select("data")
          .eq("user_id", user.id)
          .single();

        if (data?.data) {
          const d = data.data;
          setAccounts(d.accounts || []);
          setDebts(d.debts || []);
          setReceivables(d.receivables || []);
          setCryptos(d.cryptos || []);
          setTxns(d.txns || []);
          setPipelines(d.pipelines || []);
          setAssets(d.assets || []);
          setInventory(d.inventory || []);
          setPnlBatches(d.pnlBatches || []);
          setSnaps(d.snaps || []);
          if (d.rates) setRates(d.rates);
          if (d.businesses) setBusinesses(d.businesses);
        }
      } catch {
        // First login or no data yet — start fresh
      }
      setLoaded(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rates ──
  useEffect(() => {
    const go = async () => {
      setRStat("loading"); const nr: Record<string, number> = { PHP: 1 }; let gF = false, gC = false;
      try { const r = await fetch("https://open.er-api.com/v6/latest/PHP"); if (r.ok) { const d = await r.json(); if (d.rates) { nr.USD = 1 / (d.rates.USD || .017); nr.HKD = 1 / (d.rates.HKD || .135); gF = true; } } } catch {}
      if (!gF) { try { const r = await fetch("https://api.exchangerate-api.com/v4/latest/PHP"); if (r.ok) { const d = await r.json(); if (d.rates) { nr.USD = 1 / (d.rates.USD || .017); nr.HKD = 1 / (d.rates.HKD || .135); gF = true; } } } catch {} }
      if (!gF) { nr.USD = DR.USD; nr.HKD = DR.HKD; }
      try { const ids = Object.values(CRYPTO_DEF).map(c => c.cg).join(","); const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=php`); if (r.ok) { const d = await r.json(); Object.entries(CRYPTO_DEF).forEach(([s, def]) => { if (d[def.cg]?.php) { nr[s] = d[def.cg].php; gC = true; } else nr[s] = DR[s]; }); } } catch { Object.keys(CRYPTO_DEF).forEach(k => { nr[k] = DR[k]; }); }
      setRates(p => ({ ...p, ...nr })); setRStat(gF || gC ? "live" : "fallback");
    };
    go(); const iv = setInterval(go, 300000); return () => clearInterval(iv);
  }, []);

  // ── Save to Supabase (debounced) ──
  const saveToSupabase = useCallback(async (uid: string, data: AnyState) => {
    try {
      await supabase
        .from("user_data")
        .upsert({ user_id: uid, data }, { onConflict: "user_id" });
    } catch {
      // silent fail — will retry on next change
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(() => {
    if (!userId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const data = {
        accounts: accountsRef.current, debts: debtsRef.current, receivables: receivablesRef.current,
        cryptos: cryptosRef.current, txns: txnsRef.current, pipelines: pipelinesRef.current,
        assets: assetsRef.current, inventory: inventoryRef.current, pnlBatches: pnlBatchesRef.current,
        snaps: snapsRef.current, rates: ratesRef.current, businesses: businessesRef.current
      };
      saveToSupabase(userId, data);
    }, 1500);
  }, [userId, saveToSupabase]);

  // ── Logout ──
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // ── Ask Vault ──
  const askVault = async (question: string) => {
    if (!question.trim() || askLoading) return;
    const q = question.trim();
    setAskInput("");
    setAskMessages(prev => [...prev, { role: "user", text: q }]);
    setAskLoading(true);
    try {
      const vaultData = { accounts, debts, receivables, cryptos, txns, pipelines, assets, inventory, pnlBatches, rates };
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, vaultData }),
      });
      const data = await res.json();
      if (data.error) {
        setAskMessages(prev => [...prev, { role: "assistant", text: `Error: ${data.error}` }]);
      } else {
        setAskMessages(prev => [...prev, { role: "assistant", text: data.answer }]);
      }
    } catch {
      setAskMessages(prev => [...prev, { role: "assistant", text: "Failed to get a response. Please try again." }]);
    }
    setAskLoading(false);
    setTimeout(() => askEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Business helpers
  const BIZ_NATURES: Record<string, string> = { ecommerce: "E-Commerce", retail: "Retail", wholesale: "Wholesale", services: "Services", manufacturing: "Manufacturing", consulting: "Consulting", freelance: "Freelance", saas: "SaaS / Software", dropshipping: "Dropshipping", other: "Other" };
  const BIZ_PAYMENTS: Record<string, string> = { direct_deposit: "Direct Deposit", cod: "Cash on Delivery", credit_card: "Credit/Debit Card", ewallet: "E-Wallet", bank_transfer: "Bank Transfer", paypal: "PayPal", crypto: "Crypto", mixed: "Mixed / Multiple" };
  const getBizName = (s: string) => { if (s === "personal") return "Personal"; const b = businesses.find((x: AnyState) => x.id === s); return b ? b.name : s; };
  const getBizColor = (s: string) => { if (s === "personal") return "#A8B5E2"; const b = businesses.find((x: AnyState) => x.id === s); return b ? b.color : "#888"; };
  const getBizShort = (s: string) => { if (s === "personal") return "PER"; const b = businesses.find((x: AnyState) => x.id === s); return b ? b.name.slice(0, 8).toUpperCase() : s; };
  const BIZ_COLORS = ["#C896E0", "#4ECDC4", "#F4A261", "#FFD93D", "#FF6B6B", "#95E77E", "#A8B5E2", "#E9C46A", "#D4A373", "#CDB4DB"];
  const startAddBiz = () => { if (!newBizName.trim()) return; setConfirmBiz({ name: newBizName.trim(), nature: newBizNature, paymentMethod: newBizPayment, industry: newBizIndustry.trim() }); };
  const confirmAddBiz = () => { if (!confirmBiz) return; const id = confirmBiz.name.toLowerCase().replace(/[^a-z0-9]/g, "_"); const nb = [...businesses, { id, name: confirmBiz.name, color: BIZ_COLORS[businesses.length % BIZ_COLORS.length], nature: confirmBiz.nature, paymentMethod: confirmBiz.paymentMethod, industry: confirmBiz.industry }]; setBusinesses(nb); setConfirmBiz(null); setNewBizName(""); setNewBizNature("ecommerce"); setNewBizPayment("direct_deposit"); setNewBizIndustry(""); save(); };
  const startDelBiz = (b: AnyState) => { setRemoveBiz(b); setRemoveBizPw(""); };
  const confirmDelBiz = async () => {
    if (!removeBiz) return;
    const { error } = await supabase.auth.signInWithPassword({ email: (await supabase.auth.getUser()).data.user?.email || "", password: removeBizPw });
    if (error) { alert("Incorrect password. Business not removed."); return; }
    const nb = businesses.filter((b: AnyState) => b.id !== removeBiz.id); setBusinesses(nb);
    if (scope === removeBiz.id) setScope("all");
    setScopeFilter(prev => prev.filter(s => s !== removeBiz.id));
    setRemoveBiz(null); setRemoveBizPw(""); save();
  };
  const getTxCatKey = (s: string, type: string) => `${s === "personal" ? "personal" : "business"}_${type}`;

  // Scope filter — multi-select
  const scopeMatch = (itemScope: string) => {
    if (scopeFilter.includes("all")) return true;
    if (scopeFilter.includes("business") && itemScope !== "personal") return true;
    return scopeFilter.includes(itemScope);
  };
  const toggleScope = (id: string) => {
    if (id === "all") { setScopeFilter(["all"]); return; }
    setScopeFilter(prev => {
      const without = prev.filter(s => s !== "all");
      if (without.includes(id)) {
        const next = without.filter(s => s !== id);
        return next.length === 0 ? ["all"] : next;
      }
      return [...without, id];
    });
  };
  const scopeLabel = () => {
    if (scopeFilter.includes("all")) return "All";
    const names = scopeFilter.map(s => s === "personal" ? "Personal" : s === "business" ? "All Biz" : getBizName(s));
    if (names.length <= 2) return names.join(", ");
    return `${names.length} selected`;
  };

  // Scope dropdown component
  const ScopeSelect = ({ value, onChange, style: st }: { value: string; onChange: (v: string) => void; style: React.CSSProperties }) => (
    <select style={st} value={value} onChange={e => onChange(e.target.value)}>
      <option value="personal">👤 Personal</option>
      <optgroup label="📊 Business">
        {businesses.map((b: AnyState) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </optgroup>
    </select>
  );

  // Click-outside handler for scope dropdown
  useEffect(() => {
    const handleClick = () => setDdScope(false);
    if (ddScope) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [ddScope]);

  // Snapshot — uses refs to always read latest state, avoiding stale closures
  const snap = useCallback((a?: AnyState, d?: AnyState, c?: AnyState) => {
    const aa = a || accountsRef.current, dd = d || debtsRef.current, cc = c || cryptosRef.current;
    const r = ratesRef.current;
    const ast = aa.reduce((s: number, x: AnyState) => s + x.balance * (r[x.currency] || 1), 0);
    const dbt = dd.reduce((s: number, x: AnyState) => s + x.outstanding * (r[x.currency] || 1), 0);
    const cry = cc.reduce((s: number, x: AnyState) => s + x.amount * (r[x.coin] || 0), 0);
    const now = new Date();
    const ts = now.toISOString().slice(0, 16);
    const label = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const ns = [...snapsRef.current, { ts, label, a: ast, db: dbt, c: cry, n: ast + cry - dbt }].slice(-200);
    setSnaps(ns); return ns;
  }, []);

  // Scoped
  const sA = accounts.filter((a: AnyState) => scopeMatch(a.scope));
  const sD = debts.filter((d: AnyState) => scopeMatch(d.scope));
  const sR = receivables.filter((r: AnyState) => scopeMatch(r.scope));
  const sC = cryptos.filter((c: AnyState) => scopeMatch(c.scope));
  const sT = txns.filter((t: AnyState) => { const a = accounts.find((x: AnyState) => x.id === t.accountId); return scopeMatch(t.txScope || a?.scope || "personal"); });
  const sP = pipelines.filter((p: AnyState) => scopeMatch(p.scope));
  const activeP = sP.filter((p: AnyState) => p.status === "active");
  const sAx = assets.filter((a: AnyState) => scopeMatch(a.scope));
  const sIv = inventory.filter((i: AnyState) => scopeMatch(i.scope));
  const sPnl = pnlBatches.filter((b: AnyState) => scopeMatch(b.scope));

  // Totals (getBookValue defined below after ASSET_CATS)
  const tAssets = sA.reduce((s: number, a: AnyState) => s + cv(a.balance, a.currency, dCur, rates), 0);
  const tDebt = sD.reduce((s: number, d: AnyState) => s + cv(d.outstanding, d.currency, dCur, rates), 0);
  const tLimit = sD.reduce((s: number, d: AnyState) => s + cv(d.creditLimit || 0, d.currency, dCur, rates), 0);
  const tCrypto = sC.reduce((s: number, c: AnyState) => s + (c.amount * (rates[c.coin] || 0)) / (rates[dCur] || 1), 0);
  const tReceivable = sR.reduce((s: number, r: AnyState) => s + cv((r.amount - (r.received || 0)), r.currency, dCur, rates), 0);
  const openR = sR.filter((r: AnyState) => (r.received || 0) < r.amount);

  const pipelineNet = activeP.reduce((s: number, p: AnyState) => {
    const expRev = p.grossValue * (p.deliveryRate / 100);
    const totExp = (p.shippingCost || 0) + (p.codFees || 0) + (p.returnCost || 0) + (p.otherExpenses || 0);
    return s + cv(expRev - totExp, p.currency, dCur, rates);
  }, 0);
  const pipelineGross = activeP.reduce((s: number, p: AnyState) => s + cv(p.grossValue, p.currency, dCur, rates), 0);

  // tFixedAssets computed after getBookValue is defined
  const tInventory = sIv.reduce((s: number, i: AnyState) => s + cv((i.qty || 0) * (i.unitCost || 0), i.currency, dCur, rates), 0);
  const dueNow = sD.filter((d: AnyState) => { const days = dTo(d.dueDate); return days !== null && days <= 30; });
  const due3060 = sD.filter((d: AnyState) => { const days = dTo(d.dueDate); return days !== null && days > 30 && days <= 60; });
  const dueNowAmt = dueNow.reduce((s: number, d: AnyState) => s + cv(d.dueAmount || 0, d.currency, dCur, rates), 0);
  const due3060Amt = due3060.reduce((s: number, d: AnyState) => s + cv(d.dueAmount || 0, d.currency, dCur, rates), 0);
  const netCash = tAssets + tCrypto;
  const sortedD = [...sD].sort((a, b) => { const da = dTo(a.dueDate), db = dTo(b.dueDate); if (da === null) return 1; if (db === null) return -1; return da - db; });
  const sortedR = [...sR].sort((a, b) => { const da = dTo(a.dueDate), db = dTo(b.dueDate); if (da === null) return 1; if (db === null) return -1; return da - db; });

  void netCash; // used in original for net worth calc

  const chartData = snaps.map((s: AnyState) => ({ date: s.label || s.ts?.slice(5, 10) || "", Assets: Math.round(s.a / (rates[dCur] || 1)), Crypto: Math.round(s.c / (rates[dCur] || 1)), Debt: Math.round(s.db / (rates[dCur] || 1)), Net: Math.round(s.n / (rates[dCur] || 1)) }));

  // ── CRUD ──
  const addAccount = () => { if (!af.name || !rawN(af.balance)) return; const na = [...accounts, { id: gid(), ...af, balance: parseN(af.balance) }]; setAccounts(na); const ns = snap(na, debts, cryptos); save(); setAf({ name: "", category: "bank", scope: "personal", balance: "", currency: "PHP", notes: "" }); setSf(null); };
  const saveEditAcc = () => { const na = accounts.map((a: AnyState) => a.id === eId ? { ...a, ...af, balance: parseN(af.balance) } : a); setAccounts(na); const ns = snap(na, debts, cryptos); save(); setEId(null); setSf(null); };
  const delAcc = (id: string) => { const na = accounts.filter((a: AnyState) => a.id !== id); const nt = txns.filter((t: AnyState) => t.accountId !== id && t.toAccountId !== id); setAccounts(na); setTxns(nt); save(); };

  const addDebt = () => { if (!df.name) return; const nd = [...debts, { id: gid(), ...df, creditLimit: parseN(df.creditLimit), outstanding: parseN(df.outstanding), dueAmount: parseN(df.dueAmount), lastUp: new Date().toISOString() }]; setDebts(nd); snap(accounts, nd, cryptos); save(); setDf({ name: "", type: "credit_card", scope: "personal", creditLimit: "", outstanding: "", dueAmount: "", dueDate: "", currency: "PHP", notes: "", holder: "", statementDate: "" }); setSf(null); };
  const saveEditDebt = () => { const nd = debts.map((d: AnyState) => d.id === eId ? { ...d, ...df, creditLimit: parseN(df.creditLimit), outstanding: parseN(df.outstanding), dueAmount: parseN(df.dueAmount), lastUp: new Date().toISOString() } : d); setDebts(nd); const ns = snap(accounts, nd, cryptos); save(); setEId(null); setSf(null); };
  const quickD = (id: string, f: string, v: string) => { const nd = debts.map((d: AnyState) => d.id === id ? { ...d, [f]: parseN(v), lastUp: new Date().toISOString() } : d); setDebts(nd); save(); };
  const delDebt = (id: string) => { const nd = debts.filter((d: AnyState) => d.id !== id); setDebts(nd); save(); };

  const addRecv = () => { if (!rf.name || !rawN(rf.amount)) return; const nr = [...receivables, { id: gid(), ...rf, amount: parseN(rf.amount), received: 0 }]; setReceivables(nr); save(); setRf({ name: "", amount: "", dueDate: "", scope: "personal", currency: "PHP", notes: "", from: "" }); setSf(null); };
  const saveEditRecv = () => { const nr = receivables.map((r: AnyState) => r.id === eId ? { ...r, ...rf, amount: parseN(rf.amount), received: r.received || 0 } : r); setReceivables(nr); save(); setEId(null); setSf(null); };
  const delRecv = (id: string) => { const nr = receivables.filter((r: AnyState) => r.id !== id); setReceivables(nr); save(); };
  const collectRecv = (rv: AnyState) => { const nr = receivables.map((r: AnyState) => r.id === rv.id ? { ...r, received: r.amount } : r); setReceivables(nr); save(); };

  const addCrypto = () => { if (!rawN(crf.amount)) return; const nc = [...cryptos, { id: gid(), ...crf, amount: parseN(crf.amount) }]; setCryptos(nc); const ns = snap(accounts, debts, nc); save(); setCrf({ coin: "BTC", amount: "", scope: "personal", wallet: "" }); setSf(null); };
  const editCrAmt = (id: string, v: string) => { const nc = cryptos.map((c: AnyState) => c.id === id ? { ...c, amount: parseN(v) } : c); setCryptos(nc); save(); };
  const delCrypto = (id: string) => { const nc = cryptos.filter((c: AnyState) => c.id !== id); setCryptos(nc); save(); };

  // Pipeline CRUD
  const addPipeline = () => {
    if (!pf.name || !rawN(pf.grossValue)) return;
    const np = [...pipelines, { id: gid(), ...pf, grossValue: parseN(pf.grossValue), deliveryRate: parseFloat(pf.deliveryRate) || 70, shippingCost: parseN(pf.shippingCost), codFees: parseN(pf.codFees), returnCost: parseN(pf.returnCost), otherExpenses: parseN(pf.otherExpenses), parcels: parseN(pf.parcels), actualReceived: 0, actualReturned: 0, actualExpenses: 0 }];
    setPipelines(np); save();
    setPf({ name: "", grossValue: "", deliveryRate: "70", shippingCost: "", codFees: "", returnCost: "", otherExpenses: "", parcels: "", date: new Date().toISOString().slice(0, 10), expectedDate: "", scope: "business", currency: "PHP", notes: "", status: "active" }); setSf(null);
  };
  const saveEditPipeline = () => {
    const np = pipelines.map((p: AnyState) => p.id === eId ? { ...p, ...pf, grossValue: parseN(pf.grossValue), deliveryRate: parseFloat(pf.deliveryRate) || 70, shippingCost: parseN(pf.shippingCost), codFees: parseN(pf.codFees), returnCost: parseN(pf.returnCost), otherExpenses: parseN(pf.otherExpenses), parcels: parseN(pf.parcels) } : p);
    setPipelines(np); save(); setEId(null); setSf(null);
  };
  const updatePipelineActuals = (id: string, field: string, val: string) => {
    const np = pipelines.map((p: AnyState) => p.id === id ? { ...p, [field]: parseN(val) } : p);
    setPipelines(np); save();
  };
  const settlePipeline = (id: string) => {
    const np = pipelines.map((p: AnyState) => p.id === id ? { ...p, status: "settled" } : p);
    setPipelines(np); save();
  };
  const delPipeline = (id: string) => { const np = pipelines.filter((p: AnyState) => p.id !== id); setPipelines(np); save(); };

  // Asset CRUD
  const ASSET_CATS: Record<string, string> = { vehicle: "🚗 Vehicle", real_estate: "🏠 Real Estate", land: "🏞️ Land", gold: "🥇 Gold / Precious Metals", collectible: "🎨 Collectible / Art", jewelry: "💎 Jewelry", equipment: "⚙️ Equipment", electronics: "💻 Electronics", furniture: "🪑 Furniture", other: "📋 Other" };
  const APPRECIATING_CATS = ["land", "gold", "collectible", "jewelry", "real_estate"];
  const isAppreciating = (a: AnyState) => APPRECIATING_CATS.includes(a.category);
  const getBookValue = (a: AnyState) => {
    if (!a.purchaseDate) return a.purchasePrice || 0;
    const years = (Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 864e5);
    if (isAppreciating(a)) {
      const rate = parseFloat(a.appreciationRate) || 5;
      return a.purchasePrice * Math.pow(1 + rate / 100, years);
    }
    if (!a.usefulLife) return a.purchasePrice || 0;
    const life = parseFloat(a.usefulLife) || 5;
    const salvage = a.salvageValue || 0;
    const dep = ((a.purchasePrice - salvage) / life) * Math.min(years, life);
    return Math.max(a.purchasePrice - dep, salvage);
  };
  const tFixedAssets = sAx.reduce((s: number, a: AnyState) => { const val = a.marketValue > 0 ? a.marketValue : getBookValue(a); return s + cv(val, a.currency, dCur, rates); }, 0);
  const addAsset = () => { if (!axf.name || !rawN(axf.purchasePrice)) return; const na = [...assets, { id: gid(), ...axf, purchasePrice: parseN(axf.purchasePrice), salvageValue: parseN(axf.salvageValue), marketValue: parseN(axf.marketValue), usefulLife: parseFloat(axf.usefulLife) || 5, appreciationRate: parseFloat(axf.appreciationRate) || 5 }]; setAssets(na); save(); setAxf({ name: "", category: "vehicle", purchasePrice: "", purchaseDate: "", usefulLife: "5", salvageValue: "0", marketValue: "", appreciationRate: "5", scope: "personal", currency: "PHP", notes: "" }); setSf(null); };
  const saveEditAsset = () => { const na = assets.map((a: AnyState) => a.id === eId ? { ...a, ...axf, purchasePrice: parseN(axf.purchasePrice), salvageValue: parseN(axf.salvageValue), marketValue: parseN(axf.marketValue), usefulLife: parseFloat(axf.usefulLife) || 5, appreciationRate: parseFloat(axf.appreciationRate) || 5 } : a); setAssets(na); save(); setEId(null); setSf(null); };
  const delAsset = (id: string) => { const na = assets.filter((a: AnyState) => a.id !== id); setAssets(na); save(); };

  // Inventory CRUD
  const addInv = () => { if (!ivf.name || !rawN(ivf.qty)) return; const ni = [...inventory, { id: gid(), ...ivf, qty: parseN(ivf.qty), unitCost: parseN(ivf.unitCost), lastUpdated: new Date().toISOString() }]; setInventory(ni); save(); setIvf({ name: "", qty: "", unitCost: "", scope: "business", currency: "PHP", notes: "", sku: "" }); setSf(null); };
  const saveEditInv = () => { const ni = inventory.map((i: AnyState) => i.id === eId ? { ...i, ...ivf, qty: parseN(ivf.qty), unitCost: parseN(ivf.unitCost), lastUpdated: new Date().toISOString() } : i); setInventory(ni); save(); setEId(null); setSf(null); };
  const quickInv = (id: string, f: string, v: string) => { const ni = inventory.map((i: AnyState) => i.id === id ? { ...i, [f]: parseN(v), lastUpdated: new Date().toISOString() } : i); setInventory(ni); save(); };
  const delInv = (id: string) => { const ni = inventory.filter((i: AnyState) => i.id !== id); setInventory(ni); save(); };

  // ── CSV Parsing ──
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
    return lines.slice(1).map(line => {
      const vals: string[] = []; let cur = ""; let inQ = false;
      for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; } else cur += ch; }
      vals.push(cur.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/^"|"$/g, ""); });
      return obj;
    });
  };

  const PLATFORM_MAPS: Record<string, Record<string, string[]>> = {
    shopee: { gross: ["order amount", "total amount", "deal price", "original price", "product subtotal"], ship: ["shipping fee", "shipping fee paid by buyer"], fees: ["commission fee", "service fee", "transaction fee"], status: ["order status"], id: ["order id", "order sn"], date: ["order creation date", "create time", "order complete time"] },
    tiktok: { gross: ["total settlement amount", "total amount", "sku subtotal after discount", "order amount"], ship: ["shipping fee", "actual shipping fee"], fees: ["platform commission", "transaction fee", "affiliate commission"], status: ["order status"], id: ["order id"], date: ["created time", "order create time"] },
    shopify: { gross: ["total", "subtotal"], ship: ["shipping"], fees: ["taxes"], status: ["financial status"], id: ["name", "order name"], date: ["created at", "paid at"] },
    custom: { gross: ["revenue", "gross", "sales", "amount", "total"], ship: ["shipping", "delivery"], fees: ["fees", "commission"], status: ["status"], id: ["id", "order"], date: ["date"] },
  };

  const findCol = (row: Record<string, string>, candidates: string[]) => {
    const keys = Object.keys(row);
    for (const c of candidates) { const found = keys.find(k => k.includes(c)); if (found && row[found]) return parseFloat(String(row[found]).replace(/[^0-9.\-]/g, "")) || 0; }
    return 0;
  };
  const findStr = (row: Record<string, string>, candidates: string[]) => {
    const keys = Object.keys(row);
    for (const c of candidates) { const found = keys.find(k => k.includes(c)); if (found && row[found]) return row[found]; }
    return "";
  };

  const processCSV = (rows: Record<string, string>[], platform: string) => {
    const map = PLATFORM_MAPS[platform] || PLATFORM_MAPS.custom;
    let totalOrders = rows.length, delivered = 0, cancelled = 0, returned = 0;
    let grossRev = 0, totalShip = 0, totalFees = 0;

    rows.forEach(r => {
      const status = findStr(r, map.status).toLowerCase();
      const isCancelled = ["cancelled", "canceled", "refunded", "returned", "unpaid"].some(s => status.includes(s));
      const isReturned = ["return", "rts", "returned"].some(s => status.includes(s));
      if (isCancelled) { cancelled++; return; }
      if (isReturned) { returned++; return; }
      delivered++;
      grossRev += findCol(r, map.gross);
      totalShip += findCol(r, map.ship);
      totalFees += findCol(r, map.fees);
    });

    const netRev = grossRev - totalShip - totalFees;
    const deliveryRate = totalOrders > 0 ? Math.round((delivered / totalOrders) * 100) : 0;
    return { totalOrders, delivered, cancelled, returned, grossRev, totalShip, totalFees, netRev, deliveryRate, columns: rows.length > 0 ? Object.keys(rows[0]) : [] };
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target?.result as string);
      const summary = processCSV(rows, csvPlatform);
      setCsvPreview({ ...summary, fileName: file.name, platform: csvPlatform });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const savePnlBatch = () => {
    if (!csvPreview) return;
    const batch = { id: gid(), ...csvPreview, date: new Date().toISOString().slice(0, 10), scope: scope === "all" ? "business" : scope, currency: "PHP" };
    const nb = [batch, ...pnlBatches];
    setPnlBatches(nb); save();
    setCsvPreview(null);
  };
  const delPnlBatch = (id: string) => { const nb = pnlBatches.filter((b: AnyState) => b.id !== id); setPnlBatches(nb); save(); };

  const addTx = () => {
    if (!tf.accountId || !rawN(tf.amount)) return;
    if (tf.type === "transfer" && !tf.toAccountId) return;
    const amt = parseN(tf.amount);
    const tx = { id: gid(), ...tf, amount: amt };
    const nt = [tx, ...txns];
    let na = [...accounts];
    if (tf.type === "transfer") {
      na = na.map((a: AnyState) => { if (a.id === tf.accountId) return { ...a, balance: a.balance - amt }; if (a.id === tf.toAccountId) return { ...a, balance: a.balance + amt }; return a; });
    } else {
      na = na.map((a: AnyState) => { if (a.id !== tf.accountId) return a; return { ...a, balance: a.balance + (tf.type === "income" ? amt : -amt) }; });
    }
    let nr = receivables;
    if (tf.type === "income" && tf.receivableId) {
      nr = receivables.map((r: AnyState) => r.id === tf.receivableId ? { ...r, received: (r.received || 0) + amt } : r);
      setReceivables(nr);
    }
    let nd = debts;
    if (tf.type === "expense" && tf.debtId) {
      nd = debts.map((d: AnyState) => d.id === tf.debtId ? { ...d, outstanding: Math.max(0, d.outstanding - amt), paid: (d.paid || 0) + amt, lastUp: new Date().toISOString() } : d);
      setDebts(nd);
    }
    setTxns(nt); setAccounts(na); const ns = snap(na, nd, cryptos); save();
    setTf({ accountId: "", toAccountId: "", type: "expense", amount: "", description: "", date: new Date().toISOString().slice(0, 10), receivableId: "", debtId: "", txCat: "", txScope: "personal" }); setSf(null);
  };

  const saveEditTx = () => {
    const oldTx = txns.find((t: AnyState) => t.id === eId); if (!oldTx) return;
    const amt = parseN(tf.amount);
    let na = [...accounts];
    if (oldTx.type === "transfer") { na = na.map((a: AnyState) => { if (a.id === oldTx.accountId) return { ...a, balance: a.balance + oldTx.amount }; if (a.id === oldTx.toAccountId) return { ...a, balance: a.balance - oldTx.amount }; return a; }); }
    else { na = na.map((a: AnyState) => { if (a.id !== oldTx.accountId) return a; return { ...a, balance: a.balance + (oldTx.type === "income" ? -oldTx.amount : oldTx.amount) }; }); }
    if (tf.type === "transfer") { na = na.map((a: AnyState) => { if (a.id === tf.accountId) return { ...a, balance: a.balance - amt }; if (a.id === tf.toAccountId) return { ...a, balance: a.balance + amt }; return a; }); }
    else { na = na.map((a: AnyState) => { if (a.id !== tf.accountId) return a; return { ...a, balance: a.balance + (tf.type === "income" ? amt : -amt) }; }); }
    let nd = [...debts];
    if (oldTx.debtId) { nd = nd.map((d: AnyState) => d.id === oldTx.debtId ? { ...d, outstanding: d.outstanding + oldTx.amount, paid: Math.max(0, (d.paid || 0) - oldTx.amount) } : d); }
    if (tf.type === "expense" && tf.debtId) { nd = nd.map((d: AnyState) => d.id === tf.debtId ? { ...d, outstanding: Math.max(0, d.outstanding - amt), paid: (d.paid || 0) + amt, lastUp: new Date().toISOString() } : d); }
    let nr = [...receivables];
    if (oldTx.receivableId) { nr = nr.map((r: AnyState) => r.id === oldTx.receivableId ? { ...r, received: Math.max(0, (r.received || 0) - oldTx.amount) } : r); }
    if (tf.type === "income" && tf.receivableId) { nr = nr.map((r: AnyState) => r.id === tf.receivableId ? { ...r, received: (r.received || 0) + amt } : r); }
    const nt = txns.map((t: AnyState) => t.id === eId ? { ...t, ...tf, amount: amt } : t);
    setTxns(nt); setAccounts(na); setDebts(nd); setReceivables(nr); save();
    setEId(null); setSf(null); setTf({ accountId: "", toAccountId: "", type: "expense", amount: "", description: "", date: new Date().toISOString().slice(0, 10), receivableId: "", debtId: "", txCat: "", txScope: "personal" });
  };

  const delTx = (tx: AnyState) => {
    let na = [...accounts];
    if (tx.type === "transfer") { na = na.map((a: AnyState) => { if (a.id === tx.accountId) return { ...a, balance: a.balance + tx.amount }; if (a.id === tx.toAccountId) return { ...a, balance: a.balance - tx.amount }; return a; }); }
    else { na = na.map((a: AnyState) => { if (a.id !== tx.accountId) return a; return { ...a, balance: a.balance + (tx.type === "income" ? -tx.amount : tx.amount) }; }); }
    let nd = [...debts];
    if (tx.debtId) { nd = nd.map((d: AnyState) => d.id === tx.debtId ? { ...d, outstanding: d.outstanding + tx.amount, paid: Math.max(0, (d.paid || 0) - tx.amount) } : d); setDebts(nd); }
    let nr = [...receivables];
    if (tx.receivableId) { nr = nr.map((r: AnyState) => r.id === tx.receivableId ? { ...r, received: Math.max(0, (r.received || 0) - tx.amount) } : r); setReceivables(nr); }
    const nt = txns.filter((t: AnyState) => t.id !== tx.id);
    setTxns(nt); setAccounts(na); save();
  };

  const updRate = (c: string, v: string) => setRates(p => ({ ...p, [c]: parseFloat(v) || 0 }));

  // ── Smart Scan ──
  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setScanLoading(true); setScanResult(null);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsDataURL(file);
      });
      const mediaType = file.type || "image/jpeg";
      setScanImg(`data:${mediaType};base64,${base64}`);

      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: `Extract transaction details from this screenshot. This could be a receipt, bank transfer, payment confirmation, sales notification, invoice, or any financial document.

Return ONLY a JSON object with these fields (no markdown, no backticks, no explanation):
{
  "type": "income" or "expense",
  "amount": number (the main transaction amount, no currency symbols),
  "currency": "PHP" or "USD" or "HKD" (detect from the image),
  "description": "brief description of what this transaction is",
  "source": "where this is from (store name, bank, platform, person, etc)",
  "date": "YYYY-MM-DD" (if visible, otherwise today's date "${new Date().toISOString().slice(0, 10)}"),
  "confidence": "high" or "medium" or "low",
  "details": "any additional details like reference number, items purchased, etc",
  "txScope": "personal" or "business" (infer from context),
  "category": one of these exact values based on type+scope:
    Personal Expense: "food","grocery","shopping","transport","utilities","rent","health","entertainment","education","insurance","travel","gift","personal_other"
    Business Expense: "ads","salaries","opex","shipping","inventory","tools","rent_office","taxes","professional","travel_biz","commission","biz_other"
    Personal Income: "salary","freelance","investment_ret","gift_in","refund","income_other"
    Business Income: "sales","services","commission_in","refund_biz","biz_income_other"
}

Important: If you see multiple amounts, use the total/final amount. For bank transfers, the sender pays (expense) and receiver gets (income). If unsure about type, default to "expense".` }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.map((i: AnyState) => i.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setScanResult(parsed);
    } catch (err: AnyState) {
      setScanResult({ error: "Could not read this image. Try a clearer screenshot.", raw: err.message });
    }
    setScanLoading(false);
    e.target.value = "";
  };

  const saveScan = () => {
    if (!scanResult || scanResult.error || !scanResult.amount) return;
    const amt = parseFloat(scanResult.amount) || 0;
    const tx = {
      id: gid(),
      accountId: accounts.length > 0 ? accounts[0].id : "",
      toAccountId: "",
      type: scanResult.type || "expense",
      amount: amt,
      description: `${scanResult.source || "Scan"}: ${scanResult.description || ""}`.trim(),
      date: scanResult.date || new Date().toISOString().slice(0, 10),
      receivableId: "",
      debtId: "",
      scanned: true,
      txCat: scanResult.category || "",
      txScope: scanResult.txScope || "personal"
    };
    let na = [...accounts];
    if (tx.accountId) {
      na = na.map((a: AnyState) => {
        if (a.id !== tx.accountId) return a;
        return { ...a, balance: a.balance + (tx.type === "income" ? amt : -amt) };
      });
    }
    const nt = [tx, ...txns];
    setTxns(nt); setAccounts(na);
    setScanHistory((p: AnyState[]) => [{ ...scanResult, id: gid(), savedAt: new Date().toISOString() }, ...p]);
    const ns = snap(na, debts, cryptos); save();
    setScanResult(null); setScanImg(null);
  };

  // Theme
  const dk = darkMode;
  const T = {
    bg: dk ? "#0B0D12" : "#F5F5F7",
    sidebar: dk ? "#0a0c10" : "#EAEAEE",
    sidebarBorder: dk ? "#181b22" : "#D0D0D8",
    card: dk ? "#12141A" : "#FFFFFF",
    cardBorder: dk ? "#252830" : "#E0E0E6",
    input: dk ? "#111318" : "#FFFFFF",
    inputBorder: dk ? "#2a2d35" : "#D0D0D8",
    text: dk ? "#ddd" : "#1a1a2e",
    textSoft: dk ? "#555" : "#888",
    textMuted: dk ? "#444" : "#aaa",
    textWhite: dk ? "#fff" : "#1a1a2e",
    navActive: dk ? "#12141A" : "#FFFFFF",
    navInactive: dk ? "transparent" : "transparent",
    navText: dk ? "#555" : "#777",
    navActiveText: dk ? "#fff" : "#1a1a2e",
    statBg: dk ? "#0B0D12" : "#F0F0F4",
    divider: dk ? "#1a1d25" : "#E8E8EE",
  };

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  // Masked balance display
  const masked = (val: string) => hideBalances ? "••••••" : val;

  // Styles
  const I: React.CSSProperties = { background: T.input, border: `1px solid ${T.inputBorder}`, color: T.textWhite, padding: "10px 12px", borderRadius: 8, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
  const L: React.CSSProperties = { fontSize: 10, color: T.textSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, display: "block" };
  const Sec: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: T.textSoft, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 };
  const Cd = (b: string): React.CSSProperties => ({ background: T.card, borderRadius: 10, padding: "12px", borderLeft: `3px solid ${b}` });
  const BtnS = (bg: string, clr?: string): React.CSSProperties => ({ background: bg, color: clr || "#0B0D12", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 });
  const CnclS: React.CSSProperties = { background: "none", border: `1px solid ${T.inputBorder}`, color: "#888", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 };
  const FmS: React.CSSProperties = { background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: 16, marginBottom: 14 };
  const G2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 };
  const FlEnd: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 8 };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: dk ? "#0B0D12" : "#F5F5F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 14 }}>
        Loading VAULT...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif", display: "flex" }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 220, minWidth: 220, background: T.sidebar, borderRight: `1px solid ${T.sidebarBorder}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        {/* Logo */}
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.textWhite, letterSpacing: 4 }}>VAULT</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 9, color: T.textSoft, letterSpacing: 2 }}>FINANCE</span>
            <span style={{ fontSize: 8, color: rStat === "live" ? "#95E77E" : "#FFD93D", background: T.statBg, padding: "1px 5px", borderRadius: 4 }}>{rStat === "live" ? "● LIVE" : "◌ CACHED"}</span>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: "4px 8px" }}>
          {[
            ["dash", "📊", "Overview"],
            ["ask", "💬", "Ask Vault"],
            ["acc", "🏦", "Accounts"],
            ["crypto", "🪙", "Crypto"],
            ["asset", "🏠", "Assets"],
            ["debt", "💳", "Debts"],
            ["recv", "📥", "Receivables"],
            ["pipe", "📦", "Pipeline"],
            ["pnl", "💹", "P&L Import"],
            ["report", "📊", "Reports"],
            ["scan", "📸", "Smart Scan"],
            ["tx", "📝", "Activity"],
          ].map(([k, icon, label]) => (
            <button key={k} onClick={() => { setView(k); setSf(null); setEId(null); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", marginBottom: 2, background: view === k ? T.navActive : T.navInactive, border: "none", borderRadius: 8, color: view === k ? T.navActiveText : T.navText, cursor: "pointer", fontSize: 13, fontWeight: view === k ? 600 : 400, textAlign: "left" as const, borderLeft: view === k ? "3px solid #4ECDC4" : "3px solid transparent" }}>
              <span style={{ fontSize: 16 }}>{icon}</span> {label}
            </button>
          ))}
        </div>

        {/* Scope + Settings */}
        <div style={{ padding: "12px 12px 16px", borderTop: `1px solid ${T.sidebarBorder}` }}>
          <div style={{ fontSize: 9, color: T.textSoft, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>Currency</div>
          <select value={dCur} onChange={e => setDCur(e.target.value)} style={{ background: T.input, border: `1px solid ${T.inputBorder}`, color: "#4ECDC4", padding: "6px 8px", borderRadius: 6, fontSize: 13, outline: "none", fontWeight: 700, width: "100%", marginBottom: 8 }}>{ALL_CUR.map(c => <option key={c}>{c}</option>)}</select>
          <button onClick={() => setDarkMode(!darkMode)} style={{ width: "100%", background: "none", border: `1px solid ${T.inputBorder}`, color: T.navText, padding: "5px", borderRadius: 6, cursor: "pointer", fontSize: 10, marginBottom: 4 }}>{dk ? "☀️ Light Mode" : "🌙 Dark Mode"}</button>
          <button onClick={() => setShowRates(!showRates)} style={{ width: "100%", background: "none", border: `1px solid ${T.inputBorder}`, color: T.navText, padding: "5px", borderRadius: 6, cursor: "pointer", fontSize: 10, marginBottom: 4 }}>💱 Rates</button>
          <button onClick={() => {
            const answer = prompt('Type RESET to erase all data. This cannot be undone.');
            if (answer?.trim().toUpperCase() !== 'RESET') return;
            setAccounts([]); setDebts([]); setReceivables([]); setCryptos([]); setTxns([]); setPipelines([]); setAssets([]); setInventory([]); setPnlBatches([]); setSnaps([]); save();
          }} style={{ width: "100%", background: "none", border: "1px solid #FF6B6B33", color: "#FF6B6B", padding: "5px 8px", borderRadius: 6, cursor: "pointer", fontSize: 10 }}>Reset Data</button>
          <button onClick={handleLogout} style={{ width: "100%", marginTop: 8, background: "none", border: `1px solid ${T.inputBorder}`, color: "#FF6B6B", padding: "6px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Logout</button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", height: "100vh" }}>
        {/* Rates panel */}
        {showRates && (
          <div style={{ ...FmS, margin: "12px 20px 0" }}>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 13, marginBottom: 8 }}>💱 Rates (1 unit = ? PHP)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {Object.entries(rates).filter(([k]) => k !== "PHP").map(([cur, rate]) => (
                <div key={cur}><span style={{ fontSize: 10, color: "#888", fontWeight: 600 }}>1 {cur}</span><input style={{ ...I, padding: "6px 8px", fontSize: 12, marginTop: 2 }} type="number" defaultValue={rate} onBlur={e => updRate(cur, e.target.value)} /></div>
              ))}
            </div>
            <button onClick={() => setShowRates(false)} style={{ ...CnclS, marginTop: 10, width: "100%" }}>Close</button>
          </div>
        )}

        <div style={{ padding: "16px 20px", paddingBottom: 60 }}>

        {/* ═══ DASHBOARD ═══ */}
        {view === "dash" && (<div>
          {/* Greeting + Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.textWhite }}>{greeting}, Jims!</div>
              <div style={{ fontSize: 11, color: T.textSoft, marginTop: 2 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setHideBalances(!hideBalances)} style={{ background: "none", border: `1px solid ${T.inputBorder}`, color: T.textSoft, padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 16 }}>
                {hideBalances ? "🙈" : "👁"}
              </button>
              <div style={{ position: "relative" as const }}>
                <button onClick={(e) => { e.stopPropagation(); setDdScope(!ddScope); }} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, color: T.textWhite, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  🔍 {scopeLabel()} ▾
                </button>
                {ddScope && (
                  <div onClick={e => e.stopPropagation()} style={{ position: "absolute" as const, top: "100%", right: 0, marginTop: 4, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: 6, zIndex: 100, minWidth: 220, boxShadow: "0 8px 24px rgba(0,0,0,.3)" }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 6, padding: "0 4px" }}>
                      <button onClick={() => setScopeFilter(["all"])} style={{ flex: 1, background: "transparent", border: `1px solid ${T.cardBorder}`, color: T.textSoft, padding: "3px 6px", borderRadius: 4, cursor: "pointer", fontSize: 9 }}>Select All</button>
                      <button onClick={() => setScopeFilter([])} style={{ flex: 1, background: "transparent", border: `1px solid ${T.cardBorder}`, color: T.textSoft, padding: "3px 6px", borderRadius: 4, cursor: "pointer", fontSize: 9 }}>Unselect All</button>
                    </div>
                    {[
                      { id: "all", label: "🌐 View All", color: "#4ECDC4" },
                      { id: "personal", label: "👤 Personal", color: "#A8B5E2" },
                      { id: "business", label: "📊 All Business", color: "#FFD93D" },
                    ].map(opt => {
                      const active = scopeFilter.includes(opt.id);
                      return (
                        <button key={opt.id} onClick={() => toggleScope(opt.id)}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: active ? T.statBg : "transparent", border: "none", borderRadius: 6, color: active ? T.textWhite : T.text, cursor: "pointer", fontSize: 12, textAlign: "left" as const, fontWeight: active ? 600 : 400 }}>
                          <span style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${active ? opt.color : T.textSoft}`, background: active ? opt.color + "33" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: opt.color, flexShrink: 0 }}>{active ? "✓" : ""}</span>
                          {opt.label}
                        </button>
                      );
                    })}
                    {businesses.map((b: AnyState) => {
                      const active = scopeFilter.includes(b.id) || scopeFilter.includes("all") || scopeFilter.includes("business");
                      return (
                        <button key={b.id} onClick={() => toggleScope(b.id)}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px 7px 28px", background: scopeFilter.includes(b.id) ? T.statBg : "transparent", border: "none", borderRadius: 6, color: active ? T.textWhite : T.textMuted, cursor: "pointer", fontSize: 11, textAlign: "left" as const, fontWeight: scopeFilter.includes(b.id) ? 600 : 400 }}>
                          <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${scopeFilter.includes(b.id) ? b.color : T.textSoft}`, background: scopeFilter.includes(b.id) ? b.color + "33" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: b.color, flexShrink: 0 }}>{scopeFilter.includes(b.id) ? "✓" : ""}</span>
                          {b.name}
                        </button>
                      );
                    })}
                    <div style={{ borderTop: `1px solid ${T.divider}`, marginTop: 4, paddingTop: 4, display: "flex", gap: 4 }}>
                      <button onClick={() => { setShowBizMgr(!showBizMgr); setDdScope(false); }}
                        style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "transparent", border: "none", borderRadius: 6, color: T.textSoft, cursor: "pointer", fontSize: 11, textAlign: "left" as const }}>
                        ⚙️ Manage
                      </button>
                      <button onClick={() => setDdScope(false)}
                        style={{ padding: "7px 14px", background: "#4ECDC4", border: "none", borderRadius: 6, color: "#0B0D12", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Business Manager */}
          {showBizMgr && (
            <div style={{ ...FmS, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, color: T.textWhite, fontSize: 14 }}>⚙️ Manage Businesses</div>
                <button onClick={() => { setShowBizMgr(false); setConfirmBiz(null); setRemoveBiz(null); }} style={{ background: "none", border: "none", color: T.textSoft, cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>
              {businesses.map((b: AnyState) => (
                <div key={b.id} style={{ background: T.statBg, borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: b.color }} />
                      <div>
                        <div style={{ color: T.textWhite, fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                        <div style={{ fontSize: 10, color: T.textSoft }}>{BIZ_NATURES[b.nature] || b.nature || "—"} · {BIZ_PAYMENTS[b.paymentMethod] || b.paymentMethod || "—"}{b.industry ? ` · ${b.industry}` : ""}</div>
                      </div>
                    </div>
                    <button onClick={() => startDelBiz(b)} style={{ background: "none", border: `1px solid #FF6B6B44`, color: "#FF6B6B", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 10 }}>Remove</button>
                  </div>
                  {removeBiz?.id === b.id && (
                    <div style={{ marginTop: 8, padding: 10, background: "#FF6B6B11", borderRadius: 6, border: "1px solid #FF6B6B33" }}>
                      <div style={{ color: "#FF6B6B", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Confirm removal of "{b.name}"</div>
                      <div style={{ fontSize: 11, color: T.textSoft, marginBottom: 8 }}>Enter your account password to confirm:</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input style={{ ...I, flex: 1, fontSize: 12 }} type="password" value={removeBizPw} onChange={e => setRemoveBizPw(e.target.value)} placeholder="Password" onKeyDown={e => { if (e.key === "Enter") confirmDelBiz(); }} />
                        <button onClick={confirmDelBiz} style={{ ...BtnS("#FF6B6B", "#fff"), fontSize: 11 }}>Delete</button>
                        <button onClick={() => setRemoveBiz(null)} style={{ ...CnclS, fontSize: 11 }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 12, padding: 12, background: T.statBg, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textWhite, marginBottom: 8 }}>Add New Business</div>
                <div style={G2}>
                  <div><span style={L}>Business Name</span><input style={I} value={newBizName} onChange={e => setNewBizName(e.target.value)} placeholder="My Business" /></div>
                  <div><span style={L}>Nature</span><select style={I} value={newBizNature} onChange={e => setNewBizNature(e.target.value)}>{Object.entries(BIZ_NATURES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                  <div><span style={L}>Payment Method</span><select style={I} value={newBizPayment} onChange={e => setNewBizPayment(e.target.value)}>{Object.entries(BIZ_PAYMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                  <div><span style={L}>Industry</span><input style={I} value={newBizIndustry} onChange={e => setNewBizIndustry(e.target.value)} placeholder="e.g. Skincare, Tech..." /></div>
                </div>
                <div style={FlEnd}><button onClick={startAddBiz} disabled={!newBizName.trim()} style={{ ...BtnS(newBizName.trim() ? "#4ECDC4" : "#333"), cursor: newBizName.trim() ? "pointer" : "not-allowed" }}>Add Business</button></div>
              </div>
              {confirmBiz && (
                <div style={{ marginTop: 10, padding: 12, background: "#4ECDC411", borderRadius: 8, border: "1px solid #4ECDC444" }}>
                  <div style={{ color: T.textWhite, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Confirm: Add new business?</div>
                  <div style={{ fontSize: 12, color: T.text, marginBottom: 8 }}>
                    <strong>{confirmBiz.name}</strong> — {BIZ_NATURES[confirmBiz.nature] || confirmBiz.nature} · {BIZ_PAYMENTS[confirmBiz.paymentMethod] || confirmBiz.paymentMethod}{confirmBiz.industry ? ` · ${confirmBiz.industry}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={confirmAddBiz} style={BtnS("#4ECDC4")}>Confirm Add</button>
                    <button onClick={() => setConfirmBiz(null)} style={CnclS}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div style={Cd("#4ECDC4")}><div style={L}>Fiat</div><div style={{ fontSize: 14, fontWeight: 700, color: "#4ECDC4", marginTop: 3 }}>{masked(fm(tAssets, dCur, true))}</div></div>
            <div style={Cd("#F7931A")}><div style={L}>Crypto</div><div style={{ fontSize: 14, fontWeight: 700, color: "#F7931A", marginTop: 3 }}>{masked(fm(tCrypto, dCur, true))}</div></div>
            <div style={Cd("#FF6B6B")}><div style={L}>Debt</div><div style={{ fontSize: 14, fontWeight: 700, color: "#FF6B6B", marginTop: 3 }}>{masked(fm(tDebt, dCur, true))}</div></div>
          </div>
          {tLimit > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div style={Cd("#A8B5E2")}><div style={L}>Credit Limit</div><div style={{ fontSize: 14, fontWeight: 700, color: "#A8B5E2", marginTop: 3 }}>{masked(fm(tLimit, dCur, true))}</div></div>
            <div style={Cd("#FF6B6B")}><div style={L}>Used Credit</div><div style={{ fontSize: 14, fontWeight: 700, color: "#FF6B6B", marginTop: 3 }}>{masked(fm(tDebt, dCur, true))}</div><div style={{ fontSize: 10, color: T.textSoft }}>{tLimit > 0 ? Math.round(tDebt / tLimit * 100) : 0}% used</div></div>
            <div style={Cd("#95E77E")}><div style={L}>Available Credit</div><div style={{ fontSize: 14, fontWeight: 700, color: "#95E77E", marginTop: 3 }}>{masked(fm(tLimit - tDebt, dCur, true))}</div></div>
          </div>}
          {tReceivable > 0 && <div style={{ ...Cd("#26A17B"), marginBottom: 8, display: "flex", justifyContent: "space-between" }}><div><div style={L}>Receivables</div><div style={{ fontSize: 17, fontWeight: 700, color: "#26A17B", marginTop: 3 }}>{masked(fm(tReceivable, dCur, true))}</div></div><div style={{ fontSize: 10, color: T.textSoft, alignSelf: "center" }}>{openR.length} open</div></div>}
          {activeP.length > 0 && <div style={{ ...Cd("#E9C46A"), marginBottom: 8, display: "flex", justifyContent: "space-between" }}><div><div style={L}>Pipeline (Expected Net)</div><div style={{ fontSize: 17, fontWeight: 700, color: "#E9C46A", marginTop: 3 }}>{masked(fm(pipelineNet, dCur, true))}</div></div><div style={{ fontSize: 10, color: T.textSoft, alignSelf: "center" }}>{activeP.length} active · {masked(fm(pipelineGross, dCur, true))} gross</div></div>}

          {/* Net Worth Calculator */}
          <div style={{ background: "#12141A", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase" as const, letterSpacing: 2, marginBottom: 12 }}>Net Worth Calculator</div>
            {(() => {
              const items = [
                { key: "cash", icon: "💰", label: "Cash (Fiat)", val: tAssets, color: "#4ECDC4", sub: `${sA.length} accounts` },
                { key: "crypto", icon: "🪙", label: "Crypto", val: tCrypto, color: "#F7931A", sub: `${sC.length} holdings` },
                { key: "fixedAssets", icon: "🏠", label: "Fixed Assets", val: tFixedAssets, color: "#D4A373", sub: `${sAx.length} assets (book/market)` },
                { key: "inventory", icon: "📦", label: "Inventory", val: tInventory, color: "#CDB4DB", sub: `${sIv.length} items` },
                { key: "receivable", icon: "📥", label: "Receivables", val: tReceivable, color: "#26A17B", sub: `${openR.length} open` },
                { key: "pipeline", icon: "📦", label: "Pipeline (Net)", val: pipelineNet, color: "#E9C46A", sub: `${activeP.length} active` },
                { key: "dueNow", icon: "📅", label: "Dues This Month", val: -dueNowAmt, color: "#FFD93D", sub: `${dueNow.length} items` },
                { key: "due60", icon: "📆", label: "Dues 30-60 Days", val: -due3060Amt, color: "#F4A261", sub: `${due3060.length} items` },
                { key: "debtAll", icon: "🏦", label: "ALL Outstanding Debt", val: -tDebt, color: "#FF6B6B", sub: `${sD.length} debts` },
              ];
              const total = items.reduce((s, it) => s + (nwToggles[it.key] ? it.val : 0), 0);
              const activeCount = items.filter(it => nwToggles[it.key]).length;
              return (<>
                {items.map(it => (
                  <div key={it.key}
                    onClick={() => setNwToggles(p => ({ ...p, [it.key]: !p[it.key] }))}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #1a1d25", cursor: "pointer", opacity: nwToggles[it.key] ? 1 : 0.4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${nwToggles[it.key] ? it.color : "#333"}`, background: nwToggles[it.key] ? it.color + "22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: nwToggles[it.key] ? it.color : "#333", flexShrink: 0 }}>{nwToggles[it.key] ? "✓" : ""}</div>
                      <div>
                        <div style={{ fontSize: 13, color: nwToggles[it.key] ? "#ccc" : "#555", fontWeight: 600 }}>{it.icon} {it.label}</div>
                        <div style={{ fontSize: 10, color: "#444" }}>{it.sub}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: it.val >= 0 ? it.color : "#FF6B6B", textAlign: "right" as const }}>
                      {masked(`${it.val >= 0 ? "+" : ""}${fm(it.val, dCur, true)}`)}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 4px", marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>= TOTAL</div>
                    <div style={{ fontSize: 10, color: "#555" }}>{activeCount} items selected</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: total >= 0 ? "#95E77E" : "#FF6B6B" }}>{masked(fm(total, dCur, true))}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginTop: 10 }}>
                  {([
                    ["Everything", { cash: true, crypto: true, fixedAssets: true, inventory: true, receivable: true, pipeline: true, debtAll: true, dueNow: false, due60: false }],
                    ["Liquid Only", { cash: true, crypto: true, fixedAssets: false, inventory: false, receivable: false, pipeline: false, debtAll: false, dueNow: false, due60: false }],
                    ["After Dues", { cash: true, crypto: true, fixedAssets: false, inventory: false, receivable: false, pipeline: false, debtAll: false, dueNow: true, due60: false }],
                    ["True Net", { cash: true, crypto: true, fixedAssets: true, inventory: true, receivable: false, pipeline: false, debtAll: true, dueNow: false, due60: false }],
                    ["Best Case", { cash: true, crypto: true, fixedAssets: true, inventory: true, receivable: true, pipeline: true, debtAll: true, dueNow: false, due60: false }],
                  ] as [string, Record<string, boolean>][]).map(([label, preset]) => (
                    <button key={label} onClick={() => setNwToggles(preset)}
                      style={{ background: "#1a1d25", border: "1px solid #252830", color: "#888", padding: "4px 10px", borderRadius: 12, cursor: "pointer", fontSize: 10, fontWeight: 600 }}>{label}</button>
                  ))}
                </div>
              </>);
            })()}
          </div>

          {chartData.length >= 1 && (
            <div style={{ marginBottom: 20 }}><div style={Sec}>Balance History ({chartData.length} snapshots)</div>
              <div style={{ background: "#12141A", borderRadius: 10, padding: "12px 4px 4px" }}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ECDC4" stopOpacity={.3} /><stop offset="100%" stopColor="#4ECDC4" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1d25" />
                    <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v.toLocaleString("en")} width={60} />
                    <Tooltip contentStyle={{ background: "#1a1d25", border: "1px solid #2a2d35", borderRadius: 8, fontSize: 12 }} formatter={(v: AnyState) => Number(v).toLocaleString("en")} />
                    <Area type="monotone" dataKey="Assets" stroke="#4ECDC4" fill="url(#gA)" strokeWidth={2} />
                    <Line type="monotone" dataKey="Net" stroke="#95E77E" strokeWidth={2} dot={chartData.length < 20} />
                    <Line type="monotone" dataKey="Debt" stroke="#FF6B6B" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="Crypto" stroke="#F7931A" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {chartData.length === 0 && <div style={{ background: "#12141A", borderRadius: 10, padding: 20, textAlign: "center", color: "#333", fontSize: 13, marginBottom: 20 }}>📊 Add accounts to start tracking</div>}

          <div style={Sec}>💱 Rates</div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>{Object.entries(rates).filter(([k]) => k !== "PHP").map(([k, v]) => <div key={k} style={{ background: "#12141A", borderRadius: 6, padding: "4px 8px", fontSize: 11 }}><span style={{ color: "#888" }}>{k}</span> <span style={{ color: "#ccc", fontWeight: 600 }}>₱{v.toLocaleString("en", { maximumFractionDigits: 2 })}</span></div>)}</div>
        </div>)}

        {/* ═══ ASK VAULT ═══ */}
        {view === "ask" && (<div style={{ display: "flex", flexDirection: "column" as const, height: "calc(100vh - 92px)" }}>
          <div style={Sec}>💬 Ask Vault</div>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 12, marginTop: -6 }}>Ask anything about your finances. I can see all your accounts, debts, transactions, crypto, assets, and more.</div>

          {/* Quick questions */}
          {askMessages.length === 0 && (
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 16 }}>
              {[
                "How much did I spend on food this month?",
                "What are my upcoming dues?",
                "What's my net worth breakdown?",
                "Summarize my business expenses",
                "How much receivables do I have?",
                "What's my total credit card debt?",
                "Show me my biggest expenses",
                "How much crypto do I hold in PHP?",
              ].map(q => (
                <button key={q} onClick={() => askVault(q)}
                  style={{ background: "#12141A", border: "1px solid #252830", color: "#888", padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, textAlign: "left" as const }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: "auto", marginBottom: 12 }}>
            {askMessages.map((msg, i) => (
              <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: msg.role === "user" ? "#4ECDC422" : "#12141A",
                  border: `1px solid ${msg.role === "user" ? "#4ECDC444" : "#252830"}`,
                  color: msg.role === "user" ? "#4ECDC4" : "#ccc",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap" as const,
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {askLoading && (
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "#12141A", border: "1px solid #252830", color: "#555", fontSize: 13 }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={askEndRef} />
          </div>

          {/* Input */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...I, flex: 1 }}
              value={askInput}
              onChange={e => setAskInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askVault(askInput); } }}
              placeholder="Ask about your finances..."
              disabled={askLoading}
            />
            <button
              onClick={() => askVault(askInput)}
              disabled={askLoading || !askInput.trim()}
              style={{ ...BtnS(askLoading || !askInput.trim() ? "#333" : "#4ECDC4"), padding: "10px 20px", cursor: askLoading || !askInput.trim() ? "not-allowed" : "pointer" }}>
              Send
            </button>
          </div>
        </div>)}

        {/* ═══ ACCOUNTS ═══ */}
        {view === "acc" && (<div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><div style={Sec}>Accounts</div><button style={BtnS("#4ECDC4")} onClick={() => { setSf("acc"); setEId(null); setAf({ name: "", category: "bank", scope: scope === "all" ? "personal" : scope, balance: "", currency: "PHP", notes: "" }); }}>+ Add</button></div>
          {sf === "acc" && (
            <div style={FmS}><div style={{ fontWeight: 700, color: "#fff", marginBottom: 12 }}>{eId ? "Edit" : "New Account"}</div>
              <div style={G2}>
                <div><span style={L}>Name</span><input style={I} value={af.name} onChange={e => setAf({ ...af, name: e.target.value })} placeholder="BDO Savings" /></div>
                <div><span style={L}>Scope</span><ScopeSelect style={I} value={af.scope} onChange={(v: string) => setAf({ ...af, scope: v })} /></div>
                <div><span style={L}>Category</span><select style={I} value={af.category} onChange={e => setAf({ ...af, category: e.target.value })}>{Object.entries(ACCT_CATS).map(([k, c]) => <option key={k} value={k}>{c.i} {c.l}</option>)}</select></div>
                <div><span style={L}>Currency</span><select style={I} value={af.currency} onChange={e => setAf({ ...af, currency: e.target.value })}>{FIAT.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><span style={L}>Balance</span><NumIn style={I} value={af.balance} onChange={(v: string) => setAf({ ...af, balance: v })} placeholder="1,000,000" /></div>
                <div><span style={L}>Notes</span><input style={I} value={af.notes} onChange={e => setAf({ ...af, notes: e.target.value })} /></div>
              </div>
              <div style={FlEnd}><button style={CnclS} onClick={() => { setSf(null); setEId(null); }}>Cancel</button><button style={BtnS("#4ECDC4")} onClick={eId ? saveEditAcc : addAccount}>{eId ? "Save" : "Add"}</button></div>
            </div>
          )}
          {sA.length === 0 ? <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No accounts</div> :
            sA.map((a: AnyState) => { const c = ACCT_CATS[a.category]; return (
              <div key={a.id} style={{ ...Cd(c?.c || "#555"), marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div><div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{c?.i} {a.name}</div><div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{getBizShort(a.scope)} · {a.currency}</div></div>
                  <div style={{ textAlign: "right" as const }}><div style={{ fontSize: 20, fontWeight: 700, color: a.balance < 0 ? "#FF6B6B" : "#fff" }}>{fm(a.balance, a.currency)}</div>{a.currency !== dCur && <div style={{ fontSize: 11, color: "#555" }}>≈ {fm(cv(a.balance, a.currency, dCur, rates), dCur, true)}</div>}</div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}><button onClick={() => { setEId(a.id); setSf("acc"); setAf({ name: a.name, category: a.category, scope: a.scope, balance: String(a.balance), currency: a.currency, notes: a.notes || "" }); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>Edit</button><button onClick={() => { delAcc(a.id); }} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 11 }}>Delete</button></div>
              </div>
            ); })}
        </div>)}

        {/* ═══ CRYPTO ═══ */}
        {view === "crypto" && (<div>
          <div style={{ ...Cd("#F7931A"), marginBottom: 16, display: "flex", justifyContent: "space-between" }}><div><div style={L}>Total Crypto</div><div style={{ fontSize: 20, fontWeight: 700, color: "#F7931A", marginTop: 4 }}>{fm(tCrypto, dCur, true)}</div></div><div style={{ fontSize: 10, color: "#555", alignSelf: "center" }}>{sC.length} holdings</div></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><div style={Sec}>Holdings</div><button style={BtnS("#F7931A", "#fff")} onClick={() => { setSf("crypto"); setCrf({ coin: "BTC", amount: "", scope: scope === "all" ? "personal" : scope, wallet: "" }); }}>+ Add</button></div>
          {sf === "crypto" && (
            <div style={FmS}><div style={{ fontWeight: 700, color: "#fff", marginBottom: 12 }}>Add Crypto</div>
              <div style={G2}><div><span style={L}>Coin</span><select style={I} value={crf.coin} onChange={e => setCrf({ ...crf, coin: e.target.value })}>{Object.entries(CRYPTO_DEF).map(([k, c]) => <option key={k} value={k}>{c.i} {c.l}</option>)}</select></div><div><span style={L}>Scope</span><ScopeSelect style={I} value={crf.scope} onChange={(v: string) => setCrf({ ...crf, scope: v })} /></div><div><span style={L}>Amount</span><NumIn style={I} value={crf.amount} onChange={(v: string) => setCrf({ ...crf, amount: v })} /></div><div><span style={L}>Wallet</span><input style={I} value={crf.wallet} onChange={e => setCrf({ ...crf, wallet: e.target.value })} placeholder="Binance..." /></div></div>
              <div style={FlEnd}><button style={CnclS} onClick={() => setSf(null)}>Cancel</button><button style={BtnS("#F7931A", "#fff")} onClick={addCrypto}>Add</button></div>
            </div>
          )}
          {sC.length === 0 ? <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No holdings</div> : sC.map((c: AnyState) => { const cr = CRYPTO_DEF[c.coin]; const v = (c.amount * (rates[c.coin] || 0)) / (rates[dCur] || 1); return (
            <div key={c.id} style={{ ...Cd(cr?.c || "#555"), marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><div><div style={{ fontSize: 16, fontWeight: 700, color: cr?.c }}>{cr?.i} {c.coin}</div><div style={{ fontSize: 11, color: "#555" }}>{getBizShort(c.scope)}{c.wallet ? ` · ${c.wallet}` : ""}</div></div><div style={{ textAlign: "right" as const }}><div style={{ fontSize: 18, fontWeight: 700 }}>{c.amount} {c.coin}</div><div style={{ fontSize: 13, color: cr?.c, fontWeight: 600 }}>≈ {fm(v, dCur, true)}</div></div></div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "flex-end" }}><div style={{ flex: 1 }}><span style={{ fontSize: 9, color: "#555" }}>Update amount</span><input style={{ ...I, padding: "7px 8px", fontSize: 12, marginTop: 2 }} type="number" step="any" placeholder={String(c.amount)} onBlur={e => { if (e.target.value) { editCrAmt(c.id, e.target.value); e.target.value = ""; } }} /></div><button onClick={() => { delCrypto(c.id); }} style={{ background: "none", border: "1px solid #2a2d35", color: "#FF6B6B", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11 }}>Del</button></div>
            </div>
          ); })}
        </div>)}

        {/* ═══ ASSETS ═══ */}
        {view === "asset" && (<div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div style={Cd("#D4A373")}><div style={L}>Fixed Assets</div><div style={{ fontSize: 17, fontWeight: 700, color: "#D4A373", marginTop: 3 }}>{fm(tFixedAssets, dCur, true)}</div><div style={{ fontSize: 10, color: "#555" }}>{sAx.length} items</div></div>
            <div style={Cd("#CDB4DB")}><div style={L}>Inventory</div><div style={{ fontSize: 17, fontWeight: 700, color: "#CDB4DB", marginTop: 3 }}>{fm(tInventory, dCur, true)}</div><div style={{ fontSize: 10, color: "#555" }}>{sIv.length} items</div></div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <button onClick={() => setAssetSub("fixed")} style={{ background: assetSub === "fixed" ? "#1e2028" : "transparent", border: `1px solid ${assetSub === "fixed" ? "#D4A373" : "#1e2028"}`, color: assetSub === "fixed" ? "#fff" : "#555", padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🏠 Fixed Assets</button>
            <button onClick={() => setAssetSub("inventory")} style={{ background: assetSub === "inventory" ? "#1e2028" : "transparent", border: `1px solid ${assetSub === "inventory" ? "#CDB4DB" : "#1e2028"}`, color: assetSub === "inventory" ? "#fff" : "#555", padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📦 Inventory</button>
          </div>

          {assetSub === "fixed" && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><div style={Sec}>Fixed Assets</div><button style={BtnS("#D4A373", "#0B0D12")} onClick={() => { setSf("asset"); setEId(null); setAxf({ name: "", category: "vehicle", purchasePrice: "", purchaseDate: "", usefulLife: "5", salvageValue: "0", marketValue: "", appreciationRate: "5", scope: scope === "all" ? "personal" : scope, currency: "PHP", notes: "" }); }}>+ Add</button></div>
            {sf === "asset" && (
              <div style={FmS}><div style={{ fontWeight: 700, color: "#fff", marginBottom: 12 }}>{eId ? "Edit" : "Add Asset"}</div>
                <div style={G2}>
                  <div><span style={L}>Name</span><input style={I} value={axf.name} onChange={e => setAxf({ ...axf, name: e.target.value })} placeholder="Toyota Fortuner" /></div>
                  <div><span style={L}>Category</span><select style={I} value={axf.category} onChange={e => setAxf({ ...axf, category: e.target.value })}>{Object.entries(ASSET_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                  <div><span style={L}>Purchase Price</span><NumIn style={I} value={axf.purchasePrice} onChange={(v: string) => setAxf({ ...axf, purchasePrice: v })} /></div>
                  <div><span style={L}>Purchase Date</span><input style={I} type="date" value={axf.purchaseDate} onChange={e => setAxf({ ...axf, purchaseDate: e.target.value })} /></div>
                  {APPRECIATING_CATS.includes(axf.category) ? (
                    <div><span style={L}>Annual Appreciation Rate (%)</span><input style={I} type="number" value={axf.appreciationRate} onChange={e => setAxf({ ...axf, appreciationRate: e.target.value })} placeholder="5" /></div>
                  ) : (<>
                    <div><span style={L}>Useful Life (years)</span><input style={I} type="number" value={axf.usefulLife} onChange={e => setAxf({ ...axf, usefulLife: e.target.value })} /></div>
                    <div><span style={L}>Salvage Value</span><NumIn style={I} value={axf.salvageValue} onChange={(v: string) => setAxf({ ...axf, salvageValue: v })} placeholder="0" /></div>
                  </>)}
                  <div><span style={L}>Market Value (override)</span><NumIn style={I} value={axf.marketValue} onChange={(v: string) => setAxf({ ...axf, marketValue: v })} placeholder="Leave blank for auto calc" /></div>
                  <div><span style={L}>Scope</span><ScopeSelect style={I} value={axf.scope} onChange={(v: string) => setAxf({ ...axf, scope: v })} /></div>
                </div>
                <div style={{ marginBottom: 10 }}><span style={L}>Notes</span><input style={I} value={axf.notes} onChange={e => setAxf({ ...axf, notes: e.target.value })} /></div>
                <div style={FlEnd}><button style={CnclS} onClick={() => { setSf(null); setEId(null); }}>Cancel</button><button style={BtnS("#D4A373", "#0B0D12")} onClick={eId ? saveEditAsset : addAsset}>{eId ? "Save" : "Add"}</button></div>
              </div>
            )}
            {sAx.length === 0 ? <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No assets</div> : sAx.map((a: AnyState) => {
              const appreciating = isAppreciating(a);
              const bookVal = getBookValue(a);
              const displayVal = a.marketValue > 0 ? a.marketValue : bookVal;
              const changAmt = appreciating ? bookVal - a.purchasePrice : a.purchasePrice - bookVal;
              const years = a.purchaseDate ? ((Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 864e5)).toFixed(1) : "?";
              const changPct = a.purchasePrice > 0 ? Math.round((changAmt / a.purchasePrice) * 100) : 0;
              return (
                <div key={a.id} style={{ ...Cd(appreciating ? "#95E77E" : "#D4A373"), marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{ASSET_CATS[a.category]?.split(" ")[0] || "📋"} {a.name}</div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{getBizShort(a.scope)} · {ASSET_CATS[a.category]?.split(" ").slice(1).join(" ") || a.category} · {years}y{appreciating ? ` · ${a.appreciationRate || 5}%/yr` : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{fm(displayVal, a.currency)}</div>
                      <div style={{ fontSize: 10, color: a.marketValue > 0 ? "#26A17B" : appreciating ? "#95E77E" : "#D4A373" }}>{a.marketValue > 0 ? "market value" : appreciating ? "estimated value" : "book value"}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginBottom: 3 }}>
                      <span>{appreciating ? `+${changPct}% appreciated` : `${changPct}% depreciated`}</span>
                      <span>Cost {fm(a.purchasePrice, a.currency)} → {appreciating ? "Est." : "Book"} {fm(bookVal, a.currency)}</span>
                    </div>
                    <div style={{ height: 5, background: "#1a1d25", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(appreciating ? changPct : changPct, 100)}%`, background: appreciating ? "#95E77E" : changPct > 80 ? "#FF6B6B" : changPct > 50 ? "#FFD93D" : "#D4A373", borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: appreciating ? "1fr 1fr" : "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                    <div style={{ background: "#0B0D12", borderRadius: 6, padding: "5px 6px" }}><div style={{ fontSize: 9, color: "#555" }}>COST</div><div style={{ fontSize: 11, fontWeight: 700, color: "#ccc" }}>{fm(a.purchasePrice, a.currency)}</div></div>
                    {appreciating ? (
                      <div style={{ background: "#0B0D12", borderRadius: 6, padding: "5px 6px" }}><div style={{ fontSize: 9, color: "#555" }}>GAIN</div><div style={{ fontSize: 11, fontWeight: 700, color: "#95E77E" }}>+{fm(changAmt, a.currency)}</div></div>
                    ) : (<>
                      <div style={{ background: "#0B0D12", borderRadius: 6, padding: "5px 6px" }}><div style={{ fontSize: 9, color: "#555" }}>DEPREC.</div><div style={{ fontSize: 11, fontWeight: 700, color: "#FF6B6B" }}>{fm(changAmt, a.currency)}</div></div>
                      <div style={{ background: "#0B0D12", borderRadius: 6, padding: "5px 6px" }}><div style={{ fontSize: 9, color: "#555" }}>SALVAGE</div><div style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>{fm(a.salvageValue || 0, a.currency)}</div></div>
                    </>)}
                  </div>
                  {a.notes && <div style={{ fontSize: 11, color: "#444", marginBottom: 4 }}>{a.notes}</div>}
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <button onClick={() => { setEId(a.id); setSf("asset"); setAxf({ name: a.name, category: a.category, purchasePrice: String(a.purchasePrice), purchaseDate: a.purchaseDate || "", usefulLife: String(a.usefulLife), salvageValue: String(a.salvageValue || 0), marketValue: String(a.marketValue || ""), appreciationRate: String(a.appreciationRate || 5), scope: a.scope, currency: a.currency, notes: a.notes || "" }); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>Edit</button>
                    <button onClick={() => { delAsset(a.id); }} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 11 }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>)}

          {assetSub === "inventory" && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
              <div><div style={Sec}>Inventory</div><div style={{ fontSize: 10, color: "#555", marginTop: -8, marginBottom: 8 }}>Update quantities when you check — no daily logging needed</div></div>
              <button style={BtnS("#CDB4DB", "#0B0D12")} onClick={() => { setSf("inv"); setEId(null); setIvf({ name: "", qty: "", unitCost: "", scope: scope === "all" ? "business" : scope, currency: "PHP", notes: "", sku: "" }); }}>+ Add</button>
            </div>
            {sf === "inv" && (
              <div style={FmS}><div style={{ fontWeight: 700, color: "#fff", marginBottom: 12 }}>{eId ? "Edit" : "Add Inventory Item"}</div>
                <div style={G2}>
                  <div><span style={L}>Product Name</span><input style={I} value={ivf.name} onChange={e => setIvf({ ...ivf, name: e.target.value })} placeholder="Azelaic Acid Serum" /></div>
                  <div><span style={L}>SKU / Code</span><input style={I} value={ivf.sku} onChange={e => setIvf({ ...ivf, sku: e.target.value })} placeholder="SERAI-001" /></div>
                  <div><span style={L}>Qty on Hand</span><NumIn style={I} value={ivf.qty} onChange={(v: string) => setIvf({ ...ivf, qty: v })} placeholder="500" /></div>
                  <div><span style={L}>Unit Cost</span><NumIn style={I} value={ivf.unitCost} onChange={(v: string) => setIvf({ ...ivf, unitCost: v })} placeholder="150" /></div>
                  <div><span style={L}>Scope</span><ScopeSelect style={I} value={ivf.scope} onChange={(v: string) => setIvf({ ...ivf, scope: v })} /></div>
                  <div><span style={L}>Currency</span><select style={I} value={ivf.currency} onChange={e => setIvf({ ...ivf, currency: e.target.value })}>{FIAT.map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <div style={{ marginBottom: 10 }}><span style={L}>Notes</span><input style={I} value={ivf.notes} onChange={e => setIvf({ ...ivf, notes: e.target.value })} /></div>
                <div style={FlEnd}><button style={CnclS} onClick={() => { setSf(null); setEId(null); }}>Cancel</button><button style={BtnS("#CDB4DB", "#0B0D12")} onClick={eId ? saveEditInv : addInv}>{eId ? "Save" : "Add"}</button></div>
              </div>
            )}
            {sIv.length === 0 ? <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No inventory items</div> : sIv.map((i: AnyState) => {
              const totalVal = (i.qty || 0) * (i.unitCost || 0);
              return (
                <div key={i.id} style={{ ...Cd("#CDB4DB"), marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>📦 {i.name}</div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{i.sku ? `${i.sku} · ` : ""}{getBizShort(i.scope)}</div>
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#CDB4DB" }}>{fm(totalVal, i.currency)}</div>
                      <div style={{ fontSize: 10, color: "#555" }}>{fmtNum(String(i.qty))} × {fm(i.unitCost, i.currency)}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                    <div><span style={{ fontSize: 9, color: "#555" }}>Update Qty</span><input style={{ ...I, padding: "6px 8px", fontSize: 12, marginTop: 2 }} type="text" inputMode="decimal" placeholder={fmtNum(String(i.qty))} onBlur={e => { if (e.target.value) { quickInv(i.id, "qty", e.target.value); e.target.value = ""; } }} /></div>
                    <div><span style={{ fontSize: 9, color: "#555" }}>Update Unit Cost</span><input style={{ ...I, padding: "6px 8px", fontSize: 12, marginTop: 2 }} type="text" inputMode="decimal" placeholder={fmtNum(String(i.unitCost))} onBlur={e => { if (e.target.value) { quickInv(i.id, "unitCost", e.target.value); e.target.value = ""; } }} /></div>
                  </div>
                  {i.lastUpdated && <div style={{ fontSize: 10, color: "#333", marginTop: 6 }}>Updated: {new Date(i.lastUpdated).toLocaleDateString()}</div>}
                  {i.notes && <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{i.notes}</div>}
                  <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                    <button onClick={() => { setEId(i.id); setSf("inv"); setIvf({ name: i.name, qty: String(i.qty), unitCost: String(i.unitCost), scope: i.scope, currency: i.currency, notes: i.notes || "", sku: i.sku || "" }); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>Edit</button>
                    <button onClick={() => { delInv(i.id); }} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 11 }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>)}
        </div>)}

        {/* ═══ DEBTS ═══ */}
        {view === "debt" && (<div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
            <div style={{ background: "#12141A", borderRadius: 8, padding: "8px" }}><div style={{ fontSize: 9, color: "#555", textTransform: "uppercase" as const }}>Limit</div><div style={{ fontSize: 14, fontWeight: 700, color: "#A8B5E2", marginTop: 3 }}>{fm(tLimit, dCur, true)}</div></div>
            <div style={{ background: "#12141A", borderRadius: 8, padding: "8px" }}><div style={{ fontSize: 9, color: "#555", textTransform: "uppercase" as const }}>Outstanding</div><div style={{ fontSize: 14, fontWeight: 700, color: "#FF6B6B", marginTop: 3 }}>{fm(tDebt, dCur, true)}</div></div>
            <div style={{ background: "#12141A", borderRadius: 8, padding: "8px" }}><div style={{ fontSize: 9, color: "#555", textTransform: "uppercase" as const }}>Available</div><div style={{ fontSize: 14, fontWeight: 700, color: "#95E77E", marginTop: 3 }}>{fm(tLimit - tDebt, dCur, true)}</div></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><div style={Sec}>Cards & Loans</div><button style={BtnS("#FF6B6B", "#fff")} onClick={() => { setSf("debt"); setEId(null); setDf({ name: "", type: "credit_card", scope: scope === "all" ? "personal" : scope, creditLimit: "", outstanding: "", dueAmount: "", dueDate: "", currency: "PHP", notes: "", holder: "", statementDate: "" }); }}>+ Add</button></div>
          {sf === "debt" && (
            <div style={FmS}><div style={{ fontWeight: 700, color: "#fff", marginBottom: 12 }}>{eId ? "Edit" : "Add Debt"}</div>
              <div style={G2}>
                <div><span style={L}>Name</span><input style={I} value={df.name} onChange={e => setDf({ ...df, name: e.target.value })} placeholder="BPI Gold" /></div>
                <div><span style={L}>Account Holder</span><select style={I} value={df.holder} onChange={e => setDf({ ...df, holder: e.target.value })}><option value="">Select...</option><option value="Jims">Jims</option><option value="Dannah">Dannah</option></select></div>
                <div><span style={L}>Type</span><select style={I} value={df.type} onChange={e => setDf({ ...df, type: e.target.value })}>{Object.entries(DEBT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.i} {v.l}</option>)}</select></div>
                <div><span style={L}>Scope</span><ScopeSelect style={I} value={df.scope} onChange={(v: string) => setDf({ ...df, scope: v })} /></div>
                <div><span style={L}>Currency</span><select style={I} value={df.currency} onChange={e => setDf({ ...df, currency: e.target.value })}>{FIAT.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><span style={L}>Credit Limit</span><NumIn style={I} value={df.creditLimit} onChange={(v: string) => setDf({ ...df, creditLimit: v })} /></div>
                <div><span style={L}>Outstanding</span><NumIn style={I} value={df.outstanding} onChange={(v: string) => setDf({ ...df, outstanding: v })} /></div>
                <div><span style={L}>Due Amount</span><NumIn style={I} value={df.dueAmount} onChange={(v: string) => setDf({ ...df, dueAmount: v })} /></div>
                <div><span style={L}>Due Date</span><input style={I} type="date" value={df.dueDate} onChange={e => setDf({ ...df, dueDate: e.target.value })} /></div>
                <div><span style={L}>Last Statement Date</span><input style={I} type="date" value={df.statementDate} onChange={e => setDf({ ...df, statementDate: e.target.value })} /></div>
              </div>
              <div style={{ marginBottom: 10 }}><span style={L}>Notes</span><input style={I} value={df.notes} onChange={e => setDf({ ...df, notes: e.target.value })} /></div>
              <div style={FlEnd}><button style={CnclS} onClick={() => { setSf(null); setEId(null); }}>Cancel</button><button style={BtnS("#FF6B6B", "#fff")} onClick={eId ? saveEditDebt : addDebt}>{eId ? "Save" : "Add"}</button></div>
            </div>
          )}
          {sortedD.length === 0 ? <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No debts</div> : sortedD.map((d: AnyState) => {
            const days = dTo(d.dueDate); const uc = uClr(days); const util = d.creditLimit > 0 ? Math.round(d.outstanding / d.creditLimit * 100) : 0;
            return (
              <div key={d.id} style={{ background: "#12141A", borderRadius: 12, padding: "14px", marginBottom: 10, borderLeft: `3px solid ${uc}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div><div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{DEBT_TYPES[d.type]?.i || "💳"} {d.name}</div><div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{d.holder ? `${d.holder} · ` : ""}{getBizShort(d.scope)} · {d.currency}{d.statementDate ? ` · Stmt: ${d.statementDate}` : ""}</div>{d.dueDate && <div style={{ fontSize: 11, color: uc, fontWeight: 600, marginTop: 3 }}>{days !== null && days < 0 ? `⚠️ OVERDUE ${Math.abs(days)}d` : days === 0 ? "⚡ DUE TODAY" : `📅 ${days}d left`}</div>}</div>
                  <div style={{ textAlign: "right" as const }}><div style={{ fontSize: 10, color: "#555" }}>Due Amount</div><div style={{ fontSize: 16, fontWeight: 700, color: "#FFD93D" }}>{fm(d.dueAmount || 0, d.currency)}</div></div>
                </div>
                {d.creditLimit > 0 && (<div style={{ marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginBottom: 3 }}><span>{util}% used</span><span>{fm(d.outstanding, d.currency)} / {fm(d.creditLimit, d.currency)}</span></div><div style={{ height: 6, background: "#1a1d25", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(util, 100)}%`, background: util > 80 ? "#FF4444" : util > 50 ? "#FFD93D" : "#4ECDC4", borderRadius: 3 }} /></div></div>)}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "6px" }}><div style={{ fontSize: 9, color: "#555" }}>LIMIT</div><div style={{ fontSize: 12, fontWeight: 700, color: "#A8B5E2", marginTop: 2 }}>{fm(d.creditLimit || 0, d.currency)}</div></div>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "6px" }}><div style={{ fontSize: 9, color: "#555" }}>OWED</div><div style={{ fontSize: 12, fontWeight: 700, color: "#FF6B6B", marginTop: 2 }}>{fm(d.outstanding, d.currency)}</div></div>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "6px" }}><div style={{ fontSize: 9, color: "#555" }}>AVAIL</div><div style={{ fontSize: 12, fontWeight: 700, color: "#95E77E", marginTop: 2 }}>{fm((d.creditLimit || 0) - d.outstanding, d.currency)}</div></div>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "6px" }}><div style={{ fontSize: 9, color: "#555" }}>PAID</div><div style={{ fontSize: 12, fontWeight: 700, color: "#4ECDC4", marginTop: 2 }}>{fm(d.paid || 0, d.currency)}</div></div>
                </div>
                <div style={G2}>
                  <div><span style={{ fontSize: 9, color: "#555" }}>Update Balance</span><input style={{ ...I, padding: "6px 8px", fontSize: 12, marginTop: 2 }} type="text" inputMode="decimal" placeholder={fmtNum(String(d.outstanding))} onBlur={e => { if (e.target.value) { quickD(d.id, "outstanding", e.target.value); e.target.value = ""; } }} /></div>
                  <div><span style={{ fontSize: 9, color: "#555" }}>Update Due Amt</span><input style={{ ...I, padding: "6px 8px", fontSize: 12, marginTop: 2 }} type="text" inputMode="decimal" placeholder={fmtNum(String(d.dueAmount || 0))} onBlur={e => { if (e.target.value) { quickD(d.id, "dueAmount", e.target.value); e.target.value = ""; } }} /></div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                  <button onClick={() => { setEId(d.id); setSf("debt"); setDf({ name: d.name, type: d.type, scope: d.scope, creditLimit: String(d.creditLimit || 0), outstanding: String(d.outstanding), dueAmount: String(d.dueAmount || 0), dueDate: d.dueDate || "", currency: d.currency, notes: d.notes || "", holder: d.holder || "", statementDate: d.statementDate || "" }); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>Edit</button>
                  <button onClick={() => { delDebt(d.id); }} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 11 }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>)}

        {/* ═══ RECEIVABLES ═══ */}
        {view === "recv" && (<div>
          <div style={{ ...Cd("#26A17B"), marginBottom: 16, display: "flex", justifyContent: "space-between" }}><div><div style={L}>Total Remaining</div><div style={{ fontSize: 20, fontWeight: 700, color: "#26A17B", marginTop: 4 }}>{fm(tReceivable, dCur, true)}</div></div><div style={{ fontSize: 10, color: "#555", alignSelf: "center" }}>{openR.length} open / {sR.length} total</div></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><div style={Sec}>Money Owed To You</div><button style={BtnS("#26A17B", "#fff")} onClick={() => { setSf("recv"); setEId(null); setRf({ name: "", amount: "", dueDate: "", scope: scope === "all" ? "personal" : scope, currency: "PHP", notes: "", from: "" }); }}>+ Add</button></div>
          {sf === "recv" && (
            <div style={FmS}><div style={{ fontWeight: 700, color: "#fff", marginBottom: 12 }}>{eId ? "Edit" : "Add Receivable"}</div>
              <div style={G2}>
                <div><span style={L}>Description</span><input style={I} value={rf.name} onChange={e => setRf({ ...rf, name: e.target.value })} placeholder="Invoice #123" /></div>
                <div><span style={L}>From / Who Owes</span><input style={I} value={rf.from} onChange={e => setRf({ ...rf, from: e.target.value })} placeholder="Client name" /></div>
                <div><span style={L}>Total Amount</span><NumIn style={I} value={rf.amount} onChange={(v: string) => setRf({ ...rf, amount: v })} /></div>
                <div><span style={L}>Expected Date</span><input style={I} type="date" value={rf.dueDate} onChange={e => setRf({ ...rf, dueDate: e.target.value })} /></div>
                <div><span style={L}>Scope</span><ScopeSelect style={I} value={rf.scope} onChange={(v: string) => setRf({ ...rf, scope: v })} /></div>
                <div><span style={L}>Currency</span><select style={I} value={rf.currency} onChange={e => setRf({ ...rf, currency: e.target.value })}>{FIAT.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div style={{ marginBottom: 10 }}><span style={L}>Notes</span><input style={I} value={rf.notes} onChange={e => setRf({ ...rf, notes: e.target.value })} /></div>
              <div style={FlEnd}><button style={CnclS} onClick={() => { setSf(null); setEId(null); }}>Cancel</button><button style={BtnS("#26A17B", "#fff")} onClick={eId ? saveEditRecv : addRecv}>{eId ? "Save" : "Add"}</button></div>
            </div>
          )}
          {sortedR.length === 0 ? <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No receivables</div> : sortedR.map((r: AnyState) => {
            const days = dTo(r.dueDate);
            const received = r.received || 0;
            const remaining = r.amount - received;
            const isFullyPaid = received >= r.amount;
            const pct = r.amount > 0 ? Math.min(Math.round(received / r.amount * 100), 100) : 0;
            const uc = isFullyPaid ? "#555" : days !== null && days < 0 ? "#FF6B6B" : days !== null && days <= 7 ? "#FFD93D" : "#26A17B";
            return (
              <div key={r.id} style={{ background: "#12141A", borderRadius: 10, padding: "14px", marginBottom: 8, borderLeft: `3px solid ${uc}`, opacity: isFullyPaid ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                      {isFullyPaid ? "✅" : "📥"} {r.name}
                      {isFullyPaid && <span style={{ fontSize: 10, color: "#95E77E", marginLeft: 6, fontWeight: 400 }}>FULLY COLLECTED</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{r.from ? `From: ${r.from} · ` : ""}{getBizShort(r.scope)}</div>
                    {r.dueDate && !isFullyPaid && <div style={{ fontSize: 11, color: uc, fontWeight: 600, marginTop: 3 }}>{days !== null && days < 0 ? `⚠️ ${Math.abs(days)}d overdue` : days === 0 ? "Expected today" : `${days}d until expected`}</div>}
                  </div>
                  <div style={{ textAlign: "right" as const }}>
                    {!isFullyPaid && <div style={{ fontSize: 18, fontWeight: 700, color: "#26A17B" }}>{fm(remaining, r.currency)}</div>}
                    {!isFullyPaid && <div style={{ fontSize: 10, color: "#555" }}>remaining</div>}
                    {isFullyPaid && <div style={{ fontSize: 16, fontWeight: 700, color: "#95E77E" }}>{fm(r.amount, r.currency)}</div>}
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginBottom: 3 }}>
                    <span>{pct}% collected</span>
                    <span>{fm(received, r.currency)} / {fm(r.amount, r.currency)}</span>
                  </div>
                  <div style={{ height: 6, background: "#1a1d25", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: isFullyPaid ? "#95E77E" : "#26A17B", borderRadius: 3, transition: "width .3s" }} />
                  </div>
                </div>
                {r.notes && <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>{r.notes}</div>}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  {!isFullyPaid && <button onClick={() => collectRecv(r)} style={{ background: "#26A17B", border: "none", color: "#fff", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✓ Mark Fully Collected</button>}
                  <button onClick={() => { setEId(r.id); setSf("recv"); setRf({ name: r.name, amount: String(r.amount), dueDate: r.dueDate || "", scope: r.scope, currency: r.currency, notes: r.notes || "", from: r.from || "" }); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>Edit</button>
                  <button onClick={() => { delRecv(r.id); }} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 11 }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>)}

        {/* ═══ PIPELINE ═══ */}
        {view === "pipe" && (<div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div style={Cd("#E9C46A")}><div style={L}>Gross In-Flight</div><div style={{ fontSize: 18, fontWeight: 700, color: "#E9C46A", marginTop: 3 }}>{fm(pipelineGross, dCur, true)}</div></div>
            <div style={Cd(pipelineNet >= 0 ? "#95E77E" : "#FF6B6B")}><div style={L}>Expected Net</div><div style={{ fontSize: 18, fontWeight: 700, color: pipelineNet >= 0 ? "#95E77E" : "#FF6B6B", marginTop: 3 }}>{fm(pipelineNet, dCur, true)}</div></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><div style={Sec}>Shipments & Batches</div><button style={BtnS("#E9C46A", "#0B0D12")} onClick={() => { setSf("pipe"); setEId(null); setPf({ name: "", grossValue: "", deliveryRate: "70", shippingCost: "", codFees: "", returnCost: "", otherExpenses: "", parcels: "", date: new Date().toISOString().slice(0, 10), expectedDate: "", scope: scope === "all" ? "business" : scope, currency: "PHP", notes: "", status: "active" }); }}>+ Add</button></div>
          {sf === "pipe" && (
            <div style={FmS}><div style={{ fontWeight: 700, color: "#fff", marginBottom: 12 }}>{eId ? "Edit" : "New Pipeline Entry"}</div>
              <div style={G2}>
                <div><span style={L}>Batch Name</span><input style={I} value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} placeholder="Batch #45 - March" /></div>
                <div><span style={L}>Parcels</span><NumIn style={I} value={pf.parcels} onChange={(v: string) => setPf({ ...pf, parcels: v })} placeholder="1,000" /></div>
                <div><span style={L}>Gross Value</span><NumIn style={I} value={pf.grossValue} onChange={(v: string) => setPf({ ...pf, grossValue: v })} placeholder="300,000" /></div>
                <div><span style={L}>Delivery Rate %</span><input style={I} type="number" value={pf.deliveryRate} onChange={e => setPf({ ...pf, deliveryRate: e.target.value })} placeholder="70" /></div>
                <div><span style={L}>Shipping Cost</span><NumIn style={I} value={pf.shippingCost} onChange={(v: string) => setPf({ ...pf, shippingCost: v })} placeholder="0" /></div>
                <div><span style={L}>COD Fees</span><NumIn style={I} value={pf.codFees} onChange={(v: string) => setPf({ ...pf, codFees: v })} placeholder="0" /></div>
                <div><span style={L}>Return Cost</span><NumIn style={I} value={pf.returnCost} onChange={(v: string) => setPf({ ...pf, returnCost: v })} placeholder="0" /></div>
                <div><span style={L}>Other Expenses</span><NumIn style={I} value={pf.otherExpenses} onChange={(v: string) => setPf({ ...pf, otherExpenses: v })} placeholder="0" /></div>
                <div><span style={L}>Ship Date</span><input style={I} type="date" value={pf.date} onChange={e => setPf({ ...pf, date: e.target.value })} /></div>
                <div><span style={L}>Expected Settlement</span><input style={I} type="date" value={pf.expectedDate} onChange={e => setPf({ ...pf, expectedDate: e.target.value })} /></div>
                <div><span style={L}>Scope</span><ScopeSelect style={I} value={pf.scope} onChange={(v: string) => setPf({ ...pf, scope: v })} /></div>
                <div><span style={L}>Currency</span><select style={I} value={pf.currency} onChange={e => setPf({ ...pf, currency: e.target.value })}>{FIAT.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div style={{ marginBottom: 10 }}><span style={L}>Notes</span><input style={I} value={pf.notes} onChange={e => setPf({ ...pf, notes: e.target.value })} /></div>
              <div style={FlEnd}><button style={CnclS} onClick={() => { setSf(null); setEId(null); }}>Cancel</button><button style={BtnS("#E9C46A", "#0B0D12")} onClick={eId ? saveEditPipeline : addPipeline}>{eId ? "Save" : "Add"}</button></div>
            </div>
          )}
          {sP.length === 0 ? <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No pipeline entries</div> : sP.map((p: AnyState) => {
            const expRev = p.grossValue * (p.deliveryRate / 100);
            const expReturn = p.grossValue * ((100 - p.deliveryRate) / 100);
            const totExp = (p.shippingCost || 0) + (p.codFees || 0) + (p.returnCost || 0) + (p.otherExpenses || 0);
            const netProj = expRev - totExp;
            const isSettled = p.status === "settled";
            const daysLeft = dTo(p.expectedDate);
            return (
              <div key={p.id} style={{ background: "#12141A", borderRadius: 12, padding: "14px", marginBottom: 10, borderLeft: `3px solid ${isSettled ? "#555" : "#E9C46A"}`, opacity: isSettled ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                      {isSettled ? "✅" : "📦"} {p.name}
                      {isSettled && <span style={{ fontSize: 10, color: "#95E77E", marginLeft: 6 }}>SETTLED</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{getBizShort(p.scope)} · {p.parcels ? `${fmtNum(String(p.parcels))} parcels · ` : ""}{p.date}{p.expectedDate ? ` → ${p.expectedDate}` : ""}</div>
                    {daysLeft !== null && !isSettled && <div style={{ fontSize: 11, color: daysLeft <= 0 ? "#FFD93D" : "#95E77E", fontWeight: 600, marginTop: 3 }}>{daysLeft <= 0 ? "Ready for settlement" : `${daysLeft}d to settlement`}</div>}
                  </div>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontSize: 10, color: "#555" }}>Net Projection</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: netProj >= 0 ? "#95E77E" : "#FF6B6B" }}>{fm(netProj, p.currency)}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "6px" }}><div style={{ fontSize: 9, color: "#555" }}>GROSS</div><div style={{ fontSize: 12, fontWeight: 700, color: "#E9C46A", marginTop: 2 }}>{fm(p.grossValue, p.currency)}</div></div>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "6px" }}><div style={{ fontSize: 9, color: "#555" }}>EXP. REVENUE</div><div style={{ fontSize: 12, fontWeight: 700, color: "#95E77E", marginTop: 2 }}>{fm(expRev, p.currency)}</div><div style={{ fontSize: 9, color: "#444" }}>{p.deliveryRate}% delivery</div></div>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "6px" }}><div style={{ fontSize: 9, color: "#555" }}>EXP. RETURNS</div><div style={{ fontSize: 12, fontWeight: 700, color: "#FF6B6B", marginTop: 2 }}>{fm(expReturn, p.currency)}</div><div style={{ fontSize: 9, color: "#444" }}>{100 - p.deliveryRate}% return</div></div>
                </div>
                {totExp > 0 && (
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase" as const, marginBottom: 4 }}>Expenses Breakdown</div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, fontSize: 11 }}>
                      {p.shippingCost > 0 && <span style={{ color: "#888" }}>Shipping: <span style={{ color: "#FF6B6B" }}>{fm(p.shippingCost, p.currency)}</span></span>}
                      {p.codFees > 0 && <span style={{ color: "#888" }}>COD Fees: <span style={{ color: "#FF6B6B" }}>{fm(p.codFees, p.currency)}</span></span>}
                      {p.returnCost > 0 && <span style={{ color: "#888" }}>Returns: <span style={{ color: "#FF6B6B" }}>{fm(p.returnCost, p.currency)}</span></span>}
                      {p.otherExpenses > 0 && <span style={{ color: "#888" }}>Other: <span style={{ color: "#FF6B6B" }}>{fm(p.otherExpenses, p.currency)}</span></span>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#FF6B6B", marginTop: 4 }}>Total: {fm(totExp, p.currency)}</div>
                  </div>
                )}
                {!isSettled && (
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: "#E9C46A", textTransform: "uppercase" as const, marginBottom: 6 }}>Actual Results (update as they come in)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div><span style={{ fontSize: 9, color: "#555" }}>Received</span><input style={{ ...I, padding: "6px 8px", fontSize: 12, marginTop: 2 }} type="text" inputMode="decimal" placeholder={fmtNum(String(p.actualReceived || 0))} onBlur={e => { if (e.target.value) { updatePipelineActuals(p.id, "actualReceived", e.target.value); e.target.value = ""; } }} /></div>
                      <div><span style={{ fontSize: 9, color: "#555" }}>Returned</span><input style={{ ...I, padding: "6px 8px", fontSize: 12, marginTop: 2 }} type="text" inputMode="decimal" placeholder={fmtNum(String(p.actualReturned || 0))} onBlur={e => { if (e.target.value) { updatePipelineActuals(p.id, "actualReturned", e.target.value); e.target.value = ""; } }} /></div>
                      <div><span style={{ fontSize: 9, color: "#555" }}>Act. Expenses</span><input style={{ ...I, padding: "6px 8px", fontSize: 12, marginTop: 2 }} type="text" inputMode="decimal" placeholder={fmtNum(String(p.actualExpenses || 0))} onBlur={e => { if (e.target.value) { updatePipelineActuals(p.id, "actualExpenses", e.target.value); e.target.value = ""; } }} /></div>
                    </div>
                    {(p.actualReceived > 0 || p.actualReturned > 0) && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
                        <span style={{ color: "#555" }}>Actual Net: <span style={{ color: "#95E77E", fontWeight: 700 }}>{fm((p.actualReceived || 0) - (p.actualExpenses || 0), p.currency)}</span></span>
                        <span style={{ color: "#555" }}>vs Projected: <span style={{ color: "#E9C46A" }}>{fm(netProj, p.currency)}</span></span>
                      </div>
                    )}
                  </div>
                )}
                {p.notes && <div style={{ fontSize: 11, color: "#444", marginBottom: 6 }}>{p.notes}</div>}
                <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                  {!isSettled && <button onClick={() => { settlePipeline(p.id); }} style={{ background: "#E9C46A", border: "none", color: "#0B0D12", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✓ Settle</button>}
                  <button onClick={() => { setEId(p.id); setSf("pipe"); setPf({ name: p.name, grossValue: String(p.grossValue), deliveryRate: String(p.deliveryRate), shippingCost: String(p.shippingCost || 0), codFees: String(p.codFees || 0), returnCost: String(p.returnCost || 0), otherExpenses: String(p.otherExpenses || 0), parcels: String(p.parcels || 0), date: p.date || "", expectedDate: p.expectedDate || "", scope: p.scope, currency: p.currency, notes: p.notes || "", status: p.status }); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>Edit</button>
                  <button onClick={() => { delPipeline(p.id); }} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 11 }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>)}

        {/* ═══ P&L IMPORT ═══ */}
        {view === "pnl" && (<div>
          {sPnl.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 16 }}>
              {(() => { const tOrd = sPnl.reduce((s: number, b: AnyState) => s + (b.totalOrders || 0), 0); const tDel = sPnl.reduce((s: number, b: AnyState) => s + (b.delivered || 0), 0); const tGross = sPnl.reduce((s: number, b: AnyState) => s + (b.grossRev || 0), 0); const tNet = sPnl.reduce((s: number, b: AnyState) => s + (b.netRev || 0), 0); const tFees = sPnl.reduce((s: number, b: AnyState) => s + (b.totalFees || 0), 0); const tShip = sPnl.reduce((s: number, b: AnyState) => s + (b.totalShip || 0), 0);
                return (<>
                  <div style={Cd("#E9C46A")}><div style={L}>Total Orders</div><div style={{ fontSize: 16, fontWeight: 700, color: "#E9C46A", marginTop: 3 }}>{fmtNum(String(tOrd))}</div><div style={{ fontSize: 10, color: "#555" }}>{tDel} delivered</div></div>
                  <div style={Cd("#95E77E")}><div style={L}>Gross Revenue</div><div style={{ fontSize: 16, fontWeight: 700, color: "#95E77E", marginTop: 3 }}>{fm(tGross, dCur, true)}</div></div>
                  <div style={Cd("#FF6B6B")}><div style={L}>Fees + Shipping</div><div style={{ fontSize: 16, fontWeight: 700, color: "#FF6B6B", marginTop: 3 }}>{fm(tFees + tShip, dCur, true)}</div></div>
                  <div style={Cd(tNet >= 0 ? "#4ECDC4" : "#FF6B6B")}><div style={L}>Net Revenue</div><div style={{ fontSize: 16, fontWeight: 700, color: tNet >= 0 ? "#4ECDC4" : "#FF6B6B", marginTop: 3 }}>{fm(tNet, dCur, true)}</div></div>
                </>);
              })()}
            </div>
          )}

          <div style={{ ...FmS, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 12, fontSize: 15 }}>📤 Import Orders CSV</div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 12 }}>Export orders from your platform → upload CSV here → auto-parsed P&L summary</div>
            <div style={G2}>
              <div>
                <span style={L}>Platform</span>
                <select style={I} value={csvPlatform} onChange={e => setCsvPlatform(e.target.value)}>
                  <option value="shopee">🟠 Shopee</option>
                  <option value="tiktok">🎵 TikTok Shop</option>
                  <option value="shopify">🟢 Shopify</option>
                  <option value="custom">📋 Custom / Other</option>
                </select>
              </div>
              <div>
                <span style={L}>Upload CSV</span>
                <input type="file" accept=".csv,.txt" onChange={handleCSVUpload}
                  style={{ ...I, padding: "8px", fontSize: 12 }} />
              </div>
            </div>
          </div>

          {csvPreview && (
            <div style={{ background: "#12141A", border: "2px solid #E9C46A", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: "#E9C46A", marginBottom: 12, fontSize: 15 }}>📊 Preview: {csvPreview.fileName}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ background: "#0B0D12", borderRadius: 6, padding: "8px" }}><div style={{ fontSize: 9, color: "#555" }}>TOTAL ORDERS</div><div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 2 }}>{csvPreview.totalOrders}</div></div>
                <div style={{ background: "#0B0D12", borderRadius: 6, padding: "8px" }}><div style={{ fontSize: 9, color: "#555" }}>DELIVERED</div><div style={{ fontSize: 16, fontWeight: 700, color: "#95E77E", marginTop: 2 }}>{csvPreview.delivered}</div></div>
                <div style={{ background: "#0B0D12", borderRadius: 6, padding: "8px" }}><div style={{ fontSize: 9, color: "#555" }}>DELIVERY RATE</div><div style={{ fontSize: 16, fontWeight: 700, color: "#E9C46A", marginTop: 2 }}>{csvPreview.deliveryRate}%</div></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ background: "#0B0D12", borderRadius: 6, padding: "8px" }}><div style={{ fontSize: 9, color: "#555" }}>CANCELLED</div><div style={{ fontSize: 14, fontWeight: 700, color: "#FF6B6B", marginTop: 2 }}>{csvPreview.cancelled}</div></div>
                <div style={{ background: "#0B0D12", borderRadius: 6, padding: "8px" }}><div style={{ fontSize: 9, color: "#555" }}>RETURNED</div><div style={{ fontSize: 14, fontWeight: 700, color: "#F4A261", marginTop: 2 }}>{csvPreview.returned}</div></div>
              </div>
              <div style={{ background: "#0B0D12", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "#E9C46A", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>Money Flow</div>
                {([
                  ["Gross Revenue", csvPreview.grossRev, "#95E77E", "+"],
                  ["Shipping Cost", csvPreview.totalShip, "#FF6B6B", "-"],
                  ["Platform Fees", csvPreview.totalFees, "#FF6B6B", "-"],
                ] as [string, number, string, string][]).map(([label, val, clr, sign], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                    <span style={{ color: "#888" }}>{label}</span>
                    <span style={{ fontWeight: 700, color: clr }}>{sign}{fm(val, "PHP")}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid #1a1d25", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                  <span style={{ color: "#fff", fontWeight: 700 }}>Net Revenue</span>
                  <span style={{ fontWeight: 800, color: csvPreview.netRev >= 0 ? "#4ECDC4" : "#FF6B6B" }}>{fm(csvPreview.netRev, "PHP")}</span>
                </div>
              </div>
              {csvPreview.columns.length > 0 && (
                <div style={{ fontSize: 10, color: "#444", marginBottom: 10 }}>Detected columns: {csvPreview.columns.slice(0, 8).join(", ")}{csvPreview.columns.length > 8 ? ` +${csvPreview.columns.length - 8} more` : ""}</div>
              )}
              <div style={FlEnd}>
                <button onClick={() => setCsvPreview(null)} style={CnclS}>Discard</button>
                <button onClick={savePnlBatch} style={BtnS("#E9C46A", "#0B0D12")}>✓ Save to P&L</button>
              </div>
            </div>
          )}

          <div style={Sec}>Import History</div>
          {sPnl.length === 0 ? <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No imports yet — upload a CSV above</div> :
            sPnl.map((b: AnyState) => (
              <div key={b.id} style={{ ...Cd(b.netRev >= 0 ? "#4ECDC4" : "#FF6B6B"), marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>📄 {b.fileName || "Import"}</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                      {b.platform === "shopee" ? "🟠 Shopee" : b.platform === "tiktok" ? "🎵 TikTok" : b.platform === "shopify" ? "🟢 Shopify" : "📋 Custom"} · {b.date} · {getBizShort(b.scope)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: b.netRev >= 0 ? "#4ECDC4" : "#FF6B6B" }}>{fm(b.netRev, b.currency)}</div>
                    <div style={{ fontSize: 10, color: "#555" }}>net</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "5px 6px" }}><div style={{ fontSize: 9, color: "#555" }}>ORDERS</div><div style={{ fontSize: 11, fontWeight: 700, color: "#ccc" }}>{b.totalOrders}</div></div>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "5px 6px" }}><div style={{ fontSize: 9, color: "#555" }}>DELIVERED</div><div style={{ fontSize: 11, fontWeight: 700, color: "#95E77E" }}>{b.delivered}</div></div>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "5px 6px" }}><div style={{ fontSize: 9, color: "#555" }}>GROSS</div><div style={{ fontSize: 11, fontWeight: 700, color: "#E9C46A" }}>{fm(b.grossRev, b.currency)}</div></div>
                  <div style={{ background: "#0B0D12", borderRadius: 6, padding: "5px 6px" }}><div style={{ fontSize: 9, color: "#555" }}>FEES</div><div style={{ fontSize: 11, fontWeight: 700, color: "#FF6B6B" }}>{fm((b.totalFees || 0) + (b.totalShip || 0), b.currency)}</div></div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                  <button onClick={() => delPnlBatch(b.id)} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 11 }}>Delete</button>
                </div>
              </div>
            ))
          }
        </div>)}

        {/* ═══ REPORTS ═══ */}
        {view === "report" && (() => {
          const now = new Date();
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          const thisYearStart = new Date(now.getFullYear(), 0, 1);

          const reportPeriod = (p: string) => {
            if (p === "month") { setRptFrom(thisMonthStart.toISOString().slice(0, 10)); setRptTo(now.toISOString().slice(0, 10)); }
            else if (p === "lastmonth") { setRptFrom(lastMonthStart.toISOString().slice(0, 10)); setRptTo(lastMonthEnd.toISOString().slice(0, 10)); }
            else if (p === "year") { setRptFrom(thisYearStart.toISOString().slice(0, 10)); setRptTo(now.toISOString().slice(0, 10)); }
            else if (p === "all") { setRptFrom(""); setRptTo(""); }
          };

          const activeBiz = Object.keys(rptBiz).length === 0 ? ["personal", ...businesses.map((b: AnyState) => b.id)] : Object.entries(rptBiz).filter(([, v]) => v).map(([k]) => k);
          const bizMatch = (s: string) => activeBiz.includes(s) || (activeBiz.includes("business") && s !== "personal");
          const dateMatch = (d: string) => {
            if (!rptFrom && !rptTo) return true;
            const dt = new Date(d);
            if (rptFrom && dt < new Date(rptFrom)) return false;
            if (rptTo && dt > new Date(rptTo + "T23:59:59")) return false;
            return true;
          };

          const filteredTxns = txns.filter((t: AnyState) => bizMatch(t.txScope || "personal") && dateMatch(t.date));
          const rIncome = filteredTxns.filter((t: AnyState) => t.type === "income").reduce((s: number, t: AnyState) => s + cv(t.amount, accounts.find((a: AnyState) => a.id === t.accountId)?.currency || "PHP", dCur, rates), 0);
          const rExpense = filteredTxns.filter((t: AnyState) => t.type === "expense").reduce((s: number, t: AnyState) => s + cv(t.amount, accounts.find((a: AnyState) => a.id === t.accountId)?.currency || "PHP", dCur, rates), 0);

          const expByCat: Record<string, number> = {};
          const incByCat: Record<string, number> = {};
          filteredTxns.forEach((t: AnyState) => {
            const cat = t.txCat || (t.type === "income" ? "income_other" : "personal_other");
            const amt = cv(t.amount, accounts.find((a: AnyState) => a.id === t.accountId)?.currency || "PHP", dCur, rates);
            if (t.type === "expense") expByCat[cat] = (expByCat[cat] || 0) + amt;
            if (t.type === "income") incByCat[cat] = (incByCat[cat] || 0) + amt;
          });

          const topExp = filteredTxns.filter((t: AnyState) => t.type === "expense").sort((a: AnyState, b: AnyState) => b.amount - a.amount).slice(0, 10);

          const rDebts = debts.filter((d: AnyState) => bizMatch(d.scope));
          const rRecv = receivables.filter((r: AnyState) => bizMatch(r.scope));
          const rAssets = assets.filter((a: AnyState) => bizMatch(a.scope));

          return (
          <div>
            <div style={Sec}>📊 Reports</div>

            {/* Period Filter */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 12 }}>
              {([["month", "This Month"], ["lastmonth", "Last Month"], ["year", "This Year"], ["all", "All Time"]] as [string, string][]).map(([k, l]) => (
                <button key={k} onClick={() => reportPeriod(k)}
                  style={{ background: (k === "all" && !rptFrom && !rptTo) || (k === "month" && rptFrom === thisMonthStart.toISOString().slice(0, 10)) || (k === "lastmonth" && rptFrom === lastMonthStart.toISOString().slice(0, 10)) || (k === "year" && rptFrom === thisYearStart.toISOString().slice(0, 10)) ? T.card : "transparent", border: `1px solid ${T.cardBorder}`, color: T.text, padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{l}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div><span style={L}>From</span><input style={{ ...I, fontSize: 12 }} type="date" value={rptFrom} onChange={e => setRptFrom(e.target.value)} /></div>
              <div><span style={L}>To</span><input style={{ ...I, fontSize: 12 }} type="date" value={rptTo} onChange={e => setRptTo(e.target.value)} /></div>
            </div>

            {/* Business Filter */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 12 }}>
              <button onClick={() => { const all: Record<string, boolean> = { personal: true }; businesses.forEach((b: AnyState) => { all[b.id] = true; }); setRptBiz(all); }} style={{ background: "transparent", border: `1px solid ${T.cardBorder}`, color: T.textSoft, padding: "4px 10px", borderRadius: 12, cursor: "pointer", fontSize: 10 }}>Select All</button>
              <button onClick={() => setRptBiz({})} style={{ background: "transparent", border: `1px solid ${T.cardBorder}`, color: T.textSoft, padding: "4px 10px", borderRadius: 12, cursor: "pointer", fontSize: 10 }}>Clear</button>
              {[{ id: "personal", name: "Personal", color: "#A8B5E2" }, ...businesses].map((b: AnyState) => (
                <button key={b.id} onClick={() => setRptBiz((p: Record<string, boolean>) => ({ ...p, [b.id]: !p[b.id] }))}
                  style={{ background: activeBiz.includes(b.id) ? b.color + "22" : "transparent", border: `1px solid ${activeBiz.includes(b.id) ? b.color : T.cardBorder}`, color: activeBiz.includes(b.id) ? b.color : T.textSoft, padding: "4px 10px", borderRadius: 12, cursor: "pointer", fontSize: 10, fontWeight: 600 }}>
                  {b.name}
                </button>
              ))}
            </div>

            {/* Summary */}
            {rptSections.summary && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 16 }}>
                <div style={Cd("#95E77E")}><div style={L}>Income</div><div style={{ fontSize: 16, fontWeight: 700, color: "#95E77E", marginTop: 3 }}>{masked(fm(rIncome, dCur, true))}</div></div>
                <div style={Cd("#FF6B6B")}><div style={L}>Expenses</div><div style={{ fontSize: 16, fontWeight: 700, color: "#FF6B6B", marginTop: 3 }}>{masked(fm(rExpense, dCur, true))}</div></div>
                <div style={Cd(rIncome - rExpense >= 0 ? "#4ECDC4" : "#FF6B6B")}><div style={L}>Net</div><div style={{ fontSize: 16, fontWeight: 700, color: rIncome - rExpense >= 0 ? "#4ECDC4" : "#FF6B6B", marginTop: 3 }}>{masked(fm(rIncome - rExpense, dCur, true))}</div></div>
              </div>
            )}

            {/* Expense Breakdown */}
            {rptSections.expenses && Object.keys(expByCat).length > 0 && (
              <div style={{ ...FmS, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: T.textWhite, fontSize: 13, marginBottom: 10 }}>Expense Breakdown</div>
                {Object.entries(expByCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.divider}` }}>
                    <span style={{ fontSize: 12, color: T.text }}>{getTxCatLabel(cat)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#FF6B6B" }}>{masked(fm(amt, dCur))}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Income Breakdown */}
            {rptSections.income && Object.keys(incByCat).length > 0 && (
              <div style={{ ...FmS, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: T.textWhite, fontSize: 13, marginBottom: 10 }}>Income Breakdown</div>
                {Object.entries(incByCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.divider}` }}>
                    <span style={{ fontSize: 12, color: T.text }}>{getTxCatLabel(cat)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#95E77E" }}>{masked(fm(amt, dCur))}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Top Expenses */}
            {rptSections.topExpenses && topExp.length > 0 && (
              <div style={{ ...FmS, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: T.textWhite, fontSize: 13, marginBottom: 10 }}>Top 10 Expenses</div>
                {topExp.map((t: AnyState, i: number) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.divider}` }}>
                    <div>
                      <span style={{ fontSize: 12, color: T.text }}>{i + 1}. {t.description || "Expense"}</span>
                      <div style={{ fontSize: 10, color: T.textSoft }}>{t.date} · {getBizShort(t.txScope || "personal")}{t.txCat ? ` · ${getTxCatLabel(t.txCat)}` : ""}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#FF6B6B" }}>{masked(fm(t.amount, accounts.find((a: AnyState) => a.id === t.accountId)?.currency || "PHP"))}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Debts Summary */}
            {rptSections.debts && rDebts.length > 0 && (
              <div style={{ ...FmS, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: T.textWhite, fontSize: 13, marginBottom: 10 }}>Debts ({rDebts.length})</div>
                {rDebts.map((d: AnyState) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.divider}` }}>
                    <div><span style={{ fontSize: 12, color: T.text }}>{d.name}</span><div style={{ fontSize: 10, color: T.textSoft }}>{getBizShort(d.scope)}{d.holder ? ` · ${d.holder}` : ""}</div></div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#FF6B6B" }}>{masked(fm(d.outstanding, d.currency))}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: T.textWhite }}>Total</span>
                  <span style={{ color: "#FF6B6B" }}>{masked(fm(rDebts.reduce((s: number, d: AnyState) => s + cv(d.outstanding, d.currency, dCur, rates), 0), dCur))}</span>
                </div>
              </div>
            )}

            {/* Receivables Summary */}
            {rptSections.receivables && rRecv.length > 0 && (
              <div style={{ ...FmS, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: T.textWhite, fontSize: 13, marginBottom: 10 }}>Receivables ({rRecv.length})</div>
                {rRecv.map((r: AnyState) => {
                  const rem = r.amount - (r.received || 0);
                  return (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.divider}` }}>
                      <div><span style={{ fontSize: 12, color: T.text }}>{r.name}</span><div style={{ fontSize: 10, color: T.textSoft }}>{r.from ? `From: ${r.from} · ` : ""}{getBizShort(r.scope)}</div></div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: rem > 0 ? "#26A17B" : "#95E77E" }}>{masked(fm(rem, r.currency))}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Assets Summary */}
            {rptSections.assets && rAssets.length > 0 && (
              <div style={{ ...FmS, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: T.textWhite, fontSize: 13, marginBottom: 10 }}>Assets ({rAssets.length})</div>
                {rAssets.map((a: AnyState) => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.divider}` }}>
                    <div><span style={{ fontSize: 12, color: T.text }}>{a.name}</span><div style={{ fontSize: 10, color: T.textSoft }}>{getBizShort(a.scope)}</div></div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#D4A373" }}>{masked(fm(a.marketValue > 0 ? a.marketValue : a.purchasePrice, a.currency))}</span>
                  </div>
                ))}
              </div>
            )}

            {filteredTxns.length === 0 && <div style={{ color: T.textSoft, textAlign: "center", padding: 30, fontSize: 13 }}>No transactions for this period</div>}
          </div>
          );
        })()}

        {/* ═══ SMART SCAN ═══ */}
        {view === "scan" && (<div>
          <div style={{ marginBottom: 16 }}>
            <div style={Sec}>📸 Smart Scan</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 16, marginTop: -6 }}>Upload a screenshot of any receipt, bank transfer, payment confirmation, or sales notification. AI reads it and auto-fills a transaction.</div>
            <label style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "28px 20px", background: "#12141A", border: "2px dashed #252830", borderRadius: 12, cursor: "pointer" }}>
              <span style={{ fontSize: 32, marginBottom: 8 }}>📸</span>
              <span style={{ fontSize: 14, color: "#888", fontWeight: 600 }}>Tap to upload screenshot</span>
              <span style={{ fontSize: 11, color: "#444", marginTop: 4 }}>Receipts, bank transfers, GCash, PayMaya, Shopee, etc.</span>
              <input type="file" accept="image/*" onChange={handleScan} style={{ display: "none" }} />
            </label>
          </div>

          {scanLoading && (
            <div style={{ background: "#12141A", borderRadius: 12, padding: 24, textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
              <div style={{ color: "#E9C46A", fontWeight: 600, fontSize: 14 }}>Reading screenshot...</div>
              <div style={{ color: "#555", fontSize: 12, marginTop: 4 }}>AI is extracting transaction details</div>
            </div>
          )}

          {scanResult && !scanResult.error && (
            <div style={{ background: "#12141A", border: "2px solid #4ECDC4", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: "#4ECDC4", fontSize: 15 }}>✓ Transaction Detected</div>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: scanResult.confidence === "high" ? "#95E77E22" : scanResult.confidence === "medium" ? "#FFD93D22" : "#FF6B6B22", color: scanResult.confidence === "high" ? "#95E77E" : scanResult.confidence === "medium" ? "#FFD93D" : "#FF6B6B" }}>{scanResult.confidence} confidence</span>
              </div>
              {scanImg && <img src={scanImg} style={{ width: "100%", maxHeight: 200, objectFit: "contain" as const, borderRadius: 8, marginBottom: 14, background: "#0B0D12" }} />}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <span style={L}>Type</span>
                  <select style={I} value={scanResult.type || "expense"} onChange={e => setScanResult((p: AnyState) => ({ ...p, type: e.target.value }))}>
                    <option value="expense">↓ Expense</option>
                    <option value="income">↑ Income</option>
                  </select>
                </div>
                <div>
                  <span style={L}>Amount</span>
                  <NumIn style={I} value={String(scanResult.amount || "")} onChange={(v: string) => setScanResult((p: AnyState) => ({ ...p, amount: v }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <span style={L}>Source</span>
                  <input style={I} value={scanResult.source || ""} onChange={e => setScanResult((p: AnyState) => ({ ...p, source: e.target.value }))} placeholder="Store, bank, platform..." />
                </div>
                <div>
                  <span style={L}>Date</span>
                  <input style={I} type="date" value={scanResult.date || ""} onChange={e => setScanResult((p: AnyState) => ({ ...p, date: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <span style={L}>Description</span>
                <input style={I} value={scanResult.description || ""} onChange={e => setScanResult((p: AnyState) => ({ ...p, description: e.target.value }))} placeholder="What is this transaction?" />
              </div>
              {scanResult.details && <div style={{ fontSize: 11, color: "#555", marginBottom: 10, padding: "0 2px" }}>AI notes: {scanResult.details}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase" as const }}>Personal / Business</span>
                  <ScopeSelect style={{ ...I, marginTop: 4 }} value={scanResult.txScope || "personal"} onChange={(v: string) => setScanResult((p: AnyState) => ({ ...p, txScope: v, category: "" }))} />
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase" as const }}>Category</span>
                  <select style={{ ...I, marginTop: 4 }} value={scanResult.category || ""} onChange={e => setScanResult((p: AnyState) => ({ ...p, category: e.target.value }))}>
                    <option value="">Select...</option>
                    {(TX_CATS[getTxCatKey(scanResult.txScope || "personal", scanResult.type || "expense")] || []).map(c => <option key={c.k} value={c.k}>{c.l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase" as const }}>Save to Account</span>
                <select style={{ ...I, marginTop: 4 }} defaultValue={accounts.length > 0 ? accounts[0].id : ""} onChange={e => setScanResult((p: AnyState) => ({ ...p, _accountId: e.target.value }))}>
                  {accounts.map((a: AnyState) => <option key={a.id} value={a.id}>{ACCT_CATS[a.category]?.i} {a.name} ({getBizShort(a.scope)})</option>)}
                  {accounts.length === 0 && <option value="">No accounts — add one first</option>}
                </select>
              </div>
              <div style={FlEnd}>
                <button onClick={() => { setScanResult(null); setScanImg(null); }} style={CnclS}>Discard</button>
                <button onClick={() => {
                  if (scanResult._accountId) {
                    const r = scanResult;
                    const amt = parseFloat(r.amount) || 0;
                    const tx = { id: gid(), accountId: r._accountId, toAccountId: "", type: r.type || "expense", amount: amt, description: `${r.source || "Scan"}: ${r.description || ""}`.trim(), date: r.date || new Date().toISOString().slice(0, 10), receivableId: "", debtId: "", scanned: true, txCat: r.category || "", txScope: r.txScope || "personal" };
                    const na = accounts.map((a: AnyState) => { if (a.id !== tx.accountId) return a; return { ...a, balance: a.balance + (tx.type === "income" ? amt : -amt) }; });
                    const nt = [tx, ...txns];
                    setTxns(nt); setAccounts(na); const ns = snap(na, debts, cryptos); save();
                    setScanResult(null); setScanImg(null);
                  } else { saveScan(); }
                }} style={BtnS("#4ECDC4")} disabled={accounts.length === 0}>✓ Save Transaction</button>
              </div>
            </div>
          )}

          {scanResult?.error && (
            <div style={{ background: "#12141A", border: "2px solid #FF6B6B", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ color: "#FF6B6B", fontWeight: 700, marginBottom: 6 }}>❌ Could not read</div>
              <div style={{ color: "#888", fontSize: 13 }}>{scanResult.error}</div>
              <button onClick={() => { setScanResult(null); setScanImg(null); }} style={{ ...CnclS, marginTop: 10 }}>Try Again</button>
            </div>
          )}

          {scanHistory.length > 0 && (
            <div>
              <div style={Sec}>Recent Scans</div>
              {scanHistory.slice(0, 10).map((s: AnyState) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#12141A", borderBottom: "1px solid #181b22", marginBottom: 1 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>
                      <span style={{ color: s.type === "income" ? "#95E77E" : "#FF6B6B" }}>{s.type === "income" ? "↑" : "↓"}</span> {s.source}: {s.description}
                    </div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>{s.date} · {getBizShort(s.txScope || "personal")}{s.category ? ` · ${getTxCatLabel(s.category)}` : ""} · {s.confidence}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: s.type === "income" ? "#95E77E" : "#FF6B6B" }}>{fm(s.amount, s.currency || "PHP")}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: "#12141A", borderRadius: 10, padding: 14, marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 8 }}>💡 Tips for best results</div>
            <div style={{ fontSize: 11, color: "#444", lineHeight: 1.6 }}>
              • Bank transfer confirmations (BDO, BPI, UnionBank, etc.)<br/>
              • GCash / PayMaya receipts<br/>
              • Shopee / TikTok / Lazada order confirmations<br/>
              • Store receipts and invoices<br/>
              • Credit card transaction notifications<br/>
              • Make sure the amount and date are visible in the screenshot
            </div>
          </div>
        </div>)}

        {/* ═══ ACTIVITY ═══ */}
        {view === "tx" && (<div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><div style={Sec}>Transactions</div><button style={BtnS("#4ECDC4")} onClick={() => { setSf("tx"); setEId(null); setTf({ accountId: "", toAccountId: "", type: "expense", amount: "", description: "", date: new Date().toISOString().slice(0, 10), receivableId: "", debtId: "", txCat: "", txScope: "personal" }); }}>+ Add</button></div>
          {sf === "tx" && (
            <div style={FmS}><div style={{ fontWeight: 700, color: "#fff", marginBottom: 12 }}>{eId ? "Edit Transaction" : "New Transaction"}</div>
              <div style={G2}>
                <div><span style={L}>{tf.type === "transfer" ? "From Account" : "Account"}</span><select style={I} value={tf.accountId} onChange={e => setTf({ ...tf, accountId: e.target.value })}><option value="">Select...</option>{sA.map((a: AnyState) => <option key={a.id} value={a.id}>{ACCT_CATS[a.category]?.i} {a.name} ({getBizShort(a.scope)})</option>)}</select></div>
                <div><span style={L}>Type</span><select style={I} value={tf.type} onChange={e => setTf({ ...tf, type: e.target.value, receivableId: "", debtId: "", txCat: "", txScope: "personal" })}><option value="income">↑ Income</option><option value="expense">↓ Expense</option><option value="transfer">↔ Transfer</option></select></div>
                {tf.type === "transfer" && <div><span style={L}>To Account</span><select style={I} value={tf.toAccountId} onChange={e => setTf({ ...tf, toAccountId: e.target.value })}><option value="">Select...</option>{accounts.filter((a: AnyState) => a.id !== tf.accountId).map((a: AnyState) => <option key={a.id} value={a.id}>{ACCT_CATS[a.category]?.i} {a.name}</option>)}</select></div>}
                {tf.type !== "transfer" && (<>
                  <div><span style={L}>Personal / Business</span><ScopeSelect style={I} value={tf.txScope} onChange={(v: string) => setTf({ ...tf, txScope: v, txCat: "" })} /></div>
                  <div><span style={L}>Category</span><select style={I} value={tf.txCat} onChange={e => setTf({ ...tf, txCat: e.target.value })}>
                    <option value="">Select category...</option>
                    {(TX_CATS[getTxCatKey(tf.txScope, tf.type)] || []).map((c: { k: string; l: string }) => <option key={c.k} value={c.k}>{c.l}</option>)}
                  </select></div>
                </>)}
                <div><span style={L}>Amount</span><NumIn style={I} value={tf.amount} onChange={(v: string) => setTf({ ...tf, amount: v })} /></div>
                <div><span style={L}>Date</span><input style={I} type="date" value={tf.date} onChange={e => setTf({ ...tf, date: e.target.value })} /></div>
              </div>
              {tf.type === "income" && openR.length > 0 && (
                <div style={{ marginBottom: 10, background: "#0e1016", borderRadius: 8, padding: 12, border: "1px solid #1e2028" }}>
                  <span style={{ ...L, color: "#26A17B" }}>📥 Link to Receivable (optional)</span>
                  <select style={{ ...I, marginTop: 4 }} value={tf.receivableId} onChange={e => {
                    const rv = receivables.find((r: AnyState) => r.id === e.target.value);
                    if (rv) {
                      const remaining = rv.amount - (rv.received || 0);
                      setTf({ ...tf, receivableId: e.target.value, amount: String(remaining), description: tf.description || rv.name });
                    } else {
                      setTf({ ...tf, receivableId: "" });
                    }
                  }}>
                    <option value="">None — standalone income</option>
                    {openR.map((r: AnyState) => { const rem = r.amount - (r.received || 0); return <option key={r.id} value={r.id}>📥 {r.name} — {fm(rem, r.currency)} remaining{r.from ? ` (${r.from})` : ""}</option>; })}
                  </select>
                </div>
              )}
              {tf.type === "expense" && debts.filter((d: AnyState) => d.outstanding > 0).length > 0 && (
                <div style={{ marginBottom: 10, background: "#0e1016", borderRadius: 8, padding: 12, border: "1px solid #1e2028" }}>
                  <span style={{ ...L, color: "#FF6B6B" }}>💳 Link to Debt (optional)</span>
                  <select style={{ ...I, marginTop: 4 }} value={tf.debtId} onChange={e => {
                    const db = debts.find((d: AnyState) => d.id === e.target.value);
                    if (db) {
                      setTf({ ...tf, debtId: e.target.value, amount: String(db.dueAmount || db.outstanding), description: tf.description || `Payment: ${db.name}` });
                    } else {
                      setTf({ ...tf, debtId: "" });
                    }
                  }}>
                    <option value="">None — standalone expense</option>
                    {debts.filter((d: AnyState) => d.outstanding > 0).map((d: AnyState) => <option key={d.id} value={d.id}>{DEBT_TYPES[d.type]?.i || "💳"} {d.name} — {fm(d.outstanding, d.currency)} owed{d.dueAmount ? ` (${fm(d.dueAmount, d.currency)} due)` : ""}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: 10 }}><span style={L}>Description</span><input style={I} value={tf.description} onChange={e => setTf({ ...tf, description: e.target.value })} placeholder="What for?" /></div>
              <div style={FlEnd}><button style={CnclS} onClick={() => { setSf(null); setEId(null); }}>Cancel</button><button style={BtnS("#4ECDC4")} onClick={eId ? saveEditTx : addTx}>{eId ? "Save" : "Add"}</button></div>
            </div>
          )}
          {sT.length === 0 ? <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No transactions</div> : sT.map((tx: AnyState) => {
            const acc = accounts.find((a: AnyState) => a.id === tx.accountId);
            const toAcc = tx.toAccountId ? accounts.find((a: AnyState) => a.id === tx.toAccountId) : null;
            const clr = tx.type === "income" ? "#95E77E" : tx.type === "transfer" ? "#A8B5E2" : "#FF6B6B";
            const icon = tx.type === "income" ? "↑" : tx.type === "transfer" ? "↔" : "↓";
            return (
              <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#12141A", borderBottom: "1px solid #181b22" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}><span style={{ color: clr }}>{icon}</span> {tx.description || tx.type}{tx.receivableId ? " 📥" : ""}{tx.debtId ? " 💳" : ""}{tx.scanned ? " 📸" : ""}</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 1 }}>
                    {acc?.name || "?"}{tx.type === "transfer" && toAcc ? ` → ${toAcc.name}` : ""} · {getBizShort(tx.txScope || "personal")} · {tx.date}
                    {tx.txCat && <span style={{ marginLeft: 4, color: "#555" }}>· {getTxCatLabel(tx.txCat)}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: clr }}>{tx.type === "income" ? "+" : tx.type === "transfer" ? "" : "-"}{fm(tx.amount, acc?.currency)}</div>
                    {acc?.currency !== dCur && <div style={{ fontSize: 10, color: "#555" }}>≈ {fm(cv(tx.amount, acc?.currency || "PHP", dCur, rates), dCur, true)}</div>}
                  </div>
                  <button onClick={() => { setEId(tx.id); setSf("tx"); setTf({ accountId: tx.accountId, toAccountId: tx.toAccountId || "", type: tx.type, amount: String(tx.amount), description: tx.description || "", date: tx.date, receivableId: tx.receivableId || "", debtId: tx.debtId || "", txCat: tx.txCat || "", txScope: tx.txScope || "personal" }); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>✎</button>
                  <button onClick={() => { delTx(tx); }} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>)}
        </div>
      </div>
    </div>
  );
}
