import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type HistoryMessage = { direction: string; content: string };

type ProductSearchResult = {
  id: string;
  name: string;
  brand: string | null;
  price_default: number;
  promo_price: number | null;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
  sku: string | null;
  category: string | null;
  description: string | null;
  unit: string | null;
  image_url: string | null;
  ai_training: string | null;
  embedding_text?: string | null;
};

type RankedProduct = ProductSearchResult & { score: number; similarity?: number };

function mergeRankedProducts(products: RankedProduct[]): RankedProduct[] {
  const byId = new Map<string, RankedProduct>();
  for (const product of products) {
    const current = byId.get(product.id);
    if (!current || (product.score || 0) > (current.score || 0)) byId.set(product.id, product);
  }
  return [...byId.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
}

// Busca global estável: usa índice textual local em products.embedding_text.
// Não depende de endpoint externo de embeddings, então não quebra com 404/timeout.
async function indexedProductSearch(
  supabase: any,
  accountId: string,
  queryText: string,
  matchCount = 6,
): Promise<RankedProduct[]> {
  const terms = extractSearchTerms(queryText).slice(0, 8);
  if (terms.length === 0) return [];

  const fields = ["embedding_text", "name", "brand", "category", "description", "sku", "ai_training"];
  const orFilter = uniqueStrings(terms.flatMap(term => fields.map(field => `${field}.ilike.%${term}%`))).join(",");
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, price_default, promo_price, promo_starts_at, promo_ends_at, sku, category, description, unit, image_url, ai_training, embedding_text")
    .eq("account_id", accountId)
    .eq("is_active", true)
    .or(orFilter)
    .limit(500);

  if (error) {
    console.error("[zapi-webhook] indexed product search error:", error);
    return [];
  }

  const intent: ParsedIntent = {
    intencao: "buscar_produto",
    produto_busca: queryText,
    categoria: null,
    marca: null,
    sabor: null,
    gramagem: null,
    solicitou_preco: false,
    solicitou_link: false,
  };

  const ranked = (data || [])
    .map((product: any) => {
      const indexText = normalizeText(product.embedding_text || "");
      const matchedIndexTerms = terms.filter(term => termMatchesText(term, indexText)).length;
      const score = scoreProduct(product, intent) + matchedIndexTerms * 8;
      return { ...product, score, similarity: Math.min(0.99, score / 60) } as RankedProduct;
    })
    .filter((product: RankedProduct) => product.score > 0)
    .sort((a: RankedProduct, b: RankedProduct) => b.score - a.score)
    .slice(0, matchCount);

  return mergeRankedProducts(ranked);
}

// ─── SYNONYMS & TYPO CORRECTIONS ───
const SYNONYMS: Record<string, string[]> = {
  biscoito: ["bolacha", "biscoto", "biscouto", "cookie", "cookies"],
  refrigerante: ["refri", "refrigera", "refrig"],
  chocolate: ["chocolatte", "chocolat", "xocolate"],
  sabão: ["sabao"],
  detergente: ["deterjente"],
  amaciante: ["amacianti", "amaciant"],
  café: ["cafe"],
  açúcar: ["acucar", "açucar"],
  leite: ["leiti"],
  margarina: ["margarina"],
  macarrão: ["macarrao"],
  caixa: ["cx"],
  pacote: ["pct", "paco"],
  litro: ["lt", "lts"],
  quilograma: ["kg", "kilo", "quilo"],
  grama: ["gr", "gramas"],
  mililitro: ["ml"],
  unidade: ["un", "und"],
  // Diminutivos PT-BR comuns no atendimento
  bico: ["biquinho", "biquinhos", "bicos"],
  saco: ["saquinho", "saquinhos", "sacos"],
  copo: ["copinho", "copinhos", "copos"],
  caixa: ["caixinha", "caixinhas", "caixas", "cx"],
  forma: ["forminha", "forminhas", "formas"],
  garrafa: ["garrafinha", "garrafinhas", "garrafas"],
  prato: ["pratinho", "pratinhos", "pratos"],
  colher: ["colherzinha", "colherinha", "colheres"],
  bandeja: ["bandejinha", "bandejas"],
  pacote: ["pacotinho", "pacotinhos", "pacotes", "pct", "paco"],
  doce: ["docinho", "docinhos", "doces"],
  bolo: ["bolinho", "bolinhos", "bolos"],
  vela: ["velinha", "velinhas", "velas"],
  fita: ["fitinha", "fitinhas", "fitas"],
  laco: ["lacinho", "lacinhos", "lacos", "laço", "laços"],
  balao: ["baozinho", "balaozinho", "balaozinhos", "baloes", "balões", "balão"],
  papel: ["papelzinho", "papeis", "papéis"],
};

// Build reverse map: typo/synonym -> canonical
const REVERSE_SYNONYMS: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
  for (const alias of aliases) {
    REVERSE_SYNONYMS[alias] = canonical;
  }
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d)[.,](\d)/g, "$1$2").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function applySynonyms(term: string): string {
  return REVERSE_SYNONYMS[term] || term;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

const STOP_WORDS = new Set([
  "de","da","do","das","dos","um","uma","uns","umas","o","a","os","as",
  "e","ou","em","no","na","nos","nas","por","para","com","sem","que",
  "sobre","produto","produtos","detalhe","detalhes","informacao","informacoes",
  "se","ao","aos","eu","tu","ele","ela","nos","eles","elas",
  "meu","minha","seu","sua","nosso","nossa","esse","essa","este","esta","desse","dessa","deste","desta",
  "isso","isto","aquilo","aquele","aquela","tem","ter","temos",
  "quero","queria","gostaria","preciso","procuro","busco","voces","vcs","vc",
  "pode","podem","me","te","lhe","muito","mais","menos","qual","como",
  "onde","quando","ja","ainda","aqui","ali","la","sim","nao","oi","ola",
  "bom","boa","dia","tarde","noite","obrigado","obrigada","tudo","bem",
  "favor","tipo","sera","seria","algum","alguma","alguem","algo","vao",
  "tiver","manda","mande","mandar","envie","enviar","saber","ver","olhar",
  "vou","vai","ir","querer","comprar","pegar","queria","gostaria",
  "preco","preço","valor","quanto","custa","custando","sai","disponivel","disponivel","vende","vendem",
]);

function extractSearchTerms(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
  return uniqueStrings(words.map(applySynonyms));
}

const GENERIC_PRODUCT_TERMS = new Set([
  "caixa", "cx", "pacote", "pct", "unidade", "un", "und", "produto", "produtos", "item", "itens", "doces", "doce", "embalagem", "embalagens",
  "kit", "combo", "sortido", "sortidos", "grande", "pequeno", "medio", "mini", "normal",
]);

function isDistinctiveTerm(term: string): boolean {
  if (/^\d+$/.test(term)) return true;
  return term.length >= 4 && !GENERIC_PRODUCT_TERMS.has(term);
}

function getSearchTermsFromIntent(intent: ParsedIntent): string[] {
  const terms = intent.produto_busca ? extractSearchTerms(intent.produto_busca) : [];
  if (intent.categoria) terms.push(...extractSearchTerms(intent.categoria));
  if (intent.marca) terms.push(...extractSearchTerms(intent.marca));
  if (intent.sabor) terms.push(...extractSearchTerms(intent.sabor));
  if (intent.gramagem) terms.push(...extractSearchTerms(intent.gramagem));
  return uniqueStrings(terms);
}

function splitAlphaNumericTerm(term: string): string[] | null {
  const match = term.match(/^([a-z]{2,})(\d+)$/);
  if (!match) return null;
  return [match[1], match[2]];
}

function termMatchesText(term: string, text: string): boolean {
  if (!term || !text) return false;
  const termParts = splitAlphaNumericTerm(term);
  if (termParts) {
    return termParts.every(part => termMatchesText(part, text));
  }
  if (/^\d+[a-z]+$/.test(term)) {
    const compactText = text.replace(/\s+/g, "");
    return compactText.includes(term) || compactText.includes(term.replace(/g$/, "grama"));
  }
  if (/^\d+$/.test(term)) {
    const numericTerm = term.replace(/^0+/, "") || "0";
    return text.split(" ").some(token => {
      const numericToken = token.match(/^\d+/)?.[0];
      return numericToken && ((numericToken.replace(/^0+/, "") || "0") === numericTerm);
    });
  }
  if (text.includes(term)) return true;
  return text.split(" ").some(token => fuzzyTokenMatch(term, token));
}

function productSearchText(product: ProductSearchResult): string {
  return normalizeText([
    product.name,
    product.brand || "",
    product.category || "",
    product.description || "",
    product.sku || "",
  ].join(" "));
}

function productNameText(product: ProductSearchResult): string {
  return normalizeText([product.name, product.brand || "", product.sku || ""].join(" "));
}

function getStrictProductTerms(intent: ParsedIntent): string[] {
  const primaryTerms = intent.produto_busca ? extractSearchTerms(intent.produto_busca).filter(isDistinctiveTerm) : [];
  const attributeTerms = [intent.marca, intent.sabor, intent.gramagem]
    .flatMap(v => v ? extractSearchTerms(v).filter(isDistinctiveTerm) : []);
  return uniqueStrings([...primaryTerms, ...attributeTerms]);
}

function hasStrictCatalogMatch(product: ProductSearchResult, intent: ParsedIntent): boolean {
  const strictTerms = getStrictProductTerms(intent);
  if (strictTerms.length === 0) return false;

  const nameHaystack = productNameText(product);
  const fullHaystack = productSearchText(product);
  const matchedInName = strictTerms.filter(term => termMatchesText(term, nameHaystack));
  const matchedAnywhere = strictTerms.filter(term => termMatchesText(term, fullHaystack));

  if (strictTerms.length === 1) return matchedInName.length === 1;

  const requiredMatches = Math.max(2, Math.ceil(strictTerms.length * 0.8));
  return matchedAnywhere.length >= requiredMatches && matchedInName.length >= Math.min(2, strictTerms.length);
}

function isRelevantProductMatch(product: ProductSearchResult, intent: ParsedIntent): boolean {
  const terms = getSearchTermsFromIntent(intent);
  if (terms.length === 0) return false;

  if (!hasStrictCatalogMatch(product, intent)) return false;

  const haystack = productSearchText(product);
  const matchedTerms = terms.filter(term => termMatchesText(term, haystack));
  const distinctiveTerms = terms.filter(isDistinctiveTerm);
  const matchedDistinctive = distinctiveTerms.filter(term => termMatchesText(term, haystack));

  // When the customer asks for a specific product, every distinctive identifier must exist in a real catalog row.
  // This blocks generic matches like "caixa panetone" for "caixa calendário do advento 07 doces".
  if (distinctiveTerms.length >= 2 && matchedDistinctive.length < distinctiveTerms.length) return false;
  if (distinctiveTerms.length === 1 && matchedDistinctive.length === 0) return false;

  if (terms.length >= 3) return matchedTerms.length / terms.length >= 0.7;
  return matchedTerms.length > 0;
}

function isGreeting(text: string): boolean {
  const n = normalizeText(text);
  return /^(oi|ola|bom dia|boa tarde|boa noite|hey|eai|e ai|fala|salve|opa)\b/.test(n) && n.split(" ").length <= 6;
}

function isCatalogRequest(text: string): boolean {
  const n = normalizeText(text);
  return /(quais tem|quero ver|quero olhar|ver opcoes|ver as opcoes|me manda o link|manda o link|catalogo|site|navegar|ver tudo|me envia o link)/.test(n);
}

// ─── INTENT EXTRACTION (AI-powered, structured) ───
type ParsedIntent = {
  intencao: "buscar_produto" | "saudacao" | "catalogo" | "outro";
  produto_busca: string | null;
  categoria: string | null;
  marca: string | null;
  sabor: string | null;
  gramagem: string | null;
  solicitou_preco: boolean;
  solicitou_link: boolean;
};

async function extractIntent(
  messageText: string,
  history: HistoryMessage[],
  apiKey: string
): Promise<ParsedIntent> {
  // Fast-path for obvious greetings
  if (isGreeting(messageText)) {
    return { intencao: "saudacao", produto_busca: null, categoria: null, marca: null, sabor: null, gramagem: null, solicitou_preco: false, solicitou_link: false };
  }
  if (isCatalogRequest(messageText)) {
    return { intencao: "catalogo", produto_busca: null, categoria: null, marca: null, sabor: null, gramagem: null, solicitou_preco: false, solicitou_link: false };
  }

  // Use last 5 messages for context
  const recentHistory = history.slice(-5).map(m =>
    `${m.direction === "inbound" ? "Cliente" : "Bot"}: ${m.content}`
  ).join("\n");

  const prompt = `Analise a mensagem do cliente e extraia a intenção de busca de produto.

Histórico recente:
${recentHistory}

Mensagem atual: "${messageText}"

Responda APENAS com JSON válido, sem markdown, sem explicação:
{
  "intencao": "buscar_produto" ou "saudacao" ou "catalogo" ou "outro",
  "produto_busca": "termo principal para buscar no banco" ou null,
  "categoria": "categoria do produto" ou null,
  "marca": "marca mencionada" ou null,
  "sabor": "sabor mencionado" ou null,
  "gramagem": "peso/volume mencionado" ou null,
  "solicitou_preco": true/false,
  "solicitou_link": true/false
}

REGRAS:
- "produto_busca" deve ser o nome COMPLETO do produto (ex: "biscoito de chocolate", não apenas "chocolate")
- Corrija erros de digitação no produto_busca (ex: "chocolatte" -> "chocolate", "biscoto" -> "biscoito")
- "bolacha" = "biscoito", "refri" = "refrigerante"
- Se o cliente mencionou produto em mensagens anteriores e agora especifica detalhe (gramagem, sabor), mantenha o produto completo
- Se não há pedido de produto, intencao = "saudacao" ou "outro"`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    });

    if (!resp.ok) throw new Error(`AI ${resp.status}`);

    const data = await resp.json();
    const raw = (data.choices?.[0]?.message?.content || "").trim();
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr) as ParsedIntent;
    console.log("[zapi-webhook] Intent extracted:", JSON.stringify(parsed));
    return parsed;
  } catch (err) {
    console.error("[zapi-webhook] Intent extraction failed, falling back to local parser:", err);
    // Fallback: local extraction
    const terms = extractSearchTerms(messageText);
    const n = normalizeText(messageText);
    return {
      intencao: terms.length > 0 ? "buscar_produto" : "outro",
      produto_busca: terms.join(" ") || null,
      categoria: null,
      marca: null,
      sabor: null,
      gramagem: (n.match(/\d+\s?(?:g|gr|kg|ml|l|lt)\b/)?.[0]) || null,
      solicitou_preco: /preco|preço|quanto|valor|custa/.test(n),
      solicitou_link: /link|site|catalogo/.test(n),
    };
  }
}

