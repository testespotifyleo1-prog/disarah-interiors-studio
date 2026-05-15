// Single source of truth for the public REST API.
// This spec is served at GET /functions/v1/public-api/openapi.json
// and rendered in the developer docs (Swagger UI / Redoc).
//
// IMPORTANT: when adding/changing routes in index.ts, mirror them here.

export const PRODUCT_WRITE_FIELDS = [
  'sku','name','description','description_long','category','subcategory','brand','unit',
  'gtin','price_default','cost_default','promo_price','promo_starts_at','promo_ends_at',
  'ncm','cest','cfop_default','origem_icms','cst_icms','csosn','cst_pis','cst_cofins','cst_ipi',
  'aliq_icms','aliq_pis','aliq_cofins','aliq_ipi','weight','weight_unit','image_url',
  'product_group','supplier_id','is_active',
] as const;

export const CUSTOMER_WRITE_FIELDS = [
  'name','document','email','phone','address_json','birth_date','credit_authorized','credit_limit',
] as const;

const productWriteProps = Object.fromEntries(
  PRODUCT_WRITE_FIELDS.map((f) => [f, { type: 'string', nullable: true }]),
);
// numeric fields override
['price_default','cost_default','promo_price','aliq_icms','aliq_pis','aliq_cofins','aliq_ipi','weight']
  .forEach((k) => { (productWriteProps as any)[k] = { type: 'number' }; });
(productWriteProps as any).is_active = { type: 'boolean' };

const customerWriteProps = Object.fromEntries(
  CUSTOMER_WRITE_FIELDS.map((f) => [f, { type: 'string', nullable: true }]),
);
(customerWriteProps as any).credit_authorized = { type: 'boolean' };
(customerWriteProps as any).credit_limit = { type: 'number' };
(customerWriteProps as any).address_json = { type: 'object', additionalProperties: true };

const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'validation_error' },
        message: { type: 'string' },
        details: {},
      },
      required: ['code', 'message'],
    },
  },
};

const paginationOffset = {
  type: 'object',
  properties: {
    page: { type: 'integer' }, limit: { type: 'integer' },
    total: { type: 'integer' }, total_pages: { type: 'integer' },
  },
};
const paginationCursor = {
  type: 'object',
  properties: {
    limit: { type: 'integer' },
    next_cursor: { type: 'string', nullable: true },
    has_more: { type: 'boolean' },
  },
};

const listParams = (extra: any[] = []) => ([
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
  { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'Cursor base64. Quando presente ativa modo cursor (omite X-Total-Count, inclui next_cursor).' },
  { name: 'paginate', in: 'query', schema: { type: 'string', enum: ['cursor'] } },
  { name: 'updated_since', in: 'query', schema: { type: 'string', format: 'date-time' } },
  ...extra,
]);

const commonResponses = {
  '401': { description: 'Não autenticado', content: { 'application/json': { schema: errorSchema } } },
  '403': { description: 'Escopo insuficiente', content: { 'application/json': { schema: errorSchema } } },
  '404': { description: 'Não encontrado', content: { 'application/json': { schema: errorSchema } } },
  '422': { description: 'Validação falhou', content: { 'application/json': { schema: errorSchema } } },
  '500': { description: 'Erro interno', content: { 'application/json': { schema: errorSchema } } },
};

