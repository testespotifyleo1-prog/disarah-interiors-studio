ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS menu_theme text NOT NULL DEFAULT 'party';

ALTER TABLE public.accounts
DROP CONSTRAINT IF EXISTS accounts_menu_theme_check;

ALTER TABLE public.accounts
ADD CONSTRAINT accounts_menu_theme_check CHECK (menu_theme IN ('party', 'furniture'));