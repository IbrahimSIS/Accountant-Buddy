-- Create banks reference table with Jordanian banks
CREATE TABLE public.banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- Banks are public reference data - anyone authenticated can read
CREATE POLICY "Authenticated users can view banks"
ON public.banks
FOR SELECT
TO authenticated
USING (true);

-- Insert Jordanian banks
INSERT INTO public.banks (name, code) VALUES
  ('Arab Bank', 'ARAB'),
  ('Housing Bank for Trade and Finance', 'HBTF'),
  ('Bank al Etihad', 'ETIH'),
  ('Bank of Jordan', 'BOJ'),
  ('Cairo Amman Bank', 'CAB'),
  ('Capital Bank of Jordan', 'CBJ'),
  ('Jordan Ahli Bank', 'AHLI'),
  ('Jordan Commercial Bank', 'JCB'),
  ('Arab Jordan Investment Bank', 'AJIB'),
  ('Jordan Kuwait Bank', 'JKB'),
  ('Safwa Islamic Bank', 'SAFWA'),
  ('Jordan Islamic Bank', 'JIB'),
  ('Jordan Dubai Islamic Bank', 'JDIB'),
  ('Al Rajhi Bank', 'RAJHI'),
  ('Standard Chartered', 'SCB');

-- Add bank_id to bank_accounts to link accounts to banks
ALTER TABLE public.bank_accounts
ADD COLUMN bank_id UUID REFERENCES public.banks(id);