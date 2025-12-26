-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('owner', 'client');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'JOD',
  fiscal_year_start INTEGER NOT NULL DEFAULT 1 CHECK (fiscal_year_start >= 1 AND fiscal_year_start <= 12),
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_access table for client users to access their workspace
CREATE TABLE public.client_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);

-- Create bank_accounts table
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  iban TEXT,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'JOD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create account_type enum
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');

-- Create accounts table (Chart of Accounts)
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type account_type NOT NULL,
  parent_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, code)
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transaction_source enum
CREATE TYPE public.transaction_source AS ENUM ('manual', 'import');

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  source transaction_source NOT NULL DEFAULT 'manual',
  external_ref TEXT,
  attachment_url TEXT,
  notes TEXT,
  is_reconciled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reconciliation_status enum
CREATE TYPE public.reconciliation_status AS ENUM ('in_progress', 'completed', 'cancelled');

-- Create reconciliation_runs table
CREATE TABLE public.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  statement_balance DECIMAL(15,2),
  status reconciliation_status NOT NULL DEFAULT 'in_progress',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reconciliation_items table
CREATE TABLE public.reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  matched BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rules table for auto-categorization
CREATE TABLE public.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to check if user can access client
CREATE OR REPLACE FUNCTION public.can_access_client(_user_id UUID, _client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients WHERE id = _client_id AND owner_user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.client_access WHERE client_id = _client_id AND user_id = _user_id
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies (users can view their own roles)
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Clients policies
CREATE POLICY "Owners can view own clients" ON public.clients FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY "Owners can create clients" ON public.clients FOR INSERT WITH CHECK (owner_user_id = auth.uid() AND public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update own clients" ON public.clients FOR UPDATE USING (owner_user_id = auth.uid());
CREATE POLICY "Owners can delete own clients" ON public.clients FOR DELETE USING (owner_user_id = auth.uid());
CREATE POLICY "Clients can view their assigned workspace" ON public.clients FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.client_access WHERE client_id = id AND user_id = auth.uid())
);

-- Client access policies
CREATE POLICY "Owners can manage client access" ON public.client_access FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE id = client_id AND owner_user_id = auth.uid())
);
CREATE POLICY "Users can view their access" ON public.client_access FOR SELECT USING (user_id = auth.uid());

-- Bank accounts policies
CREATE POLICY "Users can access bank accounts" ON public.bank_accounts FOR ALL USING (
  public.can_access_client(auth.uid(), client_id)
);

-- Accounts policies
CREATE POLICY "Users can access accounts" ON public.accounts FOR ALL USING (
  public.can_access_client(auth.uid(), client_id)
);

-- Categories policies
CREATE POLICY "Users can access categories" ON public.categories FOR ALL USING (
  public.can_access_client(auth.uid(), client_id)
);

-- Transactions policies
CREATE POLICY "Users can access transactions" ON public.transactions FOR ALL USING (
  public.can_access_client(auth.uid(), client_id)
);

-- Reconciliation runs policies
CREATE POLICY "Users can access reconciliation runs" ON public.reconciliation_runs FOR ALL USING (
  public.can_access_client(auth.uid(), client_id)
);

-- Reconciliation items policies
CREATE POLICY "Users can access reconciliation items" ON public.reconciliation_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.reconciliation_runs r WHERE r.id = run_id AND public.can_access_client(auth.uid(), r.client_id))
);

-- Rules policies
CREATE POLICY "Users can access rules" ON public.rules FOR ALL USING (
  public.can_access_client(auth.uid(), client_id)
);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Assign owner role by default (first user is owner, or based on metadata)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'owner'));
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();