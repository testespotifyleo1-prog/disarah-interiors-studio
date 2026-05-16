# Handoff Técnico — Sistema Disarah / Typos ERP

Documento de transferência completa do projeto para um novo desenvolvedor responsável.
A partir da entrega, o desenvolvedor anterior **não presta mais suporte**.

---

## 1. Visão geral da stack

- **Frontend**: React 19 + TanStack Start v1 + Vite 7 + Tailwind CSS v4
- **UI**: shadcn/ui (Radix) + Tailwind
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **Gerenciador de pacotes**: `bun` (também funciona com `npm`/`pnpm`)

O código é 100% padrão React/Supabase — qualquer dev front/full-stack consegue rodar e fazer deploy sem dependência da plataforma Lovable.

---

## 2. Rodando localmente

```bash
bun install
bun run dev
```

Variáveis de ambiente necessárias em `.env` (já existe um modelo no repo):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

---

## 3. Migração do banco de dados (Supabase → Supabase)

### 3.1. Criar projeto novo

1. Criar conta em [supabase.com](https://supabase.com).
2. Criar um novo projeto (anotar a senha do banco).
3. Pegar do painel: `Project URL`, `anon key`, `service_role key`, e a connection string do Postgres (Settings → Database → Connection string → URI).

### 3.2. Exportar dados do projeto atual

Com a connection string do projeto **antigo**:

```bash
# Schema + dados (público)
pg_dump "postgresql://postgres:[SENHA]@[HOST]:5432/postgres" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-publications \
  --no-subscriptions \
  > dump.sql
```

### 3.3. Importar no projeto novo

```bash
psql "postgresql://postgres:[NOVA_SENHA]@[NOVO_HOST]:5432/postgres" < dump.sql
```

> Alternativamente, aplicar as migrações em `supabase/migrations/` em ordem (via Supabase CLI: `supabase db push`).

### 3.4. Storage (arquivos)

Recriar os buckets no projeto novo (mesmos nomes e configs públicas):

- `store-logos` (público)
- `product-images` (público)
- `customer-avatars` (público)
- `fiscal-xmls` (privado)
- `fiscal-pdfs` (privado)
- `fiscal-certs` (privado)
- `delivery-photos` (privado)

Migrar arquivos com o script oficial: https://supabase.com/docs/guides/storage/migrate ou via `rclone`/SDK.

### 3.5. Edge Functions

Todas as functions em `supabase/functions/` precisam ser deployadas no projeto novo:

```bash
supabase login
supabase link --project-ref [NOVO_REF]
supabase functions deploy
```

### 3.6. Secrets das Edge Functions

Configurar via Supabase Dashboard → Edge Functions → Secrets (ou `supabase secrets set`):

- `LOVABLE_API_KEY` — pode remover se não usar IA via Lovable
- Credenciais de produção que a cliente já usa: Mercado Pago, Focus NFe / NFe.io, etc.

### 3.7. Atualizar o `.env` do frontend

Trocar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` pelos do projeto novo.
Atualizar `supabase/config.toml` → `project_id` com o novo ref.

---

## 4. Deploy do frontend

O projeto é TanStack Start (SSR). Opções recomendadas:

- **Vercel** (mais simples): import do repo Git → autodetecta → deploy.
- **Cloudflare Pages / Workers**: `bun run build` + deploy do diretório de saída.
- **Netlify**: similar ao Vercel.

Configurar as variáveis `VITE_SUPABASE_*` no painel da plataforma escolhida.
Apontar o domínio da cliente (DNS) para a nova hospedagem.

---

## 5. Integrações externas em uso

Verificar com a cliente quais estão ativas e migrar as credenciais:

- **Mercado Pago** (PIX, Point, cartão) — `supabase/functions/mp-*`
- **Focus NFe / NFe.io** (NF-e, NFC-e, NFS-e, MDF-e) — `supabase/functions/emit-*`, `check-fiscal-*`, etc.
- **E-mails transacionais** — `supabase/functions/send-*-email`

---

## 6. Checklist final de entrega

- [ ] Repositório Git transferido (ou ZIP entregue) para o dev da cliente
- [ ] Dump SQL entregue
- [ ] Arquivos de Storage migrados
- [ ] Edge Functions deployadas no Supabase da cliente
- [ ] Secrets reconfigurados no Supabase da cliente
- [ ] Frontend hospedado fora do Lovable
- [ ] DNS do domínio apontando para a nova hospedagem
- [ ] Projeto despublicado no Lovable
- [ ] Conta Lovable Cloud antiga pode ser desativada

---

## 7. Suporte

Entrega final. Não há contrato de suporte pós-entrega.
Dúvidas técnicas: stack 100% open-source, documentação oficial:

- React: https://react.dev
- TanStack Start: https://tanstack.com/start
- Supabase: https://supabase.com/docs
- Tailwind: https://tailwindcss.com/docs
