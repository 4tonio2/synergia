import nodemailer from "nodemailer";

type SendEmailArgs = {
  to: string | string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
};

export async function sendEmail({ to, from, subject, text, html }: SendEmailArgs) {
  // If SENDGRID_API_KEY is present, use SendGrid HTTP API (no extra dependency)
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    try {
      const payload: any = {
        personalizations: [
          {
            to: Array.isArray(to) ? to.map((t) => ({ email: t })) : [{ email: to }],
            subject,
          },
        ],
        from: {
          email: from || process.env.SENDGRID_DEFAULT_FROM || "no-reply@example.com",
        },
        content: [],
      };

      if (html) {
        payload.content.push({ type: "text/html", value: html });
      }
      if (text) {
        payload.content.push({ type: "text/plain", value: text });
      }

      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          provider: "sendgrid",
          status: res.status,
          error: body || `SendGrid returned status ${res.status}`,
        };
      }

      return { success: true, provider: "sendgrid" };
    } catch (error: any) {
      return { success: false, provider: "sendgrid", error: error?.message || String(error) };
    }
  }

  // Fallback: create Ethereal test account (nodemailer) for dev
  try {
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: from || 'Ethereal <no-reply@example.com>',
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    return { success: true, provider: "ethereal", previewUrl, info };
  } catch (error: any) {
    return { success: false, provider: "ethereal", error: error?.message || String(error) };
  }
}
