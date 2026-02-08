import { useEffect, useState, useRef } from "react";
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
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  Receipt,
  BookOpen,
  ArrowLeftRight,
  FileText,
  Coins,
  Download,
  ChevronsUpDown,
  Check,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { transactionSchema } from "@/lib/validations";
import { z } from "zod";
import { useCurrency, currencies } from "@/contexts/CurrencyContext";
import { createJournalEntries, deleteJournalEntries, ensureSystemAccounts } from "@/lib/journal";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  X,
} from "lucide-react";

type BookType = "cash" | "transfer" | "cheque";

const BOOK_TABS: { value: BookType; label: string; icon: typeof BookOpen }[] = [
  { value: "cash", label: "Cash Book", icon: Coins },
  { value: "transfer", label: "Transfer Book", icon: ArrowLeftRight },
  { value: "cheque", label: "Cheque Book", icon: FileText },
];

const DEFAULT_INCOME_CATEGORIES = [
  "Sales / Revenue",
  "Service Income",
  "Rental Income",
  "Commission Income",
  "Other Income",
];

const DEFAULT_EXPENSE_CATEGORIES = [
  "Office Expenses",
  "Purchases",
  "Rent",
  "Utilities (Electricity, Water, Internet)",
  "Salaries & Wages",
  "Marketing & Advertising",
  "Transportation",
  "Software & Subscriptions",
  "Professional Fees (Accounting, Legal)",
  "Maintenance & Repairs",
  "Bank Fees",
  "Taxes & Government Fees",
  "Other Expenses",
];

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
  external_ref: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Client {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

function parseTransactionMeta(externalRef: string | null): { book?: string; currency?: string } {
  if (!externalRef) return {};
  try {
    return JSON.parse(externalRef);
  } catch {
    return {};
  }
}

function buildTransactionMeta(book: string, currency: string): string {
  return JSON.stringify({ book, currency });
}

export default function TransactionsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currency: globalCurrency, formatCurrency } = useCurrency();
  const [activeBook, setActiveBook] = useState<BookType>("cash");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountCodeOpen, setAccountCodeOpen] = useState(false);

  // ─── Excel/CSV import state ─────────────────────────────────────────────
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Popover open state for date picker (auto-close on select)
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date(),
    description: "",
    amount: "",
    type: "expense" as "income" | "expense",
    category_id: "",
    account_id: "",
    notes: "",
    currency: globalCurrency || "JOD",
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
      ensureSystemAccounts(selectedClient).catch(console.error);
      fetchTransactions();
      fetchCategories();
      fetchAccounts();
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

  const ensureDefaultCategories = async (clientId: string) => {
    const { data: existing } = await supabase
      .from("categories")
      .select("name, type")
      .eq("client_id", clientId);

    const existingSet = new Set((existing || []).map((c) => `${c.type}::${c.name}`));

    const toInsert: { client_id: string; name: string; type: string }[] = [];

    for (const name of DEFAULT_INCOME_CATEGORIES) {
      if (!existingSet.has(`income::${name}`)) {
        toInsert.push({ client_id: clientId, name, type: "income" });
      }
    }
    for (const name of DEFAULT_EXPENSE_CATEGORIES) {
      if (!existingSet.has(`expense::${name}`)) {
        toInsert.push({ client_id: clientId, name, type: "expense" });
      }
    }

    if (toInsert.length > 0) {
      await supabase.from("categories").insert(toInsert);
    }
  };

  const fetchAccounts = async () => {
    if (!selectedClient) return;

    const { data, error } = await supabase
      .from("accounts")
      .select("id, code, name, type")
      .eq("client_id", selectedClient)
      .eq("is_active", true)
      .order("code");

    if (!error && data) {
      setAccounts(data);
    }
  };

  const fetchCategories = async () => {
    if (!selectedClient) return;

    await ensureDefaultCategories(selectedClient);

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, type")
      .eq("client_id", selectedClient)
      .order("name");

    if (!error && data) {
      setCategories(data);
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
      external_ref: buildTransactionMeta(activeBook, formData.currency),
    };

    if (editingTransaction) {
      const { error } = await supabase
        .from("transactions")
        .update(transactionData)
        .eq("id", editingTransaction.id);

      if (error) {
        toast.error("Failed to update transaction");
      } else {
        try {
          await deleteJournalEntries(editingTransaction.id);
          await createJournalEntries({
            transactionId: editingTransaction.id,
            clientId: selectedClient,
            accountId: transactionData.account_id,
            amount: transactionData.amount,
            type: transactionData.type as "income" | "expense",
            book: activeBook,
            date: transactionData.date,
            notes: transactionData.notes,
          });
        } catch (err) {
          console.error("Journal entry error on update:", err);
        }
        toast.success("Transaction updated");
        fetchTransactions();
        closeDialog();
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("transactions")
        .insert(transactionData)
        .select("id")
        .single();

      if (error) {
        toast.error("Failed to create transaction");
      } else {
        try {
          await createJournalEntries({
            transactionId: inserted.id,
            clientId: selectedClient,
            accountId: transactionData.account_id,
            amount: transactionData.amount,
            type: transactionData.type as "income" | "expense",
            book: activeBook,
            date: transactionData.date,
            notes: transactionData.notes,
          });
        } catch (err) {
          console.error("Journal entry error on create:", err);
        }
        toast.success("Transaction added");
        fetchTransactions();
        closeDialog();
      }
    }
  };

  const handleDelete = async (id: string) => {
    await deleteJournalEntries(id);
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
    const meta = parseTransactionMeta(transaction.external_ref);
    setFormData({
      date: new Date(transaction.date),
      description: transaction.description,
      amount: String(transaction.amount),
      type: transaction.type as "income" | "expense",
      category_id: transaction.category_id || "",
      account_id: transaction.account_id || "",
      notes: transaction.notes || "",
      currency: meta.currency || globalCurrency || "JOD",
    });
    if (meta.book) {
      setActiveBook(meta.book as BookType);
    }
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
      currency: globalCurrency || "JOD",
    });
    setErrors({});
  };

  // ─── Excel/CSV import handlers ──────────────────────────────────────────
  // Parses uploaded file, validates rows, and inserts transactions.
  // Expected columns: Date, Description, Amount, Type (income/expense), Notes (optional).

  const openImportDialog = () => {
    setImportFile(null);
    setImportRows([]);
    setImportErrors([]);
    setImportLoading(false);
    setIsImportDialogOpen(true);
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportRows([]);
    setImportErrors([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setImportErrors(["The file contains no sheets."]);
        return;
      }

      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(
        workbook.Sheets[sheetName]
      );

      if (rawRows.length === 0) {
        setImportErrors(["The file contains no data rows."]);
        return;
      }

      // Helper to get cell value case-insensitively
      const getCell = (row: Record<string, any>, col: string): string => {
        const key = Object.keys(row).find(
          (k) => k.trim().toLowerCase() === col.toLowerCase()
        );
        if (!key) return "";
        const val = row[key];
        if (val === null || val === undefined) return "";
        return String(val).trim();
      };

      // Check required columns
      const headers = Object.keys(rawRows[0]).map((h) => h.trim().toLowerCase());
      const requiredCols = ["date", "description", "amount", "type"];
      const missing = requiredCols.filter((c) => !headers.includes(c));
      if (missing.length > 0) {
        setImportErrors([`Missing required columns: ${missing.join(", ")}`]);
        return;
      }

      // Build account code → id map for optional Account Code column
      const accountCodeToId = new Map<string, string>();
      for (const acc of accounts) {
        accountCodeToId.set(acc.code.toLowerCase(), acc.id);
      }

      const errs: string[] = [];
      const validRows: {
        date: string;
        description: string;
        amount: number;
        type: string;
        notes: string | null;
        account_id: string | null;
      }[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const rowNum = i + 2;
        const raw = rawRows[i];

        const dateStr = getCell(raw, "Date");
        const description = getCell(raw, "Description");
        const amountStr = getCell(raw, "Amount");
        const typeStr = getCell(raw, "Type").toLowerCase();
        const accountCode = getCell(raw, "Account Code");
        const notes = getCell(raw, "Notes") || null;

        if (!dateStr) { errs.push(`Row ${rowNum}: Date is required.`); continue; }
        if (!description) { errs.push(`Row ${rowNum}: Description is required.`); continue; }
        if (!amountStr) { errs.push(`Row ${rowNum}: Amount is required.`); continue; }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
          errs.push(`Row ${rowNum}: Amount must be a positive number.`);
          continue;
        }

        if (typeStr !== "income" && typeStr !== "expense") {
          errs.push(`Row ${rowNum}: Type must be "income" or "expense".`);
          continue;
        }

        // Parse date — support multiple formats
        let parsedDate: Date;
        const numDate = Number(dateStr);
        if (!isNaN(numDate) && numDate > 30000) {
          // Excel serial date number
          parsedDate = new Date((numDate - 25569) * 86400 * 1000);
        } else {
          parsedDate = new Date(dateStr);
        }
        if (isNaN(parsedDate.getTime())) {
          errs.push(`Row ${rowNum}: Invalid date "${dateStr}".`);
          continue;
        }

        const account_id = accountCode
          ? accountCodeToId.get(accountCode.toLowerCase()) || null
          : null;

        validRows.push({
          date: format(parsedDate, "yyyy-MM-dd"),
          description,
          amount,
          type: typeStr,
          notes,
          account_id,
        });
      }

      setImportErrors(errs);
      setImportRows(errs.length === 0 ? validRows : []);
    } catch (err) {
      setImportErrors(["Failed to parse the file. Ensure it is a valid .xlsx or .csv file."]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportTransactions = async () => {
    if (importRows.length === 0 || !selectedClient) return;

    setImportLoading(true);
    try {
      const payload = importRows.map((row) => ({
        client_id: selectedClient,
        date: row.date,
        description: row.description,
        amount: row.amount,
        type: row.type,
        account_id: row.account_id || null,
        notes: row.notes,
        source: "import" as const,
        external_ref: buildTransactionMeta(activeBook, globalCurrency || "JOD"),
      }));

      const { data: inserted, error } = await supabase
        .from("transactions")
        .insert(payload)
        .select("id, amount, type, account_id, date, notes");

      if (error) {
        toast.error(`Import failed: ${error.message}`);
      } else {
        if (inserted) {
          for (const txn of inserted) {
            try {
              await createJournalEntries({
                transactionId: txn.id,
                clientId: selectedClient,
                accountId: txn.account_id,
                amount: txn.amount,
                type: txn.type as "income" | "expense",
                book: activeBook,
                date: txn.date,
                notes: txn.notes,
              });
            } catch (err) {
              console.error("Journal entry error on import:", err);
            }
          }
        }
        toast.success(`Imported ${importRows.length} transaction${importRows.length !== 1 ? "s" : ""}`);
        await fetchTransactions();
        setIsImportDialogOpen(false);
      }
    } catch (err: any) {
      toast.error(`Import failed: ${err?.message || "Unknown error"}`);
    } finally {
      setImportLoading(false);
    }
  };

  const selectedClientData = clients.find((c) => c.id === selectedClient);
  const filteredCategories = categories.filter(
    (c) => c.type === formData.type
  );

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    const meta = parseTransactionMeta(t.external_ref);
    const matchesBook = !meta.book || meta.book === activeBook;
    return matchesSearch && matchesType && matchesBook;
  });

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  // ─── Excel Export ─────────────────────────────────────────────────────
  const handleExportTransactions = () => {
    if (filteredTransactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }
    const clientName = clients.find((c) => c.id === selectedClient)?.name || "All";
    const rows = filteredTransactions.map((t) => {
      const cat = categories.find((c) => c.id === t.category_id);
      const acc = accounts.find((a) => a.id === t.account_id);
      const meta = parseTransactionMeta(t.external_ref);
      return {
        Date: t.date,
        Description: t.description,
        Type: t.type,
        "Account Code": acc?.code || "",
        "Account Name": acc?.name || "",
        Amount: t.amount,
        Category: cat?.name || "",
        Book: meta.book || "",
        Currency: meta.currency || "",
        Notes: t.notes || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 35 }, { wch: 10 }, { wch: 14 }, { wch: 20 },
      { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `Transactions_${clientName.replace(/\s+/g, "_")}.xlsx`);
    toast.success(`Exported ${rows.length} transaction${rows.length !== 1 ? "s" : ""}`);
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
            <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              View and manage client transactions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportTransactions} disabled={!selectedClient || transactions.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button variant="outline" onClick={openImportDialog} disabled={!selectedClient}>
              <Upload className="mr-2 h-4 w-4" />
              Import Excel
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={closeDialog} disabled={!selectedClient}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? "Edit Transaction" : "Add Transaction"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 py-4">
                    {/* Row 1: Date + Type */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal h-9",
                                errors.date && "border-destructive"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              {format(formData.date, "MM/dd/yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.date}
                              onSelect={(date) => {
                                if (date) {
                                  setFormData({ ...formData, date });
                                  setDatePopoverOpen(false);
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        {errors.date && (
                          <p className="text-sm text-destructive">{errors.date}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value: "income" | "expense") =>
                            setFormData({ ...formData, type: value, category_id: "" })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 2: Accounting Code + Category */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Accounting Code</Label>
                        <Popover open={accountCodeOpen} onOpenChange={setAccountCodeOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={accountCodeOpen}
                              className="w-full justify-between h-9 font-normal"
                            >
                              {formData.account_id
                                ? (() => {
                                    const acc = accounts.find((a) => a.id === formData.account_id);
                                    return acc ? `${acc.code} — ${acc.name}` : "Select account…";
                                  })()
                                : "Select account…"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search accounts…" />
                              <CommandList>
                                <CommandEmpty>No account found.</CommandEmpty>
                                <CommandGroup>
                                  {accounts.map((account) => (
                                    <CommandItem
                                      key={account.id}
                                      value={`${account.code} ${account.name}`}
                                      onSelect={() => {
                                        setFormData({
                                          ...formData,
                                          account_id:
                                            formData.account_id === account.id ? "" : account.id,
                                        });
                                        setAccountCodeOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.account_id === account.id
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <span className="font-mono text-xs mr-2">{account.code}</span>
                                      {account.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={formData.category_id || "__none__"}
                          onValueChange={(value) =>
                            setFormData({ ...formData, category_id: value === "__none__" ? "" : value })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No Category</SelectItem>
                            {filteredCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 3: Amount + Currency */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount</Label>
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
                          className={cn("h-9", errors.amount && "border-destructive")}
                        />
                        {errors.amount && (
                          <p className="text-sm text-destructive">{errors.amount}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select
                          value={formData.currency}
                          onValueChange={(value) =>
                            setFormData({ ...formData, currency: value })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.symbol} {c.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 4: Description (full width) */}
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        placeholder="Description"
                        className={cn("h-9", errors.description && "border-destructive")}
                      />
                      {errors.description && (
                        <p className="text-sm text-destructive">{errors.description}</p>
                      )}
                    </div>

                    {/* Row 5: Notes (full width, larger) */}
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder="Additional notes..."
                        rows={4}
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

        {/* Book Tabs */}
        <div className="flex gap-2 rounded-lg border bg-muted/40 p-1">
          {BOOK_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveBook(tab.value)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all",
                  activeBook === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
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
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        {selectedClient && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-accent">
                 {formatCurrency(totalIncome)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-destructive">
                 {formatCurrency(totalExpenses)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Net</p>
              <p className={cn(
                "text-2xl font-bold",
                totalIncome - totalExpenses >= 0 ? "text-success" : "text-destructive"
              )}>
                 {formatCurrency(totalIncome - totalExpenses)}
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
                  <th>Category</th>
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
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          transaction.type === "income"
                            ? "bg-accent/10 text-accent"
                            : "bg-destructive/10 text-destructive"
                        )}>
                          {transaction.type === "income" ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {transaction.type === "income" ? "Income" : "Expense"}
                        </span>
                      </td>
                      <td>
                        <span className={cn(
                          "badge-status",
                          category ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {category?.name || "Uncategorized"}
                        </span>
                      </td>
                      <td className={cn(
                        "text-right font-medium",
                        transaction.type === "income" && "text-accent",
                        transaction.type === "expense" && "text-destructive"
                      )}>
                        {transaction.type === "income" ? "+" : "-"}
                         {formatCurrency(transaction.amount)}
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

      {/* ─── Import Excel/CSV Dialog ─────────────────────────────────────── */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Transactions
            </DialogTitle>
            <DialogDescription>
              Upload an Excel (.xlsx) or CSV file with columns:
              Date, Description, Amount, Type (income/expense), Account Code (optional), Notes (optional).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer hover:border-primary/50 hover:bg-muted/30",
                importFile ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleImportFileChange}
                className="hidden"
              />
              {importFile ? (
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(importFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImportFile(null);
                      setImportRows([]);
                      setImportErrors([]);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to upload a file</p>
                  <p className="text-xs text-muted-foreground">.xlsx or .csv</p>
                </>
              )}
            </div>

            {/* Validation errors */}
            {importErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">
                    {importErrors.length} Validation Error{importErrors.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {importErrors.map((err, i) => (
                    <li key={i} className="text-xs text-destructive/90">{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Success summary */}
            {importRows.length > 0 && importErrors.length === 0 && (
              <div className="rounded-lg border border-green-500/50 bg-green-500/5 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-semibold text-green-600">
                    {importRows.length} transaction{importRows.length !== 1 ? "s" : ""} ready to import
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
              disabled={importLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportTransactions}
              disabled={importRows.length === 0 || importLoading}
            >
              {importLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {importRows.length} Transaction{importRows.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
