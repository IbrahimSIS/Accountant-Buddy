import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  Search,
  Filter,
  Upload,
  Calendar as CalendarIcon,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  Receipt,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category_id: string | null;
  source: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  currency: string;
}

export default function TransactionsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    date: new Date(),
    description: "",
    amount: "",
    type: "expense",
  });

  useEffect(() => {
    const clientParam = searchParams.get("client");
    if (clientParam) {
      setSelectedClient(clientParam);
    }
  }, [searchParams]);

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
      fetchTransactions();
    }
  }, [selectedClient]);

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

  const fetchTransactions = async () => {
    if (!selectedClient) return;

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("client_id", selectedClient)
      .order("date", { ascending: false });

    if (error) {
      toast.error("Failed to load transactions");
    } else {
      setTransactions(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim() || !formData.amount) {
      toast.error("Description and amount are required");
      return;
    }

    const transactionData = {
      client_id: selectedClient,
      date: format(formData.date, "yyyy-MM-dd"),
      description: formData.description,
      amount: parseFloat(formData.amount),
      type: formData.type,
      source: "manual" as const,
    };

    if (editingTransaction) {
      const { error } = await supabase
        .from("transactions")
        .update(transactionData)
        .eq("id", editingTransaction.id);

      if (error) {
        toast.error("Failed to update transaction");
      } else {
        toast.success("Transaction updated");
        fetchTransactions();
        closeDialog();
      }
    } else {
      const { error } = await supabase.from("transactions").insert(transactionData);

      if (error) {
        toast.error("Failed to create transaction");
      } else {
        toast.success("Transaction added");
        fetchTransactions();
        closeDialog();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete transaction");
    } else {
      toast.success("Transaction deleted");
      fetchTransactions();
    }
  };

  const openEditDialog = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      date: new Date(transaction.date),
      description: transaction.description,
      amount: String(transaction.amount),
      type: transaction.type as "income" | "expense" | "transfer",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTransaction(null);
    setFormData({
      date: new Date(),
      description: "",
      amount: "",
      type: "expense",
    });
  };

  const selectedClientData = clients.find((c) => c.id === selectedClient);

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

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
            <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              View and manage client transactions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={closeDialog} disabled={!selectedClient}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? "Edit Transaction" : "Add Transaction"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTransaction
                      ? "Update the transaction details below."
                      : "Enter the transaction details below."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(formData.date, "PPP")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.date}
                            onSelect={(date) =>
                              date && setFormData({ ...formData, date })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        placeholder="Office supplies purchase"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount *</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) =>
                            setFormData({ ...formData, amount: e.target.value })
                          }
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">Type</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value: "income" | "expense" | "transfer") =>
                            setFormData({ ...formData, type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="transfer">Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingTransaction ? "Save Changes" : "Add Transaction"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
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
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        {selectedClient && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-accent">
                {selectedClientData?.currency} {totalIncome.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-destructive">
                {selectedClientData?.currency} {totalExpenses.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Net</p>
              <p className={cn(
                "text-2xl font-bold",
                totalIncome - totalExpenses >= 0 ? "text-success" : "text-destructive"
              )}>
                {selectedClientData?.currency} {(totalIncome - totalExpenses).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        {!selectedClient ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No client selected</h3>
            <p className="text-sm text-muted-foreground">
              Select a client to view their transactions
            </p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No transactions yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first transaction or import from CSV
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                  <th className="w-[50px]"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="font-medium">
                      {format(new Date(transaction.date), "MMM d, yyyy")}
                    </td>
                    <td>{transaction.description}</td>
                    <td>
                      <span
                        className={cn(
                          "badge-status",
                          transaction.type === "income" && "badge-success",
                          transaction.type === "expense" && "badge-error",
                          transaction.type === "transfer" && "badge-warning"
                        )}
                      >
                        {transaction.type === "income" && (
                          <ArrowUpRight className="mr-1 h-3 w-3" />
                        )}
                        {transaction.type === "expense" && (
                          <ArrowDownRight className="mr-1 h-3 w-3" />
                        )}
                        {transaction.type}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "text-right font-mono",
                        transaction.type === "income" && "amount-positive",
                        transaction.type === "expense" && "amount-negative"
                      )}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {selectedClientData?.currency} {transaction.amount.toLocaleString()}
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(transaction)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(transaction.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
