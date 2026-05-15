
-- Create super_admins table
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins sa
    WHERE sa.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
$$;

-- RLS: only super admins can see the table
CREATE POLICY "Super admins can view super_admins"
ON public.super_admins
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- Allow super admins to read ALL chatbot_settings (bypass account restriction)
CREATE POLICY "Super admins can view all chatbot settings"
ON public.chatbot_settings
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- Allow super admins to update ALL chatbot_settings
CREATE POLICY "Super admins can update all chatbot settings"
ON public.chatbot_settings
FOR UPDATE
TO authenticated
USING (public.is_super_admin());

-- Allow super admins to insert chatbot_settings for any store
CREATE POLICY "Super admins can insert chatbot settings"
ON public.chatbot_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

-- Allow super admins to view all stores
CREATE POLICY "Super admins can view all stores"
ON public.stores
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- Allow super admins to view all accounts
CREATE POLICY "Super admins can view all accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- Insert the super admin
INSERT INTO public.super_admins (email) VALUES ('leojunioandrade19921@gmail.com');
