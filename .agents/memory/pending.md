# Pending Tasks

> Tasks that were not completed in the previous session.
> Maestro reads this at the start of each session and proposes continuing from where we left off.
> Updated at the end of each session.

---

<!-- Example format:

- [ ] Finish integration tests for auth flow (blocked by: missing test DB config).
- [ ] Update .context.md in src/api/ after middleware refactor.
- [ ] Review PR #42 — Coder finished, waiting for Reviewer.

-->

## Adicionado em 2026-02-26

- [ ] **Commit limpo do RBAC**: commitar os 9 arquivos modificados localmente (478 linhas de RBAC/Ploomes integration). Excluir `node_modules/`, `.next/`, `tsconfig.tsbuildinfo`.
- [ ] **Rodar migrations SQL no Supabase**:
  1. `frontend-v0/supabase-migrations/add-roles-ploomes-link.sql`
  2. `frontend-v0/supabase-migrations/add-sales-owner-id.sql`
  (Atenção: verificar constraint `users_role_check` antes de rodar)
- [ ] **Backfill de dados históricos**: executar `scripts/backfill-sales-owner-id.js` após migration.
- [ ] **Commitar/avaliar** `src/app/api/ploomes/users/` (untracked) e `.context.md`.
- [ ] **Weekly backup via GitHub Actions** (`.github/` untracked): avaliar se workflows estão prontos para commit.