// ─── SEARCH QUERY BUILDING ───
function buildProductSearch(intent: ParsedIntent): string {
  const searchParts: string[] = [];
  const fields = ["name", "brand", "category", "description"];

  // Primary: use the full product_busca
  if (intent.produto_busca) {
    const terms = extractSearchTerms(intent.produto_busca);
    for (const t of terms) {
      for (const f of fields) {
        searchParts.push(`${f}.ilike.%${t}%`);
      }
    }
  }
  // Also add category/brand/sabor if specified separately
  if (intent.categoria) {
    const ct = normalizeText(intent.categoria);
    searchParts.push(`category.ilike.%${ct}%`, `name.ilike.%${ct}%`);
  }
  if (intent.marca) {
    const mt = normalizeText(intent.marca);
    searchParts.push(`brand.ilike.%${mt}%`, `name.ilike.%${mt}%`);
  }
  if (intent.sabor) {
    const st = normalizeText(intent.sabor);
    searchParts.push(`name.ilike.%${st}%`, `description.ilike.%${st}%`);
  }

  return uniqueStrings(searchParts).join(",");
}

// ─── PRODUCT SCORING ───
function fuzzyTokenMatch(term: string, token: string): boolean {
  if (!term || !token) return false;
  if (term === token || token.includes(term) || term.includes(token)) return true;
  // Levenshtein-lite: same prefix for long words
  return term.length >= 5 && token.length >= 5 && term.slice(0, 4) === token.slice(0, 4);
}

function scoreField(term: string, fieldText: string, exactW: number, fuzzyW: number): number {
  if (!fieldText) return 0;
  if (fieldText.includes(term)) return exactW;
  return fieldText.split(" ").some(t => fuzzyTokenMatch(term, t)) ? fuzzyW : 0;
}

function scoreProduct(product: ProductSearchResult, intent: ParsedIntent): number {
  const nameText = normalizeText(product.name);
  const brandText = normalizeText(product.brand || "");
  const catText = normalizeText(product.category || "");
  const descText = normalizeText(product.description || "");

  const searchTerms = getSearchTermsFromIntent(intent);
  if (searchTerms.length === 0) return 0;

  let score = 0;
  let matched = 0;

  for (const term of searchTerms) {
    const isNum = /^\d+$/.test(term);
    const s = scoreField(term, nameText, isNum ? 18 : 14, isNum ? 14 : 9)
      || scoreField(term, brandText, 10, 6)
      || scoreField(term, catText, 8, 5)
      || scoreField(term, descText, 5, 3);
    if (s > 0) matched++;
    score += s;
  }

  // CRITICAL: ALL search terms must match somewhere
  if (searchTerms.length > 1) {
    const missingCount = searchTerms.length - matched;
    if (missingCount > 0) {
      // Heavy penalty - effectively disqualifies products missing key terms
      score -= missingCount * 25;
    } else {
      score += 15; // Bonus for full match
    }
  }

  // Extra bonus for category match
  if (intent.categoria) {
    const catNorm = normalizeText(intent.categoria);
    if (catText.includes(catNorm) || nameText.includes(catNorm)) score += 10;
  }
  // Extra bonus for brand match
  if (intent.marca) {
    const marcaNorm = normalizeText(intent.marca);
    if (brandText.includes(marcaNorm) || nameText.includes(marcaNorm)) score += 8;
  }
  // Sabor bonus
  if (intent.sabor) {
    const saborNorm = normalizeText(intent.sabor);
    if (nameText.includes(saborNorm) || descText.includes(saborNorm)) score += 8;
  }
  // Gramagem bonus
  if (intent.gramagem) {
    const gramNorm = normalizeText(intent.gramagem).replace(/\s/g, "");
    const nameNoSpace = nameText.replace(/\s/g, "");
    if (nameNoSpace.includes(gramNorm)) score += 12;
    else score -= 5; // Penalty if gramagem specified but not found
  }

  return score;
}

// ─── CONFIDENCE LEVELS ───
type Confidence = "high" | "medium" | "low";

function getConfidence(products: RankedProduct[]): Confidence {
  if (products.length === 0) return "low";
  const top = products[0].score;
  if (top >= 20) return "high";
  if (top >= 10) return "medium";
  return "low";
}

// ─── PROMO & FORMATTING ───
function isPromoActive(p: ProductSearchResult, now = new Date()): boolean {
  return Boolean(p.promo_price && p.promo_starts_at && p.promo_ends_at && now >= new Date(p.promo_starts_at) && now < new Date(p.promo_ends_at));
}

function formatCurrency(v: number): string {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function sanitizeWhatsAppText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      const l = String(label).trim();
      return l === url ? url : `${l}: ${url}`;
    })
    .replace(/^\*\s+/gm, "• ")
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Saudação inteligente: só cumprimenta na primeira interação OU após >12h sem falar.
// Evita o "Olá, Leonardo" repetido a cada mensagem.
function shouldGreet(history: HistoryMessage[], lastBotAt: Date | null): boolean {
  const hasPriorBotMsg = history.some(m => m.direction === "outbound");
  if (!hasPriorBotMsg) return true;
  if (lastBotAt) {
    const hours = (Date.now() - lastBotAt.getTime()) / 3_600_000;
    if (hours >= 12) return true;
  }
  return false;
}

function buildGreetingPrefix(customerName: string, greet: boolean): string {
  if (!greet) return "";
  return customerName ? `Olá, ${customerName}! ` : "Olá! ";
}

