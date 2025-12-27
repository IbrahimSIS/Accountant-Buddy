import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { transactionSchema, TransactionFormData } from "@/lib/validations";
import { z } from "zod";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category_id: string | null;
  account_id: string | null;
  notes: string | null;
  source: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  currency: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

export default function TransactionsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    date: new Date(),
    description: "",
    amount: "",
    type: "expense" as "income" | "expense" | "transfer",
    category_id: "",
    account_id: "",
    notes: "",
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
      fetchCategories();
      fetchAccounts();
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

  const fetchCategories = async () => {
    if (!selectedClient) return;

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, type")
      .eq("client_id", selectedClient)
      .order("name");

    if (!error && data) {
      setCategories(data);
    }
  };

  const fetchAccounts = async () => {
    if (!selectedClient) return;

    const { data, error } = await supabase
      .from("accounts")
      .select("id, code, name, type")
      .eq("client_id", selectedClient)
      .order("code");

    if (!error && data) {
      setAccounts(data);
    }
  };

  const validateForm = (): boolean => {
    try {
      transactionSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    const transactionData = {
      client_id: selectedClient,
      date: format(formData.date, "yyyy-MM-dd"),
      description: formData.description.trim(),
      amount: parseFloat(formData.amount),
      type: formData.type,
      category_id: formData.category_id || null,
      account_id: formData.account_id || null,
      notes: formData.notes?.trim() || null,
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
      category_id: transaction.category_id || "",
      account_id: transaction.account_id || "",
      notes: transaction.notes || "",
    });
    setErrors({});
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
      category_id: "",
      account_id: "",
      notes: "",
    });
    setErrors({});
  };

  const selectedClientData = clients.find((c) => c.id === selectedClient);
  const filteredCategories = categories.filter(
    (c) => formData.type === "transfer" || c.type === formData.type
  );

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
              <DialogContent className="sm:max-w-[500px]">
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
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              errors.date && "border-destructive"
                            )}
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
                      {errors.date && (
                        <p className="text-sm text-destructive">{errors.date}</p>
                      )}
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
                        className={cn(errors.description && "border-destructive")}
                      />
                      {errors.description && (
                        <p className="text-sm text-destructive">{errors.description}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount *</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.amount}
                          onChange={(e) =>
                            setFormData({ ...formData, amount: e.target.value })
                          }
                          placeholder="0.00"
                          className={cn(errors.amount && "border-destructive")}
                        />
                        {errors.amount && (
                          <p className="text-sm text-destructive">{errors.amount}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">Type</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value: "income" | "expense" | "transfer") =>
                            setFormData({ ...formData, type: value, category_id: "" })
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={formData.category_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, category_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No Category</SelectItem>
                            {filteredCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="account">Account</Label>
                        <Select
                          value={formData.account_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, account_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No Account</SelectItem>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder="Additional notes..."
                        rows={2}
                        className={cn(errors.notes && "border-destructive")}
                      />
                      {errors.notes && (
                        <p className="text-sm text-destructive">{errors.notes}</p>
                      )}
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
                  <th>Category</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                  <th className="w-[50px]"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => {
                  const category = categories.find(c => c.id === transaction.category_id);
                  return (
                    <tr key={transaction.id}>
                      <td className="font-medium">
                        {format(new Date(transaction.date), "MMM d, yyyy")}
                      </td>
                      <td>
                        <div>
                          <span>{transaction.description}</span>
                          {transaction.notes && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {transaction.notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={cn(
                          "badge-status",
                          category ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {category?.name || "Uncategorized"}
                        </span>
                      </td>
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
                      <td className={cn(
                        "text-right font-medium",
                        transaction.type === "income" && "text-accent",
                        transaction.type === "expense" && "text-destructive"
                      )}>
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
                            <DropdownMenuItem onClick={() => openEditDialog(transaction)}>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
