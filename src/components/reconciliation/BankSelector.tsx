import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, Building2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface Bank {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
}

interface BankSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** Whether to remember the user's choice in localStorage (default: true for reconciliation, false for forms) */
  rememberChoice?: boolean;
}

const BANK_STORAGE_KEY = "preferred_bank_id";

// Bank initials for the icon fallback
const getBankInitials = (name: string): string => {
  const words = name.split(" ");
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
};

// Generate a consistent color based on bank code
const getBankColor = (code: string): string => {
  const colors = [
    "bg-primary/10 text-primary",
    "bg-accent/10 text-accent",
    "bg-chart-1/10 text-chart-1",
    "bg-chart-2/10 text-chart-2",
    "bg-chart-3/10 text-chart-3",
    "bg-success/10 text-success",
    "bg-warning/10 text-warning",
  ];
  const index = code.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

export function BankSelector({
  value,
  onValueChange,
  disabled = false,
  className,
  rememberChoice = false,
}: BankSelectorProps) {
  const [open, setOpen] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBanks();
  }, []);

  // Set default from localStorage if rememberChoice is enabled and no value provided
  useEffect(() => {
    if (rememberChoice && !value && banks.length > 0) {
      const storedBankId = localStorage.getItem(BANK_STORAGE_KEY);
      if (storedBankId && banks.some((b) => b.id === storedBankId)) {
        onValueChange(storedBankId);
      }
    }
  }, [banks, value, onValueChange, rememberChoice]);

  const fetchBanks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("banks")
      .select("id, name, code, logo_url")
      .order("name");

    if (!error && data) {
      setBanks(data);
    }
    setLoading(false);
  };

  const handleSelect = (bankId: string) => {
    onValueChange(bankId);
    if (rememberChoice) {
      localStorage.setItem(BANK_STORAGE_KEY, bankId);
    }
    setOpen(false);
  };

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === value),
    [banks, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading banks...
            </span>
          ) : selectedBank ? (
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold",
                  getBankColor(selectedBank.code)
                )}
              >
                {getBankInitials(selectedBank.name)}
              </span>
              <span className="truncate">{selectedBank.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Select bank...
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search banks..."
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0"
            />
          </div>
          <CommandList>
            <CommandEmpty>No bank found.</CommandEmpty>
            <CommandGroup>
              {banks.map((bank) => (
                <CommandItem
                  key={bank.id}
                  value={bank.name}
                  onSelect={() => handleSelect(bank.id)}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold shrink-0",
                      getBankColor(bank.code)
                    )}
                  >
                    {getBankInitials(bank.name)}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{bank.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {bank.code}
                    </span>
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0",
                      value === bank.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