// ─── DETERMINISTIC FALLBACK (used only if AI compose fails) ───
function buildDeterministicResponse(
  products: RankedProduct[],
  confidence: Confidence,
  intent: ParsedIntent,
  storeLink: string | null,
  _storeName: string,
  customerName: string,
  greet: boolean,
): string {
  const greeting = buildGreetingPrefix(customerName, greet);
  const now = new Date();

  if (intent.intencao === "saudacao") {
    return `${greeting || ""}Como posso te ajudar? 😊`.trim();
  }
  if (intent.intencao === "catalogo") {
    return storeLink ? `${greeting}Aqui está nosso catálogo:\n${storeLink}` : `${greeting}Me diga o produto que procura!`;
  }
  if (confidence === "low" || products.length === 0) {
    const t = intent.produto_busca || "esse item";
    return `${greeting}Não achei *${t}* no catálogo. Pode me dar marca, sabor ou tamanho?`.trim();
  }
  const top = products.slice(0, 3);
  if (top.length === 1) {
    const p = top[0];
    const promo = isPromoActive(p, now);
    const price = promo ? p.promo_price ?? p.price_default : p.price_default;
    return `${greeting}*${p.name}* sai por ${formatCurrency(price)}${promo ? " 🔥" : ""}.`.trim();
  }
  return `${greeting}Encontrei ${top.length} opções 👇`.trim();
}

function buildCatalogFirstProductResponse(
  products: RankedProduct[],
  intent: ParsedIntent,
  customerName: string,
  greet: boolean,
): string {
  const greeting = buildGreetingPrefix(customerName, greet);
  const requested = intent.produto_busca || "esse produto";

  if (products.length === 0) {
    return `${greeting}Não encontrei *${requested}* no catálogo. Tem marca, sabor ou tamanho específico? Pode mandar foto também 📷`.trim();
  }

  if (products.length === 1) {
    const p = products[0];
    const promo = isPromoActive(p);
    const price = promo ? p.promo_price ?? p.price_default : p.price_default;
    const training = p.ai_training?.trim();
    const extra = training ? `\n${sanitizeWhatsAppText(training).slice(0, 160)}` : "";
    return `${greeting}*${p.name}* — ${formatCurrency(price)}${promo ? " 🔥" : ""}.${extra}`.trim();
  }

  return `${greeting}Tenho ${Math.min(products.length, 3)} opções 👇`.trim();
}

// ─── AI-POWERED HUMANIZED COMPOSER ───
async function composeAiResponse(params: {
  apiKey: string;
  storeName: string;
  customerName: string;
  storeLink: string | null;
  intent: ParsedIntent;
  messageText: string;
  history: HistoryMessage[];
  products: RankedProduct[];
  confidence: Confidence;
  trainingBase: string;
  profileSummary: string;
  greet: boolean;
}): Promise<string> {
  const { apiKey, storeName, customerName, storeLink, intent, messageText, history, products, confidence, trainingBase, profileSummary, greet } = params;
  const now = new Date();

  const productCtx = products.slice(0, 3).map((p, i) => {
    const promo = isPromoActive(p, now);
    const price = promo ? p.promo_price ?? p.price_default : p.price_default;
    return `[${i + 1}] ${p.name}${p.brand ? ` (${p.brand})` : ""} — ${formatCurrency(price)}${promo ? " 🔥 promo" : ""}${p.unit ? ` / ${p.unit}` : ""}${p.ai_training ? `\n   Treinamento do lojista: ${p.ai_training.slice(0, 400)}` : ""}`;
  }).join("\n");

  const recent = history.slice(-6).map(m =>
    `${m.direction === "inbound" ? "Cliente" : "Você"}: ${m.content}`
  ).join("\n");

  const greetingRule = greet
    ? `- Esta é a PRIMEIRA mensagem da conversa (ou retomada após muito tempo). Pode cumprimentar pelo nome UMA vez no início.`
    : `- A conversa JÁ ESTÁ EM ANDAMENTO. NÃO cumprimente de novo. NADA de "Olá", "Oi", "Olá ${customerName || 'cliente'}". Vá DIRETO ao ponto.`;

  const systemPrompt = `Você é o atendente da loja *${storeName}* no WhatsApp. Atendimento DIRETO e EFICIENTE — não é pra bater papo.

REGRAS DE OURO (não quebre):
- MÁXIMO 3 linhas. Curto, claro, direto. Sem encheção de linguiça.
- Pergunte 1 coisa por vez quando precisar de info.
- NUNCA invente produto, preço, prazo, estoque ou política. Use SÓ o que está no contexto abaixo.
- NUNCA use markdown de link [texto](url). Cole a URL pura quando precisar.
- Use *asterisco* só pra negrito do WhatsApp em palavras-chave (no máx 1 por mensagem).
- Emojis com moderação (no máx 1 por mensagem).
- Se há produtos listados abaixo, NÃO repita nome+preço de todos no texto — os cartões serão enviados em seguida. Apenas anuncie em UMA linha curta.
- Se não tem o produto, seja honesto: diga que não achou e peça marca/sabor/tamanho. NUNCA ofereça outros produtos no lugar.
${greetingRule}
${trainingBase}${profileSummary}

CONTEXTO DESTA MENSAGEM:
- Cliente: ${customerName || "(nome desconhecido)"}
- Intenção detectada: ${intent.intencao}${intent.produto_busca ? ` | busca: "${intent.produto_busca}"` : ""}
- Confiança da busca: ${confidence}
- Loja online: ${storeLink || "(sem link de catálogo)"}

PRODUTOS ENCONTRADOS (${products.length === 0 ? "nenhum" : products.length}):
${productCtx || "(nenhum produto bateu com a busca semântica)"}

HISTÓRICO RECENTE:
${recent || "(primeira mensagem)"}

Mensagem atual do cliente: "${messageText}"

Responda em PT-BR, máx 3 linhas. Se há cartões de produto pra enviar, sua resposta deve ser UMA linha curta (ex: "Achei aqui 👇" ou "Tenho 2 opções 👇"). Se não há produto, responda objetivamente.`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.4,
      }),
    });
    if (!resp.ok) throw new Error(`AI ${resp.status}`);
    const data = await resp.json();
    const txt = sanitizeWhatsAppText(data.choices?.[0]?.message?.content || "");
    return txt || buildDeterministicResponse(products, confidence, intent, storeLink, storeName, customerName, greet);
  } catch (e) {
    console.error("[zapi-webhook] composeAiResponse failed:", e);
    return buildDeterministicResponse(products, confidence, intent, storeLink, storeName, customerName, greet);
  }
}

// ─── BUILD TRAINING BASE FROM SETTINGS ───
function buildTrainingBase(settings: any): string {
  const parts: string[] = [];
  const tone = settings?.tone;
  if (tone) {
    const toneMap: Record<string, string> = {
      amigavel_objetivo: "Tom: amigável e objetivo, fala como gente boa de balcão.",
      formal: "Tom: formal e respeitoso, sem gírias.",
      descontraido: "Tom: descontraído e leve, com bom humor (sem exagerar).",
      consultivo: "Tom: consultivo, faz perguntas pra entender a necessidade antes de oferecer.",
    };
    parts.push(toneMap[tone] || `Tom: ${tone}.`);
  }
  if (settings?.ai_instructions?.trim()) parts.push(`Instruções gerais do lojista:\n${settings.ai_instructions.trim()}`);
  if (settings?.business_info?.trim()) parts.push(`Sobre a loja (entrega, pagamento, endereço, horários):\n${settings.business_info.trim()}`);
  if (settings?.faq?.trim()) parts.push(`Perguntas frequentes (use estas respostas, não invente):\n${settings.faq.trim()}`);
  if (settings?.response_examples?.trim()) parts.push(`Exemplos do tom desejado (imite o estilo):\n${settings.response_examples.trim()}`);
  if (settings?.forbidden_topics?.trim()) parts.push(`NÃO FAZER / NÃO FALAR:\n${settings.forbidden_topics.trim()}`);
  return parts.length ? `\n\nBASE DE TREINAMENTO:\n${parts.join("\n\n")}` : "";
}

// ─── CONTINUOUS LEARNING: customer profile helpers ───
type AiProfile = {
  display_name: string | null;
  preferred_greeting: string | null;
  communication_style: string | null;
  preferred_brands: string[] | null;
  preferred_categories: string[] | null;
  disliked_items: string[] | null;
  frequent_products: string[] | null;
  avg_ticket: number | null;
  total_interactions: number;
  total_purchases: number;
  notes_summary: string | null;
};

function buildProfileSummary(p: AiProfile): string {
  const lines: string[] = [];
  if (p.display_name) lines.push(`Nome: ${p.display_name}`);
  if (p.preferred_greeting) lines.push(`Forma de cumprimentar: ${p.preferred_greeting}`);
  if (p.communication_style) lines.push(`Estilo: ${p.communication_style}`);
  if (p.preferred_brands?.length) lines.push(`Marcas favoritas: ${p.preferred_brands.join(", ")}`);
  if (p.preferred_categories?.length) lines.push(`Categorias favoritas: ${p.preferred_categories.join(", ")}`);
  if (p.frequent_products?.length) lines.push(`Compra com frequência: ${p.frequent_products.slice(0, 5).join(", ")}`);
  if (p.disliked_items?.length) lines.push(`Não gosta: ${p.disliked_items.join(", ")}`);
  if (p.avg_ticket && p.avg_ticket > 0) lines.push(`Ticket médio: R$ ${Number(p.avg_ticket).toFixed(2)}`);
  if (p.total_interactions) lines.push(`Já conversou ${p.total_interactions}x antes`);
  if (p.notes_summary) lines.push(`Anotações: ${p.notes_summary}`);
  return lines.length ? `\n\n📋 PERFIL APRENDIDO DO CLIENTE (use para personalizar o atendimento):\n${lines.join("\n")}` : "";
}

