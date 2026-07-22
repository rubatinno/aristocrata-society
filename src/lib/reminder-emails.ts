import "server-only";
import { differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

export type ReminderKind = "30" | "5" | "start";

const KIND_BADGE: Record<ReminderKind, string> = {
  "30": "Começa em 30 minutos",
  "5": "Começa em 5 minutos",
  start: "Começando agora",
};

export interface ReminderEmailInput {
  recipientName: string;
  otherPartyName: string;
  mentorName: string;
  menteeName: string;
  kind: ReminderKind;
  startsAt: string; // ISO
  endsAt: string; // ISO
  timeZone: string;
  meetingLink: string | null;
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
  meetingLink,
}: ReminderEmailInput): { subject: string; html: string } {
  const badge = KIND_BADGE[kind];
  const eventTitle = `Mentoria: ${mentorName} + ${menteeName}`;
  const durationMinutes = differenceInMinutes(new Date(endsAt), new Date(startsAt));

  const weekdayDate = formatInTimeZone(new Date(startsAt), timeZone, "EEEE, d 'de' MMMM", {
    locale: ptBR,
  });
  const capitalizedDate = weekdayDate.charAt(0).toUpperCase() + weekdayDate.slice(1);
  const startTime = formatInTimeZone(new Date(startsAt), timeZone, "HH:mm");
  const endTime = formatInTimeZone(new Date(endsAt), timeZone, "HH:mm");

  const subject =
    kind === "start"
      ? `Começando agora: mentoria com ${otherPartyName}`
      : `${badge}: mentoria com ${otherPartyName}`;

  const linkButtonHtml = meetingLink
    ? `
      <tr>
        <td style="padding: 24px 32px 4px 32px;">
          <a href="${meetingLink}"
             style="display:inline-block; background-color:#4f46e5; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; padding:12px 22px; border-radius:8px;">
            Entrar na chamada
          </a>
        </td>
      </tr>`
    : "";

  const html = `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0; padding:0; background-color:#f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e4e4e7;">
            <tr>
              <td style="height:6px; background-color:#4f46e5; font-size:0; line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding: 28px 32px 0 32px;">
                <span style="display:inline-block; background-color:#eef2ff; color:#4338ca; font-size:12px; font-weight:700; letter-spacing:.02em; text-transform:uppercase; padding:5px 12px; border-radius:999px;">
                  ${badge}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 14px 32px 0 32px;">
                <p style="margin:0; font-size:20px; font-weight:700; color:#111827;">${eventTitle}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:8px; font-size:14px; color:#52525b; width:88px;">Quando</td>
                    <td style="padding-bottom:8px; font-size:14px; color:#111827; font-weight:600;">${capitalizedDate}, ${startTime} – ${endTime}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:8px; font-size:14px; color:#52525b;">Duração</td>
                    <td style="padding-bottom:8px; font-size:14px; color:#111827; font-weight:600;">${durationMinutes} minutos</td>
                  </tr>
                  <tr>
                    <td style="font-size:14px; color:#52525b;">Com</td>
                    <td style="font-size:14px; color:#111827; font-weight:600;">${otherPartyName}</td>
                  </tr>
                </table>
              </td>
            </tr>
            ${linkButtonHtml}
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
