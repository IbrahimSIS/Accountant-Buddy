import React, { ReactNode, useState, useEffect } from "react";
import { TooltipProvider as RadixTooltipProvider } from "@/components/ui/tooltip";

interface SafeTooltipProviderProps {
  children: ReactNode;
}

/**
 * A wrapper around RadixTooltipProvider that gracefully handles
 * environments where tooltips may not work (e.g., older mobile browsers).
 */
const SafeTooltipProvider: React.FC<SafeTooltipProviderProps> = ({ children }) => {
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);

  useEffect(() => {
    // Disable tooltips on touch-only devices as they're not useful anyway
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      setTooltipsEnabled(false);
    }
  }, []);

  if (!tooltipsEnabled) {
    // On touch devices, skip the TooltipProvider entirely
    return <>{children}</>;
  }

  try {
    return <RadixTooltipProvider>{children}</RadixTooltipProvider>;
  } catch {
    // If TooltipProvider fails, render children without it
    console.warn("TooltipProvider failed to render, falling back to no tooltips");
    return <>{children}</>;
  }
};

export default SafeTooltipProvider;