async function updateCustomerProfile(
  supabase: any,
  apiKey: string,
  accountId: string,
  phone: string,
  customerId: string | null,
  customerName: string | null,
  history: HistoryMessage[],
  currentProfile: AiProfile | null,
): Promise<void> {
  try {
    const recent = history.slice(-12).map(m =>
      `${m.direction === "inbound" ? "Cliente" : "Atendente"}: ${m.content}`
    ).join("\n");

    const existingJson = currentProfile ? JSON.stringify({
      display_name: currentProfile.display_name,
      preferred_greeting: currentProfile.preferred_greeting,
      communication_style: currentProfile.communication_style,
      preferred_brands: currentProfile.preferred_brands,
      preferred_categories: currentProfile.preferred_categories,
      disliked_items: currentProfile.disliked_items,
      frequent_products: currentProfile.frequent_products,
      notes_summary: currentProfile.notes_summary,
    }) : "null";

    const prompt = `Você analisa conversas de WhatsApp para construir um perfil EVOLUTIVO do cliente.

Perfil atual aprendido (mescle e atualize, NÃO apague o que já está bom):
${existingJson}

Conversa recente:
${recent}

Extraia/atualize o perfil. Responda APENAS com JSON válido:
{
  "display_name": "nome real do cliente se descobriu, senão mantenha o atual ou null",
  "preferred_greeting": "como o cliente prefere ser cumprimentado (ex: 'Oi João', 'Bom dia, dona Maria') ou null",
  "communication_style": "informal/formal/objetivo/conversador ou null",
  "preferred_brands": ["marcas mencionadas positivamente"],
  "preferred_categories": ["categorias de interesse"],
  "disliked_items": ["coisas que recusou ou criticou"],
  "frequent_products": ["produtos que cita/pede recorrentemente"],
  "notes_summary": "resumo curto (máx 200 chars) com insights úteis para o próximo atendimento"
}

REGRAS:
- Mescle com o perfil atual: NÃO apague info útil que já existe
- Use arrays vazios [] se nada novo a adicionar
- Seja conciso e objetivo`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!aiResp.ok) {
      console.error("[ai-profile] AI error:", aiResp.status);
      return;
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { return; }

    const merge = (oldArr: string[] | null, newArr: any): string[] => {
      const a = Array.isArray(oldArr) ? oldArr : [];
      const b = Array.isArray(newArr) ? newArr.filter((x: any) => typeof x === "string" && x.trim()) : [];
      return [...new Set([...a, ...b].map(s => s.trim()).filter(Boolean))].slice(0, 15);
    };

    const upsertData: any = {
      account_id: accountId,
      phone,
      customer_id: customerId,
      display_name: parsed.display_name || currentProfile?.display_name || customerName || null,
      preferred_greeting: parsed.preferred_greeting || currentProfile?.preferred_greeting || null,
      communication_style: parsed.communication_style || currentProfile?.communication_style || null,
      preferred_brands: merge(currentProfile?.preferred_brands || null, parsed.preferred_brands),
      preferred_categories: merge(currentProfile?.preferred_categories || null, parsed.preferred_categories),
      disliked_items: merge(currentProfile?.disliked_items || null, parsed.disliked_items),
      frequent_products: merge(currentProfile?.frequent_products || null, parsed.frequent_products),
      notes_summary: parsed.notes_summary || currentProfile?.notes_summary || null,
      total_interactions: (currentProfile?.total_interactions || 0) + 1,
      last_interaction_at: new Date().toISOString(),
    };

    await supabase
      .from("customer_ai_profiles")
      .upsert(upsertData, { onConflict: "account_id,phone" });

    console.log("[ai-profile] updated for", phone);
  } catch (e) {
    console.error("[ai-profile] error:", e);
  }
}

// ════════════════════════════════════════════════════════════════
// ─── AGENTE IA COM TOOLS (atendente humanizado, multi-passo) ───
// ════════════════════════════════════════════════════════════════
type AgentMessage = { role: "system" | "user" | "assistant" | "tool"; content: any; tool_calls?: any[]; tool_call_id?: string; name?: string };

type AgentResult = {
  text: string;
  productsToShow: RankedProduct[];
  escalated: boolean;
  escalationReason?: string;
  newSessionState: any;
  newPhrases: string[];
};

