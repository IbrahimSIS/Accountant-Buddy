import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportTransaction, ReportType } from "@/hooks/useReportData";

interface Props {
  transactions: ReportTransaction[];
  formatCurrency: (amount: number) => string;
  reportType?: ReportType;
}

export function ReportTransactionsTable({ transactions, formatCurrency, reportType }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-12">
        <p className="text-sm text-muted-foreground">
          {reportType === "balance"
            ? "Balance Sheet displays account balances above — no transaction rows"
            : "No transactions found for this period"}
        </p>
      </div>
    );
  }

  // Cash Flow uses Inflow / Outflow / Net Cash columns
  if (reportType === "cashflow") {
    let runningNet = 0;
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right w-[130px]">Inflow</TableHead>
              <TableHead className="text-right w-[130px]">Outflow</TableHead>
              <TableHead className="text-right w-[130px]">Net Cash</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => {
              const inflow = t.type === "income" ? Number(t.amount) : 0;
              const outflow = t.type === "expense" ? Number(t.amount) : 0;
              runningNet += inflow - outflow;

              return (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.date}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.category_name || "Uncategorized"}</TableCell>
                  <TableCell className="text-right text-accent font-medium">
                    {inflow > 0 ? formatCurrency(inflow) : ""}
                  </TableCell>
                  <TableCell className="text-right text-destructive font-medium">
                    {outflow > 0 ? formatCurrency(outflow) : ""}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${runningNet >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(runningNet)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Default: P&L / Monthly — Income / Expense / Balance columns
  let runningBalance = 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right w-[130px]">Income</TableHead>
            <TableHead className="text-right w-[130px]">Expense</TableHead>
            <TableHead className="text-right w-[130px]">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => {
            const income = t.type === "income" ? Number(t.amount) : 0;
            const expense = t.type === "expense" ? Number(t.amount) : 0;
            runningBalance += income - expense;

            return (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.date}</TableCell>
                <TableCell>{t.description}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.category_name || "Uncategorized"}</TableCell>
                <TableCell className="text-right text-accent font-medium">
                  {income > 0 ? formatCurrency(income) : ""}
                </TableCell>
                <TableCell className="text-right text-destructive font-medium">
                  {expense > 0 ? formatCurrency(expense) : ""}
                </TableCell>
                <TableCell className={`text-right font-medium ${runningBalance >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(runningBalance)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
