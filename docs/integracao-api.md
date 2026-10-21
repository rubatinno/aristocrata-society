# Integração com outro sistema (API de agendamento)

Esse documento é pra quem vai integrar um sistema externo (ex: uma área de
membros) com o agendamento da Aristocrata Society. Dá pra mandar esse
arquivo direto pra quem for implementar do outro lado.

## Como isso funciona

**O Supabase deste app (societyagendamentos.app) continua sendo a única
fonte de verdade sobre horários e agendamentos.** O outro sistema nunca
grava direto no banco nem guarda sua própria cópia dos horários — ele
sempre chama essa API, que é a mesma peça de código usada pela tela de
agendamento normal (`/agendar`). Isso é o que garante que nunca existam
dois lugares com informação diferente sobre o mesmo horário: não existe
"sincronizar depois", existe uma chamada por vez, sempre na mesma base.

Concretamente: criar/cancelar agendamento, checar disponibilidade e
elegibilidade (limite semanal do plano, restrição por "qual chamada" etc.)
passam todos pela mesma função interna (`lib/booking-service.ts`), não
importa se quem chamou foi a tela de agendamento ou essa API. Se um
horário já foi ocupado — por qualquer um dos dois lados — o outro recebe
erro na hora, nunca um agendamento duplicado.

## Duas formas de integrar — escolha uma

Existem dois jeitos de ligar a área de membros a esse agendamento.
**Não precisa usar os dois** — escolha o que fizer mais sentido:

### Opção A — Linkar/embutir a tela já pronta (mesma interface, menos trabalho)

Se a ideia é o mentorado ver **exatamente a mesma tela** que já existe hoje
(`/agendar`), sem o outro sistema desenhar nada do zero, basta um link:

```
https://societyagendamentos.app/agendar?mentor=<slug-do-mentor>
```

O parâmetro `?mentor=` é opcional — pré-seleciona um mentor específico
(o `slug` vem de `GET /mentors`, campo `slug`). Sem ele, o mentorado escolhe
entre os mentores disponíveis.

Duas formas de usar esse link:

- **Botão/link que abre em nova aba** (`target="_blank"` ou
  `window.open(...)`) — é o jeito mais simples e mais confiável. Zero
  trabalho de integração, funciona igual em qualquer navegador.
- **`<iframe>` embutido na própria página** da área de membros, pra parecer
  que nunca saiu do site:
  ```html
  <iframe
    src="https://societyagendamentos.app/agendar?mentor=<slug>"
    style="width: 100%; height: 800px; border: 0;"
    title="Agendar mentoria"
  ></iframe>
  ```
  **Atenção com essa opção**: o login do mentorado dentro do agendamento
  depende de cookie — e navegadores modernos (Safari por padrão, Chrome em
  parte dos casos) bloqueiam cookie de terceiro dentro de iframe entre
  domínios diferentes. Na prática, isso pode fazer o mentorado precisar
  logar de novo toda vez, ou o login simplesmente não "grudar" dentro do
  iframe em alguns navegadores. Testem em Safari antes de depender disso —
  se der problema, o link em nova aba (acima) resolve sem essa limitação.

Com a Opção A, essa API (endpoints abaixo) **não é necessária** — o
agendamento inteiro acontece dentro da tela que já existe.

### Opção B — Chamar a API e construir a própria tela

Se a ideia é o mentorado agendar **sem sair da interface da área de
membros**, com visual próprio, o outro sistema usa os endpoints abaixo pra
buscar disponibilidade e criar o agendamento por trás dos panos. Dá mais
liberdade de design, mas é todo o trabalho de tela (calendário, formulário
etc.) por conta de quem integrar.

---

## Autenticação (só necessária pra Opção B)

Toda chamada precisa do header:

```
Authorization: Bearer <INTEGRATION_API_KEY>
```

O valor de `INTEGRATION_API_KEY` é um segredo fixo, configurado nas
variáveis de ambiente do projeto na Vercel (e em `.env.local` pra rodar
localmente). Sem o header certo, toda rota devolve `401`.

> Esse é um segredo de **servidor pra servidor**. Nunca deve aparecer no
> navegador/app do usuário final — só no backend do sistema externo.

Base URL em produção:

```
https://societyagendamentos.app/api/v1
```

## Fluxo de integração (visão geral)

1. Mentorado compra/se matricula no sistema externo.
2. Sistema externo chama `POST /mentees` com o e-mail dele → isso aprova o
   acesso aqui dentro (equivalente a um admin aprovar manualmente em
   "Aprovações").
3. Pra mostrar a agenda, sistema externo chama `GET /availability` com o
   e-mail do mentorado → recebe só os horários que ele realmente pode
   marcar (já considerando limite semanal, restrição por nº de chamada
   etc).
4. Mentorado escolhe um horário → sistema externo chama
   `POST /bookings` → agendamento confirmado dos dois lados ao mesmo
   tempo, porque é o mesmo banco.
5. Se precisar cancelar: `POST /bookings/:id/cancel`.
6. A qualquer momento, `GET /bookings?menteeEmail=...` mostra o estado
   real atual — útil pra exibir "sua próxima mentoria" ou conferir que
   está tudo batendo.

---

## `POST /mentees`

Provisiona/aprova um mentorado. Chame **uma vez**, assim que a pessoa
compra/se matricula do outro lado — antes de tentar marcar qualquer
horário pra esse e-mail. Pode chamar de novo sem problema (é idempotente:
se o e-mail já existe, só atualiza os dados e não duplica nada).

**Body (JSON):**

```json
{
  "email": "pessoa@exemplo.com",
  "fullName": "Nome Completo",
  "phone": "11999998888",
  "planId": "uuid-do-plano (opcional)"
}
```