// Similaridade simples (Jaccard de palavras) para detectar repetição
function phraseSimilarity(a: string, b: string): number {
  const norm = (s: string) => normalizeText(s).split(/\s+/).filter(w => w.length > 2);
  const sa = new Set(norm(a));
  const sb = new Set(norm(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / Math.min(sa.size, sb.size);
}

// Detecta frustração ou pedido explícito de humano
function detectsHumanRequest(text: string): boolean {
  const n = normalizeText(text);
  return /\b(atendente|humano|pessoa|alguem real|falar com gente|nao quero robo|para com isso|chega de robo|me transfere|transfere|atendimento humano|gerente|dono|funcionario)\b/.test(n);
}

// Define as tools disponíveis para o agente (formato OpenAI function calling)
function getAgentTools(): any[] {
  return [
    {
      type: "function",
      function: {
        name: "buscar_produto",
        description: "Busca produtos no catálogo da loja. Use SEMPRE que o cliente perguntar/pedir um produto. NÃO invente — só ofereça o que esta tool retornar. ⚠️ NO 'termo' inclua TODAS as palavras descritivas que o cliente usou: tipo + cor + tamanho/medida + material + embalagem (ex: 'caixa branca 50 doces', 'copo cristal 25ml', 'forminha amarela n5', 'papel chumbo vermelho 12x12'). NUNCA reduza a 1 palavra genérica nem troque a ordem — quanto mais específico o termo, melhor o ranking.",
        parameters: {
          type: "object",
          properties: {
            termo: { type: "string", description: "Frase de busca com TODAS as características que o cliente citou (cor, tamanho, material, embalagem). Ex: 'caixa branca para 50 doces', 'copo cristal 25ml', 'bico confeitar pitanga pequeno'." },
          },
          required: ["termo"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "info_loja",
        description: "Retorna informações da loja: endereço, horário, formas de pagamento, frete, política de troca, FAQ. Use quando o cliente perguntar sobre a loja em si.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "consultar_pedido",
        description: "Consulta o pedido mais recente deste cliente (status, itens, valor, entrega). Use quando ele perguntar sobre 'meu pedido', 'minha compra', 'a entrega'.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "consultar_crediario",
        description: "Consulta saldo devedor de crediário e crédito de loja deste cliente. Use quando ele perguntar 'quanto devo', 'meu saldo', 'minha conta', 'crediário'.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "registrar_interesse",
        description: "Registra que o cliente demonstrou interesse num produto (para follow-up do lojista). Use quando ele disser 'me avisa quando chegar', 'quero saber quando voltar'.",
        parameters: {
          type: "object",
          properties: { descricao: { type: "string", description: "O produto ou assunto de interesse" } },
          required: ["descricao"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "escalar_humano",
        description: "Transfere a conversa para um atendente humano. Use SOMENTE quando: (a) cliente pediu humano explicitamente, (b) reclamação séria, (c) você não tem como ajudar mesmo após tentar, (d) cliente está irritado/frustrado, (e) é assunto sensível (cancelamento, problema com pedido entregue, cobrança indevida).",
        parameters: {
          type: "object",
          properties: { motivo: { type: "string", description: "Motivo curto (1 linha) para o lojista entender o contexto" } },
          required: ["motivo"],
        },
      },
    },
  ];
}

// Executa uma tool chamada pelo agente
async function executeAgentTool(
  name: string,
  args: any,
  ctx: { supabase: any; accountId: string; storeId: string; phone: string; customerId: string | null; settings: any; storeLink: string | null; storeName: string },
): Promise<{ result: any; products?: RankedProduct[]; escalated?: { reason: string } }> {
  try {
    if (name === "buscar_produto") {
      const termo = String(args?.termo || "").trim();
      if (!termo) return { result: { erro: "termo vazio" } };
      const distinctiveTerms = extractSearchTerms(termo).filter(isDistinctiveTerm);

      // 1) Busca indexada padrão (com sinônimos, fuzzy, scoring)
      let ranked = await indexedProductSearch(ctx.supabase, ctx.accountId, termo, 12);
      let top: RankedProduct[] = ranked.filter(p => p.score > 0);

      // 1.1) Busca direcionada por cada palavra-chave distintiva, sempre.
      // Isso evita perder produtos em catálogos grandes quando o OR genérico retorna muitos itens antes do produto certo.
      if (distinctiveTerms.length > 0) {
        const fields = ["embedding_text", "name", "brand", "category", "description", "sku"];
        const targeted: RankedProduct[] = [];
        for (const t of distinctiveTerms.slice(0, 8)) {
          const { data, error } = await ctx.supabase
            .from("products")
            .select("id, name, brand, price_default, promo_price, promo_starts_at, promo_ends_at, sku, category, description, unit, image_url, ai_training, embedding_text")
            .eq("account_id", ctx.accountId)
            .eq("is_active", true)
            .or(fields.map(f => `${f}.ilike.%${t}%`).join(","))
            .limit(80);
          if (error) console.error("[buscar_produto] targeted token search error:", error);
          for (const p of (data || [])) {
            const hay = normalizeText([p.name, p.brand, p.category, p.description, p.embedding_text, p.sku].filter(Boolean).join(" "));
            const matches = distinctiveTerms.filter(term => termMatchesText(term, hay)).length;
            if (matches > 0) targeted.push({ ...(p as any), score: scoreProduct(p as any, { intencao: "buscar_produto", produto_busca: termo, categoria: null, marca: null, sabor: null, gramagem: null, solicitou_preco: false, solicitou_link: false }) + matches * 18, similarity: Math.min(0.99, matches / Math.max(1, distinctiveTerms.length)) } as RankedProduct);
          }
        }
        top = mergeRankedProducts([...top, ...targeted]);
      }

      // 2) FALLBACK 1: ILIKE direto no nome com o termo bruto inteiro
      if (top.length === 0) {
        const raw = termo.replace(/[%_]/g, " ").trim();
        if (raw.length >= 2) {
          const { data } = await ctx.supabase
            .from("products")
            .select("id, name, brand, price_default, promo_price, promo_starts_at, promo_ends_at, sku, category, description, unit, image_url, ai_training, embedding_text")
            .eq("account_id", ctx.accountId)
            .eq("is_active", true)
            .ilike("name", `%${raw}%`)
            .limit(10);
          if (data && data.length > 0) {
            top = data.map((p: any) => ({ ...p, score: 20, similarity: 0.8 } as RankedProduct));
          }
        }
      }

      // 3) FALLBACK 2: tokens individuais
      if (top.length === 0) {
        const terms = extractSearchTerms(termo).filter(isDistinctiveTerm).slice(0, 4);
        const seen = new Set<string>();
        for (const t of terms) {
          const { data } = await ctx.supabase
            .from("products")
            .select("id, name, brand, price_default, promo_price, promo_starts_at, promo_ends_at, sku, category, description, unit, image_url, ai_training, embedding_text")
            .eq("account_id", ctx.accountId)
            .eq("is_active", true)
            .or(`name.ilike.%${t}%,brand.ilike.%${t}%,category.ilike.%${t}%,description.ilike.%${t}%,sku.ilike.%${t}%,embedding_text.ilike.%${t}%`)
            .limit(15);
          for (const p of (data || [])) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              top.push({ ...(p as any), score: 5, similarity: 0.5 } as RankedProduct);
            }
          }
        }
      }

      // Match ESTRITO por word-boundary: term aparece como palavra inteira ou prefixo
      // de uma palavra (≥3 chars). Evita falso-positivo "vela" ⊂ "avela", "copo" ⊂ "C/".
      const strictTermInText = (term: string, text: string): boolean => {
        if (!term || !text) return false;
        if (/^\d+$/.test(term)) return termMatchesText(term, text); // números: lógica original
        const re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
        return re.test(text);
      };

      // 4) PRECISÃO: se a consulta tem ≥2 tokens distintivos, exigir que o produto cubra
      // pelo menos a maioria deles no nome+marca+categoria+descrição. Match estrito
      // (word-boundary) para evitar "vela" casar com "avela".
      if (distinctiveTerms.length >= 2 && top.length > 0) {
        const required = Math.max(2, Math.ceil(distinctiveTerms.length * 0.6));
        const scored = top.map(p => {
          const hay = normalizeText([p.name, p.brand, p.category, p.description, p.embedding_text, p.sku].filter(Boolean).join(" "));
          const matches = distinctiveTerms.filter(t => strictTermInText(t, hay)).length;
          return { p, matches };
        });
        const filtered = scored.filter(s => s.matches >= required);
        if (filtered.length > 0) {
          top = filtered
            .sort((a, b) => b.matches - a.matches || (b.p.score || 0) - (a.p.score || 0))
            .map(s => ({ ...s.p, score: (s.p.score || 0) + s.matches * 15 }));
        } else {
          const partial = scored.filter(s => s.matches >= 2);
          top = partial.length > 0
            ? partial.sort((a, b) => b.matches - a.matches).map(s => s.p)
            : [];
        }
      }

      // Substantivo principal: primeiro token distintivo NÃO numérico do termo bruto
      // (ex.: "copo cristal 25ml" → "copo"). Produto sem essa palavra (estrita) no NOME
      // é descartado. Evita "taça" quando cliente pediu "copo" e "avelã" quando pediu "vela".
      const headNoun = distinctiveTerms.find(t => !/^\d/.test(t)) || null;

      const decorated = top.map(p => {
        const hay = normalizeText([p.name, p.brand, p.category, p.description, (p as any).embedding_text, p.sku].filter(Boolean).join(" "));
        const nameHay = normalizeText([p.name, p.brand].filter(Boolean).join(" "));
        const matches = distinctiveTerms.filter(t => strictTermInText(t, hay)).length;
        const total = distinctiveTerms.length;
        const headMatchInName = headNoun ? strictTermInText(headNoun, nameHay) : true;
        return { p, matches, total, full: total > 0 && matches === total, headMatchInName };
      });
      decorated.sort((a, b) =>
        (b.headMatchInName ? 1 : 0) - (a.headMatchInName ? 1 : 0) ||
        (b.full ? 1 : 0) - (a.full ? 1 : 0) ||
        b.matches - a.matches ||
        (b.p.score || 0) - (a.p.score || 0)
      );
      // Se há ≥1 produto com substantivo principal no nome, descarta os que não têm
      const hadHeadFilter = !!(headNoun && decorated.some(d => d.headMatchInName));
      if (hadHeadFilter) {
        for (let i = decorated.length - 1; i >= 0; i--) {
          if (!decorated[i].headMatchInName) decorated.splice(i, 1);
        }
      }
      top = decorated.slice(0, 5).map(d => d.p);
      const fullMatches = decorated.filter(d => d.full).map(d => d.p);

      console.log(`[buscar_produto] termo="${termo}" tokens=[${distinctiveTerms.join(",")}] head=${headNoun} headFilter=${hadHeadFilter} → ${top.length}res ${fullMatches.length}full | ${top.slice(0,3).map(p=>p.name).join(" || ")}`);

      return {
        result: top.length === 0
          ? { encontrou: false, mensagem: `Nenhum produto encontrado para "${termo}". Pergunte ao cliente uma característica diferente (marca, sabor, tamanho, embalagem) e tente buscar de novo com outras palavras antes de afirmar que não tem.` }
          : {
              encontrou: true,
              total: top.length,
              tem_correspondencia_exata: fullMatches.length > 0,
              instrucao_obrigatoria: fullMatches.length > 0
                ? `ATENÇÃO: o(s) primeiro(s) produto(s) abaixo (combina_completo=true) cobre(m) TODAS as palavras-chave que o cliente pediz. VOCÊ TEM ESTE PRODUTO. É PROIBIDO dizer que não tem, que está em falta, sem estoque, ou oferecer alternativa diferente. Confirme com naturalidade ("Tenho sim 👇" / "Esse aqui ó 👇") e o card será enviado automaticamente.`
                : `Nenhum produto cobriu todas as palavras pedidas. Mostre os mais próximos como sugestão ("Tenho parecido 👇") OU pergunte uma característica adicional para refinar.`,
              produtos: decorated.slice(0, 5).map(d => {
                const p = d.p;
                const promo = isPromoActive(p);
                const price = promo ? p.promo_price ?? p.price_default : p.price_default;
                return {
                  id: p.id,
                  nome: p.name,
                  marca: p.brand,
                  preco: price,
                  em_promocao: promo,
                  unidade: p.unit,
                  combina_completo: d.full,
                  palavras_cobertas: `${d.matches}/${d.total}`,
                  observacao_lojista: p.ai_training?.slice(0, 200) || null,
                };
              }),
            },
        products: top,
      };
    }

    if (name === "info_loja") {
      const s = ctx.settings;
      const { data: store } = await ctx.supabase.from("stores").select("name, address_json, phone").eq("id", ctx.storeId).single();
      const addr = store?.address_json;
      const enderecoStr = addr ? `${addr.street || ""}${addr.number ? ", " + addr.number : ""} - ${addr.neighborhood || ""}, ${addr.city || ""}/${addr.state || ""}`.replace(/^[\s,-]+|[\s,-]+$/g, "") : null;
      return {
        result: {
          nome: ctx.storeName,
          endereco: enderecoStr,
          telefone: store?.phone,
          catalogo_online: ctx.storeLink,
          informacoes_gerais: s?.business_info || null,
          faq: s?.faq || null,
        },
      };
    }

    if (name === "consultar_pedido") {
      if (!ctx.customerId) return { result: { erro: "Cliente não cadastrado. Peça nome/CPF para localizar." } };
      const { data: sale } = await ctx.supabase
        .from("sales")
        .select("id, order_number, status, total, payment_method, created_at, notes")
        .eq("customer_id", ctx.customerId)
        .eq("store_id", ctx.storeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sale) return { result: { encontrou: false } };
      const { data: items } = await ctx.supabase
        .from("sale_items")
        .select("name, quantity, unit_price")
        .eq("sale_id", sale.id);
      return {
        result: {
          encontrou: true,
          pedido: sale.order_number,
          status: sale.status,
          total: sale.total,
          forma_pagamento: sale.payment_method,
          data: sale.created_at,
          itens: (items || []).map((i: any) => `${i.quantity}x ${i.name} (R$ ${Number(i.unit_price).toFixed(2)})`),
          observacao: sale.notes?.slice(0, 200) || null,
        },
      };
    }

    if (name === "consultar_crediario") {
      if (!ctx.customerId) return { result: { erro: "Cliente não cadastrado." } };
      const { data: receivables } = await ctx.supabase
        .from("accounts_receivable")
        .select("amount, paid_value, due_date, status")
        .eq("customer_id", ctx.customerId)
        .in("status", ["pending", "overdue", "partial"]);
      const totalDevido = (receivables || []).reduce((sum: number, r: any) => sum + (Number(r.amount) - Number(r.paid_value || 0)), 0);
      const proximaParcela = (receivables || []).sort((a: any, b: any) => String(a.due_date).localeCompare(String(b.due_date)))[0];
      const { data: credits } = await ctx.supabase
        .from("store_credits")
        .select("amount, used_amount, status")
        .eq("customer_id", ctx.customerId)
        .eq("status", "active");
      const creditoLoja = (credits || []).reduce((sum: number, c: any) => sum + (Number(c.amount) - Number(c.used_amount || 0)), 0);
      return {
        result: {
          credito_loja: creditoLoja,
          total_devido_crediario: totalDevido,
          parcelas_em_aberto: (receivables || []).length,
          proxima_parcela: proximaParcela ? { valor: Number(proximaParcela.amount) - Number(proximaParcela.paid_value || 0), vencimento: proximaParcela.due_date } : null,
        },
      };
    }

    if (name === "registrar_interesse") {
      const desc = String(args?.descricao || "").slice(0, 300);
      await ctx.supabase.from("chat_messages").insert({
        conversation_id: (await ctx.supabase.from("chat_conversations").select("id").eq("phone", ctx.phone).eq("store_id", ctx.storeId).limit(1).single()).data?.id,
        direction: "system",
        content: `📌 Interesse registrado: ${desc}`,
        message_type: "text",
      });
      return { result: { ok: true } };
    }

    if (name === "escalar_humano") {
      const motivo = String(args?.motivo || "Cliente solicitou atendimento humano").slice(0, 300);
      return { result: { ok: true, mensagem: "Conversa transferida ao atendente humano." }, escalated: { reason: motivo } };
    }

    return { result: { erro: `Tool desconhecida: ${name}` } };
  } catch (e) {
    console.error(`[agent] tool ${name} failed:`, e);
    return { result: { erro: e instanceof Error ? e.message : "erro" } };
  }
}

// Constrói o system prompt humanizado e contextual
function buildAgentSystemPrompt(ctx: {
  storeName: string;
  storeLink: string | null;
  customerName: string;
  trainingBase: string;
  profileSummary: string;
  sessionState: any;
  isFirstInteraction: boolean;
  hoursSinceLastBot: number | null;
}): string {
  const greetingRule = ctx.isFirstInteraction
    ? `É a PRIMEIRA mensagem com este cliente. Você pode cumprimentar pelo nome UMA vez no início.`
    : (ctx.hoursSinceLastBot !== null && ctx.hoursSinceLastBot >= 12)
      ? `Conversa retomada após ${Math.floor(ctx.hoursSinceLastBot)}h. Pode dar um "oi" leve uma vez.`
      : `CONVERSA EM ANDAMENTO. NÃO comece com "Olá", "Oi", "Olá fulano", "Como posso ajudar". Continue de onde parou. Vá DIRETO ao ponto.`;

  const stateLine = ctx.sessionState && Object.keys(ctx.sessionState).length > 0
    ? `\nESTADO ATUAL DA CONVERSA (use pra dar continuidade): ${JSON.stringify(ctx.sessionState)}`
    : "";

  return `Você é atendente da loja *${ctx.storeName}* no WhatsApp. Sua missão: atender clientes como uma PESSOA REAL — natural, empática, prestativa, eficiente.

# COMO VOCÊ FALA
- Português brasileiro, tom de balcão amigável (sem ser bobo, sem ser formal demais).
- VARIE suas respostas. NUNCA use o mesmo bordão duas vezes seguidas (ex: "Achei X opções", "Como posso ajudar?", "Olá novamente").
- 1 a 5 linhas, conforme a necessidade. Não force respostas curtinhas se o cliente pediu algo complexo.
- Emojis com naturalidade (0 a 2 por mensagem, sem exagero).
- WhatsApp: use *asterisco* para negrito (sem markdown de link, cole URL pura).
- Pergunte UMA coisa de cada vez quando precisar de info.
- ${greetingRule}

# REGRAS DE OURO
- NUNCA invente produto, preço, prazo, estoque, política. Use SOMENTE dados das tools.
- ⚠️ ESTOQUE: A tool buscar_produto NÃO informa estoque. Se a tool retornou um produto, ELE EXISTE NA LOJA. NUNCA diga "está em falta", "sem estoque", "esgotou", "não vou ter agora" — você NÃO TEM essa informação. Apresente o produto normalmente; se o cliente quiser confirmar disponibilidade física, oriente a fechar pelo link/atendente.
- ⚠️ Se buscar_produto retornar "tem_correspondencia_exata: true", é PROIBIDO dizer que não tem ou oferecer alternativa diferente — confirme e envie o(s) produto(s) com "combina_completo: true".
- NUNCA repita literalmente uma mensagem que você já enviou nesta conversa. Reescreva diferente.
- Se o cliente já te disse algo (nome, endereço, o que quer), LEMBRE — está no histórico abaixo.
- Não diga "deixa eu verificar" e fique calado: USE A TOOL apropriada de imediato.
- Se não conseguir resolver após tentar, ou cliente pedir humano/atendente/pessoa, CHAME a tool escalar_humano.

# QUANDO USAR CADA TOOL
- Cliente pergunta sobre QUALQUER produto → buscar_produto (SEMPRE, sem exceção, mesmo que pareça óbvio que não tem).
- ⚠️ NUNCA diga "não temos", "não achei", "não encontrei" sem ter chamado buscar_produto pelo menos DUAS vezes com termos DIFERENTES. Exemplo: cliente pediu "ovinho de chocolate" → 1ª tentativa: termo="ovinho de chocolate". Se vier vazio, 2ª tentativa: termo="ovinho" (palavra-chave principal isolada). Só depois disso é honesto dizer que não tem.
- ⚠️ MONTANDO O TERMO: copie a descrição que o cliente deu, com TODAS as palavras importantes (cor, tamanho, medida, material, embalagem). Ex: "queria caixa branca pra 50 doces" → termo="caixa branca 50 doces" (NÃO use só "doces" nem só "caixa"). "tem copo cristal 25ml?" → termo="copo cristal 25ml" (NÃO reduza pra "copo"). Só simplifique para 1 palavra-chave na 2ª tentativa, se a 1ª voltou vazio.
- "Onde fica?", "Qual horário?", "Aceita PIX?", "Tem entrega?" → info_loja
- "Cadê meu pedido?", "Status da compra" → consultar_pedido
- "Quanto devo?", "Meu crediário" → consultar_crediario
- "Avisa quando chegar X" → registrar_interesse
- Cliente irritado, pedido com problema, pediu humano → escalar_humano

# CONTEXTO
- Loja: *${ctx.storeName}*
- Cliente: ${ctx.customerName || "(nome desconhecido — descubra com gentileza se fizer sentido)"}
- Catálogo online: ${ctx.storeLink || "(loja sem catálogo online)"}${stateLine}
${ctx.trainingBase}${ctx.profileSummary}

# IMPORTANTE — produtos
Quando você chamar buscar_produto e ela retornar produtos, sua mensagem de texto deve ser CURTA e natural ("Tenho aqui pra você 👇" ou "Esse aqui combina:" etc), porque os cards dos produtos serão enviados em seguida automaticamente. NUNCA repita nome+preço de todos no texto.

Responda agora.`;
}

// Loop principal do agente (multi-step com tools)
async function runChatAgent(params: {
  apiKey: string;
  supabase: any;
  history: HistoryMessage[];
  currentMessage: string;
  conversation: any;
  settings: any;
  accountId: string;
  storeId: string;
  storeName: string;
  storeLink: string | null;
  customerName: string;
  customerId: string | null;
  phone: string;
  trainingBase: string;
  profileSummary: string;
}): Promise<AgentResult> {
  const { apiKey, supabase, history, currentMessage, conversation, settings, accountId, storeId, storeName, storeLink, customerName, customerId, phone, trainingBase, profileSummary } = params;

  const sessionState = (conversation.session_state as any) || {};
  const lastBotPhrases: string[] = Array.isArray(conversation.last_bot_phrases) ? conversation.last_bot_phrases : [];
  const hasPriorBot = history.some(m => m.direction === "outbound");
  const lastBotAt = conversation.last_message_at ? new Date(conversation.last_message_at) : null;
  const hoursSinceLastBot = (hasPriorBot && lastBotAt) ? (Date.now() - lastBotAt.getTime()) / 3_600_000 : null;

  const systemPrompt = buildAgentSystemPrompt({
    storeName, storeLink, customerName,
    trainingBase, profileSummary, sessionState,
    isFirstInteraction: !hasPriorBot,
    hoursSinceLastBot,
  });

  // Monta histórico como mensagens de role (NÃO prompt monolítico)
  const recentHistory = history.slice(-20).filter(m => m.direction === "inbound" || m.direction === "outbound");
  const messages: AgentMessage[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map(m => ({
      role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
  ];
  // Mensagem atual (se for diferente do último inbound já no histórico)
  const lastInbound = recentHistory.filter(m => m.direction === "inbound").slice(-1)[0];
  if (!lastInbound || lastInbound.content !== currentMessage) {
    messages.push({ role: "user", content: currentMessage });
  }

  const tools = getAgentTools();
  const ctx = { supabase, accountId, storeId, phone, customerId, settings, storeLink, storeName };
  const collectedProducts: RankedProduct[] = [];
  let escalated: { reason: string } | undefined;
  let finalText = "";

  // Loop multi-passo (até 5 iterações de tool calls)
  for (let step = 0; step < 5; step++) {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => "");
      console.error(`[agent] gateway ${resp.status}:`, errTxt.slice(0, 300));
      // Fallback simples
      finalText = customerName
        ? `Desculpa ${customerName}, tive um problema técnico aqui. Pode tentar de novo em instantes? 🙏`
        : `Desculpa, tive um problema técnico aqui. Pode tentar de novo em instantes? 🙏`;
      break;
    }

    const data = await resp.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) break;

    const toolCalls = msg.tool_calls || [];
    if (toolCalls.length === 0) {
      finalText = sanitizeWhatsAppText(msg.content || "");
      break;
    }

    // Adiciona a resposta do assistente (com tool_calls) ao histórico
    messages.push({ role: "assistant", content: msg.content || "", tool_calls: toolCalls });

    // Executa cada tool e injeta resultado
    for (const call of toolCalls) {
      let args: any = {};
      try { args = JSON.parse(call.function?.arguments || "{}"); } catch { /* ignore */ }
      const exec = await executeAgentTool(call.function?.name || "", args, ctx);
      if (exec.products?.length) collectedProducts.push(...exec.products);
      if (exec.escalated) escalated = exec.escalated;
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function?.name,
        content: JSON.stringify(exec.result),
      });
    }
  }

  // ─── ANTI-REPETIÇÃO: se a resposta for muito parecida com as últimas 3, regenera ───
  if (finalText && lastBotPhrases.length > 0) {
    const maxSim = Math.max(0, ...lastBotPhrases.map(p => phraseSimilarity(finalText, p)));
    if (maxSim >= 0.75) {
      console.log("[agent] resposta repetitiva detectada, regenerando…");
      messages.push({ role: "user", content: "[SISTEMA: sua resposta acima ficou MUITO parecida com algo que você já disse antes. Reescreva de um jeito completamente diferente, com outras palavras e estrutura, mantendo o conteúdo. NÃO repita bordões.]" });
      try {
        const retry = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-2.5-pro", messages, temperature: 0.9 }),
        });
        if (retry.ok) {
          const rdata = await retry.json();
          const retryTxt = sanitizeWhatsAppText(rdata?.choices?.[0]?.message?.content || "");
          if (retryTxt) finalText = retryTxt;
        }
      } catch (e) { console.error("[agent] anti-repeat retry failed:", e); }
    }
  }

  if (!finalText) {
    finalText = customerName ? `Pode repetir, ${customerName}? Acho que me perdi 🙏` : `Pode repetir? Acho que me perdi 🙏`;
  }

  // Atualiza estado da conversa (memória leve)
  const newSessionState = {
    ...sessionState,
    ultima_atualizacao: new Date().toISOString(),
    produtos_oferecidos: collectedProducts.slice(0, 5).map(p => ({ id: p.id, nome: p.name })),
    ultima_resposta_resumo: finalText.slice(0, 200),
  };

  // Anti-repeat memory: guarda últimas 5 respostas
  const newPhrases = [finalText, ...lastBotPhrases].slice(0, 5);

  // Dedup produtos
  const uniqueProducts: RankedProduct[] = [];
  const seenIds = new Set<string>();
  for (const p of collectedProducts) {
    if (!seenIds.has(p.id)) { seenIds.add(p.id); uniqueProducts.push(p); }
  }

  return {
    text: finalText,
    productsToShow: uniqueProducts.slice(0, 3),
    escalated: !!escalated,
    escalationReason: escalated?.reason,
    newSessionState,
    newPhrases,
  };
}

