import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportData, ReportTransaction } from "@/hooks/useReportData";

interface ExportOptions {
  reportTitle: string;
  clientName: string;
  dateRange: string;
  formatCurrency: (amount: number) => string;
}

function buildRows(
  transactions: ReportTransaction[],
  formatCurrency: (amount: number) => string
) {
  let runningBalance = 0;
  return transactions.map((t) => {
    const income = t.type === "income" ? Number(t.amount) : 0;
    const expense = t.type === "expense" ? Number(t.amount) : 0;
    runningBalance += income - expense;

    return {
      Date: t.date,
      Description: t.description,
      Income: income > 0 ? formatCurrency(income) : "",
      Expense: expense > 0 ? formatCurrency(expense) : "",
      Balance: formatCurrency(runningBalance),
    };
  });
}

export function exportToExcel(data: ReportData, options: ExportOptions) {
  const { reportTitle, clientName, dateRange, formatCurrency } = options;

  // Summary sheet
  const summaryRows = [
    ["Report", reportTitle],
    ["Client", clientName],
    ["Period", dateRange],
    [],
    ["Metric", "Amount"],
    ["Total Income", formatCurrency(data.summary.totalIncome)],
    ["Total Expenses", formatCurrency(data.summary.totalExpenses)],
    ["Net Income", formatCurrency(data.summary.netIncome)],
    ["Total Transactions", String(data.summary.transactionCount)],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);

  // Transactions sheet
  const rows = buildRows(data.transactions, formatCurrency);
  const ws2 = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws2["!cols"] = [
    { wch: 12 },
    { wch: 40 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");
  XLSX.utils.book_append_sheet(wb, ws2, "Transactions");

  const fileName = `${reportTitle.replace(/\s+/g, "_")}_${clientName.replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportToPDF(data: ReportData, options: ExportOptions) {
  const { reportTitle, clientName, dateRange, formatCurrency } = options;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(reportTitle, pageWidth / 2, 20, { align: "center" });

  // Subtitle
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Client: ${clientName}`, pageWidth / 2, 28, { align: "center" });
  doc.text(`Period: ${dateRange}`, pageWidth / 2, 34, { align: "center" });

  // Summary box
  doc.setDrawColor(200);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 42, pageWidth - 28, 36, 3, 3, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const summaryY = 52;
  const colW = (pageWidth - 28) / 4;

  const summaryItems = [
    { label: "Total Income", value: formatCurrency(data.summary.totalIncome) },
    { label: "Total Expenses", value: formatCurrency(data.summary.totalExpenses) },
    { label: "Net Income", value: formatCurrency(data.summary.netIncome) },
    { label: "Transactions", value: String(data.summary.transactionCount) },
  ];

  summaryItems.forEach((item, i) => {
    const x = 14 + colW * i + colW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(item.label, x, summaryY, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(item.value, x, summaryY + 10, { align: "center" });
  });

  // Transactions table
  let runningBalance = 0;
  const tableData = data.transactions.map((t) => {
    const income = t.type === "income" ? Number(t.amount) : 0;
    const expense = t.type === "expense" ? Number(t.amount) : 0;
    runningBalance += income - expense;

    return [
      t.date,
      t.description,
      income > 0 ? formatCurrency(income) : "",
      expense > 0 ? formatCurrency(expense) : "",
      formatCurrency(runningBalance),
    ];
  });

  autoTable(doc, {
    startY: 84,
    head: [["Date", "Description", "Income", "Expense", "Balance"]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 65 },
      2: { halign: "right", cellWidth: 28 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 28 },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (hookData) => {
      // Footer
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Page ${hookData.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    },
  });

  const fileName = `${reportTitle.replace(/\s+/g, "_")}_${clientName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}
