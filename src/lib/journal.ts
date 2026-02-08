import { supabase } from "@/integrations/supabase/client";

// ─── System Account Definitions ──────────────────────────────────────────────

export const SYSTEM_ACCOUNTS = {
  cash:    { code: "SYS-CASH", name: "Cash",              type: "asset"   as const },
  bank:    { code: "SYS-BANK", name: "Bank",              type: "asset"   as const },
  cheque:  { code: "SYS-CHQ",  name: "Cheque Clearing",   type: "asset"   as const },
  revenue: { code: "SYS-REV",  name: "Revenue",           type: "income"  as const },
  expense: { code: "SYS-EXP",  name: "General Expense",   type: "expense" as const },
} as const;

export type SystemAccountKey = keyof typeof SYSTEM_ACCOUNTS;
export type BookType = "cash" | "transfer" | "cheque";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BOOK_TO_ACCOUNT: Record<BookType, SystemAccountKey> = {
  cash:     "cash",
  transfer: "bank",
  cheque:   "cheque",
};

async function getOrCreateSystemAccount(
  clientId: string,
  key: SystemAccountKey
): Promise<string> {
  const def = SYSTEM_ACCOUNTS[key];

  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("client_id", clientId)
    .eq("code", def.code)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("accounts")
    .insert({
      client_id: clientId,
      code: def.code,
      name: def.name,
      type: def.type,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create system account ${def.code}: ${error.message}`);
  return created.id;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function ensureSystemAccounts(clientId: string): Promise<void> {
  for (const key of Object.keys(SYSTEM_ACCOUNTS) as SystemAccountKey[]) {
    await getOrCreateSystemAccount(clientId, key);
  }
}

export async function createJournalEntries(params: {
  transactionId: string;
  clientId: string;
  accountId: string | null;
  amount: number;
  type: "income" | "expense";
  book: BookType;
  date: string;
  notes?: string | null;
}): Promise<void> {
  const { transactionId, clientId, accountId, amount, type, book, date, notes } = params;

  const bookAccountId = await getOrCreateSystemAccount(clientId, BOOK_TO_ACCOUNT[book]);

  let debitAccountId: string;
  let creditAccountId: string;

  if (type === "expense") {
    debitAccountId  = accountId || await getOrCreateSystemAccount(clientId, "expense");
    creditAccountId = bookAccountId;
  } else {
    debitAccountId  = bookAccountId;
    creditAccountId = accountId || await getOrCreateSystemAccount(clientId, "revenue");
  }

  const entries = [
    {
      transaction_id: transactionId,
      client_id: clientId,
      account_id: debitAccountId,
      debit: amount,
      credit: 0,
      date,
      notes: notes || null,
    },
    {
      transaction_id: transactionId,
      client_id: clientId,
      account_id: creditAccountId,
      debit: 0,
      credit: amount,
      date,
      notes: notes || null,
    },
  ];

  const { error } = await supabase.from("journal_entries").insert(entries);
  if (error) {
    console.error("Failed to create journal entries:", error);
    throw error;
  }
}

export async function deleteJournalEntries(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("transaction_id", transactionId);

  if (error) {
    console.error("Failed to delete journal entries:", error);
  }
}
