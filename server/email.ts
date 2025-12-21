import nodemailer from "nodemailer";

type SendEmailArgs = {
  to: string | string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
};

export async function sendEmail({ to, from, subject, text, html }: SendEmailArgs) {
  // Prefer SMTP if configured (avoid SendGrid per request)
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const smtpSecure = process.env.SMTP_SECURE === "true";

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort || 587,
        secure: smtpSecure || false,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: from || process.env.SMTP_DEFAULT_FROM || `no-reply@${smtpHost}`,
        to: Array.isArray(to) ? to.join(", ") : to,
        subject,
        text: text || undefined,
        html: html || undefined,
      });

      return { success: true, provider: "smtp", info };
    } catch (error: any) {
      console.error('[EMAIL] SMTP send error:', error);
      return { success: false, provider: "smtp", error: error?.message || String(error) };
    }
  }

  // Fallback: Ethereal for development
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
    console.error('[EMAIL] Ethereal send error:', error);
    return { success: false, provider: "ethereal", error: error?.message || String(error) };
  }
}
