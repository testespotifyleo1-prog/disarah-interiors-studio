export interface ParsedNFeItem {
  code: string;
  description: string;
  ncm: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalLine: number;
}

export interface ParsedNFe {
  accessKey: string;
  nfeNumber: string;
  nfeSeries: string;
  issueDate: string;
  emitente: {
    cnpj: string;
    name: string;
    tradeName: string;
  };
  destinatario: {
    cnpj: string;
    name: string;
  };
  items: ParsedNFeItem[];
  totalProducts: number;
  totalFreight: number;
  totalDiscount: number;
  totalNfe: number;
}

function getTextContent(parent: Element, tagName: string): string {
  // Search without namespace first, then with
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || '';
}

export function parseNFeXml(xmlString: string): ParsedNFe {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('XML inválido: não foi possível parsear o arquivo.');

  // Find the infNFe element (contains the access key in Id attribute)
  const infNFe = doc.getElementsByTagName('infNFe')[0];
  if (!infNFe) throw new Error('XML inválido: elemento infNFe não encontrado.');

  const idAttr = infNFe.getAttribute('Id') || '';
  const accessKey = idAttr.replace(/^NFe/, '');

  // ide - identification
  const ide = doc.getElementsByTagName('ide')[0];
  const nfeNumber = getTextContent(ide, 'nNF');
  const nfeSeries = getTextContent(ide, 'serie');
  const issueDate = getTextContent(ide, 'dhEmi').substring(0, 10);

  // emit - emitter (supplier)
  const emit = doc.getElementsByTagName('emit')[0];
  const emitCnpj = getTextContent(emit, 'CNPJ');
  const emitName = getTextContent(emit, 'xNome');
  const emitTradeName = getTextContent(emit, 'xFant');

  // dest - destination (my store)
  const dest = doc.getElementsByTagName('dest')[0];
  const destCnpj = getTextContent(dest, 'CNPJ') || getTextContent(dest, 'CPF');
  const destName = getTextContent(dest, 'xNome');

  // items
  const detElements = doc.getElementsByTagName('det');
  const items: ParsedNFeItem[] = [];

  for (let i = 0; i < detElements.length; i++) {
    const det = detElements[i];
    const prod = det.getElementsByTagName('prod')[0];
    if (!prod) continue;

    items.push({
      code: getTextContent(prod, 'cProd'),
      description: getTextContent(prod, 'xProd'),
      ncm: getTextContent(prod, 'NCM'),
      cfop: getTextContent(prod, 'CFOP'),
      unit: getTextContent(prod, 'uCom'),
      quantity: parseFloat(getTextContent(prod, 'qCom')) || 0,
      unitPrice: parseFloat(getTextContent(prod, 'vUnCom')) || 0,
      totalLine: parseFloat(getTextContent(prod, 'vProd')) || 0,
    });
  }

  // totals
  const icmsTot = doc.getElementsByTagName('ICMSTot')[0];
  const totalProducts = parseFloat(getTextContent(icmsTot, 'vProd')) || 0;
  const totalFreight = parseFloat(getTextContent(icmsTot, 'vFrete')) || 0;
  const totalDiscount = parseFloat(getTextContent(icmsTot, 'vDesc')) || 0;
  const totalNfe = parseFloat(getTextContent(icmsTot, 'vNF')) || 0;

  return {
    accessKey,
    nfeNumber,
    nfeSeries,
    issueDate,
    emitente: { cnpj: emitCnpj, name: emitName, tradeName: emitTradeName },
    destinatario: { cnpj: destCnpj, name: destName },
    items,
    totalProducts,
    totalFreight,
    totalDiscount,
    totalNfe,
  };
}
