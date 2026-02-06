import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Receipt, BookOpen, Scale, FileBarChart, Settings, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabaseClient as supabase } from "@/lib/supabase-client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
const navItems = [{
  to: "/",
  icon: LayoutDashboard,
  label: "Dashboard"
}, {
  to: "/clients",
  icon: Users,
  label: "Clients"
}, {
  to: "/transactions",
  icon: Receipt,
  label: "Transactions"
}, {
  to: "/accounts",
  icon: BookOpen,
  label: "Chart of Accounts"
}, {
  to: "/reconciliation",
  icon: Scale,
  label: "Reconciliation"
}, {
  to: "/reports",
  icon: FileBarChart,
  label: "Reports"
}, {
  to: "/settings",
  icon: Settings,
  label: "Settings"
}];
export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Auto-close sidebar on route change for mobile
  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [location.pathname, isMobile]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
    } else {
      navigate("/auth");
    }
  };

  const handleNavClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // On mobile, show hamburger toggle behavior
  const isOpen = isMobile ? mobileOpen : true;
  const sidebarWidth = collapsed ? "w-16" : "w-64";

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}
      
      {/* Mobile hamburger button */}
      {isMobile && !mobileOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="fixed left-4 top-4 z-50 h-10 w-10 bg-sidebar text-sidebar-foreground shadow-md"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      )}

      <aside className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-sidebar transition-all duration-300",
        sidebarWidth,
        isMobile && !mobileOpen && "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
                <BookOpen className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-sidebar-foreground">Pro Accountant</h1>
                <p className="text-xs text-sidebar-muted">Hub</p>
              </div>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => isMobile ? setMobileOpen(false) : setCollapsed(!collapsed)} 
            className="h-8 w-8 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {isMobile ? (
              <ChevronLeft className="h-4 w-4 text-stone-50" />
            ) : collapsed ? (
              <ChevronRight className="h-4 w-4 text-stone-50" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(item => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink 
                key={item.to} 
                to={item.to} 
                onClick={handleNavClick}
                className={cn("sidebar-link", isActive && "active", collapsed && "justify-center px-2")} 
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0 text-stone-50" />
                {!collapsed && <span className="text-secondary">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="border-t border-sidebar-border p-3">
          <button 
            onClick={handleSignOut} 
            className={cn("sidebar-link w-full text-sidebar-muted hover:text-destructive", collapsed && "justify-center px-2")} 
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}