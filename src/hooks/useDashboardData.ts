import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface DashboardData {
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

const categoryColors = [
  "hsl(221, 83%, 40%)",
  "hsl(173, 58%, 45%)",
  "hsl(262, 52%, 55%)",
  "hsl(38, 92%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(215, 16%, 47%)",
  "hsl(348, 83%, 47%)",
  "hsl(187, 85%, 43%)",
];

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function useDashboardData() {
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

  const fetchDashboardData = useCallback(async () => {
    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
      
      // Previous month for trend calculation
      const firstDayOfPrevMonth = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
      const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      // Fetch all data in parallel
      const [
        clientsResult,
        transactionsResult,
        bankAccountsResult,
        categoriesResult,
        prevMonthTransactions,
      ] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact" }),
        supabase.from("transactions").select("*"),
        supabase.from("bank_accounts").select("id, opening_balance", { count: "exact" }),
        supabase.from("categories").select("*"),
        supabase.from("transactions")
          .select("*")
          .gte("date", firstDayOfPrevMonth)
          .lte("date", lastDayOfPrevMonth),
      ]);

      const transactions = transactionsResult.data || [];
      const categories = categoriesResult.data || [];
      const bankAccounts = bankAccountsResult.data || [];

      // Current month transactions
      const currentMonthTxns = transactions.filter(t => {
        const txDate = t.date;
        return txDate >= firstDayOfMonth && txDate <= lastDayOfMonth;
      });

      // Calculate current month totals
      const currentIncome = currentMonthTxns
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const currentExpenses = currentMonthTxns
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // Calculate previous month totals for trends
      const prevTxns = prevMonthTransactions.data || [];
      const prevIncome = prevTxns
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const prevExpenses = prevTxns
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // Calculate trends
      const incomeTrend = prevIncome > 0 ? ((currentIncome - prevIncome) / prevIncome) * 100 : 0;
      const expenseTrend = prevExpenses > 0 ? ((currentExpenses - prevExpenses) / prevExpenses) * 100 : 0;
      const prevProfit = prevIncome - prevExpenses;
      const currentProfit = currentIncome - currentExpenses;
      const profitTrend = prevProfit > 0 ? ((currentProfit - prevProfit) / prevProfit) * 100 : 0;

      // Cash balance: sum of opening balances + all income - all expenses
      const openingBalance = bankAccounts.reduce((sum, ba) => sum + Number(ba.opening_balance || 0), 0);
      const allIncome = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
      const allExpenses = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
      const cashBalance = openingBalance + allIncome - allExpenses;

      // Uncategorized transactions
      const uncategorizedCount = transactions.filter(t => !t.category_id).length;

      // Monthly data for last 6 months
      const monthlyData: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const month = new Date(currentYear, currentMonth - i, 1);
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const monthTxns = transactions.filter(t => t.date >= monthStart && t.date <= monthEnd);
        
        monthlyData.push({
          month: monthNames[month.getMonth()],
          income: monthTxns.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0),
          expense: monthTxns.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0),
        });
      }

      // Category breakdown for current month
      const categoryMap = new Map(categories.map(c => [c.id, c]));
      
      const expenseCategoryTotals: Record<string, number> = {};
      const incomeCategoryTotals: Record<string, number> = {};
      
      currentMonthTxns.forEach(t => {
        const category = t.category_id ? categoryMap.get(t.category_id) : null;
        const categoryName = category?.name || "Uncategorized";
        
        if (t.type === "expense") {
          expenseCategoryTotals[categoryName] = (expenseCategoryTotals[categoryName] || 0) + Number(t.amount);
        } else if (t.type === "income") {
          incomeCategoryTotals[categoryName] = (incomeCategoryTotals[categoryName] || 0) + Number(t.amount);
        }
      });

      const expenseCategories: CategoryData[] = Object.entries(expenseCategoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value], i) => ({ name, value, color: categoryColors[i % categoryColors.length] }));

      const incomeCategories: CategoryData[] = Object.entries(incomeCategoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value], i) => ({ name, value, color: categoryColors[i % categoryColors.length] }));

      setData({
        totalIncome: currentIncome,
        totalExpenses: currentExpenses,
        netProfit: currentProfit,
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
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => fetchDashboardData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        () => fetchDashboardData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bank_accounts' },
        () => fetchDashboardData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  return { ...data, refetch: fetchDashboardData };
}
