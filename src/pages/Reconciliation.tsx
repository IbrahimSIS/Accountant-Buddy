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
  Scale,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  FileText,
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { BankSelector } from "@/components/reconciliation/BankSelector";
import { Label } from "@/components/ui/label";

interface Client {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  name: string;
  opening_balance: number;
  bank_id: string | null;
}

export default function ReconciliationPage() {
  const [_session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
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

  useEffect(() => {
    if (selectedClient) {
      fetchBankAccounts();
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
       .select("id, name")
      .order("name");

    if (!error && data) {
      setClients(data);
      if (data.length > 0 && !selectedClient) {
        setSelectedClient(data[0].id);
      }
    }
  };

  const fetchBankAccounts = async () => {
    if (!selectedClient) return;

    const { data, error } = await supabase
      .from("bank_accounts")
      .select("id, name, opening_balance, bank_id")
      .eq("client_id", selectedClient)
      .order("name");

    if (!error && data) {
      setBankAccounts(data);
    }
  };

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
            <h1 className="text-2xl font-bold tracking-tight">Bank Reconciliation</h1>
            <p className="text-muted-foreground">
              Match bank statements with ledger transactions
            </p>
          </div>
          <Button disabled={!selectedAccount}>
            <Plus className="mr-2 h-4 w-4" />
            New Reconciliation
          </Button>
        </div>

        {/* Filters */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger>
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
          </div>
          <div className="space-y-2">
            <Label>Bank</Label>
            <BankSelector
              value={selectedBankId}
              onValueChange={setSelectedBankId}
              disabled={!selectedClient}
              rememberChoice={true}
            />
          </div>
          <div className="space-y-2">
            <Label>Bank Account</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts
                  .filter((account) =>
                    selectedBankId ? account.bank_id === selectedBankId : true
                  )
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Empty State */}
        {!selectedClient || bankAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Scale className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {!selectedClient ? "No client selected" : "No bank accounts"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {!selectedClient
                ? "Select a client to start reconciliation"
                : "Add bank accounts to this client first"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-success/10 p-2.5">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">Matched Items</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-warning/10 p-2.5">
                    <XCircle className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">Unmatched Items</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">Completed Runs</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold mb-4">How to Reconcile</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    1
                  </span>
                  <span>Select a bank account and click "New Reconciliation"</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    2
                  </span>
                  <span>Enter the statement period and ending balance from your bank statement</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    3
                  </span>
                  <span>Match transactions from the ledger with your bank statement</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    4
                  </span>
                  <span>Review unmatched items and resolve discrepancies</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    5
                  </span>
                  <span>Complete the reconciliation and export the summary</span>
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
