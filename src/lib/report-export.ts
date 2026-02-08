import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportData, ReportTransaction, AccountBalance } from "@/hooks/useReportData";

interface ExportOptions {
  reportTitle: string;
  clientName: string;
  dateRange: string;
  formatCurrency: (amount: number) => string;
}

// ─── Excel helpers ────────────────────────────────────────────────────────────

function buildPnLRows(txns: ReportTransaction[], fc: (n: number) => string) {
  let bal = 0;
  return txns.map((t) => {
    const inc = t.type === "income" ? Number(t.amount) : 0;
    const exp = t.type === "expense" ? Number(t.amount) : 0;
    bal += inc - exp;
    return {
      Date: t.date, Description: t.description,
      Category: t.category_name || "Uncategorized",
      Income: inc > 0 ? fc(inc) : "", Expense: exp > 0 ? fc(exp) : "",
      Balance: fc(bal),
    };
  });
}

function buildCashFlowRows(txns: ReportTransaction[], fc: (n: number) => string) {
  let net = 0;
  return txns.map((t) => {
    const inf = t.type === "income" ? Number(t.amount) : 0;
    const out = t.type === "expense" ? Number(t.amount) : 0;
    net += inf - out;
    return {
      Date: t.date, Description: t.description,
      Category: t.category_name || "Uncategorized",
      Inflow: inf > 0 ? fc(inf) : "", Outflow: out > 0 ? fc(out) : "",
      "Net Cash": fc(net),
    };
  });
}

function buildAccountRows(accounts: AccountBalance[], fc: (n: number) => string) {
  return accounts.map((a) => ({
    Code: a.code, Name: a.name, Type: a.type,
    Balance: fc(a.balance),
  }));
}

function summaryRowsForType(data: ReportData, fc: (n: number) => string): (string | number)[][] {
  const s = data.summary;
  switch (s.reportType) {
    case "pnl":
      return [
        ["Total Income", fc(s.totalIncome)],
        ["Total Expenses", fc(s.totalExpenses)],
        ["Net Profit/Loss", fc(s.netProfitLoss)],
        ["Transactions", String(s.transactionCount)],
      ];
    case "balance":
      return [
        ["Total Assets", fc(s.totalAssets)],
        ["Total Liabilities", fc(s.totalLiabilities)],
        ["Total Equity", fc(s.totalEquity)],
        ["Assets − Liabilities", fc(s.totalAssets - s.totalLiabilities)],
      ];
    case "cashflow":
      return [
        ["Cash Inflows", fc(s.cashInflows)],
        ["Cash Outflows", fc(s.cashOutflows)],
        ["Net Cash", fc(s.netCash)],
        ["Transactions", String(s.transactionCount)],
      ];
    case "monthly":
      return [
        ["Total Income", fc(s.totalIncome)],
        ["Total Expenses", fc(s.totalExpenses)],
        ["Net Profit/Loss", fc(s.netProfitLoss)],
        ["Total Assets", fc(s.totalAssets)],
        ["Total Liabilities", fc(s.totalLiabilities)],
        ["Net Cash", fc(s.netCash)],
        ["Transactions", String(s.transactionCount)],
      ];
  }
}

// ─── Excel export ─────────────────────────────────────────────────────────────

