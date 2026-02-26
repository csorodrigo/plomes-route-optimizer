# Last Session

> This file is overwritten at the end of each session by the Maestro.
> It provides a quick briefing for the next session start.

## Date

2026-02-26 (tarde)

## Goals

- ✅ Restaurar deployment Vercel funcional
- ✅ Corrigir autenticação (login falhando com 404 em /api/auth/verify)
- ✅ Tornar o otimizador de rotas acessível como homepage

## What Was Done

**Deployment Vercel restaurado:**
- CVE-2025-66478 em Next.js 15.5.4 bloqueava o Vercel. Atualizado para 15.5.12.
- `vercel.json` corrigido: build era de `frontend-v0/` (sem `package.json` no git) → migrado para raiz.
- Deployment voltou ao estado READY.

**Autenticação corrigida:**
- Root cause: `verify/route.ts` commitado usava `supabaseServer.sql()` (pg direto) — `SUPABASE_SERVICE_ROLE_KEY` não estava no Vercel → erro `[supabase-server] SQL error` → loop de logout.
- Fix: versão local já usava `@supabase/supabase-js` (REST) — commitada (`4ee812b1`).
- `ploomes-user-link.ts` estava untracked e causava build failure — commitado (`ebe8035f`).

**Homepage → Otimizador de Rotas:**
- Investigado: nenhum commit foi perdido (`3a9351089` nunca existiu no GitHub).
- Causa: vercel.json antigo buildava `frontend-v0/` cujo `page.tsx` É o otimizador. Após migrar para raiz, homepage virou `/dashboard/cliente`.
- Fix em dois pontos:
  - `src/app/page.tsx`: redirect `/dashboard/cliente` → `/rota-cep` (`081a8cce`)
  - `src/components/AuthGuard.tsx`: post-login redirect `/dashboard/cliente` → `/rota-cep` (`f184babf`)

## Decisions Made

- **Arquitetura de deploy**: app principal é a raiz (`src/`). O `frontend-v0/` é legado, sem build próprio.
- **Homepage**: `/rota-cep` é a entrada — core do negócio.
- **Auth stack**: `@supabase/supabase-js` (REST) como padrão. `supabase-server.ts` (pg direto) abandonado nas rotas de auth.

## What Remains

**9 arquivos com mudanças locais NÃO commitadas** (478 linhas) — implementação RBAC da sessão anterior (Codex):
- APIs: `users/route.ts`, `users/[id]/route.ts`, `cached-search/route.ts`, `sync/sales/route.ts`
- Frontend: `dashboard/cliente/page.tsx`, `users/page.tsx`, `rota-cep/page.tsx`
- Lib: `ploomes-client.ts`, `types/api.ts`

**Arquivos untracked relevantes:**
- `src/app/api/ploomes/users/` — endpoint listagem de vendedores Ploomes
- `.context.md` — contexto do projeto
- `.github/` — workflows (weekly backup, planejado em sessão anterior)
- `docs/` — documentação
- `frontend-v0/supabase-migrations/` — migrations SQL (roles + sales_owner_id) **NÃO rodadas no Supabase**

---

*Auto-maintained by Maestro. Do not edit manually.*
