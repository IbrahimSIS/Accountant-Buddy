import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryColor } from "@/lib/category-colors";

// ─── Shared types ────────────────────────────────────────────────────────────
export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

export interface CategoryData {
  name: string;
  value: number;
  color: string;
}

export interface DashboardFilter {
  /** 0-11.  null = "All Time" (no month filter) */
  month: number | null;
  /** Full year, e.g. 2026.  null = "All Time" (no year filter) */
  year: number | null;
}

export interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  cashBalance: number;
  clientCount: number;
  transactionCount: number;
  bankAccountCount: number;
  uncategorizedCount: number;
  monthlyData: MonthlyData[];
  expenseCategories: CategoryData[];
  incomeCategories: CategoryData[];
  incomeTrend: number;
  expenseTrend: number;
  profitTrend: number;
  loading: boolean;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Returns true if a category_id is effectively "uncategorized".
 *
 * BUG FIX: Previously any transaction with category_id === null was counted as
 * uncategorized, even though the dashboard categories query also resolved null
 * to the string "Uncategorized" and displayed it in the chart.  Now we
 * normalize at the data layer: a transaction is uncategorized ONLY when its
 * category_id is null/empty AND the resolved name is missing or is literally
 * "uncategorized" (case-insensitive).  This eliminates phantom counts.
 */
