import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertCardProps {
  title: string;
  description: string;
  type: "error" | "warning" | "success";
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function AlertCard({ title, description, type, action }: AlertCardProps) {
  const icons = {
    error: AlertCircle,
    warning: AlertTriangle,
    success: CheckCircle,
  };

  const styles = {
    error: "border-destructive/30 bg-destructive/5",
    warning: "border-warning/30 bg-warning/5",
    success: "border-success/30 bg-success/5",
  };

  const iconStyles = {
    error: "text-destructive",
    warning: "text-warning",
    success: "text-success",
  };

  const Icon = icons[type];

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-4", styles[type])}>
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconStyles[type])} />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            {action.label} →
          </button>
        )}
      </div>
    </div>
  );
}
