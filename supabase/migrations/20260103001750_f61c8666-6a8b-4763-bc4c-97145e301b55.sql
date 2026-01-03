-- Fix infinite recursion between clients <-> client_access RLS policies

-- 1) Helper function to check client ownership without RLS recursion
create or replace function public.is_client_owner(_user_id uuid, _client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clients c
    where c.id = _client_id
      and c.owner_user_id = _user_id
  );
$$;

-- 2) Recreate client_access policies to avoid referencing clients table directly in policy expressions

-- Owners manage access (ALL)
drop policy if exists "Owners can manage client access" on public.client_access;
create policy "Owners can manage client access"
on public.client_access
as permissive
for all
to authenticated
using (public.is_client_owner(auth.uid(), client_id))
with check (public.is_client_owner(auth.uid(), client_id));

-- Users can view their access (SELECT)
drop policy if exists "Users can view their access" on public.client_access;
create policy "Users can view their access"
on public.client_access
as permissive
for select
to authenticated
using (user_id = auth.uid());
