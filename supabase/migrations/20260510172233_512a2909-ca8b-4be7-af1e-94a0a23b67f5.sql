
-- ============================================================
-- FASE 1, 2 e 3 — FISCAL ESSENCIAL (Focus NFe)
-- ============================================================

-- 1.1 INUTILIZAÇÃO DE NUMERAÇÃO ------------------------------
CREATE TABLE public.fiscal_invalidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  store_id UUID NOT NULL,
  user_id UUID,
  modelo TEXT NOT NULL CHECK (modelo IN ('55','65')),
  serie INT NOT NULL,
  numero_inicial INT NOT NULL,
  numero_final INT NOT NULL,
  justificativa TEXT NOT NULL CHECK (length(justificativa) BETWEEN 15 AND 255),
  status TEXT NOT NULL DEFAULT 'processing',
  protocolo TEXT,
  provider_ref TEXT,
  xml_url TEXT,
  response_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fiscal_invalidations_store ON public.fiscal_invalidations(store_id, created_at DESC);
ALTER TABLE public.fiscal_invalidations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view invalidations"
  ON public.fiscal_invalidations FOR SELECT
  USING (public.is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can manage invalidations"
  ON public.fiscal_invalidations FOR ALL
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]))
  WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]));
CREATE TRIGGER set_fiscal_invalidations_updated_at
  BEFORE UPDATE ON public.fiscal_invalidations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 1.2 MDF-e ---------------------------------------------------
CREATE TABLE public.mdfe_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  store_id UUID NOT NULL,
  user_id UUID,
  numero INT,
  serie INT NOT NULL DEFAULT 1,
  modelo TEXT NOT NULL DEFAULT '58',
  chave TEXT,
  protocolo TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  provider_ref TEXT UNIQUE,
  xml_url TEXT,
  pdf_url TEXT,
  uf_carregamento TEXT NOT NULL,
  uf_descarregamento TEXT NOT NULL,
  municipio_carregamento TEXT,
  municipio_descarregamento TEXT,
  veiculo_placa TEXT NOT NULL,
  veiculo_uf TEXT,
  veiculo_tara INT,
  veiculo_rntrc TEXT,
  motorista_nome TEXT NOT NULL,
  motorista_cpf TEXT NOT NULL,
  peso_total NUMERIC(12,3) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  documentos_vinculados JSONB DEFAULT '[]'::jsonb,
  origem_tipo TEXT,
  origem_id UUID,
  encerrado_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  cancel_justificativa TEXT,
  response_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mdfe_store_status ON public.mdfe_documents(store_id, status, created_at DESC);
CREATE INDEX idx_mdfe_origem ON public.mdfe_documents(origem_tipo, origem_id);
ALTER TABLE public.mdfe_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view mdfe"
  ON public.mdfe_documents FOR SELECT
  USING (public.is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can manage mdfe"
  ON public.mdfe_documents FOR ALL
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role,'manager'::account_role]))
  WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role,'manager'::account_role]));
CREATE TRIGGER set_mdfe_updated_at
  BEFORE UPDATE ON public.mdfe_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Estende drivers com campos do MDF-e (placa, RNTRC etc.)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS vehicle_plate TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_uf TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_tara INT,
  ADD COLUMN IF NOT EXISTS rntrc TEXT;

-- 1.3 MANIFESTAÇÃO DO DESTINATÁRIO ---------------------------
CREATE TABLE public.nfe_destination_manifest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  store_id UUID NOT NULL,
  chave_nfe TEXT NOT NULL,
  cnpj_emitente TEXT,
  nome_emitente TEXT,
  numero_nfe TEXT,
  serie_nfe TEXT,
  valor_nfe NUMERIC(12,2),
  data_emissao TIMESTAMPTZ,
  tipo_manifestacao TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  protocolo TEXT,
  manifested_at TIMESTAMPTZ,
  user_id UUID,
  response_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, chave_nfe)
);
CREATE INDEX idx_nfe_dest_store_status ON public.nfe_destination_manifest(store_id, status, data_emissao DESC);
ALTER TABLE public.nfe_destination_manifest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view dest manifest"
  ON public.nfe_destination_manifest FOR SELECT
  USING (public.is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can manage dest manifest"
  ON public.nfe_destination_manifest FOR ALL
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role,'manager'::account_role]))
  WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role,'manager'::account_role]));
CREATE TRIGGER set_nfe_dest_updated_at
  BEFORE UPDATE ON public.nfe_destination_manifest
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2.1 CONTINGÊNCIA NFC-e -------------------------------------
ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS contingency_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contingency_justification TEXT,
  ADD COLUMN IF NOT EXISTS transmitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_contingency
  ON public.fiscal_documents(store_id, contingency_mode, status)
  WHERE contingency_mode = true AND status NOT IN ('issued','cancelled');

-- 2.2 CARTA DE CORREÇÃO --------------------------------------
CREATE TABLE public.fiscal_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  store_id UUID NOT NULL,
  fiscal_document_id UUID NOT NULL REFERENCES public.fiscal_documents(id) ON DELETE CASCADE,
  user_id UUID,
  sequencia INT NOT NULL,
  correcao_text TEXT NOT NULL CHECK (length(correcao_text) BETWEEN 15 AND 1000),
  status TEXT NOT NULL DEFAULT 'processing',
  protocolo TEXT,
  provider_ref TEXT,
  xml_url TEXT,
  pdf_url TEXT,
  response_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fiscal_document_id, sequencia)
);
CREATE INDEX idx_fiscal_corrections_doc ON public.fiscal_corrections(fiscal_document_id);
ALTER TABLE public.fiscal_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view corrections"
  ON public.fiscal_corrections FOR SELECT
  USING (public.is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can manage corrections"
  ON public.fiscal_corrections FOR ALL
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role,'manager'::account_role]))
  WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role,'manager'::account_role]));
CREATE TRIGGER set_fiscal_corrections_updated_at
  BEFORE UPDATE ON public.fiscal_corrections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3.1 BACKUP XMLs --------------------------------------------
CREATE TABLE public.fiscal_xml_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  store_id UUID NOT NULL,
  fiscal_document_id UUID REFERENCES public.fiscal_documents(id) ON DELETE SET NULL,
  chave_nfe TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INT,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, chave_nfe)
);
CREATE INDEX idx_xml_backups_account_date ON public.fiscal_xml_backups(account_id, backed_up_at DESC);
ALTER TABLE public.fiscal_xml_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view backups"
  ON public.fiscal_xml_backups FOR SELECT
  USING (public.is_account_member(auth.uid(), account_id));

-- Storage bucket privado para XMLs
INSERT INTO storage.buckets (id, name, public)
VALUES ('fiscal-xmls', 'fiscal-xmls', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members can read fiscal xmls"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'fiscal-xmls'
    AND public.is_account_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
