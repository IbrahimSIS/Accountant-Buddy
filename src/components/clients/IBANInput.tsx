import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { validateIBAN, formatIBAN, cleanIBAN, getIBANCountry } from "@/lib/iban-validation";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface IBANInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function IBANInput({ value, onChange, error: externalError, disabled }: IBANInputProps) {
  const [displayValue, setDisplayValue] = useState("");
  const [validation, setValidation] = useState<{
    isValid: boolean;
    error?: string;
    countryCode?: string;
  } | null>(null);
  const [isTouched, setIsTouched] = useState(false);

  useEffect(() => {
    if (value) {
      setDisplayValue(formatIBAN(value));
      setValidation(validateIBAN(value));
    } else {
      setDisplayValue("");
      setValidation(null);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Allow letters, numbers, and spaces
    const filtered = input.replace(/[^a-zA-Z0-9\s]/g, "").toUpperCase();
    setDisplayValue(formatIBAN(filtered));
    
    const cleaned = cleanIBAN(filtered);
    onChange(cleaned);
    
    if (cleaned.length >= 2) {
      setValidation(validateIBAN(cleaned));
    } else {
      setValidation(null);
    }
  };

  const handleBlur = () => {
    setIsTouched(true);
    if (value) {
      setValidation(validateIBAN(value));
    }
  };

  const showError = isTouched && validation && !validation.isValid && value.length > 0;
  const showSuccess = validation?.isValid && value.length > 0;
  const errorMessage = externalError || (showError ? validation?.error : undefined);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="JO94 CBJO 0010 0000 0000 0131 0003 02"
          disabled={disabled}
          className={cn(
            "pr-10 font-mono text-sm tracking-wide",
            showError && "border-destructive focus-visible:ring-destructive",
            showSuccess && "border-success focus-visible:ring-success"
          )}
          maxLength={42} // Max formatted length with spaces
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {showSuccess && (
            <CheckCircle className="h-4 w-4 text-success" />
          )}
          {showError && (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          {!showSuccess && !showError && value.length > 0 && (
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      
      {errorMessage && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {errorMessage}
        </p>
      )}
      
      {showSuccess && validation?.countryCode && (
        <p className="text-sm text-success flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Valid {getIBANCountry(validation.countryCode)} IBAN
        </p>
      )}
    </div>
  );
}
