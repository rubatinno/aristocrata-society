import "server-only";
import { formatInTimeZone } from "date-fns-tz";

export type ReminderKind = "30" | "5" | "start";

const KIND_LABEL: Record<ReminderKind, string> = {
  "30": "em 30 minutos",
  "5": "em 5 minutos",
  start: "agora",
};

export interface ReminderEmailInput {
  recipientName: string;
  otherPartyName: string;
  kind: ReminderKind;
  startsAt: string; // ISO
  timeZone: string;
  meetingLink: string | null;
}

export function buildReminderEmail({
  recipientName,
  otherPartyName,
  kind,
  startsAt,
  timeZone,
  meetingLink,
}: ReminderEmailInput): { subject: string; html: string } {
  const time = formatInTimeZone(new Date(startsAt), timeZone, "HH:mm");
  const label = KIND_LABEL[kind];

  const subject =
    kind === "start"
      ? `Sua mentoria com ${otherPartyName} está começando agora`
      : `Sua mentoria com ${otherPartyName} começa ${label}`;

  const linkHtml = meetingLink
    ? `<p><a href="${meetingLink}" style="color:#2563eb;">Entrar na chamada</a></p>`
    : "";

  const html = `
    <div style="font-family: sans-serif; font-size: 15px; color: #111; line-height: 1.5;">
      <p>Olá, ${recipientName}!</p>
      <p>Sua mentoria com <strong>${otherPartyName}</strong> começa <strong>${label}</strong>, às ${time}.</p>
      ${linkHtml}
      <p style="color:#666; font-size: 13px;">Aristocrata Society</p>
    </div>
  `.trim();

  return { subject, html };
}