// ─── MAIN HANDLER ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    const body = await req.json();
    console.log("[zapi-webhook] Received:", JSON.stringify(body).slice(0, 500));

    // ─── PresenceChatCallback: cliente está digitando ───
    // Z-API envia status "composing" (digitando) ou "available"/"paused" (parou)
    if (body.type === "PresenceChatCallback" || body.status === "composing" || body.status === "recording" || body.status === "available" || body.status === "paused") {
      const presencePhone = (body.phone || body.from || "").replace(/\D/g, "");
      const presenceStatus = body.status || body.presence || "";
      if (presencePhone) {
        const isTyping = presenceStatus === "composing" || presenceStatus === "recording";
        await supabase
          .from("chat_conversations")
          .update({ is_typing: isTyping, typing_at: new Date().toISOString() })
          .eq("phone", presencePhone);
        console.log(`[zapi-webhook] Presence ${presencePhone} -> ${presenceStatus} (typing=${isTyping})`);
      }
      return new Response(JSON.stringify({ ok: true, presence: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── MessageStatusCallback: status de entrega (SENT/RECEIVED/READ/PLAYED) ───
    // IMPORTANT: Z-API inbound message webhooks also carry status:"RECEIVED" alongside messageId/text.
    // Only treat as status callback when explicitly typed as MessageStatusCallback (or there's no message body).
    const isStatusCallback =
      body.type === "MessageStatusCallback" ||
      (Array.isArray(body.ids) && !body.text && !body.body && !body.image && !body.audio && !body.video && !body.document && body.fromMe === undefined);
    if (isStatusCallback) {
      const statusMsgId = body.ids?.[0] || body.messageId || body.id;
      const rawStatus = (body.status || "").toUpperCase();
      const mapped =
        rawStatus === "READ" || rawStatus === "PLAYED" ? "read" :
        rawStatus === "RECEIVED" ? "delivered" :
        rawStatus === "SENT" ? "sent" : null;
      if (statusMsgId && mapped) {
        await supabase
          .from("chat_messages")
          .update({ status: mapped })
          .eq("z_api_message_id", statusMsgId);
        console.log(`[zapi-webhook] Status ${statusMsgId} -> ${mapped}`);
      }
      return new Response(JSON.stringify({ ok: true, status: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isMessage =
      body.type === "ReceivedCallback" ||
      body.fromMe === false ||
      !!body.text || !!body.body || !!body.image || !!body.audio || !!body.video || !!body.document;
    if (body.fromMe === true) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!isMessage) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const phone = (body.phone || body.from || "").replace(/\D/g, "");
    const messageText = body.text?.message || body.body || body.text || body.caption || "";
    const instanceId = body.instanceId || "";
    const wppMessageId: string | null = body.messageId || body.id || body.zaapId || null;

    // ─── IDEMPOTÊNCIA: Z-API às vezes reenvia o mesmo evento (dupla imagem/texto) ───
    if (wppMessageId) {
      const { data: existingMsg } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("z_api_message_id", wppMessageId)
        .limit(1)
        .maybeSingle();
      if (existingMsg) {
        console.log("[zapi-webhook] Duplicate webhook ignored, messageId:", wppMessageId);
        return new Response(JSON.stringify({ ok: true, deduped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const incomingMediaUrl = body.image?.imageUrl || body.audio?.audioUrl || body.document?.documentUrl || body.video?.videoUrl || null;
    const incomingMediaType = body.image ? "image" : body.audio ? "audio" : body.document ? "document" : body.video ? "video" : "text";

    if (!phone || (!messageText && !incomingMediaUrl)) {
      return new Response(JSON.stringify({ ok: true, skipped: "no phone or content" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── ISOLAMENTO MULTI-TENANT: exige instanceId válido ───
    // NUNCA usar fallback "primeiro ativo" — isso vaza mensagens entre lojas.
    if (!instanceId || !instanceId.trim()) {
      console.warn("[zapi-webhook] Missing instanceId — refusing to route");
      return new Response(JSON.stringify({ ok: true, skipped: "missing instanceId" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validação opcional do client-token (Z-API envia em header ou body)
    const incomingClientToken =
      req.headers.get("client-token") ||
      req.headers.get("Client-Token") ||
      body.clientToken ||
      body.client_token ||
      null;

    const { data: settingsByInstance } = await supabase
      .from("chatbot_settings")
      .select("*, stores(id, name, account_id)")
      .eq("z_api_instance_id", instanceId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!settingsByInstance) {
      console.warn("[zapi-webhook] No chatbot_settings found for instanceId:", instanceId);
      return new Response(JSON.stringify({ ok: true, skipped: "unknown instanceId" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (
      incomingClientToken &&
      settingsByInstance.z_api_client_token &&
      incomingClientToken !== settingsByInstance.z_api_client_token
    ) {
      console.warn("[zapi-webhook] client-token mismatch for instanceId:", instanceId);
      return new Response(JSON.stringify({ ok: true, skipped: "client-token mismatch" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const settings = settingsByInstance;

    const storeId = settings.store_id;
    const accountId = settings.account_id;

    const { data: ecomSettings } = await supabase
      .from("store_ecommerce_settings")
      .select("slug, is_enabled")
      .eq("store_id", storeId)
      .eq("is_enabled", true)
      .limit(1)
      .single();

    const storeLink = ecomSettings?.slug ? `https://typoserp.com.br/loja/${ecomSettings.slug}` : null;

    // Find or create conversation
    let { data: conversation } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("store_id", storeId)
      .eq("phone", phone)
      .eq("status", "active")
      .limit(1)
      .single();

    if (!conversation) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id, name")
        .eq("account_id", accountId)
        .or(`phone.eq.${phone},phone.ilike.%${phone.slice(-9)}%`)
        .limit(1)
        .single();

      const pushname = body.senderName || body.notifyName || body.chatName || body.pushname || null;

      const { data: newConv, error: convError } = await supabase
        .from("chat_conversations")
        .insert({
          account_id: accountId,
          store_id: storeId,
          phone,
          customer_name: customer?.name || null,
          customer_id: customer?.id || null,
          customer_pushname: pushname,
          is_ai_active: true,
        })
        .select()
        .single();
      if (convError) throw convError;
      conversation = newConv;

    }

    // ─── PROFILE PICTURE: re-fetch sempre que estiver vazia ou tiver mais de 24h ───
    try {
      const fetchedAt = (conversation as any).profile_fetched_at;
      const stale = !fetchedAt || (Date.now() - new Date(fetchedAt).getTime() > 24 * 3600 * 1000);
      if (!(conversation as any).profile_pic_url || stale) {
        const zb = `https://api.z-api.io/instances/${settings.z_api_instance_id}/token/${settings.z_api_instance_token}`;
        const zh = { "Client-Token": settings.z_api_client_token };
        const senderPhone = phone;
        const picResp = await fetch(`${zb}/profile-picture?phone=${senderPhone}`, { headers: zh });
        if (picResp.ok) {
          const pic = await picResp.json();
          const profilePic = pic?.link || pic?.url || pic?.profilePicture || pic?.imgUrl || null;
          if (profilePic) {
            await supabase.from("chat_conversations")
              .update({ profile_pic_url: profilePic, profile_fetched_at: new Date().toISOString() })
              .eq("id", conversation.id);
            (conversation as any).profile_pic_url = profilePic;
          }
        }
      }
    } catch (e) { console.log("[zapi-webhook] profile pic refetch failed:", e); }

    // Save inbound message
    const displayContent = messageText || (incomingMediaType === "image" ? "📷 Imagem" : incomingMediaType === "audio" ? "🎵 Áudio enviado pelo cliente" : incomingMediaType === "video" ? "🎥 Vídeo" : "📎 Arquivo");
    await supabase.from("chat_messages").insert({
      conversation_id: conversation.id,
      direction: "inbound",
      content: displayContent,
      message_type: incomingMediaType,
      media_url: incomingMediaUrl,
      z_api_message_id: wppMessageId,
    });

    await supabase.from("chat_conversations")
      .update({ last_message_at: new Date().toISOString(), is_typing: false })
      .eq("id", conversation.id);

    // ─── AI RESPONSE FLOW ───
    if (conversation.is_ai_active && LOVABLE_API_KEY) {
      const { data: history } = await supabase
        .from("chat_messages")
        .select("direction, content")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(25);

      const conversationHistory = (history || []) as HistoryMessage[];
      const storeName = settings.stores?.name || "Nossa Loja";
      const customerName = conversation.customer_name || "";

      // ─── LEARNED CUSTOMER PROFILE (continuous learning) ───
      const { data: aiProfile } = await supabase
        .from("customer_ai_profiles")
        .select("*")
        .eq("account_id", accountId)
        .eq("phone", phone)
        .maybeSingle();

      const profileSummary = aiProfile ? buildProfileSummary(aiProfile) : "";

      // ─── SAUDAÇÃO INTELIGENTE: só cumprimenta na primeira ou após >12h ───
      const lastBotMsg = conversationHistory.filter(m => m.direction === "outbound").slice(-1)[0];
      const lastBotAt = (conversation as any).last_message_at && lastBotMsg
        ? new Date((conversation as any).last_message_at)
        : null;
      const greet = shouldGreet(conversationHistory, lastBotAt);

      let responseText = "";
      const allProducts: RankedProduct[] = [];

      // Handle media: transcribe audio / describe image via Gemini multimodal
      let effectiveText = messageText;
      if (!effectiveText && incomingMediaUrl && (incomingMediaType === "audio" || incomingMediaType === "image")) {
        try {
          const mediaResp = await fetch(incomingMediaUrl);
          if (mediaResp.ok) {
            const buf = new Uint8Array(await mediaResp.arrayBuffer());
            let bin = "";
            for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
            const b64 = btoa(bin);
            const mime = mediaResp.headers.get("content-type") ||
              (incomingMediaType === "audio" ? "audio/ogg" : "image/jpeg");

            const promptText = incomingMediaType === "audio"
              ? "Transcreva fielmente este áudio em português. Responda APENAS com a transcrição, sem comentários."
              : `Esta é uma foto enviada por um cliente. Identifique o produto principal e responda APENAS com 2 a 6 palavras-chave em português para BUSCAR esse produto. SOMENTE as palavras separadas por espaço.`;

            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{
                  role: "user",
                  content: [
                    { type: "text", text: promptText },
                    incomingMediaType === "image"
                      ? { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }
                      : { type: "input_audio", input_audio: { data: b64, format: mime.includes("mp3") ? "mp3" : mime.includes("wav") ? "wav" : "ogg" } },
                  ],
                }],
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              const extracted = aiData.choices?.[0]?.message?.content?.trim() || "";
              if (extracted) {
                effectiveText = extracted;
                await supabase.from("chat_messages").insert({
                  conversation_id: conversation.id,
                  direction: "system",
                  content: `🤖 ${incomingMediaType === "audio" ? "Transcrição" : "Análise"}: ${extracted}`,
                  message_type: "text",
                });
              }
            }
          }
        } catch (e) {
          console.error("[zapi-webhook] media interpret error:", e);
        }
      }

      // ─── DETECÇÃO PRÉ-IA: pedido explícito de humano ───
      if (effectiveText && detectsHumanRequest(effectiveText) && conversation.is_ai_active) {
        await supabase.from("chat_conversations").update({
          is_ai_active: false,
          escalated_at: new Date().toISOString(),
          escalation_reason: "Cliente solicitou atendimento humano",
        }).eq("id", conversation.id);
        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          direction: "system",
          content: "🚨 IA desativada: cliente solicitou atendimento humano",
          message_type: "text",
        });
        const handoff = customerName
          ? `Beleza, ${customerName}! Vou chamar um atendente da loja agora pra te atender. Só um instante 🙏`
          : `Beleza! Vou chamar um atendente da loja agora pra te atender. Só um instante 🙏`;
        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          direction: "outbound",
          content: handoff,
          message_type: "ai_response",
          is_ai_generated: true,
        });
        if (settings.z_api_instance_id) {
          const zb = `https://api.z-api.io/instances/${settings.z_api_instance_id}/token/${settings.z_api_instance_token}`;
          await fetch(`${zb}/send-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Client-Token": settings.z_api_client_token },
            body: JSON.stringify({ phone, message: handoff }),
          });
        }
        return new Response(JSON.stringify({ ok: true, escalated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let escalateNow: { reason: string } | null = null;

      if (!effectiveText && incomingMediaType === "audio") {
        responseText = `Recebi seu áudio 🎵 mas não consegui entender. Pode escrever?`;
      } else if (!effectiveText && incomingMediaType === "image") {
        responseText = `Recebi a imagem 📷. Me diga o produto que procura.`;
      } else if (effectiveText) {
        // ═══ NOVO AGENTE IA com tools (humanizado, multi-passo) ═══
        const trainingBase = buildTrainingBase(settings);
        const agentResult = await runChatAgent({
          apiKey: LOVABLE_API_KEY,
          supabase,
          history: conversationHistory,
          currentMessage: effectiveText,
          conversation,
          settings,
          accountId,
          storeId,
          storeName,
          storeLink,
          customerName,
          customerId: conversation.customer_id,
          phone,
          trainingBase,
          profileSummary,
        });
        responseText = agentResult.text;
        allProducts.push(...agentResult.productsToShow);
        if (agentResult.escalated) escalateNow = { reason: agentResult.escalationReason || "Encaminhado pela IA" };

        await supabase.from("chat_conversations").update({
          session_state: agentResult.newSessionState,
          last_bot_phrases: agentResult.newPhrases,
        }).eq("id", conversation.id);
      }

      if (responseText) {
        const uniqueProducts: RankedProduct[] = [];
        const seenIds = new Set<string>();
        for (const p of allProducts) {
          if (!seenIds.has(p.id)) { seenIds.add(p.id); uniqueProducts.push(p); }
        }
        const productsToSend: RankedProduct[] = uniqueProducts.length > 0 && storeLink
          ? uniqueProducts.slice(0, 3)
          : [];

        const textToSend = responseText;

        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          direction: "outbound",
          content: textToSend,
          message_type: "ai_response",
          is_ai_generated: true,
        });

        if (settings.z_api_instance_id && settings.z_api_instance_token && settings.z_api_client_token) {
          const zapiBase = `https://api.z-api.io/instances/${settings.z_api_instance_id}/token/${settings.z_api_instance_token}`;
          const zapiHeaders = { "Content-Type": "application/json", "Client-Token": settings.z_api_client_token };

          try {
            await fetch(`${zapiBase}/send-chat-state`, {
              method: "POST", headers: zapiHeaders,
              body: JSON.stringify({ phone, chatState: "composing" }),
            });
          } catch (e) { console.log("[zapi-webhook] chat-state composing failed:", e); }

          // Delay proporcional ao tamanho da mensagem (sensação humana)
          const delay = Math.min(4000, Math.max(1200, textToSend.length * 25));
          await new Promise(r => setTimeout(r, delay));

          const sendResp = await fetch(`${zapiBase}/send-text`, {
            method: "POST", headers: zapiHeaders,
            body: JSON.stringify({ phone, message: textToSend }),
          });
          const sendResult = await sendResp.json().catch(() => ({}));
          console.log("[zapi-webhook] Z-API send:", JSON.stringify(sendResult).slice(0, 300));

          const sentId = sendResult?.messageId || sendResult?.id;
          if (sentId) {
            const { data: lastMsg } = await supabase
              .from("chat_messages")
              .select("id")
              .eq("conversation_id", conversation.id)
              .eq("content", textToSend)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (lastMsg) await supabase.from("chat_messages").update({ z_api_message_id: sentId }).eq("id", lastMsg.id);
          }

          for (const product of productsToSend) {
            const hasPromo = isPromoActive(product);
            const price = hasPromo ? product.promo_price ?? product.price_default : product.price_default;
            const productLink = `${storeLink}?produto=${product.id}`;
            const cardMsg = `*${product.name}*\n💰 ${formatCurrency(price)}${hasPromo ? " 🔥 PROMOÇÃO" : ""}\n\n👉 Compre aqui: ${productLink}`;
            try {
              await new Promise(r => setTimeout(r, 800));
              const payload: any = {
                phone, message: cardMsg, linkUrl: productLink,
                title: product.name,
                linkDescription: `${formatCurrency(price)} - Compre agora!`,
              };
              if (product.image_url) payload.image = product.image_url;
              const cardResp = await fetch(`${zapiBase}/send-link`, {
                method: "POST", headers: zapiHeaders, body: JSON.stringify(payload),
              });
              const cardResult = await cardResp.json().catch(() => ({}));
              await supabase.from("chat_messages").insert({
                conversation_id: conversation.id,
                direction: "outbound",
                content: cardMsg,
                message_type: product.image_url ? "image" : "ai_response",
                media_url: product.image_url || null,
                is_ai_generated: true,
                z_api_message_id: cardResult?.messageId || cardResult?.id || null,
              });
              console.log(`[zapi-webhook] Sent product card: ${product.name}`);
            } catch (imgErr) {
              console.error(`[zapi-webhook] Error sending product card:`, imgErr);
            }
          }

          try {
            await fetch(`${zapiBase}/send-chat-state`, {
              method: "POST", headers: zapiHeaders,
              body: JSON.stringify({ phone, chatState: "paused" }),
            });
          } catch (e) { console.log("[zapi-webhook] chat-state paused failed:", e); }
        }

        if (escalateNow) {
          await supabase.from("chat_conversations").update({
            is_ai_active: false,
            escalated_at: new Date().toISOString(),
            escalation_reason: escalateNow.reason,
          }).eq("id", conversation.id);
          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            direction: "system",
            content: `🚨 IA transferiu para humano: ${escalateNow.reason}`,
            message_type: "text",
          });
        }
      }

      // ─── CONTINUOUS LEARNING: update profile in background ───
      // Inclui última troca para o aprendizado considerar a resposta também
      const updatedHistory = [
        ...conversationHistory,
        ...(messageText || incomingMediaType !== "text" ? [{ direction: "inbound", content: messageText || `[${incomingMediaType}]` }] : []),
        ...(responseText ? [{ direction: "outbound", content: responseText }] : []),
      ] as HistoryMessage[];

      // Não bloqueia a resposta — roda em paralelo
      try {
        // @ts-ignore EdgeRuntime exists in Supabase Deno runtime
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(updateCustomerProfile(supabase, LOVABLE_API_KEY, accountId, phone, conversation.customer_id, conversation.customer_name, updatedHistory, aiProfile));
        } else {
          updateCustomerProfile(supabase, LOVABLE_API_KEY, accountId, phone, conversation.customer_id, conversation.customer_name, updatedHistory, aiProfile);
        }
      } catch (e) {
        console.error("[zapi-webhook] profile update dispatch error:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[zapi-webhook] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