export function buildOpenApiSpec(serverUrl: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Typos! ERP — Public API',
      version: '1.0.0',
      description:
        'API REST pública do Typos! ERP. Autenticação por chave Bearer (`tps_live_…` ou `tps_test_…`). ' +
        'Cabeçalhos de resposta `X-Typos-Environment` e `X-Typos-Dry-Run` indicam o ambiente. ' +
        'Esta especificação é gerada a partir das rotas reais do backend e é a fonte única de verdade.',
      contact: { name: 'Typos! ERP', url: 'https://typoserp.com.br/docs/api' },
    },
    servers: [{ url: serverUrl, description: 'API v1' }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Produtos' }, { name: 'Estoque' }, { name: 'Vendas' },
      { name: 'Clientes' }, { name: 'Lojas' }, { name: 'Meta' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'tps_live_… | tps_test_…' },
      },
      schemas: {
        Error: errorSchema,
        PaginationOffset: paginationOffset,
        PaginationCursor: paginationCursor,
        Product: { type: 'object', additionalProperties: true, properties: { id: { type: 'string', format: 'uuid' } } },
        ProductWrite: { type: 'object', required: ['name'], properties: productWriteProps as any },
        Customer: { type: 'object', additionalProperties: true, properties: { id: { type: 'string', format: 'uuid' } } },
        CustomerWrite: { type: 'object', required: ['name'], properties: customerWriteProps as any },
        InventoryRow: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            store_id: { type: 'string', format: 'uuid' },
            product_id: { type: 'string', format: 'uuid' },
            variant_id: { type: 'string', format: 'uuid', nullable: true },
            qty_on_hand: { type: 'number' },
            min_qty: { type: 'number' },
            expiration_date: { type: 'string', format: 'date', nullable: true },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        StockAdjust: {
          type: 'object',
          required: ['store_id', 'product_id'],
          properties: {
            store_id: { type: 'string', format: 'uuid' },
            product_id: { type: 'string', format: 'uuid' },
            qty_on_hand: { type: 'number', description: 'Define o saldo absoluto.' },
            qty_delta: { type: 'number', description: 'Soma ao saldo atual (use no lugar de qty_on_hand).' },
            min_qty: { type: 'number' },
          },
        },
        Sale: { type: 'object', additionalProperties: true },
        Store: { type: 'object', additionalProperties: true },
      },
      responses: commonResponses as any,
    },
    paths: {
      '/v1/products': {
        get: {
          tags: ['Produtos'], summary: 'Listar produtos', operationId: 'listProducts',
          security: [{ bearerAuth: ['products:read'] }],
          parameters: listParams([
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Busca em name/sku/gtin' },
            { name: 'category', in: 'query', schema: { type: 'string' } },
          ]),
          responses: {
            '200': {
              description: 'Lista de produtos',
              headers: { 'X-Total-Count': { schema: { type: 'integer' } } },
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                  pagination: { oneOf: [{ $ref: '#/components/schemas/PaginationOffset' }, { $ref: '#/components/schemas/PaginationCursor' }] },
                },
              } } },
            },
            ...commonResponses,
          },
        },
        post: {
          tags: ['Produtos'], summary: 'Criar produto', operationId: 'createProduct',
          security: [{ bearerAuth: ['products:write'] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductWrite' } } } },
          responses: { '201': { description: 'Criado', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Product' } } } } } }, ...commonResponses },
        },
      },
      '/v1/products/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        get: {
          tags: ['Produtos'], summary: 'Obter produto', operationId: 'getProduct',
          security: [{ bearerAuth: ['products:read'] }],
          responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Product' } } } } } }, ...commonResponses },
        },
        patch: {
          tags: ['Produtos'], summary: 'Atualizar produto', operationId: 'updateProduct',
          security: [{ bearerAuth: ['products:write'] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductWrite' } } } },
          responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Product' } } } } } }, ...commonResponses },
        },
        delete: {
          tags: ['Produtos'], summary: 'Inativar produto (soft delete)', operationId: 'deleteProduct',
          security: [{ bearerAuth: ['products:write'] }],
          responses: { '200': { description: 'OK' }, ...commonResponses },
        },
      },
      '/v1/stock': {
        get: {
          tags: ['Estoque'], summary: 'Listar estoque', operationId: 'listStock',
          security: [{ bearerAuth: ['stock:read'] }],
          parameters: listParams([
            { name: 'store_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'product_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ]),
          responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/InventoryRow' } } } } } } }, ...commonResponses },
        },
      },
      '/v1/stock/adjust': {
        post: {
          tags: ['Estoque'], summary: 'Ajustar saldo / mínimo', operationId: 'adjustStock',
          security: [{ bearerAuth: ['stock:write'] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StockAdjust' } } } },
          responses: { '200': { description: 'OK' }, '201': { description: 'Criado' }, ...commonResponses },
        },
      },
      '/v1/sales': {
        get: {
          tags: ['Vendas'], summary: 'Listar vendas', operationId: 'listSales',
          security: [{ bearerAuth: ['sales:read'] }],
          parameters: listParams([
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft','open','paid','canceled','crediario'] } },
            { name: 'store_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
            { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          ]),
          responses: { '200': { description: 'OK' }, ...commonResponses },
        },
      },
      '/v1/sales/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        get: {
          tags: ['Vendas'], summary: 'Obter venda + itens + pagamentos', operationId: 'getSale',
          security: [{ bearerAuth: ['sales:read'] }],
          responses: { '200': { description: 'OK' }, ...commonResponses },
        },
      },
      '/v1/customers': {
        get: {
          tags: ['Clientes'], summary: 'Listar clientes', operationId: 'listCustomers',
          security: [{ bearerAuth: ['customers:read'] }],
          parameters: listParams([{ name: 'q', in: 'query', schema: { type: 'string' }, description: 'Busca em name/email/phone/document' }]),
          responses: { '200': { description: 'OK' }, ...commonResponses },
        },
        post: {
          tags: ['Clientes'], summary: 'Criar cliente', operationId: 'createCustomer',
          security: [{ bearerAuth: ['customers:write'] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerWrite' } } } },
          responses: { '201': { description: 'Criado' }, ...commonResponses },
        },
      },
      '/v1/customers/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        patch: {
          tags: ['Clientes'], summary: 'Atualizar cliente', operationId: 'updateCustomer',
          security: [{ bearerAuth: ['customers:write'] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerWrite' } } } },
          responses: { '200': { description: 'OK' }, ...commonResponses },
        },
      },
      '/v1/stores': {
        get: {
          tags: ['Lojas'], summary: 'Listar lojas da conta', operationId: 'listStores',
          security: [{ bearerAuth: ['stores:read'] }],
          responses: { '200': { description: 'OK' }, ...commonResponses },
        },
      },
      '/': {
        get: {
          tags: ['Meta'], summary: 'Info da API', operationId: 'apiInfo', security: [],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/openapi.json': {
        get: {
          tags: ['Meta'], summary: 'Especificação OpenAPI 3.1 (JSON)', operationId: 'openapiJson', security: [],
          responses: { '200': { description: 'Spec OpenAPI', content: { 'application/json': {} } } },
        },
      },
    },
  };
}
