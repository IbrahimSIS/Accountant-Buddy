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

export interface ReportTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category_id: string | null;
  account_id: string | null;
  notes: string | null;
  source: string;
}

export interface ReportSummary {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  transactionCount: number;
  incomeByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
}

export interface ReportData {
  transactions: ReportTransaction[];
  summary: ReportSummary;
}

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

export function useReportData() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const fetchReport = useCallback(
    async (clientId: string, period: string): Promise<ReportData | null> => {
      if (!clientId) return null;
      setLoading(true);

      try {
        const { start, end } = getDateRange(period);

        // Fetch transactions for the period — handle >1000 rows
        let allTransactions: ReportTransaction[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("transactions")
            .select("id, date, description, amount, type, category_id, account_id, notes, source")
            .eq("client_id", clientId)
            .gte("date", start)
            .lte("date", end)
            .order("date", { ascending: true })
            .range(from, from + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allTransactions = [...allTransactions, ...data];
            from += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Calculate summary
        let totalIncome = 0;
        let totalExpenses = 0;
        const incomeByCategory: Record<string, number> = {};
        const expenseByCategory: Record<string, number> = {};

        for (const t of allTransactions) {
          if (t.type === "income") {
            totalIncome += Number(t.amount);
            const catKey = t.category_id || "uncategorized";
            incomeByCategory[catKey] = (incomeByCategory[catKey] || 0) + Number(t.amount);
          } else if (t.type === "expense") {
            totalExpenses += Number(t.amount);
            const catKey = t.category_id || "uncategorized";
            expenseByCategory[catKey] = (expenseByCategory[catKey] || 0) + Number(t.amount);
          }
        }

        const result: ReportData = {
          transactions: allTransactions,
          summary: {
            totalIncome,
            totalExpenses,
            netIncome: totalIncome - totalExpenses,
            transactionCount: allTransactions.length,
            incomeByCategory,
            expenseByCategory,
          },
        };

        setReportData(result);
        return result;
      } catch (err) {
        console.error("Failed to fetch report data:", err);
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
