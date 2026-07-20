# Mentora — agendamento de mentorias

Esqueleto de um sistema de agendamento estilo Calendly/Google Agenda, focado em
mentores: cada mentor tem um link público (`/m/seu-link`) com os horários que
disponibilizou, o mentorado agenda direto nesse link, e o mentor acompanha tudo
num painel (próximas calls, histórico, cancelamentos).

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + Supabase
(Auth com magic link, Postgres, RLS).

## Como rodar

```bash
npm install
npm run dev
```

Sem configurar o Supabase, a landing page (`/`) já funciona. As páginas que
dependem de dados (login, painel, agendamento público) mostram uma tela
avisando para configurar o Supabase.

## Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o conteúdo de `supabase/migrations/0001_init.sql`
   (cria as tabelas `profiles`, `availability_rules`, `bookings`, as policies
   de RLS e a função `get_busy_ranges`).
3. Em **Authentication → URL Configuration**, adicione
   `http://localhost:3000/auth/callback` como Redirect URL.
4. Copie `.env.example` para `.env.local` e preencha com as chaves do seu
   projeto (**Project Settings → API**):

   ```bash
   cp .env.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — chaves públicas.
   - `SUPABASE_SERVICE_ROLE_KEY` — usada só no servidor (Server Actions) para
     confirmar um agendamento com segurança. **Nunca** exponha no client.

5. Rode `npm run dev` de novo e entre por `/login` com seu e-mail (magic
   link, sem senha). No primeiro acesso você passa por um onboarding rápido
   (nome, link, fuso horário, duração da sessão).

## Como o agendamento funciona

- O mentor define blocos de disponibilidade recorrentes por dia da semana em
  **Disponibilidade** (`src/app/dashboard/disponibilidade`).
- A página pública `/m/[slug]` (`src/app/m/[slug]/page.tsx`) calcula os
  horários livres combinando essas regras com os agendamentos já existentes —
  a lógica de slots fica isolada em `src/lib/scheduling.ts` (fuso horário
  tratado com `date-fns-tz`).
- Ao confirmar, a Server Action `createBooking`
  (`src/app/m/[slug]/actions.ts`) insere o registro usando a service role,
  depois de checar que o horário ainda está livre. A garantia final contra
  dois mentorados reservando o mesmo horário ao mesmo tempo é uma constraint
  de exclusão no Postgres (`bookings_no_overlap`, no arquivo de migration) —
  não uma checagem só no código.
- O painel (`src/app/dashboard`) lista as calls a realizar, o histórico e os
  cancelamentos, com ações para marcar como concluída ou cancelar.

## Estrutura

```
src/
  app/
    page.tsx                  landing page
    login/                    login com magic link
    onboarding/                primeira configuração do mentor
    dashboard/                 painel do mentor (protegido)
      agenda/                  calls a realizar / histórico / canceladas
      disponibilidade/         editor de horários semanais
      configuracoes/           perfil, link, duração da sessão, fuso
    m/[slug]/                  página pública de agendamento
  components/
    ui/                        componentes shadcn/ui
    dashboard/, booking/, auth/, landing/
  lib/
    supabase/                  clients (browser, server, admin)
    scheduling.ts              cálculo de horários disponíveis
    session.ts                 helpers de autenticação/servidor
supabase/
  migrations/0001_init.sql     schema, RLS, função get_busy_ranges
```

## Próximos passos sugeridos

- Enviar e-mail de confirmação/lembrete ao mentor e ao mentorado (ex: Resend).
- Gerar automaticamente o link de call (Google Meet/Zoom) ao confirmar.
- Reagendar/cancelar pelo lado do mentorado (hoje só o mentor gerencia depois
  de criado).
- Suportar múltiplas durações de sessão ("tipos de evento", como no Calendly).
