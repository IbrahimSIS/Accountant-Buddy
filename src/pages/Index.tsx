import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
 import { useCurrency } from "@/contexts/CurrencyContext";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Plus,
  Users,
  FileText,
  RefreshCw,
  Banknote,
} from "lucide-react";
import { Session } from "@supabase/supabase-js";

// Demo data for when no real data exists
const demoMonthlyData = [
  { month: "Jul", income: 45000, expense: 32000 },
  { month: "Aug", income: 52000, expense: 38000 },
  { month: "Sep", income: 48000, expense: 35000 },
  { month: "Oct", income: 61000, expense: 42000 },
  { month: "Nov", income: 55000, expense: 39000 },
  { month: "Dec", income: 67000, expense: 45000 },
];

const demoExpenseCategories = [
  { name: "Salaries", value: 25000, color: "hsl(221, 83%, 40%)" },
  { name: "Rent", value: 8000, color: "hsl(173, 58%, 45%)" },
  { name: "Utilities", value: 3500, color: "hsl(262, 52%, 55%)" },
  { name: "Marketing", value: 5500, color: "hsl(38, 92%, 50%)" },
  { name: "Other", value: 3000, color: "hsl(215, 16%, 47%)" },
];

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const dashboardData = useDashboardData();
   const { formatCurrency, currency } = useCurrency();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      navigate("/auth");
    }
  }, [loading, session, navigate]);

  if (loading || dashboardData.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Use demo data if no real data exists
  const hasRealData = dashboardData.transactionCount > 0;
  const monthlyData = hasRealData ? dashboardData.monthlyData : demoMonthlyData;
  const expenseCategories = hasRealData && dashboardData.expenseCategories.length > 0 
    ? dashboardData.expenseCategories 
    : demoExpenseCategories;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of all clients' financial data
              {!hasRealData && " (Demo data shown)"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
              <FileText className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
            <Button size="sm" onClick={() => navigate("/clients")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Income"
             value={hasRealData ? formatCurrency(dashboardData.totalIncome) : `${currency} 67,000`}
            subtitle="This month"
            icon={TrendingUp}
            trend={hasRealData && dashboardData.incomeTrend !== 0 ? { 
              value: Math.round(dashboardData.incomeTrend * 10) / 10, 
              label: "vs last month" 
            } : undefined}
            variant="income"
          />
          <KPICard
            title="Total Expenses"
             value={hasRealData ? formatCurrency(dashboardData.totalExpenses) : `${currency} 45,000`}
            subtitle="This month"
            icon={TrendingDown}
            trend={hasRealData && dashboardData.expenseTrend !== 0 ? { 
              value: Math.round(dashboardData.expenseTrend * 10) / 10, 
              label: "vs last month" 
            } : undefined}
            variant="expense"
          />
          <KPICard
            title="Net Profit"
             value={hasRealData ? formatCurrency(dashboardData.netProfit) : `${currency} 22,000`}
            subtitle="This month"
            icon={PiggyBank}
            trend={hasRealData && dashboardData.profitTrend !== 0 ? { 
              value: Math.round(dashboardData.profitTrend * 10) / 10, 
              label: "vs last month" 
            } : undefined}
            variant="profit"
          />
          <KPICard
            title="Cash Balance"
             value={hasRealData ? formatCurrency(dashboardData.cashBalance) : `${currency} 156,400`}
            subtitle="All accounts"
            icon={Wallet}
            variant="balance"
          />
        </div>

        {/* Alerts */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboardData.uncategorizedCount > 0 ? (
            <AlertCard
              type="warning"
              title={`${dashboardData.uncategorizedCount} Uncategorized Transaction${dashboardData.uncategorizedCount > 1 ? 's' : ''}`}
              description="Review and categorize transactions for accurate reporting."
              action={{ label: "Review now", onClick: () => navigate("/transactions") }}
            />
          ) : (
            <AlertCard
              type="success"
              title="All Transactions Categorized"
              description="Great job! All your transactions have been categorized."
            />
          )}
          {dashboardData.clientCount === 0 ? (
            <AlertCard
              type="warning"
              title="No Clients Yet"
              description="Get started by adding your first client to the system."
              action={{ label: "Add Client", onClick: () => navigate("/clients") }}
            />
          ) : (
            <AlertCard
              type="success"
              title={`${dashboardData.clientCount} Active Client${dashboardData.clientCount > 1 ? 's' : ''}`}
              description="Manage your clients and their financial data."
              action={{ label: "View Clients", onClick: () => navigate("/clients") }}
            />
          )}
          <AlertCard
            type="success"
            title="Reports Ready"
            description="Generate monthly P&L, Balance Sheet, and Cash Flow reports."
            action={{ label: "View Reports", onClick: () => navigate("/reports") }}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Revenue Overview</h3>
                <p className="text-sm text-muted-foreground">Income vs Expenses trend</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-accent" />
                  <span className="text-muted-foreground">Income</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-muted-foreground">Expenses</span>
                </div>
              </div>
            </div>
            <RevenueChart data={monthlyData} />
          </div>
          <div className="rounded-xl border bg-card p-6">
            <CategoryBreakdown data={expenseCategories} title="Expense Breakdown" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboardData.clientCount}</p>
                <p className="text-sm text-muted-foreground">Active Clients</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2.5">
                <FileText className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboardData.transactionCount}</p>
                <p className="text-sm text-muted-foreground">Transactions</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {dashboardData.totalIncome > 0 
                    ? Math.round((dashboardData.netProfit / dashboardData.totalIncome) * 100) 
                    : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Profit Margin</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-2.5">
                <Banknote className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboardData.bankAccountCount}</p>
                <p className="text-sm text-muted-foreground">Bank Accounts</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
