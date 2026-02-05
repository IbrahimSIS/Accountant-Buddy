-- Add default_currency column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'JOD';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.default_currency IS 'User''s preferred currency for displaying amounts (e.g., JOD, USD, EUR)';