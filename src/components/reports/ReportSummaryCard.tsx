import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Scale,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  ShieldCheck,
  PiggyBank,
} from "lucide-react";
import type { ReportSummary, AccountBalance } from "@/hooks/useReportData";

interface ReportSummaryCardProps {
  summary: ReportSummary;
  clientName: string;
  formatCurrency: (amount: number) => string;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  colorClass?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className={`h-4 w-4 ${colorClass || ""}`} />
        {label}
      </div>
      <p className={`text-2xl font-bold ${colorClass || ""}`}>{value}</p>
    </div>
  );
}

function AccountList({
  title,
  accounts,
  formatCurrency,
}: {
  title: string;
  accounts: AccountBalance[];
  formatCurrency: (amount: number) => string;
}) {
  if (accounts.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h4>
      <div className="space-y-1">
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between text-sm">
            <span className="truncate">
              <span className="font-mono text-xs text-muted-foreground mr-2">{a.code}</span>
              {a.name}
            </span>
            <span
              className={`font-medium tabular-nums ${
                a.balance >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {formatCurrency(Math.abs(a.balance))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBreakdown({
  title,
  data,
  colorClass,
  formatCurrency,
}: {
  title: string;
  data: Record<string, number>;
  colorClass: string;
  formatCurrency: (amount: number) => string;
}) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h4>
      <div className="space-y-1">
        {entries.map(([cat, amt]) => (
          <div key={cat} className="flex items-center justify-between text-sm">
            <span className="truncate">{cat}</span>
            <span className={`font-medium tabular-nums ${colorClass}`}>
              {formatCurrency(amt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── P&L Summary ──────────────────────────────────────────────────────────────

function PnLSummary({
  summary,
  formatCurrency,
}: {
  summary: ReportSummary;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Total Income" value={formatCurrency(summary.totalIncome)} icon={TrendingUp} colorClass="text-accent" />
        <MetricCard label="Total Expenses" value={formatCurrency(summary.totalExpenses)} icon={TrendingDown} colorClass="text-destructive" />
        <MetricCard
          label="Net Profit/Loss"
          value={formatCurrency(summary.netProfitLoss)}
          icon={DollarSign}
          colorClass={summary.netProfitLoss >= 0 ? "text-success" : "text-destructive"}
        />
        <MetricCard label="Transactions" value={String(summary.transactionCount)} icon={Receipt} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 mt-6 pt-4 border-t">
        <CategoryBreakdown title="Income by Category" data={summary.incomeByCategory} colorClass="text-accent" formatCurrency={formatCurrency} />
        <CategoryBreakdown title="Expenses by Category" data={summary.expenseByCategory} colorClass="text-destructive" formatCurrency={formatCurrency} />
      </div>
    </>
  );
}

// ─── Balance Sheet Summary ────────────────────────────────────────────────────

function BalanceSheetSummary({
  summary,
  formatCurrency,
}: {
  summary: ReportSummary;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Assets" value={formatCurrency(summary.totalAssets)} icon={Landmark} colorClass="text-accent" />
        <MetricCard label="Total Liabilities" value={formatCurrency(summary.totalLiabilities)} icon={ShieldCheck} colorClass="text-destructive" />
        <MetricCard label="Total Equity" value={formatCurrency(summary.totalEquity)} icon={PiggyBank} colorClass="text-primary" />
      </div>
      <div className="mt-4 pt-3 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Assets − Liabilities</span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(summary.totalAssets - summary.totalLiabilities)}
          </span>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-3 mt-6 pt-4 border-t">
        <AccountList title="Assets" accounts={summary.assetAccounts} formatCurrency={formatCurrency} />
        <AccountList title="Liabilities" accounts={summary.liabilityAccounts} formatCurrency={formatCurrency} />
        <AccountList title="Equity" accounts={summary.equityAccounts} formatCurrency={formatCurrency} />
      </div>
    </>
  );
}

// ─── Cash Flow Summary ────────────────────────────────────────────────────────

function CashFlowSummary({
  summary,
  formatCurrency,
}: {
  summary: ReportSummary;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Cash Inflows" value={formatCurrency(summary.cashInflows)} icon={ArrowDownLeft} colorClass="text-accent" />
        <MetricCard label="Cash Outflows" value={formatCurrency(summary.cashOutflows)} icon={ArrowUpRight} colorClass="text-destructive" />
        <MetricCard
          label="Net Cash"
          value={formatCurrency(summary.netCash)}
          icon={Wallet}
          colorClass={summary.netCash >= 0 ? "text-success" : "text-destructive"}
        />
        <MetricCard label="Transactions" value={String(summary.transactionCount)} icon={Receipt} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 mt-6 pt-4 border-t">
        <CategoryBreakdown title="Inflows by Category" data={summary.inflowsByCategory} colorClass="text-accent" formatCurrency={formatCurrency} />
        <CategoryBreakdown title="Outflows by Category" data={summary.outflowsByCategory} colorClass="text-destructive" formatCurrency={formatCurrency} />
      </div>
    </>
  );
}

// ─── Monthly Summary ──────────────────────────────────────────────────────────

function MonthlySummaryView({
  summary,
  formatCurrency,
}: {
  summary: ReportSummary;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Income" value={formatCurrency(summary.totalIncome)} icon={TrendingUp} colorClass="text-accent" />
        <MetricCard label="Total Expenses" value={formatCurrency(summary.totalExpenses)} icon={TrendingDown} colorClass="text-destructive" />
        <MetricCard
          label="Net Profit/Loss"
          value={formatCurrency(summary.netProfitLoss)}
          icon={DollarSign}
          colorClass={summary.netProfitLoss >= 0 ? "text-success" : "text-destructive"}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3 mt-4 pt-4 border-t">
        <MetricCard label="Total Assets" value={formatCurrency(summary.totalAssets)} icon={Landmark} colorClass="text-accent" />
        <MetricCard label="Total Liabilities" value={formatCurrency(summary.totalLiabilities)} icon={ShieldCheck} colorClass="text-destructive" />
        <MetricCard
          label="Net Cash"
          value={formatCurrency(summary.netCash)}
          icon={Wallet}
          colorClass={summary.netCash >= 0 ? "text-success" : "text-destructive"}
        />
      </div>
      <div className="mt-4 pt-3 border-t text-sm text-muted-foreground text-center">
        {summary.transactionCount} transactions in period
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const reportTitles: Record<string, string> = {
  pnl: "Profit & Loss",
  balance: "Balance Sheet",
  cashflow: "Cash Flow Statement",
  monthly: "Monthly Summary",
};

export function ReportSummaryCard({ summary, clientName, formatCurrency }: ReportSummaryCardProps) {
  const title = reportTitles[summary.reportType] || "Report Summary";

  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="font-semibold mb-4">
        {title} — {clientName}
      </h3>
      {summary.reportType === "pnl" && (
        <PnLSummary summary={summary} formatCurrency={formatCurrency} />
      )}
      {summary.reportType === "balance" && (
        <BalanceSheetSummary summary={summary} formatCurrency={formatCurrency} />
      )}
      {summary.reportType === "cashflow" && (
        <CashFlowSummary summary={summary} formatCurrency={formatCurrency} />
      )}
      {summary.reportType === "monthly" && (
        <MonthlySummaryView summary={summary} formatCurrency={formatCurrency} />
      )}
    </div>
  );
}
