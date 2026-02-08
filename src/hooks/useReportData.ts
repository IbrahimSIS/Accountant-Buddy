import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  startOfYear,
  endOfYear,
  subYears,
  format,
} from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportType = "pnl" | "balance" | "cashflow" | "monthly";

export interface ReportTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category_id: string | null;
  category_name?: string;
  account_id: string | null;
  account_name?: string;
  account_type?: string;
  notes: string | null;
  source: string;
}

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
}

export interface ReportSummary {
  reportType: ReportType;
  transactionCount: number;
  // P&L
  totalIncome: number;
  totalExpenses: number;
  netProfitLoss: number;
  incomeByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  // Balance Sheet
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  assetAccounts: AccountBalance[];
  liabilityAccounts: AccountBalance[];
  equityAccounts: AccountBalance[];
  // Cash Flow
  cashInflows: number;
  cashOutflows: number;
  netCash: number;
  inflowsByCategory: Record<string, number>;
  outflowsByCategory: Record<string, number>;
}

export interface ReportData {
  transactions: ReportTransaction[];
  summary: ReportSummary;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getDateRange(period: string): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (period) {
    case "current-month":
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;
    case "last-month":
      start = startOfMonth(subMonths(now, 1));
      end = endOfMonth(subMonths(now, 1));
      break;
    case "current-quarter":
      start = startOfQuarter(now);
      end = endOfQuarter(now);
      break;
    case "last-quarter":
      start = startOfQuarter(subQuarters(now, 1));
      end = endOfQuarter(subQuarters(now, 1));
      break;
    case "ytd":
      start = startOfYear(now);
      end = now;
      break;
    case "last-year":
      start = startOfYear(subYears(now, 1));
      end = endOfYear(subYears(now, 1));
      break;
    default:
      start = startOfMonth(now);
      end = endOfMonth(now);
  }

  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}

