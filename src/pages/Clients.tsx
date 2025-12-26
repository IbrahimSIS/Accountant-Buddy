import { useEffect, useState } from "react";
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
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Building2,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";

interface Client {
  id: string;
  name: string;
  currency: string;
  fiscal_year_start: number;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

const currencies = [
  { code: "JOD", name: "Jordanian Dinar" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function ClientsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    currency: "JOD",
    fiscal_year_start: 1,
    contact_email: "",
    contact_phone: "",
  });
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
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load clients");
    } else {
      setClients(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (editingClient) {
      const { error } = await supabase
        .from("clients")
        .update({
          name: formData.name,
          currency: formData.currency,
          fiscal_year_start: formData.fiscal_year_start,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
        })
        .eq("id", editingClient.id);

      if (error) {
        toast.error("Failed to update client");
      } else {
        toast.success("Client updated successfully");
        fetchClients();
        closeDialog();
      }
    } else {
      const { error } = await supabase.from("clients").insert({
        name: formData.name,
        currency: formData.currency,
        fiscal_year_start: formData.fiscal_year_start,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        owner_user_id: session?.user.id,
      });

      if (error) {
        toast.error("Failed to create client");
      } else {
        toast.success("Client created successfully");
        fetchClients();
        closeDialog();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete client");
    } else {
      toast.success("Client deleted");
      fetchClients();
    }
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      currency: client.currency,
      fiscal_year_start: client.fiscal_year_start,
      contact_email: client.contact_email || "",
      contact_phone: client.contact_phone || "",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
    setFormData({
      name: "",
      currency: "JOD",
      fiscal_year_start: 1,
      contact_email: "",
      contact_phone: "",
    });
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground">
              Manage your client workspaces and settings
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => closeDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Edit Client" : "Add New Client"}
                </DialogTitle>
                <DialogDescription>
                  {editingClient
                    ? "Update client details below."
                    : "Create a new client workspace to manage their bookkeeping."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Client Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Acme Corporation"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(value) =>
                          setFormData({ ...formData, currency: value })
                        }
                      >
                        <SelectTrigger>
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
                      <Label htmlFor="fiscal">Fiscal Year Start</Label>
                      <Select
                        value={String(formData.fiscal_year_start)}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            fiscal_year_start: parseInt(value),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {months.map((month, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_email: e.target.value })
                      }
                      placeholder="contact@client.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Contact Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_phone: e.target.value })
                      }
                      placeholder="+962 7XX XXX XXX"
                    />
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
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Clients Grid */}
        {filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No clients yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by adding your first client
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="group rounded-xl border bg-card p-5 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{client.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {client.currency} · FY starts {months[client.fiscal_year_start - 1]}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(client)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(client.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {(client.contact_email || client.contact_phone) && (
                  <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                    {client.contact_email && <p>{client.contact_email}</p>}
                    {client.contact_phone && <p>{client.contact_phone}</p>}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/transactions?client=${client.id}`)}
                  >
                    Transactions
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/reports?client=${client.id}`)}
                  >
                    Reports
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
