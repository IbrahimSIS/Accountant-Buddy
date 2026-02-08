import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardData, DashboardFilter } from "@/hooks/useDashboardData";
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
  CalendarDays,
} from "lucide-react";
import { Session } from "@supabase/supabase-js";

// ─── Constants for the date filter ──────────────────────────────────────────
const MONTH_OPTIONS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

/** Generate year options: current year and 4 years back */
function getYearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear();
  const opts: { value: string; label: string }[] = [];
  for (let y = current; y >= current - 4; y--) {
    opts.push({ value: String(y), label: String(y) });
  }
  return opts;
}
const YEAR_OPTIONS = getYearOptions();

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();

  // ─── Date filter state ──────────────────────────────────────────────────
  // Default: current month + current year.  "all" sentinel = null in filter.
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<string>(String(now.getMonth()));
  const [filterYear, setFilterYear] = useState<string>(String(now.getFullYear()));

  // Build the filter object that useDashboardData consumes.
  // Memoized so it only changes when the user actually picks a new value.
  const dashboardFilter = useMemo<DashboardFilter>(() => ({
    month: filterMonth === "all" ? null : Number(filterMonth),
    year: filterYear === "all" ? null : Number(filterYear),
  }), [filterMonth, filterYear]);

  // BUG FIX: Previously the hook accepted no parameters and hardcoded
  // "current month".  Now it reacts to the filter so all KPI cards,
  // charts, and breakdowns update when the user changes the date.
  const dashboardData = useDashboardData(dashboardFilter);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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

  // Derive a human-readable label for the active filter period
  const periodLabel =
    filterMonth === "all" && filterYear === "all"
      ? "All Time"
      : filterMonth === "all"
        ? filterYear
        : filterYear === "all"
          ? MONTH_OPTIONS[Number(filterMonth)]?.label ?? ""
          : `${MONTH_OPTIONS[Number(filterMonth)]?.label ?? ""} ${filterYear}`;

  // BUG FIX: Previously demo/mock data was shown when transactionCount === 0.
  // This violated the "no mock values" rule and displayed fabricated financial
  // figures.  Now we always show real data — zeros when there are no transactions.
  const { monthlyData, expenseCategories } = dashboardData;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header + Date Filter */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of all clients' financial data
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date filter: month selector */}
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[130px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {MONTH_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Date filter: year selector */}
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[100px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y.value} value={y.value}>
                    {y.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
              <FileText className="mr-2 h-4 w-4" />
              Reports
            </Button>
            <Button size="sm" onClick={() => navigate("/clients")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </div>
        </div>

        {/* KPI Cards — values come ONLY from the transactions table via useDashboardData */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Income"
            value={formatCurrency(dashboardData.totalIncome)}
            subtitle={periodLabel}
            icon={TrendingUp}
            trend={dashboardData.incomeTrend !== 0 ? {
              value: Math.round(dashboardData.incomeTrend * 10) / 10,
              label: "vs prior period",
            } : undefined}
            variant="income"
          />
          <KPICard
            title="Total Expenses"
            value={formatCurrency(dashboardData.totalExpenses)}
            subtitle={periodLabel}
            icon={TrendingDown}
            trend={dashboardData.expenseTrend !== 0 ? {
              value: Math.round(dashboardData.expenseTrend * 10) / 10,
              label: "vs prior period",
            } : undefined}
            variant="expense"
          />
          <KPICard
            title="Net Profit"
            value={formatCurrency(dashboardData.netProfit)}
            subtitle={periodLabel}
            icon={PiggyBank}
            trend={dashboardData.profitTrend !== 0 ? {
              value: Math.round(dashboardData.profitTrend * 10) / 10,
              label: "vs prior period",
            } : undefined}
            variant="profit"
          />
          <KPICard
            title="Cash Balance"
            value={formatCurrency(dashboardData.cashBalance)}
            subtitle={periodLabel}
            icon={Wallet}
            variant="balance"
          />
        </div>

        {/* Alerts */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboardData.uncategorizedCount > 0 ? (
            <AlertCard
              type="warning"
              title={`${dashboardData.uncategorizedCount} Uncategorized Transaction${dashboardData.uncategorizedCount > 1 ? "s" : ""}`}
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
              title={`${dashboardData.clientCount} Active Client${dashboardData.clientCount > 1 ? "s" : ""}`}
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
