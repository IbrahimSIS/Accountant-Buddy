-- Drop the broken policy
DROP POLICY IF EXISTS "Clients can view their assigned workspace" ON public.clients;

-- Recreate with correct reference to clients.id
CREATE POLICY "Users can view assigned clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_access
    WHERE client_access.client_id = clients.id
    AND client_access.user_id = auth.uid()
  )
);

-- Also make the owner policies permissive (they were restrictive which requires ALL to pass)
DROP POLICY IF EXISTS "Owners can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Owners can create clients" ON public.clients;
DROP POLICY IF EXISTS "Owners can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Owners can delete own clients" ON public.clients;

-- Recreate as permissive policies
CREATE POLICY "Owners can view own clients"
ON public.clients
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "Owners can create clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners can update own clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "Owners can delete own clients"
ON public.clients
FOR DELETE
TO authenticated
USING (owner_user_id = auth.uid());