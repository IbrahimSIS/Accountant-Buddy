import { TrendingUp, TrendingDown, DollarSign, Receipt } from "lucide-react";
import type { ReportSummary } from "@/hooks/useReportData";

interface ReportSummaryCardProps {
  summary: ReportSummary;
  clientName: string;
  formatCurrency: (amount: number) => string;
}

export function ReportSummaryCard({ summary, clientName, formatCurrency }: ReportSummaryCardProps) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="font-semibold mb-4">Quick Summary — {clientName}</h3>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-accent" />
            Total Income
          </div>
          <p className="text-2xl font-bold text-accent">
            {formatCurrency(summary.totalIncome)}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" />
            Total Expenses
          </div>
          <p className="text-2xl font-bold text-destructive">
            {formatCurrency(summary.totalExpenses)}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4 text-success" />
            Net Income
          </div>
          <p className={`text-2xl font-bold ${summary.netIncome >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(summary.netIncome)}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" />
            Transactions
          </div>
          <p className="text-2xl font-bold">{summary.transactionCount}</p>
        </div>
      </div>
    </div>
  );
}