export function exportToExcel(data: ReportData, options: ExportOptions) {
  const { reportTitle, clientName, dateRange, formatCurrency: fc } = options;
  const rt = data.summary.reportType;

  const header: (string | number)[][] = [
    ["Report", reportTitle],
    ["Client", clientName],
    ["Period", dateRange],
    [],
    ["Metric", "Amount"],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([...header, ...summaryRowsForType(data, fc)]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  if (rt === "balance") {
    const allAccounts = [
      ...data.summary.assetAccounts,
      ...data.summary.liabilityAccounts,
      ...data.summary.equityAccounts,
    ];
    const ws2 = XLSX.utils.json_to_sheet(buildAccountRows(allAccounts, fc));
    ws2["!cols"] = [{ wch: 10 }, { wch: 36 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Accounts");
  } else if (rt === "cashflow") {
    const ws2 = XLSX.utils.json_to_sheet(buildCashFlowRows(data.transactions, fc));
    ws2["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Transactions");
  } else {
    const ws2 = XLSX.utils.json_to_sheet(buildPnLRows(data.transactions, fc));
    ws2["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Transactions");
  }

  const fileName = `${reportTitle.replace(/\s+/g, "_")}_${clientName.replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────

function pdfHeader(
  doc: jsPDF,
  pageWidth: number,
  title: string,
  clientName: string,
  dateRange: string
) {
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 20, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Client: ${clientName}`, pageWidth / 2, 28, { align: "center" });
  doc.text(`Period: ${dateRange}`, pageWidth / 2, 34, { align: "center" });
}

function pdfSummaryBox(
  doc: jsPDF,
  pageWidth: number,
  items: { label: string; value: string }[]
) {
  doc.setDrawColor(200);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 42, pageWidth - 28, 36, 3, 3, "FD");

  const colW = (pageWidth - 28) / items.length;
  const summaryY = 52;

  items.forEach((item, i) => {
    const x = 14 + colW * i + colW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(item.label, x, summaryY, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(item.value, x, summaryY + 10, { align: "center" });
  });
}

function pdfFooter(doc: jsPDF, pageWidth: number) {
  return (hookData: { pageNumber: number }) => {
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${hookData.pageNumber} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  };
}

const tableDefaults = {
  styles: { fontSize: 8, cellPadding: 2 } as const,
  headStyles: { fillColor: [30, 58, 95] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
  alternateRowStyles: { fillColor: [245, 247, 250] as [number, number, number] },
  margin: { left: 14, right: 14 },
};

// ─── PDF export ───────────────────────────────────────────────────────────────

export function exportToPDF(data: ReportData, options: ExportOptions) {
  const { reportTitle, clientName, dateRange, formatCurrency: fc } = options;
  const rt = data.summary.reportType;
  const s = data.summary;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  pdfHeader(doc, pageWidth, reportTitle, clientName, dateRange);

  // Summary items per report type
  let summaryItems: { label: string; value: string }[];
  switch (rt) {
    case "pnl":
      summaryItems = [
        { label: "Total Income", value: fc(s.totalIncome) },
        { label: "Total Expenses", value: fc(s.totalExpenses) },
        { label: "Net Profit/Loss", value: fc(s.netProfitLoss) },
        { label: "Transactions", value: String(s.transactionCount) },
      ];
      break;
    case "balance":
      summaryItems = [
        { label: "Total Assets", value: fc(s.totalAssets) },
        { label: "Total Liabilities", value: fc(s.totalLiabilities) },
        { label: "Total Equity", value: fc(s.totalEquity) },
      ];
      break;
    case "cashflow":
      summaryItems = [
        { label: "Cash Inflows", value: fc(s.cashInflows) },
        { label: "Cash Outflows", value: fc(s.cashOutflows) },
        { label: "Net Cash", value: fc(s.netCash) },
        { label: "Transactions", value: String(s.transactionCount) },
      ];
      break;
    case "monthly":
      summaryItems = [
        { label: "Income", value: fc(s.totalIncome) },
        { label: "Expenses", value: fc(s.totalExpenses) },
        { label: "Net P/L", value: fc(s.netProfitLoss) },
        { label: "Net Cash", value: fc(s.netCash) },
      ];
      break;
  }
  pdfSummaryBox(doc, pageWidth, summaryItems);

  // Table per report type
  if (rt === "balance") {
    const allAccounts = [
      ...s.assetAccounts,
      ...s.liabilityAccounts,
      ...s.equityAccounts,
    ];
    const body = allAccounts.map((a) => [a.code, a.name, a.type, fc(a.balance)]);
    autoTable(doc, {
      startY: 84,
      head: [["Code", "Account Name", "Type", "Balance"]],
      body,
      ...tableDefaults,
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 60 },
        2: { cellWidth: 30 },
        3: { halign: "right", cellWidth: 30 },
      },
      didDrawPage: pdfFooter(doc, pageWidth),
    });
  } else if (rt === "cashflow") {
    let net = 0;
    const body = data.transactions.map((t) => {
      const inf = t.type === "income" ? Number(t.amount) : 0;
      const out = t.type === "expense" ? Number(t.amount) : 0;
      net += inf - out;
      return [
        t.date, t.description, t.category_name || "Uncategorized",
        inf > 0 ? fc(inf) : "", out > 0 ? fc(out) : "", fc(net),
      ];
    });
    autoTable(doc, {
      startY: 84,
      head: [["Date", "Description", "Category", "Inflow", "Outflow", "Net Cash"]],
      body,
      ...tableDefaults,
      columnStyles: {
        0: { cellWidth: 20 }, 1: { cellWidth: 45 }, 2: { cellWidth: 30 },
        3: { halign: "right", cellWidth: 24 }, 4: { halign: "right", cellWidth: 24 },
        5: { halign: "right", cellWidth: 24 },
      },
      didDrawPage: pdfFooter(doc, pageWidth),
    });
  } else {
    // P&L and Monthly use income/expense/balance columns
    let bal = 0;
    const body = data.transactions.map((t) => {
      const inc = t.type === "income" ? Number(t.amount) : 0;
      const exp = t.type === "expense" ? Number(t.amount) : 0;
      bal += inc - exp;
      return [
        t.date, t.description, t.category_name || "Uncategorized",
        inc > 0 ? fc(inc) : "", exp > 0 ? fc(exp) : "", fc(bal),
      ];
    });
    autoTable(doc, {
      startY: 84,
      head: [["Date", "Description", "Category", "Income", "Expense", "Balance"]],
      body,
      ...tableDefaults,
      columnStyles: {
        0: { cellWidth: 20 }, 1: { cellWidth: 45 }, 2: { cellWidth: 30 },
        3: { halign: "right", cellWidth: 24 }, 4: { halign: "right", cellWidth: 24 },
        5: { halign: "right", cellWidth: 24 },
      },
      didDrawPage: pdfFooter(doc, pageWidth),
    });
  }

  const fileName = `${reportTitle.replace(/\s+/g, "_")}_${clientName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}
