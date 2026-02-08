import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Plus,
  Search,
  BookOpen,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { accountSchema } from "@/lib/validations";
import { z } from "zod";
import { CHART_OF_ACCOUNTS_SEED } from "@/data/chartOfAccountsSeed";
import { Database as DatabaseIcon } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  description: string | null;
  is_active: boolean;
  parent_id: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const accountTypeLabels: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

const accountTypeColors: Record<AccountType, string> = {
  asset: "bg-chart-1/10 text-chart-1",
  liability: "bg-chart-5/10 text-chart-5",
  equity: "bg-chart-3/10 text-chart-3",
  income: "bg-accent/10 text-accent",
  expense: "bg-destructive/10 text-destructive",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  // Autocomplete state for account code selection in the Add/Edit dialog
  const [showCodeSuggestions, setShowCodeSuggestions] = useState(false);

  // Seeding state — used to populate the table with the default Chart of Accounts
  const [seeding, setSeeding] = useState(false);

  // A fallback client_id is needed for DB inserts because the accounts table
  // has a NOT NULL foreign key constraint on client_id.  The Chart of Accounts
  // is conceptually GLOBAL (shared across all clients), but the DB schema
  // still requires a client_id.  We silently resolve the first available client
  // and use it for all account inserts.
  const [fallbackClientId, setFallbackClientId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "expense" as AccountType,
    description: "",
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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
        // Chart of Accounts is GLOBAL — fetch all accounts and resolve a
        // fallback client_id for DB constraint satisfaction.
        fetchAccounts();
        fetchFallbackClientId();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // WHY GLOBAL: The Chart of Accounts defines the universal accounting
  // structure.  All clients share the same account codes (e.g. 1000 = Cash).
  // Filtering by client would create per-client silos and break consistency.
  const fetchAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("code");

    if (error) {
      toast.error("Failed to load accounts");
    } else {
      setAccounts(data || []);
    }
  }, []);

  const fetchFallbackClientId = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .order("name")
      .limit(1);
    if (data && data.length > 0) {
      setFallbackClientId(data[0].id);
    }
  };

  const validateForm = (): boolean => {
    try {
      accountSchema.parse(formData);
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

    if (!fallbackClientId) {
      toast.error("No clients exist. Please create a client first.");
      return;
    }

    // client_id is required by the DB but the account is logically global.
    const accountData = {
      client_id: fallbackClientId,
      code: formData.code.trim(),
      name: formData.name.trim(),
      type: formData.type,
      description: formData.description?.trim() || null,
    };

    if (editingAccount) {
      const { error } = await supabase
        .from("accounts")
        .update(accountData)
        .eq("id", editingAccount.id);

      if (error) {
        toast.error("Failed to update account");
      } else {
        toast.success("Account updated");
        fetchAccounts();
        closeDialog();
      }
    } else {
      const { error } = await supabase.from("accounts").insert(accountData);

      if (error) {
        if (error.message.includes("duplicate")) {
          toast.error("Account code already exists");
        } else {
          toast.error("Failed to create account");
        }
      } else {
        toast.success("Account created");
        fetchAccounts();
        closeDialog();
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteAccountId) return;

    const { error } = await supabase.from("accounts").delete().eq("id", deleteAccountId);

    if (error) {
      toast.error("Failed to delete account. It may be in use by transactions.");
    } else {
      toast.success("Account deleted");
      fetchAccounts();
    }
    setDeleteAccountId(null);
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      description: account.description || "",
    });
    setErrors({});
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingAccount(null);
    setFormData({
      code: "",
      name: "",
      type: "expense",
      description: "",
    });
    setErrors({});
  };

  // ─── Seed default Chart of Accounts ────────────────────────────────────
  // Populates the accounts table with the canonical 139-account structure.
  // Inserts in sorted-code order so parents always exist before children.
  // Skips any account code that already exists (no duplicates).
  const handleSeedAccounts = async () => {
    if (!fallbackClientId) {
      toast.error("No clients exist. Please create a client first.");
      return;
    }

    setSeeding(true);
    try {
      // Build set of existing codes to skip duplicates
      const existingCodes = new Set(accounts.map((a) => a.code));

      // Filter out accounts that already exist
      const toInsert = CHART_OF_ACCOUNTS_SEED.filter(
        (s) => !existingCodes.has(s.code)
      );

      if (toInsert.length === 0) {
        toast.info("All accounts already exist. Nothing to seed.");
        setSeeding(false);
        return;
      }

      // Sort by code so parents are always inserted before children
      const sorted = [...toInsert].sort((a, b) => a.code.localeCompare(b.code));

      // Build a code→id map from existing DB accounts
      const codeToId = new Map(accounts.map((a) => [a.code, a.id]));

      // Insert in small batches to respect parent→child ordering.
      // Each batch's parent_id is resolved from the codeToId map.
      const BATCH_SIZE = 20;
      let insertedCount = 0;

      for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
        const batch = sorted.slice(i, i + BATCH_SIZE);
        const payload = batch.map((row) => ({
          client_id: fallbackClientId,
          code: row.code,
          name: row.name,
          type: row.type,
          description: row.description,
          is_active: true,
          // parentCode === null means root account → parent_id = null
          parent_id: row.parentCode ? (codeToId.get(row.parentCode) ?? null) : null,
        }));

        const { data: inserted, error } = await supabase
          .from("accounts")
          .insert(payload)
          .select("id, code");

        if (error) {
          toast.error(`Seed failed at batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
          break;
        }

        // Update code→id map with newly inserted accounts for next batch
        if (inserted) {
          for (const acc of inserted) {
            codeToId.set(acc.code, acc.id);
          }
          insertedCount += inserted.length;
        }
      }

      if (insertedCount > 0) {
        toast.success(`Seeded ${insertedCount} account${insertedCount !== 1 ? "s" : ""} successfully`);
        await fetchAccounts();
      }
    } catch (err: any) {
      toast.error(`Seed failed: ${err?.message || "Unknown error"}`);
    } finally {
      setSeeding(false);
    }
  };

  // ─── Account code autocomplete handler ─────────────────────────────────
  // When user selects an existing account code from the autocomplete dropdown,
  // auto-fill account_name, type, and description into the form.
  const handleCodeSelect = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      description: account.description || "",
    });
    setShowCodeSuggestions(false);
  };

  // Filtered suggestions for the account code autocomplete.
  // Matches on code or name, limited to 10 results for performance.
  const codeSuggestions = formData.code.length > 0
    ? accounts.filter(
        (a) =>
          a.code.toLowerCase().includes(formData.code.toLowerCase()) ||
          a.name.toLowerCase().includes(formData.code.toLowerCase())
      ).slice(0, 10)
    : accounts.slice(0, 10);

  // ─── Derived state ─────────────────────────────────────────────────────

  const filteredAccounts = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedAccounts = (["asset", "liability", "equity", "income", "expense"] as AccountType[]).map((type) => ({
    type,
    accounts: filteredAccounts.filter((a) => a.type === type),
  }));

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
        {/* Header — no client selector; Chart of Accounts is global */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
            <p className="text-muted-foreground">
              Global account structure shared across all clients
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={closeDialog} disabled={!fallbackClientId}>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAccount ? "Edit Account" : "Add Account"}
                </DialogTitle>
                <DialogDescription>
                  {editingAccount
                    ? "Update the account details."
                    : "Select an existing account code or enter a new one manually."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Account Code with autocomplete — type to search existing
                        accounts. Selecting one auto-fills name, type, description. */}
                    <div className="space-y-2">
                      <Label htmlFor="code">Account Code *</Label>
                      <div className="relative">
                        <Input
                          id="code"
                          value={formData.code}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData({ ...formData, code: val });
                            setShowCodeSuggestions(true);
                            // If user changes code away from the loaded account, reset editing
                            if (editingAccount && editingAccount.code !== val) {
                              setEditingAccount(null);
                            }
                          }}
                          onFocus={() => {
                            if (accounts.length > 0) setShowCodeSuggestions(true);
                          }}
                          onBlur={() => {
                            // Delay hiding so clicks on suggestions register first
                            setTimeout(() => setShowCodeSuggestions(false), 150);
                          }}
                          placeholder="Type code or search..."
                          className={cn(errors.code && "border-destructive")}
                          autoComplete="off"
                        />
                        {/* Autocomplete dropdown — shows existing accounts matching
                            the typed code. Selecting auto-fills all form fields. */}
                        {showCodeSuggestions && codeSuggestions.length > 0 && !editingAccount && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {codeSuggestions.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2 transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleCodeSelect(a);
                                }}
                              >
                                <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">
                                  {a.code}
                                </span>
                                <span className="truncate">{a.name}</span>
                                <span className={cn("ml-auto text-xs px-1.5 py-0.5 rounded", accountTypeColors[a.type])}>
                                  {a.type}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {errors.code && (
                        <p className="text-sm text-destructive">{errors.code}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: AccountType) =>
                          setFormData({ ...formData, type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asset">Asset</SelectItem>
                          <SelectItem value="liability">Liability</SelectItem>
                          <SelectItem value="equity">Equity</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Account Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Cash on Hand"
                      className={cn(errors.name && "border-destructive")}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Optional description"
                      className={cn(errors.description && "border-destructive")}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive">{errors.description}</p>
                    )}
                  </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingAccount ? "Save Changes" : "Add Account"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </div>

        {/* Search filter — no client selector needed for global scope */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} total
          </p>
        </div>

        {/* Accounts list */}
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No accounts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Seed the default chart of accounts or add accounts manually
            </p>
            <div className="flex gap-2">
              <Button onClick={handleSeedAccounts} disabled={!fallbackClientId || seeding}>
                {seeding ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Seeding...
                  </>
                ) : (
                  <>
                    <DatabaseIcon className="mr-2 h-4 w-4" />
                    Seed Default Accounts
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(true)} disabled={!fallbackClientId}>
                <Plus className="mr-2 h-4 w-4" />
                Add Manually
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedAccounts.map(({ type, accounts: accts }) =>
              accts.length > 0 ? (
                <div key={type} className="rounded-xl border bg-card overflow-hidden">
                  <div className="border-b bg-muted/30 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("badge-status", accountTypeColors[type])}>
                        {accountTypeLabels[type]}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {accts.length} account{accts.length !== 1 && "s"}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {accts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm font-medium text-muted-foreground w-16">
                            {account.code}
                          </span>
                          <div>
                            <p className="font-medium">{account.name}</p>
                            {account.description && (
                              <p className="text-sm text-muted-foreground">
                                {account.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!account.is_active && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                              Inactive
                            </span>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(account)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteAccountId(account.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAccountId} onOpenChange={() => setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this account? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
