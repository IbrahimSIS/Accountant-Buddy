import { useEffect, useState, useMemo, useRef } from "react";
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
  Users,
  Building2,
  RefreshCw,
  Pencil,
  Trash2,
  Mail,
  Phone,
  CreditCard,
  MapPin,
  ChevronsUpDown,
  Check,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Download,
  Briefcase,
} from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";
import { clientSchema } from "@/lib/validations";
import { z } from "zod";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { COUNTRIES, type CountryData } from "@/data/countriesData";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  currency: string;
  client_type: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  created_at: string;
}

const CLIENT_TYPES = ["Individual", "Company", "NGO", "Government"] as const;

// ─── Constants ───────────────────────────────────────────────────────────────

const currencies = [
  { code: "JOD", name: "Jordanian Dinar" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "IQD", name: "Iraqi Dinar" },
  { code: "LBP", name: "Lebanese Pound" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "INR", name: "Indian Rupee" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAddress(address: string | null): { country: string; city: string } {
  if (!address) return { country: "", city: "" };
  try {
    const parsed = JSON.parse(address);
    return { country: parsed.country || "", city: parsed.city || "" };
  } catch {
    return { country: "", city: "" };
  }
}

function buildAddress(country: string, city: string): string | null {
  if (!country && !city) return null;
  return JSON.stringify({ country, city });
}

function getCountryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name || code;
}

function getClientInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  // Combobox popover states
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  // Excel import state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    country: "",
    city: "",
    currency: "JOD",
    client_type: "Company" as string,
    contact_email: "",
    contact_phone: "",
  });

  // ─── Derived state ───────────────────────────────────────────────────────

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const filteredClients = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [clients, searchQuery]
  );

  const citiesForCountry = useMemo(() => {
    if (!formData.country) return [];
    const country = COUNTRIES.find((c) => c.code === formData.country);
    return country?.cities || [];
  }, [formData.country]);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) navigate("/auth");
    });

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

  // Auto-set currency when country changes
  useEffect(() => {
    if (!formData.country) return;
    const country = COUNTRIES.find((c) => c.code === formData.country);
    if (country) {
      const matchedCurrency = currencies.find((cur) => cur.code === country.currency);
      if (matchedCurrency) {
        setFormData((prev) => ({ ...prev, currency: matchedCurrency.code }));
      }
    }
  }, [formData.country]);

  // ─── Data fetching ───────────────────────────────────────────────────────

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase clients error:", error);
      toast.error(`Failed to load clients: ${error.message}`);
    } else {
      setClients((data as any[]) || []);
    }
  };

  // ─── Form helpers ────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    try {
      clientSchema.parse(formData);
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

    const payload = {
      name: formData.name.trim(),
      currency: formData.currency,
      client_type: formData.client_type,
      contact_email: formData.contact_email?.trim() || null,
      contact_phone: formData.contact_phone?.trim() || null,
      address: buildAddress(formData.country, formData.city),
    };

    if (editingClient) {
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editingClient.id);

      if (error) {
        toast.error("Failed to update client");
      } else {
        toast.success("Client updated successfully");
        await fetchClients();
        closeDialog();
      }
    } else {
      const { error } = await supabase.from("clients").insert({
        ...payload,
        owner_user_id: session?.user.id,
      });

      if (error) {
        toast.error("Failed to create client");
      } else {
        toast.success("Client created successfully");
        await fetchClients();
        closeDialog();
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteClientId) return;

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", deleteClientId);

    if (error) {
      toast.error("Failed to delete client. Make sure all related data is removed first.");
    } else {
      toast.success("Client deleted");
      if (selectedClientId === deleteClientId) setSelectedClientId(null);
      fetchClients();
    }
    setDeleteClientId(null);
  };

  const openEditDialog = (client: Client) => {
    const addr = parseAddress(client.address);
    setEditingClient(client);
    setFormData({
      name: client.name,
      country: addr.country,
      city: addr.city,
      currency: client.currency,
      client_type: client.client_type || "Company",
      contact_email: client.contact_email || "",
      contact_phone: client.contact_phone || "",
    });
    setErrors({});
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
    setFormData({
      name: "",
      country: "",
      city: "",
      currency: "JOD",
      client_type: "Company",
      contact_email: "",
      contact_phone: "",
    });
    setErrors({});
  };

  // ─── Excel Import ──────────────────────────────────────────────────────

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
    setImportErrors([]);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (json.length === 0) {
        setImportErrors(["File is empty or has no data rows."]);
        setImportRows([]);
        return;
      }

      const errors: string[] = [];
      const parsed = json.map((row, i) => {
        const name = String(row["Name"] || row["name"] || row["Client Name"] || "").trim();
        if (!name) errors.push(`Row ${i + 2}: Name is required`);
        const clientType = String(row["Client Type"] || row["client_type"] || "Company").trim();
        const validTypes = ["Individual", "Company", "NGO", "Government"];
        if (!validTypes.includes(clientType)) errors.push(`Row ${i + 2}: Invalid Client Type "${clientType}"`);
        return {
          name,
          currency: String(row["Currency"] || row["currency"] || "JOD").trim().toUpperCase(),
          client_type: validTypes.includes(clientType) ? clientType : "Company",
          contact_email: String(row["Email"] || row["email"] || row["Contact Email"] || "").trim() || null,
          contact_phone: String(row["Phone"] || row["phone"] || row["Contact Phone"] || "").trim() || null,
          country: String(row["Country"] || row["country"] || row["Country Code"] || "").trim().toUpperCase(),
          city: String(row["City"] || row["city"] || "").trim(),
        };
      });

      setImportErrors(errors);
      setImportRows(parsed);
    } catch {
      setImportErrors(["Could not parse file. Please use .xlsx or .csv format."]);
      setImportRows([]);
    }
  };

  const handleImportClients = async () => {
    if (importRows.length === 0) return;
    setImportLoading(true);

    try {
      const payloads = importRows
        .filter((r) => r.name)
        .map((r) => ({
          name: r.name,
          currency: r.currency || "JOD",
          client_type: r.client_type || "Company",
          contact_email: r.contact_email,
          contact_phone: r.contact_phone,
          address: r.country ? JSON.stringify({ country: r.country, city: r.city || "" }) : null,
          owner_user_id: session?.user.id,
        }));

      const { error } = await supabase.from("clients").insert(payloads);

      if (error) {
        toast.error(`Import failed: ${error.message}`);
      } else {
        toast.success(`Imported ${payloads.length} client${payloads.length !== 1 ? "s" : ""}`);
        await fetchClients();
        setIsImportDialogOpen(false);
      }
    } catch (err: any) {
      toast.error(`Import failed: ${err?.message || "Unknown error"}`);
    } finally {
      setImportLoading(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  const handleExportClientsTemplate = () => {
    const templateData = [
      { Name: "Acme Corp", Currency: "USD", "Client Type": "Company", Email: "info@acme.com", Phone: "+1 555-0100", "Country Code": "US", City: "New York" },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clients");
    XLSX.writeFile(wb, "Clients_Import_Template.xlsx");
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Page Header */}
        <div className="flex items-center justify-between px-1 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
            <p className="text-sm text-muted-foreground">
              Manage your client workspaces
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openImportDialog}>
              <Upload className="mr-2 h-4 w-4" />
              Import Excel
            </Button>
            <Button onClick={() => { closeDialog(); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </div>
        </div>

        {/* Two-pane layout */}
        <div className="flex flex-1 gap-4 overflow-hidden rounded-xl border bg-card">
          {/* ─── Left pane: Client list ───────────────────────────────── */}
          <div className="w-64 shrink-0 border-r flex flex-col">
            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            {/* Scrollable client list */}
            <div className="flex-1 overflow-y-auto">
              {filteredClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Users className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No clients</p>
                </div>
              ) : (
                <div className="py-1">
                  {filteredClients.map((client) => {
                    const isSelected = selectedClientId === client.id;
                    return (
                      <button
                        key={client.id}
                        onClick={() => setSelectedClientId(client.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                          isSelected && "bg-primary/10 hover:bg-primary/10"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {getClientInitials(client.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              isSelected && "text-primary"
                            )}
                          >
                            {client.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {client.contact_email || client.currency}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Right pane: Client details ───────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            {!selectedClient ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="rounded-full bg-muted p-5 mb-4">
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Select a client</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Choose a client from the list on the left to view their details,
                  or add a new client to get started.
                </p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Client header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold">
                      {getClientInitials(selectedClient.name)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{selectedClient.name}</h2>
                      {(() => {
                        const addr = parseAddress(selectedClient.address);
                        if (addr.city || addr.country) {
                          return (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {[addr.city, getCountryName(addr.country)]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(selectedClient)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteClientId(selectedClient.id)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wider">Client Type</span>
                    </div>
                    <p className="text-sm font-semibold">{selectedClient.client_type || "Company"}</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wider">Currency</span>
                    </div>
                    <p className="text-sm font-semibold">{selectedClient.currency}</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wider">Phone</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {selectedClient.contact_phone || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wider">Email</span>
                    </div>
                    <p className="text-sm font-semibold break-all">
                      {selectedClient.contact_email || "—"}
                    </p>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() =>
                      navigate(`/transactions?client=${selectedClient.id}`)
                    }
                  >
                    Transactions
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(`/reports?client=${selectedClient.id}`)
                    }
                  >
                    Reports
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Add / Edit Client Dialog ──────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "Edit Client" : "Add New Client"}
            </DialogTitle>
            <DialogDescription>
              {editingClient
                ? "Update client details below."
                : "Create a new client workspace."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Client Name */}
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Acme Corporation"
                  className={cn("h-9", errors.name && "border-destructive")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              {/* Country + City */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Popover open={countryOpen} onOpenChange={setCountryOpen} modal={true}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-9 font-normal"
                      >
                        <span className="truncate text-left">
                          {formData.country
                            ? getCountryName(formData.country)
                            : "Select country"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                      style={{ zIndex: 9999 }}
                    >
                      <Command>
                        <CommandInput placeholder="Search countries..." />
                        <CommandList className="max-h-[200px]">
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandGroup>
                            {COUNTRIES.map((c) => (
                              <CommandItem
                                key={c.code}
                                value={`${c.name} ${c.code}`}
                                onSelect={() => {
                                  setFormData({
                                    ...formData,
                                    country: c.code,
                                    city: "",
                                  });
                                  setCountryOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    formData.country === c.code
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="truncate">{c.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Popover open={cityOpen} onOpenChange={setCityOpen} modal={true}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-9 font-normal"
                        disabled={!formData.country}
                      >
                        <span className="truncate text-left">
                          {formData.city || "Select city"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                      style={{ zIndex: 9999 }}
                    >
                      <Command>
                        <CommandInput placeholder="Search cities..." />
                        <CommandList className="max-h-[200px]">
                          <CommandEmpty>No city found.</CommandEmpty>
                          <CommandGroup>
                            {citiesForCountry.map((city) => (
                              <CommandItem
                                key={city}
                                value={city}
                                onSelect={() => {
                                  setFormData({ ...formData, city });
                                  setCityOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    formData.city === city
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {city}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Currency + Client Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Client Type</Label>
                  <Select
                    value={formData.client_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, client_type: value })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_email: e.target.value })
                    }
                    placeholder="contact@client.com"
                    className={cn(
                      "h-9",
                      errors.contact_email && "border-destructive"
                    )}
                  />
                  {errors.contact_email && (
                    <p className="text-sm text-destructive">
                      {errors.contact_email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_phone: e.target.value })
                    }
                    placeholder="+962 7XX XXX XXX"
                    className={cn(
                      "h-9",
                      errors.contact_phone && "border-destructive"
                    )}
                  />
                  {errors.contact_phone && (
                    <p className="text-sm text-destructive">
                      {errors.contact_phone}
                    </p>
                  )}
                </div>
              </div>

            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingClient ? "Save Changes" : "Create Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ───────────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteClientId}
        onOpenChange={() => setDeleteClientId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this client? This action cannot be
              undone and will remove all associated data including transactions,
              accounts, and categories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Import Excel Dialog ──────────────────────────────────────────── */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Clients from Excel
            </DialogTitle>
            <DialogDescription>
              Upload an Excel (.xlsx) or CSV file with client data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-3">
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleImportFileChange}
                className="hidden"
              />
              {importFile ? (
                <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {importRows.length} row{importRows.length !== 1 ? "s" : ""} detected
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImportFile(null);
                      setImportRows([]);
                      setImportErrors([]);
                      if (importFileRef.current) importFileRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={() => importFileRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm">Click to select file</span>
                    <span className="text-xs text-muted-foreground">.xlsx or .csv</span>
                  </div>
                </Button>
              )}
            </div>

            {importErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Validation Issues</span>
                </div>
                <ul className="text-xs text-destructive/80 space-y-0.5 max-h-24 overflow-y-auto">
                  {importErrors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            {importRows.length > 0 && importErrors.length === 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/10 p-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {importRows.length} client{importRows.length !== 1 ? "s" : ""} ready to import
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={handleExportClientsTemplate}>
                <Download className="mr-1 h-3 w-3" />
                Download template
              </Button>
              <span className="text-xs text-muted-foreground">
                Columns: Name, Currency, Client Type, Email, Phone, Country Code, City
              </span>
            </div>
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
              onClick={handleImportClients}
              disabled={importRows.length === 0 || importErrors.length > 0 || importLoading}
            >
              {importLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {importRows.length > 0 ? `${importRows.length} Client${importRows.length !== 1 ? "s" : ""}` : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
