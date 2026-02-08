import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileBarChart,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  TrendingUp,
  Scale,
  Wallet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useReportData, getPeriodLabel, type ReportType } from "@/hooks/useReportData";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { ReportTransactionsTable } from "@/components/reports/ReportTransactionsTable";
import { exportToExcel, exportToPDF } from "@/lib/report-export";

interface Client {
  id: string;
  name: string;
}

const reportTypes = [
  {
    id: "pnl",
    name: "Profit & Loss",
    description: "Income and expenses for the period",
    icon: TrendingUp,
  },
  {
    id: "balance",
    name: "Balance Sheet",
    description: "Assets, liabilities, and equity snapshot",
    icon: Scale,
  },
  {
    id: "cashflow",
    name: "Cash Flow Statement",
    description: "Cash inflows and outflows (direct method)",
    icon: Wallet,
  },
  {
    id: "monthly",
    name: "Monthly Summary",
    description: "Comprehensive monthly financial overview",
    icon: FileBarChart,
  },
];

const periods = [
  { value: "current-month", label: "Current Month" },
  { value: "last-month", label: "Last Month" },
  { value: "current-quarter", label: "Current Quarter" },
  { value: "last-quarter", label: "Last Quarter" },
  { value: "ytd", label: "Year to Date" },
  { value: "last-year", label: "Last Year" },
];

export default function ReportsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState("current-month");
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const { reportData, loading: reportLoading, fetchReport } = useReportData();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) navigate("/auth");
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        fetchClients();
      }
      setPageLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name")
      .order("name");

    if (!error && data) {
      setClients(data);
      if (data.length > 0) {
        setSelectedClient(data[0].id);
      }
    }
  };

  const handleGenerateReport = useCallback(
    async (reportId: string) => {
      if (!selectedClient) {
        toast.error("Please select a client first");
        return;
      }

      setGeneratingId(reportId);
      const result = await fetchReport(
        selectedClient,
        selectedPeriod,
        reportId as ReportType
      );
      setGeneratingId(null);

      if (result) {
        setActiveReport(reportId);
        const reportName = reportTypes.find((r) => r.id === reportId)?.name;
        const countLabel =
          reportId === "balance"
            ? `${result.summary.assetAccounts.length + result.summary.liabilityAccounts.length + result.summary.equityAccounts.length} accounts`
            : `${result.summary.transactionCount} transactions`;
        toast.success(`${reportName} generated — ${countLabel}`);
      } else {
        toast.error("Failed to generate report");
      }
    },
    [selectedClient, selectedPeriod, fetchReport]
  );

  const getExportOptions = useCallback(
    (reportId?: string) => {
      const clientName = clients.find((c) => c.id === selectedClient)?.name || "Unknown";
      const reportTitle = reportTypes.find((r) => r.id === (reportId || activeReport))?.name || "Financial Report";
      const dateRange = getPeriodLabel(selectedPeriod);

      return { reportTitle, clientName, dateRange, formatCurrency };
    },
    [selectedClient, selectedPeriod, activeReport, clients, formatCurrency]
  );

  const handleExportExcel = useCallback(
    async (reportId?: string) => {
      const rid = reportId || activeReport || "pnl";
      let data = reportData;
      if (!data || (reportData && reportData.summary.reportType !== rid)) {
        if (!selectedClient) {
          toast.error("Please select a client first");
          return;
        }
        data = await fetchReport(selectedClient, selectedPeriod, rid as ReportType);
      }
      if (!data) {
        toast.error("No data to export");
        return;
      }

      try {
        exportToExcel(data, getExportOptions(reportId));
        toast.success("Excel file downloaded");
      } catch {
        toast.error("Failed to export Excel");
      }
    },
    [reportData, selectedClient, selectedPeriod, activeReport, fetchReport, getExportOptions]
  );

  const handleExportPDF = useCallback(
    async (reportId?: string) => {
      const rid = reportId || activeReport || "pnl";
      let data = reportData;
      if (!data || (reportData && reportData.summary.reportType !== rid)) {
        if (!selectedClient) {
          toast.error("Please select a client first");
          return;
        }
        data = await fetchReport(selectedClient, selectedPeriod, rid as ReportType);
      }
      if (!data) {
        toast.error("No data to export");
        return;
      }

      try {
        exportToPDF(data, getExportOptions(reportId));
        toast.success("PDF file downloaded");
      } catch {
        toast.error("Failed to export PDF");
      }
    },
    [reportData, selectedClient, selectedPeriod, activeReport, fetchReport, getExportOptions]
  );

  const selectedClientData = clients.find((c) => c.id === selectedClient);

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">
              Generate financial reports and statements
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExportExcel()}
              disabled={!reportData || reportLoading}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportPDF()}
              disabled={!reportData || reportLoading}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClient && (
            <p className="text-xs text-muted-foreground ml-1">
              {getPeriodLabel(selectedPeriod)}
            </p>
          )}
        </div>

        {/* Report Types */}
        {!selectedClient ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FileBarChart className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No client selected</h3>
            <p className="text-sm text-muted-foreground">
              Select a client to generate reports
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {reportTypes.map((report) => {
              const isActive = activeReport === report.id;
              const isGenerating = generatingId === report.id;

              return (
                <div
                  key={report.id}
                  className={`group rounded-xl border bg-card p-6 transition-all hover:shadow-md ${
                    isActive ? "ring-2 ring-primary/40" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-3">
                      <report.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{report.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {report.description}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleGenerateReport(report.id)}
                          disabled={isGenerating || reportLoading}
                        >
                          {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          {isGenerating ? "Generating…" : "Generate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExportPDF(report.id)}
                          disabled={reportLoading}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Summary — live data */}
        {selectedClient && reportData && (
          <ReportSummaryCard
            summary={reportData.summary}
            clientName={selectedClientData?.name || ""}
            formatCurrency={formatCurrency}
          />
        )}

        {/* Transactions Table */}
        {selectedClient && reportData && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {reportData.summary.reportType === "balance"
                  ? "Account Details"
                  : `Transactions (${reportData.transactions.length})`}
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleExportExcel()}>
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                  Excel
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleExportPDF()}>
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  PDF
                </Button>
              </div>
            </div>
            <ReportTransactionsTable
              transactions={reportData.transactions}
              formatCurrency={formatCurrency}
              reportType={reportData.summary.reportType}
            />
          </div>
        )}

        {/* Loading state */}
        {reportLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Fetching transactions…</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
