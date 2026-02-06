import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cleanIBAN } from "@/lib/iban-validation";

interface ClientMatch {
  id: string;
  name: string;
  iban: string;
  currency: string;
}

/**
 * Hook to find client matches based on IBAN
 * Used in reconciliation to auto-suggest clients for transactions
 */
export function useClientIBANMatch() {
  const [clients, setClients] = useState<ClientMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientsWithIBAN = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, iban, currency")
        .not("iban", "is", null)
        .order("name");

      if (!error && data) {
        setClients(data.filter((c) => c.iban) as ClientMatch[]);
      }
      setLoading(false);
    };

    fetchClientsWithIBAN();
  }, []);

  /**
   * Find a client by IBAN match
   * @param iban The IBAN to search for
   * @returns The matching client or null
   */
  const findClientByIBAN = (iban: string): ClientMatch | null => {
    if (!iban) return null;
    
    const cleanedInput = cleanIBAN(iban);
    
    // Find exact match first
    const exactMatch = clients.find(
      (client) => cleanIBAN(client.iban) === cleanedInput
    );
    
    if (exactMatch) return exactMatch;
    
    // Try partial match (last 10 digits - account number portion)
    if (cleanedInput.length >= 10) {
      const inputSuffix = cleanedInput.slice(-10);
      const partialMatch = clients.find((client) => {
        const clientIban = cleanIBAN(client.iban);
        return clientIban.slice(-10) === inputSuffix;
      });
      
      if (partialMatch) return partialMatch;
    }
    
    return null;
  };

  /**
   * Find all potential client matches from a list of IBANs
   * @param ibans Array of IBANs to check
   * @returns Map of IBAN to matching client
   */
  const findMatchesForIBANs = (ibans: string[]): Map<string, ClientMatch> => {
    const matches = new Map<string, ClientMatch>();
    
    ibans.forEach((iban) => {
      const match = findClientByIBAN(iban);
      if (match) {
        matches.set(iban, match);
      }
    });
    
    return matches;
  };

  return {
    clients,
    loading,
    findClientByIBAN,
    findMatchesForIBANs,
  };
}
