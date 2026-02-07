import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportTransaction } from "@/hooks/useReportData";

interface Props {
  transactions: ReportTransaction[];
  formatCurrency: (amount: number) => string;
}

export function ReportTransactionsTable({ transactions, formatCurrency }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-12">
        <p className="text-sm text-muted-foreground">No transactions found for this period</p>
      </div>
    );
  }

  let runningBalance = 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead>Description</TableHead>
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