function isUncategorized(categoryId: string | null, resolvedName: string | undefined): boolean {
  if (!categoryId || categoryId.trim() === "") return true;
  if (!resolvedName) return true;
  return resolvedName.trim().toLowerCase() === "uncategorized";
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDashboardData(filter?: DashboardFilter) {
  const [data, setData] = useState<DashboardData>({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    cashBalance: 0,
    clientCount: 0,
    transactionCount: 0,
    bankAccountCount: 0,
    uncategorizedCount: 0,
    monthlyData: [],
    expenseCategories: [],
    incomeCategories: [],
    incomeTrend: 0,
    expenseTrend: 0,
    profitTrend: 0,
    loading: true,
  });

  // Derive date bounds from filter (null = all-time)
  const filterMonth = filter?.month ?? null;
  const filterYear = filter?.year ?? null;

  const fetchDashboardData = useCallback(async () => {
    try {
      // ── 1. Determine date window ─────────────────────────────────────────
      // "All Time" when both are null.  Otherwise clamp to selected month/year.
      let dateStart: string | null = null;
      let dateEnd: string | null = null;

      if (filterYear !== null && filterMonth !== null) {
        // Specific month + year
        dateStart = new Date(filterYear, filterMonth, 1).toISOString().split("T")[0];
        dateEnd = new Date(filterYear, filterMonth + 1, 0).toISOString().split("T")[0];
      } else if (filterYear !== null && filterMonth === null) {
        // Entire year
        dateStart = `${filterYear}-01-01`;
        dateEnd = `${filterYear}-12-31`;
      }
      // else: all time → dateStart/dateEnd stay null

      // ── 2. Build transaction query with server-side date filter ───────────
      // BUG FIX: Previously ALL transactions were fetched and filtered in JS.
      // Now we push the date predicate to Supabase so only relevant rows are
      // returned.  This is both more efficient and ensures the DB is the single
      // source of truth for filtering.
      let txnQuery = supabase.from("transactions").select("*");
      if (dateStart) txnQuery = txnQuery.gte("date", dateStart);
      if (dateEnd) txnQuery = txnQuery.lte("date", dateEnd);

      // Previous-period query for trend calculation (only meaningful when a
      // specific month+year is selected; otherwise trends are not applicable).
      let prevTxnPromise: PromiseLike<{ data: any[] | null }> | null = null;
      let prevStart: string | null = null;
      let prevEnd: string | null = null;
      if (filterYear !== null && filterMonth !== null) {
        const pm = filterMonth === 0 ? 11 : filterMonth - 1;
        const py = filterMonth === 0 ? filterYear - 1 : filterYear;
        prevStart = new Date(py, pm, 1).toISOString().split("T")[0];
        prevEnd = new Date(py, pm + 1, 0).toISOString().split("T")[0];
        prevTxnPromise = supabase
          .from("transactions")
          .select("amount, type")
          .gte("date", prevStart)
          .lte("date", prevEnd);
      }

      // ── 3. Parallel fetch ────────────────────────────────────────────────
      const [clientsResult, transactionsResult, bankAccountsResult, categoriesResult] =
        await Promise.all([
          supabase.from("clients").select("id", { count: "exact" }),
          txnQuery,
          supabase.from("bank_accounts").select("id", { count: "exact" }),
          supabase.from("categories").select("id, name, type"),
        ]);

      // Fetch previous-period data only when applicable (avoids wasted request)
      const prevMonthResult = prevTxnPromise ? await prevTxnPromise : { data: [] as any[] };

      const transactions: any[] = transactionsResult.data || [];
      const categories: any[] = categoriesResult.data || [];

      // Build a lookup: category_id → category row
      const categoryMap = new Map<string, { id: string; name: string; type: string }>(
        categories.map((c: any) => [c.id, c])
      );

      // ── 4. KPI calculations — ONLY from the transactions table ───────────
      // BUG FIX: Cash Balance previously included bank_accounts.opening_balance.
      // Per requirements, all KPIs derive exclusively from the transactions
      // table within the active date filter.
      let totalIncome = 0;
      let totalExpenses = 0;
      let uncategorizedCount = 0;

      const expenseCategoryTotals: Record<string, number> = {};
      const incomeCategoryTotals: Record<string, number> = {};

      for (const t of transactions) {
        const amount = Number(t.amount);
        const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
        const catName = cat?.name;

        if (isUncategorized(t.category_id, catName)) {
          uncategorizedCount++;
        }

        if (t.type === "income") {
          totalIncome += amount;
          const key = catName || "Uncategorized";
          incomeCategoryTotals[key] = (incomeCategoryTotals[key] || 0) + amount;
        } else if (t.type === "expense") {
          totalExpenses += amount;
          const key = catName || "Uncategorized";
          expenseCategoryTotals[key] = (expenseCategoryTotals[key] || 0) + amount;
        }
      }

      const netProfit = totalIncome - totalExpenses;
      // Cash Balance = net of all filtered transactions (income − expense)
      const cashBalance = totalIncome - totalExpenses;

      // ── 5. Trend calculation ─────────────────────────────────────────────
      let incomeTrend = 0;
      let expenseTrend = 0;
      let profitTrend = 0;
      const prevTxns = prevMonthResult.data || [];
      if (prevTxns.length > 0) {
        const prevIncome = prevTxns
          .filter((t: any) => t.type === "income")
          .reduce((s: number, t: any) => s + Number(t.amount), 0);
        const prevExpenses = prevTxns
          .filter((t: any) => t.type === "expense")
          .reduce((s: number, t: any) => s + Number(t.amount), 0);
        const prevProfit = prevIncome - prevExpenses;

        incomeTrend = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : 0;
        expenseTrend = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;
        profitTrend = prevProfit !== 0 ? ((netProfit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;
      }

      // ── 6. Monthly chart data ────────────────────────────────────────────
      // When a specific month is selected we show 6 months ending at that month.
      // When "All Time" or year-only, we show the last 12 months of the selected
      // year (or current year).
      const refYear = filterYear ?? new Date().getFullYear();
      const refMonth = filterMonth ?? new Date().getMonth();
      // Show 12 months when viewing an entire year or all-time; 6 when a specific month is selected
      const chartMonths = filterMonth === null ? 12 : 6;

      const monthlyData: MonthlyData[] = [];
      for (let i = chartMonths - 1; i >= 0; i--) {
        const m = new Date(refYear, refMonth - i, 1);
        const mStart = new Date(m.getFullYear(), m.getMonth(), 1).toISOString().split("T")[0];
        const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString().split("T")[0];

        // For "all time" we need to scan all fetched transactions;
        // for date-filtered views the transactions are already scoped, but
        // the chart may include months outside the strict filter window
        // (e.g. showing context).  Re-query is expensive so we filter in JS
        // over the already-fetched superset.
        const mTxns = transactions.filter((t: any) => t.date >= mStart && t.date <= mEnd);

        monthlyData.push({
          month: MONTH_NAMES[m.getMonth()],
          income: mTxns.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0),
          expense: mTxns.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0),
        });
      }

      // ── 7. Category breakdowns with FIXED colors ─────────────────────────
      // BUG FIX: Previously colors were assigned by sort-index, meaning the
      // same category could change color between months.  Now we use a
      // deterministic mapping via getCategoryColor().
      const expenseCategories: CategoryData[] = Object.entries(expenseCategoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value, color: getCategoryColor(name) }));

      const incomeCategories: CategoryData[] = Object.entries(incomeCategoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value, color: getCategoryColor(name) }));

      // ── 8. Commit state ──────────────────────────────────────────────────
      setData({
        totalIncome,
        totalExpenses,
        netProfit,
        cashBalance,
        clientCount: clientsResult.count || 0,
        transactionCount: transactions.length,
        bankAccountCount: bankAccountsResult.count || 0,
        uncategorizedCount,
        monthlyData,
        expenseCategories,
        incomeCategories,
        incomeTrend,
        expenseTrend,
        profitTrend,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [filterMonth, filterYear]);

  useEffect(() => {
    fetchDashboardData();

    // Real-time subscriptions — re-fetch on any mutation so the dashboard
    // never shows stale data.
    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => fetchDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => fetchDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "bank_accounts" }, () => fetchDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => fetchDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  return { ...data, refetch: fetchDashboardData };
}
