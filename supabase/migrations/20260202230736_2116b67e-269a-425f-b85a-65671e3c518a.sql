-- Fix RLS policy for accounts table to allow authenticated users to create their own accounts
DROP POLICY IF EXISTS "Users can insert their own accounts" ON public.accounts;

CREATE POLICY "Users can insert their own accounts" 
ON public.accounts 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = owner_user_id);