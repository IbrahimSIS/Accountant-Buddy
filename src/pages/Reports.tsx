import { useEffect, useState } from "react";
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
  TrendingDown,
  Scale,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";

interface Client {
  id: string;
  name: string;
  currency: string;
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
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState("current-month");
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        fetchClients();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, currency")
      .order("name");

    if (!error && data) {
      setClients(data);
      if (data.length > 0 && !selectedClient) {
        setSelectedClient(data[0].id);
      }
    }
  };

  const handleGenerateReport = (reportId: string) => {
    toast.success(`Generating ${reportTypes.find(r => r.id === reportId)?.name} report...`);
  };

  const handleExport = (format: "pdf" | "excel") => {
    toast.success(`Exporting to ${format.toUpperCase()}...`);
  };

  const selectedClientData = clients.find((c) => c.id === selectedClient);

  if (loading) {
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
            <Button variant="outline" onClick={() => handleExport("excel")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button variant="outline" onClick={() => handleExport("pdf")}>
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
            {reportTypes.map((report) => (
              <div
                key={report.id}
                className="group rounded-xl border bg-card p-6 transition-all hover:shadow-md"
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
                      >
                        Generate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport("pdf")}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        {selectedClient && (
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-4">Quick Summary - {selectedClientData?.name}</h3>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-accent">
                  {selectedClientData?.currency} 0
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-destructive">
                  {selectedClientData?.currency} 0
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Net Income</p>
                <p className="text-2xl font-bold text-success">
                  {selectedClientData?.currency} 0
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
