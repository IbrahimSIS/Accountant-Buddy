 import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 
 interface CurrencyContextType {
   currency: string;
   setCurrency: (currency: string) => Promise<void>;
   formatCurrency: (amount: number) => string;
   loading: boolean;
 }
 
 const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
 
 export const currencies = [
   { code: "JOD", name: "Jordanian Dinar", symbol: "JOD" },
   { code: "USD", name: "US Dollar", symbol: "$" },
   { code: "EUR", name: "Euro", symbol: "€" },
   { code: "GBP", name: "British Pound", symbol: "£" },
   { code: "AED", name: "UAE Dirham", symbol: "AED" },
   { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
 ];
 
 export function CurrencyProvider({ children }: { children: ReactNode }) {
   const [currency, setCurrencyState] = useState("JOD");
   const [loading, setLoading] = useState(true);
 
  useEffect(() => {
    const fetchCurrency = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("default_currency")
            .eq("id", user.id)
            .maybeSingle();
          
          if (data?.default_currency) {
            setCurrencyState(data.default_currency);
          }
        }
      } catch (error) {
        console.error("Error fetching currency:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrency();

    let subscription: { unsubscribe: () => void } | null = null;
    
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          supabase
            .from("profiles")
            .select("default_currency")
            .eq("id", session.user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.default_currency) {
                setCurrencyState(data.default_currency);
              }
            });
        }
      });
      subscription = data.subscription;
    } catch (error) {
      console.error("Error setting up auth subscription:", error);
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, []);
 
   const setCurrency = useCallback(async (newCurrency: string) => {
     const { data: { user } } = await supabase.auth.getUser();
     if (user) {
       const { error } = await supabase
         .from("profiles")
         .update({ default_currency: newCurrency })
         .eq("id", user.id);
       
       if (!error) {
         setCurrencyState(newCurrency);
       }
     }
   }, []);
 
   const formatCurrency = useCallback((amount: number) => {
     const currencyInfo = currencies.find(c => c.code === currency);
     const symbol = currencyInfo?.symbol || currency;
     return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
   }, [currency]);
 
   return (
     <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency, loading }}>
       {children}
     </CurrencyContext.Provider>
   );
 }
 
 export function useCurrency() {
   const context = useContext(CurrencyContext);
   if (context === undefined) {
     throw new Error("useCurrency must be used within a CurrencyProvider");
   }
   return context;
 }