export function getPeriodLabel(period: string): string {
  const { start, end } = getDateRange(period);
  return `${format(new Date(start), "MMM d, yyyy")} – ${format(new Date(end), "MMM d, yyyy")}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AccountInfo = { id: string; code: string; name: string; type: string };

function emptySummary(reportType: ReportType): ReportSummary {
  return {
    reportType,
    transactionCount: 0,
    totalIncome: 0,
    totalExpenses: 0,
    netProfitLoss: 0,
    incomeByCategory: {},
    expenseByCategory: {},
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    assetAccounts: [],
    liabilityAccounts: [],
    equityAccounts: [],
    cashInflows: 0,
    cashOutflows: 0,
    netCash: 0,
    inflowsByCategory: {},
    outflowsByCategory: {},
  };
}

async function fetchPaginatedTransactions(
  clientId: string,
  start: string | null,
  end: string,
  selectFields = "id, date, description, amount, type, category_id, account_id, notes, source"
): Promise<ReportTransaction[]> {
  let all: ReportTransaction[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("transactions")
      .select(selectFields)
      .eq("client_id", clientId)
      .lte("date", end)
      .order("date", { ascending: true })
      .range(from, from + pageSize - 1);

    if (start) query = query.gte("date", start);

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      all = [...all, ...(data as unknown as ReportTransaction[])];
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return all;
}

function enrichTransactions(
  transactions: ReportTransaction[],
  categoryMap: Map<string, string>,
  accountMap: Map<string, AccountInfo>
) {
  for (const t of transactions) {
    t.category_name = t.category_id
      ? categoryMap.get(t.category_id) || "Uncategorized"
      : "Uncategorized";
    if (t.account_id) {
      const account = accountMap.get(t.account_id);
      if (account) {
        t.account_name = account.name;
        t.account_type = account.type;
      }
    }
  }
}

// ─── P&L ──────────────────────────────────────────────────────────────────────

async function buildPnL(
  clientId: string,
  start: string,
  end: string,
  categoryMap: Map<string, string>,
  accountMap: Map<string, AccountInfo>
): Promise<ReportData> {
  const allTxns = await fetchPaginatedTransactions(clientId, start, end);
  enrichTransactions(allTxns, categoryMap, accountMap);

  // Only income and expense transactions
  const transactions = allTxns.filter(
    (t) => t.type === "income" || t.type === "expense"
  );

  const summary = emptySummary("pnl");
  summary.transactionCount = transactions.length;

  for (const t of transactions) {
    const amt = Number(t.amount);
    const cat = t.category_name || "Uncategorized";
    if (t.type === "income") {
      summary.totalIncome += amt;
      summary.incomeByCategory[cat] = (summary.incomeByCategory[cat] || 0) + amt;
    } else {
      summary.totalExpenses += amt;
      summary.expenseByCategory[cat] = (summary.expenseByCategory[cat] || 0) + amt;
    }
  }
  summary.netProfitLoss = summary.totalIncome - summary.totalExpenses;

  return { transactions, summary };
}

// ─── Journal-based helpers ───────────────────────────────────────────────────

interface JournalRow {
  account_id: string;
  debit: number;
  credit: number;
}

async function fetchJournalBalances(
  clientId: string,
  end: string
): Promise<Map<string, number>> {
  const balanceMap = new Map<string, number>();

  try {
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("account_id, debit, credit")
        .eq("client_id", clientId)
        .lte("date", end)
        .range(from, from + pageSize - 1);

      if (error) {
        console.warn("journal_entries query failed (table may not exist yet):", error.message);
        return balanceMap;
      }

      if (data && data.length > 0) {
        for (const row of data as unknown as JournalRow[]) {
          const current = balanceMap.get(row.account_id) || 0;
          balanceMap.set(
            row.account_id,
            current + Number(row.debit) - Number(row.credit)
          );
        }
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
  } catch (err) {
    console.warn("fetchJournalBalances error:", err);
  }

  return balanceMap;
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────

async function buildBalanceSheet(
  clientId: string,
  end: string,
  accounts: AccountInfo[]
): Promise<ReportData> {
  const bsAccounts = accounts.filter(
    (a) => a.type === "asset" || a.type === "liability" || a.type === "equity"
  );

  const balanceMap = await fetchJournalBalances(clientId, end);

  const summary = emptySummary("balance");

  for (const account of bsAccounts) {
    const rawBalance = balanceMap.get(account.id) || 0;
    if (rawBalance === 0) continue;

    const balance =
      account.type === "liability" || account.type === "equity"
        ? -rawBalance
        : rawBalance;

    const ab: AccountBalance = {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      balance,
    };
    switch (account.type) {
      case "asset":
        summary.assetAccounts.push(ab);
        summary.totalAssets += balance;
        break;
      case "liability":
        summary.liabilityAccounts.push(ab);
        summary.totalLiabilities += balance;
        break;
      case "equity":
        summary.equityAccounts.push(ab);
        summary.totalEquity += balance;
        break;
    }
  }

  // Compute Retained Earnings from income/expense accounts so BS balances
  const incExpAccounts = accounts.filter(
    (a) => a.type === "income" || a.type === "expense"
  );
  let netIncome = 0;
  for (const account of incExpAccounts) {
    const rawBalance = balanceMap.get(account.id) || 0;
    if (account.type === "income") {
      netIncome += -rawBalance; // income natural balance is credit
    } else {
      netIncome -= rawBalance;  // expense natural balance is debit
    }
  }
  if (netIncome !== 0) {
    summary.equityAccounts.push({
      id: "retained-earnings",
      code: "RE",
      name: "Retained Earnings",
      type: "equity",
      balance: netIncome,
    });
    summary.totalEquity += netIncome;
  }

  summary.transactionCount =
    summary.assetAccounts.length +
    summary.liabilityAccounts.length +
    summary.equityAccounts.length;

  return { transactions: [], summary };
}

// ─── Cash Flow (Direct Method) ────────────────────────────────────────────────

async function buildCashFlow(
  clientId: string,
  start: string,
  end: string,
  categoryMap: Map<string, string>,
  accountMap: Map<string, AccountInfo>
): Promise<ReportData> {
  const transactions = await fetchPaginatedTransactions(clientId, start, end);
  enrichTransactions(transactions, categoryMap, accountMap);

  const summary = emptySummary("cashflow");
  summary.transactionCount = transactions.length;

  for (const t of transactions) {
    const amt = Number(t.amount);
    const cat = t.category_name || "Uncategorized";
    if (t.type === "income") {
      summary.cashInflows += amt;
      summary.inflowsByCategory[cat] =
        (summary.inflowsByCategory[cat] || 0) + amt;
    } else if (t.type === "expense") {
      summary.cashOutflows += amt;
      summary.outflowsByCategory[cat] =
        (summary.outflowsByCategory[cat] || 0) + amt;
    }
  }
  summary.netCash = summary.cashInflows - summary.cashOutflows;

  return { transactions, summary };
}

// ─── Monthly Summary ──────────────────────────────────────────────────────────

async function buildMonthlySummary(
  clientId: string,
  start: string,
  end: string,
  accounts: AccountInfo[],
  categoryMap: Map<string, string>,
  accountMap: Map<string, AccountInfo>
): Promise<ReportData> {
  const transactions = await fetchPaginatedTransactions(clientId, start, end);
  enrichTransactions(transactions, categoryMap, accountMap);

  const summary = emptySummary("monthly");
  summary.transactionCount = transactions.length;

  // P&L + cash metrics from period transactions
  for (const t of transactions) {
    const amt = Number(t.amount);
    const cat = t.category_name || "Uncategorized";
    if (t.type === "income") {
      summary.totalIncome += amt;
      summary.cashInflows += amt;
      summary.incomeByCategory[cat] = (summary.incomeByCategory[cat] || 0) + amt;
    } else if (t.type === "expense") {
      summary.totalExpenses += amt;
      summary.cashOutflows += amt;
      summary.expenseByCategory[cat] = (summary.expenseByCategory[cat] || 0) + amt;
    }
  }
  summary.netProfitLoss = summary.totalIncome - summary.totalExpenses;
  summary.netCash = summary.cashInflows - summary.cashOutflows;

  // Balance Sheet snapshot from journal entries (cumulative up to end of period)
  const bsAccounts = accounts.filter(
    (a) => a.type === "asset" || a.type === "liability" || a.type === "equity"
  );

  const balanceMap = await fetchJournalBalances(clientId, end);

  for (const account of bsAccounts) {
    const rawBalance = balanceMap.get(account.id) || 0;
    if (rawBalance === 0) continue;

    const balance =
      account.type === "liability" || account.type === "equity"
        ? -rawBalance
        : rawBalance;

    const ab: AccountBalance = {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      balance,
    };
    switch (account.type) {
      case "asset":
        summary.assetAccounts.push(ab);
        summary.totalAssets += balance;
        break;
      case "liability":
        summary.liabilityAccounts.push(ab);
        summary.totalLiabilities += balance;
        break;
      case "equity":
        summary.equityAccounts.push(ab);
        summary.totalEquity += balance;
        break;
    }
  }

  // Compute Retained Earnings from income/expense accounts so BS balances
  const incExpAccounts = accounts.filter(
    (a) => a.type === "income" || a.type === "expense"
  );
  let netIncome = 0;
  for (const account of incExpAccounts) {
    const rawBalance = balanceMap.get(account.id) || 0;
    if (account.type === "income") {
      netIncome += -rawBalance;
    } else {
      netIncome -= rawBalance;
    }
  }
  if (netIncome !== 0) {
    summary.equityAccounts.push({
      id: "retained-earnings",
      code: "RE",
      name: "Retained Earnings",
      type: "equity",
      balance: netIncome,
    });
    summary.totalEquity += netIncome;
  }

  return { transactions, summary };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReportData() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const fetchReport = useCallback(
    async (
      clientId: string,
      period: string,
      reportType: ReportType
    ): Promise<ReportData | null> => {
      if (!clientId) return null;
      setLoading(true);

      try {
        const { start, end } = getDateRange(period);

        // Shared lookups
        const { data: accountsData } = await supabase
          .from("accounts")
          .select("id, code, name, type")
          .eq("client_id", clientId)
          .eq("is_active", true);
        const accounts: AccountInfo[] = accountsData || [];
        const accountMap = new Map(accounts.map((a) => [a.id, a]));

        const { data: catData } = await supabase
          .from("categories")
          .select("id, name")
          .eq("client_id", clientId);
        const categoryMap = new Map(
          (catData || []).map((c) => [c.id, c.name])
        );

        let result: ReportData;

        switch (reportType) {
          case "pnl":
            result = await buildPnL(clientId, start, end, categoryMap, accountMap);
            break;
          case "balance":
            result = await buildBalanceSheet(clientId, end, accounts);
            break;
          case "cashflow":
            result = await buildCashFlow(clientId, start, end, categoryMap, accountMap);
            break;
          case "monthly":
            result = await buildMonthlySummary(
              clientId, start, end, accounts, categoryMap, accountMap
            );
            break;
          default:
            result = { transactions: [], summary: emptySummary(reportType) };
        }

        setReportData(result);
        return result;
      } catch (err: any) {
        console.error("Failed to fetch report data:", err?.message || err);
        setReportData(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { reportData, loading, fetchReport, getDateRange };
}
