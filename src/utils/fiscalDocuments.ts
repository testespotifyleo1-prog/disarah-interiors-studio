import { supabase } from '@/integrations/supabase/client';

type FiscalDocumentType = 'nfce' | 'nfe';
type FiscalDocumentStatus = 'processing' | 'issued' | 'error' | 'denied' | 'cancelled' | string;

type FiscalDocumentRow = {
  id: string;
  sale_id: string;
  type: FiscalDocumentType;
  status: FiscalDocumentStatus;
  nfe_number: string | null;
};

type CheckFiscalStatusResponse = {
  status?: FiscalDocumentStatus;
  status_label?: string;
  error_message?: string;
};

const TERMINAL_ERROR_STATUSES = ['error', 'denied', 'cancelled'];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeFiscalMessage(message: string) {
  if (message.includes('Schema xml')) {
    return 'Erro de validação no XML da nota. Verifique os dados fiscais dos produtos e da venda.';
  }

  if (message.includes('company_id')) {
    return 'Configure a empresa fiscal nas configurações da loja antes de emitir a NFC-e.';
  }

  return message;
}

async function getFiscalDocumentById(docId: string): Promise<FiscalDocumentRow | null> {
  const { data, error } = await supabase
    .from('fiscal_documents')
    .select('id, sale_id, type, status, nfe_number')
    .eq('id', docId)
    .maybeSingle();

  if (error) throw error;
  return (data as FiscalDocumentRow | null) ?? null;
}

export async function getLatestFiscalDocumentForSale(
  saleId: string,
  type: FiscalDocumentType = 'nfce',
): Promise<FiscalDocumentRow | null> {
  const { data, error } = await supabase
    .from('fiscal_documents')
    .select('id, sale_id, type, status, nfe_number')
    .eq('sale_id', saleId)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return ((data?.[0] as FiscalDocumentRow | undefined) ?? null);
}

export async function emitFiscalDocumentForSale(
  saleId: string,
  type: FiscalDocumentType = 'nfce',
): Promise<FiscalDocumentRow> {
  const { data, error } = await supabase.functions.invoke('emit-fiscal-document', {
    body: { sale_id: saleId, type },
  });

  if (error) throw error;
  if (data?.error) throw new Error(normalizeFiscalMessage(data.error));

  const fiscalDocument = data?.document as FiscalDocumentRow | undefined;
  if (!fiscalDocument?.id) {
    throw new Error('Não foi possível iniciar a emissão fiscal.');
  }

  return fiscalDocument;
}

export async function waitForFiscalDocumentIssued(
  docId: string,
  options?: { attempts?: number; delayMs?: number },
): Promise<FiscalDocumentRow> {
  const attempts = options?.attempts ?? 24;
  const delayMs = options?.delayMs ?? 2500;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await supabase.functions.invoke('check-fiscal-status', {
      body: { fiscal_document_id: docId },
    });

    if (error) throw error;

    const response = (data ?? {}) as CheckFiscalStatusResponse;
    const status = response.status;

    if (status === 'issued') {
      const fiscalDocument = await getFiscalDocumentById(docId);
      if (!fiscalDocument) {
        throw new Error('Documento fiscal não localizado após autorização.');
      }
      return fiscalDocument;
    }

    if (status && TERMINAL_ERROR_STATUSES.includes(status)) {
      throw new Error(response.error_message || `Documento fiscal ${response.status_label || status}.`);
    }

    if (attempt < attempts - 1) {
      await delay(delayMs);
    }
  }

  throw new Error('A NFC-e ainda está em processamento na SEFAZ. Tente novamente em alguns segundos.');
}

export async function ensureIssuedNfceForSale(saleId: string): Promise<FiscalDocumentRow> {
  let fiscalDocument = await getLatestFiscalDocumentForSale(saleId, 'nfce');

  if (!fiscalDocument) {
    fiscalDocument = await emitFiscalDocumentForSale(saleId, 'nfce');
  } else if (TERMINAL_ERROR_STATUSES.includes(fiscalDocument.status)) {
    throw new Error(`Já existe uma NFC-e com status "${fiscalDocument.status}" para esta venda. Verifique o fiscal antes de tentar novamente.`);
  }

  if (fiscalDocument.status !== 'issued') {
    fiscalDocument = await waitForFiscalDocumentIssued(fiscalDocument.id);
  }

  const refreshedDocument = await getFiscalDocumentById(fiscalDocument.id);
  if (!refreshedDocument) {
    throw new Error('Documento fiscal não encontrado após a emissão.');
  }

  if (refreshedDocument.status !== 'issued') {
    throw new Error('A NFC-e ainda não foi autorizada pela SEFAZ.');
  }

  return refreshedDocument;
}

function parseFilename(contentDisposition: string | null) {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const standardMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return standardMatch?.[1] ?? null;
}

export async function downloadFiscalDocumentFile(docId: string, format: 'pdf' | 'xml' = 'pdf') {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const session = (await supabase.auth.getSession()).data.session;

  if (!session) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/download-fiscal-file?doc_id=${docId}&format=${format}`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    },
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Erro ${response.status}`);
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') || '',
    fileName: parseFilename(response.headers.get('content-disposition')),
  };
}
