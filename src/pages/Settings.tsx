import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Settings as SettingsIcon,
  User,
  Building2,
  Bell,
  Shield,
  RefreshCw,
  Save,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
 import { useCurrency, currencies } from "@/contexts/CurrencyContext";

export default function SettingsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
   const { currency, setCurrency } = useCurrency();

  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    autoCategorizationEnabled: true,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      setProfile({
        fullName: data.full_name || "",
        email: data.email || "",
      });
    }
  };

   const handleCurrencyChange = async (newCurrency: string) => {
     try {
       await setCurrency(newCurrency);
       toast.success(`Currency updated to ${newCurrency}`);
     } catch (error) {
       toast.error("Failed to update currency");
     }
   };
 
  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.fullName,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile saved");
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
    } else {
      navigate("/auth");
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
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and application preferences
          </p>
        </div>

        {/* Profile Section */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Profile</h2>
              <p className="text-sm text-muted-foreground">Your personal information</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={profile.fullName}
                  onChange={(e) =>
                    setProfile({ ...profile, fullName: e.target.value })
                  }
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Preferences</h2>
              <p className="text-sm text-muted-foreground">
                Default settings for new clients
              </p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Select
                 value={currency}
                 onValueChange={handleCurrencyChange}
              >
                <SelectTrigger className="w-[250px]">
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
               <p className="text-xs text-muted-foreground">
                 This currency will be used across the dashboard and all reports
               </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Categorization</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically categorize imported transactions using rules
                </p>
              </div>
              <Switch
                checked={preferences.autoCategorizationEnabled}
                onCheckedChange={(checked) =>
                  setPreferences({
                    ...preferences,
                    autoCategorizationEnabled: checked,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Notifications</h2>
              <p className="text-sm text-muted-foreground">
                Manage notification preferences
              </p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email alerts for important events
                </p>
              </div>
              <Switch
                checked={preferences.emailNotifications}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, emailNotifications: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Security</h2>
              <p className="text-sm text-muted-foreground">
                Account security settings
              </p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <Button variant="outline">Change Password</Button>
            <p className="text-sm text-muted-foreground">
              Last password change: Never
            </p>
          </div>
        </div>

        {/* Sign Out Section */}
        <div className="rounded-xl border border-destructive/20 bg-card">
          <div className="flex items-center gap-3 border-b border-destructive/20 px-6 py-4">
            <LogOut className="h-5 w-5 text-destructive" />
            <div>
              <h2 className="font-semibold">Sign Out</h2>
              <p className="text-sm text-muted-foreground">
                End your current session
              </p>
            </div>
          </div>
          <div className="p-6">
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
