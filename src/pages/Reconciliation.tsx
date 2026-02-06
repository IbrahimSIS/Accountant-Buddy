import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseClient as supabase } from "@/lib/supabase-client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from "@/components/ui/dialog";
import {
  Scale,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  FileText,
   Building2,
   CreditCard,
   Users,
   Sparkles,
} from "lucide-react";
 import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";
import { BankSelector } from "@/components/reconciliation/BankSelector";
 import { IBANInput } from "@/components/clients/IBANInput";
import { Label } from "@/components/ui/label";
 import { useClientIBANMatch } from "@/hooks/useClientIBANMatch";
 import { useCurrency } from "@/contexts/CurrencyContext";
 import { cn } from "@/lib/utils";
 import { format } from "date-fns";

interface Client {
  id: string;
  name: string;
   bank_id: string | null;
   iban: string | null;
}

interface BankAccount {
  id: string;
  name: string;
  opening_balance: number;
  bank_id: string | null;
   iban: string | null;
 }
 
 interface Transaction {
   id: string;
   date: string;
   description: string;
   amount: number;
   type: string;
   external_ref: string | null;
   is_reconciled: boolean;
}

export default function ReconciliationPage() {
  const [_session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
   const [transactions, setTransactions] = useState<Transaction[]>([]);
   const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
   const [newAccountForm, setNewAccountForm] = useState({
     name: "",
     bank_id: "",
     iban: "",
     opening_balance: "",
   });
  const navigate = useNavigate();
   const { findClientByIBAN, clients: clientsWithIBAN } = useClientIBANMatch();
   const { formatCurrency } = useCurrency();

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
       // Auto-select bank if client has a linked bank
       const client = clients.find(c => c.id === selectedClient);
       if (client?.bank_id && !selectedBankId) {
         setSelectedBankId(client.bank_id);
       }
    }
   }, [selectedClient, clients]);
 
   useEffect(() => {
     if (selectedAccount) {
       fetchTransactions();
     }
   }, [selectedAccount]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
       .select("id, name, bank_id, iban")
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
       .select("id, name, opening_balance, bank_id, iban")
      .eq("client_id", selectedClient)
      .order("name");

    if (!error && data) {
      setBankAccounts(data);
       // Auto-select first account if only one exists
       if (data.length === 1 && !selectedAccount) {
         setSelectedAccount(data[0].id);
       }
    }
  };

   const fetchTransactions = async () => {
     if (!selectedClient || !selectedAccount) return;
 
     const { data, error } = await supabase
       .from("transactions")
       .select("id, date, description, amount, type, external_ref, is_reconciled")
       .eq("client_id", selectedClient)
       .eq("bank_account_id", selectedAccount)
       .order("date", { ascending: false })
       .limit(50);
 
     if (!error && data) {
       setTransactions(data);
     }
   };
 
   const handleAddBankAccount = async () => {
     if (!newAccountForm.name.trim() || !newAccountForm.bank_id) {
       toast.error("Please fill in all required fields");
       return;
     }
 
     const { error } = await supabase.from("bank_accounts").insert({
       client_id: selectedClient,
       name: newAccountForm.name.trim(),
       bank_id: newAccountForm.bank_id,
       iban: newAccountForm.iban || null,
       opening_balance: parseFloat(newAccountForm.opening_balance) || 0,
     });
 
     if (error) {
       toast.error("Failed to create bank account");
     } else {
       toast.success("Bank account created");
       setIsAddAccountOpen(false);
       setNewAccountForm({ name: "", bank_id: "", iban: "", opening_balance: "" });
       fetchBankAccounts();
     }
   };
 
   const selectedClientData = clients.find(c => c.id === selectedClient);
   const selectedAccountData = bankAccounts.find(a => a.id === selectedAccount);
 
   // Get suggested client match for a transaction based on IBAN
   const getSuggestedClient = (transaction: Transaction): { id: string; name: string } | null => {
     // Check if transaction has an external ref that looks like an IBAN
     if (transaction.external_ref) {
       const match = findClientByIBAN(transaction.external_ref);
       if (match) {
         return { id: match.id, name: match.name };
       }
     }
     return null;
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
           <div className="flex gap-2">
             <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
               <DialogTrigger asChild>
                 <Button variant="outline" disabled={!selectedClient}>
                   <CreditCard className="mr-2 h-4 w-4" />
                   Add Bank Account
                 </Button>
               </DialogTrigger>
               <DialogContent className="sm:max-w-[425px]">
                 <DialogHeader>
                   <DialogTitle>Add Bank Account</DialogTitle>
                   <DialogDescription>
                     Create a new bank account for {selectedClientData?.name}
                   </DialogDescription>
                 </DialogHeader>
                 <div className="grid gap-4 py-4">
                   <div className="space-y-2">
                     <Label htmlFor="accountName">Account Name *</Label>
                     <Input
                       id="accountName"
                       value={newAccountForm.name}
                       onChange={(e) =>
                         setNewAccountForm({ ...newAccountForm, name: e.target.value })
                       }
                       placeholder="e.g., Main Business Account"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Bank *</Label>
                     <BankSelector
                       value={newAccountForm.bank_id}
                       onValueChange={(value) =>
                         setNewAccountForm({ ...newAccountForm, bank_id: value })
                       }
                       rememberChoice={false}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>IBAN / Account Number</Label>
                     <IBANInput
                       value={newAccountForm.iban}
                       onChange={(value) =>
                         setNewAccountForm({ ...newAccountForm, iban: value })
                       }
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="openingBalance">Opening Balance</Label>
                     <Input
                       id="openingBalance"
                       type="number"
                       step="0.01"
                       value={newAccountForm.opening_balance}
                       onChange={(e) =>
                         setNewAccountForm({ ...newAccountForm, opening_balance: e.target.value })
                       }
                       placeholder="0.00"
                     />
                   </div>
                 </div>
                 <DialogFooter>
                   <Button variant="outline" onClick={() => setIsAddAccountOpen(false)}>
                     Cancel
                   </Button>
                   <Button onClick={handleAddBankAccount}>
                     <Plus className="mr-2 h-4 w-4" />
                     Add Account
                   </Button>
                 </DialogFooter>
               </DialogContent>
             </Dialog>
             <Button disabled={!selectedAccount}>
               <Plus className="mr-2 h-4 w-4" />
               New Reconciliation
             </Button>
           </div>
        </div>

         {/* Client Bank Info Card */}
         {selectedClientData && (selectedClientData.bank_id || selectedClientData.iban) && (
           <div className="rounded-lg border bg-card p-4">
             <div className="flex items-center gap-3">
               <div className="rounded-lg bg-primary/10 p-2">
                 <Building2 className="h-5 w-5 text-primary" />
               </div>
               <div className="flex-1">
                 <p className="text-sm font-medium">Client Bank Details</p>
                 <p className="text-sm text-muted-foreground">
                   {selectedClientData.iban
                     ? `IBAN: ${selectedClientData.iban.replace(/(.{4})/g, "$1 ").trim()}`
                     : "No IBAN on file"}
                 </p>
               </div>
             </div>
           </div>
         )}
 
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
                       {account.name} {account.iban && `(${account.iban.slice(-4)})`}
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
             {selectedClient && bankAccounts.length === 0 && (
               <Button onClick={() => setIsAddAccountOpen(true)}>
                 <Plus className="mr-2 h-4 w-4" />
                 Add Bank Account
               </Button>
             )}
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
                     <p className="text-2xl font-bold">
                       {transactions.filter(t => t.is_reconciled).length}
                     </p>
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
                     <p className="text-2xl font-bold">
                       {transactions.filter(t => !t.is_reconciled).length}
                     </p>
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
                     <p className="text-2xl font-bold">{transactions.length}</p>
                     <p className="text-sm text-muted-foreground">Total Transactions</p>
                  </div>
                </div>
              </div>
            </div>

             {/* Transactions with IBAN Matching */}
             {transactions.length > 0 ? (
               <div className="rounded-xl border bg-card overflow-hidden">
                 <div className="border-b px-6 py-4">
                   <h3 className="font-semibold">Recent Transactions</h3>
                   <p className="text-sm text-muted-foreground">
                     Transactions with matching client IBANs are highlighted
                   </p>
                 </div>
                 <table className="data-table">
                   <thead>
                     <tr>
                       <th>Date</th>
                       <th>Description</th>
                       <th>Suggested Client</th>
                       <th className="text-right">Amount</th>
                       <th>Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     {transactions.map((transaction) => {
                       const suggestedClient = getSuggestedClient(transaction);
                       return (
                         <tr key={transaction.id}>
                           <td className="font-medium">
                             {format(new Date(transaction.date), "MMM d, yyyy")}
                           </td>
                           <td>
                             <div>
                               <span>{transaction.description}</span>
                               {transaction.external_ref && (
                                 <p className="text-xs text-muted-foreground font-mono">
                                   Ref: {transaction.external_ref}
                                 </p>
                               )}
                             </div>
                           </td>
                           <td>
                             {suggestedClient ? (
                               <div className="flex items-center gap-2">
                                 <Sparkles className="h-4 w-4 text-warning" />
                                 <span className="badge-status badge-success">
                                   <Users className="mr-1 h-3 w-3" />
                                   {suggestedClient.name}
                                 </span>
                               </div>
                             ) : (
                               <span className="text-muted-foreground text-sm">—</span>
                             )}
                           </td>
                           <td
                             className={cn(
                               "text-right font-medium",
                               transaction.type === "income" && "text-accent",
                               transaction.type === "expense" && "text-destructive"
                             )}
                           >
                             {transaction.type === "income" ? "+" : "-"}
                             {formatCurrency(transaction.amount)}
                           </td>
                           <td>
                             <span
                               className={cn(
                                 "badge-status",
                                 transaction.is_reconciled
                                   ? "badge-success"
                                   : "badge-warning"
                               )}
                             >
                               {transaction.is_reconciled ? (
                                 <>
                                   <CheckCircle className="mr-1 h-3 w-3" />
                                   Matched
                                 </>
                               ) : (
                                 <>
                                   <XCircle className="mr-1 h-3 w-3" />
                                   Pending
                                 </>
                               )}
                             </span>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             ) : (
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
                     <span>
                       Transactions with matching client IBANs will show{" "}
                       <Sparkles className="inline h-4 w-4 text-warning" /> suggested matches
                     </span>
                   </li>
                   <li className="flex gap-3">
                     <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                       5
                     </span>
                     <span>Complete the reconciliation and export the summary</span>
                   </li>
                 </ol>
               </div>
             )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
