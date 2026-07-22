import "server-only";
import { differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

export type ReminderKind = "30" | "5" | "1";

const KIND_MINUTES: Record<ReminderKind, number> = { "30": 30, "5": 5, "1": 1 };

function minutesLabel(minutes: number) {
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

// Paleta institucional Aristocrata Society (quase-preto + dourado envelhecido),
// convertida de oklch (src/app/globals.css) pra hex — clientes de e-mail não
// entendem oklch().
const COLORS = {
  gold: "#93690d",
  goldSoft: "#e9dcc8",
  goldText: "#643f00",
  ink: "#16100a",
  cream: "#f9f4ec",
  border: "#d6ccc0",
  mutedText: "#5d5449",
};

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export interface ReminderEmailInput {
  recipientName: string;
  otherPartyName: string;
  mentorName: string;
  menteeName: string;
  kind: ReminderKind;
  startsAt: string; // ISO
  endsAt: string; // ISO
  timeZone: string;
  panelUrl: string; // caminho relativo, ex: "/dashboard/agenda" ou "/agendar"
}

export function buildReminderEmail({
  recipientName,
  otherPartyName,
  mentorName,
  menteeName,
  kind,
  startsAt,
  endsAt,
  timeZone,
  panelUrl,
}: ReminderEmailInput): { subject: string; html: string } {
  const minutes = KIND_MINUTES[kind];
  const badge = `Começa em ${minutesLabel(minutes)}`;
  const eventTitle = `Mentoria: ${mentorName} + ${menteeName}`;
  const durationMinutes = differenceInMinutes(new Date(endsAt), new Date(startsAt));

  const weekdayDate = formatInTimeZone(new Date(startsAt), timeZone, "EEEE, d 'de' MMMM", {
    locale: ptBR,
  });
  const capitalizedDate = weekdayDate.charAt(0).toUpperCase() + weekdayDate.slice(1);
  const startTime = formatInTimeZone(new Date(startsAt), timeZone, "HH:mm");
  const endTime = formatInTimeZone(new Date(endsAt), timeZone, "HH:mm");

  const subject = `Sua chamada começa em ${minutesLabel(minutes)}!`;

  const logoLightUrl = `${appUrl()}/logo-mark-dark-email.png`; // brasão em tinta escura, pro fundo claro
  const logoDarkUrl = `${appUrl()}/logo-mark-email.png`; // brasão em tinta clara, pro fundo escuro
  const dashboardUrl = `${appUrl()}${panelUrl}`;

  const html = `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <style>
      .logo-dark { display: none; }
      @media (prefers-color-scheme: dark) {
        .logo-light { display: none !important; }
        .logo-dark { display: block !important; }
      }
      /* Gmail (webmail/app) não segue prefers-color-scheme — usa esse
         atributo próprio injetado no <body> quando o usuário está no
         modo escuro. Repete a mesma troca de logo pra cobrir o Gmail. */
      [data-ogsc] .logo-light { display: none !important; }
      [data-ogsc] .logo-dark { display: block !important; }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:${COLORS.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.cream}; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:14px; overflow:hidden; border:1px solid ${COLORS.border};">
            <tr>
              <td style="height:6px; background-color:${COLORS.gold}; font-size:0; line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style="padding: 26px 32px 0 32px;">
                <img src="${logoLightUrl}" alt="Aristocrata Society" width="120" class="logo-light" style="display:block; width:120px; height:auto;" />
                <img src="${logoDarkUrl}" alt="Aristocrata Society" width="120" class="logo-dark" style="width:120px; height:auto;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 18px 32px 0 32px;">
                <span style="display:inline-block; background-color:${COLORS.goldSoft}; color:${COLORS.goldText}; font-size:12px; font-weight:700; letter-spacing:.02em; text-transform:uppercase; padding:5px 12px; border-radius:999px;">
                  ${badge}
                </span>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 14px 32px 0 32px;">
                <p style="margin:0; font-family: Georgia, 'Times New Roman', serif; font-size:21px; font-weight:700; color:${COLORS.ink};">${eventTitle}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${COLORS.border}; border-bottom:1px solid ${COLORS.border};">
                  <tr>
                    <td style="padding:14px 0; font-size:14px; color:${COLORS.mutedText}; width:88px;">Quando</td>
                    <td style="padding:14px 0; font-size:14px; color:${COLORS.ink}; font-weight:600;">${capitalizedDate}, ${startTime} – ${endTime}</td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-top:12px; font-size:14px; color:${COLORS.mutedText}; width:88px;">Duração</td>
                    <td style="padding-top:12px; font-size:14px; color:${COLORS.ink}; font-weight:600;">${durationMinutes} minutos</td>
                  </tr>
                  <tr>
                    <td style="padding-top:8px; font-size:14px; color:${COLORS.mutedText};">Com</td>
                    <td style="padding-top:8px; font-size:14px; color:${COLORS.ink}; font-weight:600;">${otherPartyName}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 24px 32px 4px 32px;">
                <a href="${dashboardUrl}"
                   style="display:inline-block; background-color:${COLORS.gold}; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; padding:12px 22px; border-radius:8px;">
                  Acessar Agendamentos
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px 28px 32px;">
                <p style="margin:0; font-size:12px; color:#a1a1aa;">Olá, ${recipientName} — este é um lembrete automático da Aristocrata Society.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  return { subject, html };
}
