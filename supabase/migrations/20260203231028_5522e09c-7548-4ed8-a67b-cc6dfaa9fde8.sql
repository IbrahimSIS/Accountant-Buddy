-- Add bank_id and iban columns to clients table
ALTER TABLE public.clients
ADD COLUMN bank_id uuid REFERENCES public.banks(id) ON DELETE SET NULL,
ADD COLUMN iban text;

-- Add index for IBAN lookups (for reconciliation matching)
CREATE INDEX idx_clients_iban ON public.clients(iban) WHERE iban IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.clients.iban IS 'International Bank Account Number for automatic reconciliation matching';