import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "income" | "expense" | "profit" | "balance";
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, variant = "balance" }: KPICardProps) {
  const variantClasses = {
    income: "kpi-income",
    expense: "kpi-expense",
    profit: "kpi-profit",
    balance: "kpi-balance",
  };

  const iconColors = {
    income: "text-accent",
    expense: "text-destructive",
    profit: "text-success",
    balance: "text-primary",
  };

  return (
    <div className={cn("kpi-card animate-fade-in", variantClasses[variant])}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn("rounded-lg bg-muted p-2.5", iconColors[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center text-xs font-medium",
              trend.value >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
