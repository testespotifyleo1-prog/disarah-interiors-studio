
ALTER TABLE public.fiscal_documents 
  ADD COLUMN IF NOT EXISTS ref_fiscal_document_id uuid REFERENCES public.fiscal_documents(id),
  ADD COLUMN IF NOT EXISTS return_note_id uuid REFERENCES public.return_notes(id),
  ADD COLUMN IF NOT EXISTS access_key text,
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'normal';
