import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Plus,
  Users,
  FileText,
  RefreshCw,
} from "lucide-react";
import { User, Session } from "@supabase/supabase-js";

// Demo data for visualization
const monthlyData = [
  { month: "Jul", income: 45000, expense: 32000 },
  { month: "Aug", income: 52000, expense: 38000 },
  { month: "Sep", income: 48000, expense: 35000 },
  { month: "Oct", income: 61000, expense: 42000 },
  { month: "Nov", income: 55000, expense: 39000 },
  { month: "Dec", income: 67000, expense: 45000 },
];

const expenseCategories = [
  { name: "Salaries", value: 25000, color: "hsl(221, 83%, 40%)" },
  { name: "Rent", value: 8000, color: "hsl(173, 58%, 45%)" },
  { name: "Utilities", value: 3500, color: "hsl(262, 52%, 55%)" },
  { name: "Marketing", value: 5500, color: "hsl(38, 92%, 50%)" },
  { name: "Other", value: 3000, color: "hsl(215, 16%, 47%)" },
];

const incomeCategories = [
  { name: "Consulting", value: 35000, color: "hsl(173, 58%, 39%)" },
  { name: "Projects", value: 22000, color: "hsl(221, 83%, 40%)" },
  { name: "Retainers", value: 8000, color: "hsl(142, 71%, 45%)" },
  { name: "Other", value: 2000, color: "hsl(215, 16%, 47%)" },
];

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      navigate("/auth");
    }
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of all clients' financial data
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Income"
            value="JOD 67,000"
            subtitle="This month"
            icon={TrendingUp}
            trend={{ value: 12.5, label: "vs last month" }}
            variant="income"
          />
          <KPICard
            title="Total Expenses"
            value="JOD 45,000"
            subtitle="This month"
            icon={TrendingDown}
            trend={{ value: -3.2, label: "vs last month" }}
            variant="expense"
          />
          <KPICard
            title="Net Profit"
            value="JOD 22,000"
            subtitle="This month"
            icon={PiggyBank}
            trend={{ value: 18.7, label: "vs last month" }}
            variant="profit"
          />
          <KPICard
            title="Cash Balance"
            value="JOD 156,400"
            subtitle="All accounts"
            icon={Wallet}
            variant="balance"
          />
        </div>

        {/* Alerts */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AlertCard
            type="warning"
            title="12 Uncategorized Transactions"
            description="Review and categorize imported transactions for accurate reporting."
            action={{ label: "Review now", onClick: () => navigate("/transactions") }}
          />
          <AlertCard
            type="error"
            title="Bank Reconciliation Pending"
            description="Main Account for Client ABC has unreconciled items from last month."
            action={{ label: "Reconcile", onClick: () => navigate("/reconciliation") }}
          />
          <AlertCard
            type="success"
            title="Monthly Reports Ready"
            description="December reports for 3 clients are ready for review and export."
            action={{ label: "View reports", onClick: () => navigate("/reports") }}
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
                <p className="text-2xl font-bold">8</p>
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
                <p className="text-2xl font-bold">156</p>
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
                <p className="text-2xl font-bold">24</p>
                <p className="text-sm text-muted-foreground">Reports Generated</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-2.5">
                <Wallet className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">Bank Accounts</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
