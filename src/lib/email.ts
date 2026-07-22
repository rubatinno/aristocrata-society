import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/** Envia um e-mail via API do Resend. Lança erro se a chamada falhar — quem
 * chama decide se isso deve derrubar o fluxo (nunca deve, para lembretes). */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Aristocrata Society <avisos@societyagendamentos.app>",
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) throw new Error(`Falha ao enviar e-mail via Resend: ${await res.text()}`);
}