- `planId` é o id de um plano já cadastrado no painel (Planos). Se não
  mandar, a pessoa fica sem plano vinculado — nesse caso o limite padrão é
  1 chamada por semana, sem limite de total de chamadas nem de duração.

**Resposta (200 ou 201):**

```json
{ "menteeId": "uuid", "created": true }
```

`created: false` quer dizer que a conta já existia e só foi atualizada.

---

## `GET /mentors`

Lista os mentores com agenda ativa.

**Resposta:**

```json
{
  "mentors": [
    {
      "id": "uuid",
      "slug": "luizflavio",
      "name": "Rubatinno",
      "headline": null,
      "sessionDurationMinutes": 60,
      "meetingLocation": "Google Meet",
      "timezone": "America/Sao_Paulo"
    }
  ]
}
```

---

## `GET /availability?mentorId=...&menteeEmail=...&days=14`

Horários livres de um mentor pros próximos dias, **já filtrados pelo que
esse mentorado específico pode marcar** — é por isso que `menteeEmail` é
obrigatório: a lista de horários muda de pessoa pra pessoa (ex: horários
marcados como "só 2ª chamada" só aparecem pra quem está exatamente na 2ª
chamada).

**Query params:**

- `mentorId` (obrigatório)
- `menteeEmail` (obrigatório)
- `days` (opcional, padrão 14, máximo 31 ou a janela de agendamento do
  mentor — o que for menor)

**Resposta:**

```json
{
  "mentorId": "uuid",
  "menteeCallNumber": 2,
  "timezone": "America/Sao_Paulo",
  "sessionDurationMinutes": 60,
  "days": [
    {
      "date": "2026-10-21",
      "slots": [
        { "startsAt": "2026-10-21T18:00:00.000Z", "endsAt": "2026-10-21T19:00:00.000Z" }
      ]
    }
  ]
}
```

Todo horário vem em ISO 8601 UTC. `menteeCallNumber` é informativo (em
qual chamada esse mentorado está) — útil se o sistema externo quiser
mostrar algo tipo "sua 2ª mentoria".

---

## `POST /bookings`

Cria o agendamento. Passa pelas mesmas regras da tela normal: aprovação,
limite do plano (semanal/mensal/total), elegibilidade por chamada,
conflito de horário. Se qualquer regra barrar, devolve `409` com uma
mensagem pronta pra mostrar ao usuário.

**Body:**

```json
{
  "mentorId": "uuid",
  "menteeEmail": "pessoa@exemplo.com",
  "startsAt": "2026-10-21T18:00:00.000Z",
  "endsAt": "2026-10-21T19:00:00.000Z",
  "notes": "opcional"
}
```

`startsAt`/`endsAt` devem ser exatamente um dos horários devolvidos por
`GET /availability` (início/fim do slot).

**Resposta de sucesso (201):**

```json
{ "ok": true, "bookingId": "uuid" }
```

**Resposta de erro (409) — exemplos de mensagens que podem voltar:**

```json
{ "ok": false, "message": "Esse horário acabou de ser reservado. Escolha outro." }
```

```json
{ "ok": false, "message": "Só é permitida uma mentoria por semana. Você já tem uma chamada marcada nesta semana — você poderá marcar a próxima a partir de domingo." }
```

As mensagens já vêm prontas em português, pensadas pra mostrar direto pro
mentorado (são as mesmas usadas na tela interna).

**404** se `menteeEmail` ainda não foi provisionado — chame
`POST /mentees` primeiro.

---

## `POST /bookings/:id/cancel`

Cancela um agendamento (libera o horário de novo). `:id` é o `bookingId`
devolvido por `POST /bookings`.

**Resposta:** `{ "ok": true }`, ou `404` se o agendamento não existe ou já
estava cancelado.

---

## `GET /bookings?menteeEmail=...`

Lista os agendamentos (qualquer status) de um mentorado — do mais recente
pro mais antigo. Bom pra mostrar "sua próxima mentoria" no outro sistema
ou só conferir que os dois lados estão batendo.

```json
{
  "bookings": [
    {
      "id": "uuid",
      "mentorId": "uuid",
      "mentorName": "Lucas Vasconcelos",
      "startsAt": "2026-10-21T18:00:00+00:00",
      "endsAt": "2026-10-21T19:00:00+00:00",
      "status": "confirmada",
      "meetingLink": null,
      "notes": null
    }
  ]
}
```

`status` é um de: `confirmada`, `concluida`, `cancelada`, `no_show`.

---

## O que NÃO está incluso (por enquanto)

- **Tempo real**: se um admin cancelar/remarcar algo pelo painel interno,
  o sistema externo só vai saber na próxima vez que chamar `GET
  /bookings`. Não existe webhook avisando automaticamente ainda — se isso
  virar necessário, dá pra adicionar depois sem quebrar nada do que já
  existe aqui.
- **Edição/reagendamento**: hoje o fluxo é cancelar + criar de novo, não
  existe um "mover horário" atômico.
- **Gestão de planos**: criar/editar planos continua sendo feito manualmente
  no painel (Planos). A API só referencia um `planId` que já exista.

## Notas pra quem for implementar

- Todas as datas são ISO 8601 em UTC. Converta pro fuso de exibição do seu
  sistema na hora de mostrar pro usuário.
- `POST /mentees` e `POST /bookings/:id/cancel` são seguros de chamar mais
  de uma vez (idempotentes) — não duplicam nem quebram se repetidos.
- `POST /bookings` **não é** idempotente por natureza (duas chamadas
  diferentes = duas tentativas de agendamento) — mas duas tentativas pro
  mesmo horário vão naturalmente colidir e a segunda vai vir com erro 409,
  então não corre risco de duplicar o agendamento.
