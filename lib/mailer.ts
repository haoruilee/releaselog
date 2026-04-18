import { Resend } from "resend";
import nodemailer from "nodemailer";

type MailArgs = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
};

type MailResult = {
  provider: "smtp" | "resend";
  messageId?: string | null;
};

type Provider = "smtp" | "resend";

function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number.parseInt(process.env.SMTP_PORT?.trim() ?? "", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const secureRaw = process.env.SMTP_SECURE?.trim();

  if (!host || !Number.isFinite(port) || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure: secureRaw ? secureRaw !== "0" && secureRaw.toLowerCase() !== "false" : port === 465,
    user,
    pass,
  };
}

function createSmtpTransport() {
  const config = smtpConfig();
  if (!config) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

function configuredProviders(): Provider[] {
  const providers: Provider[] = [];
  if (process.env.RESEND_API_KEY?.trim()) {
    providers.push("resend");
  }
  if (smtpConfig()) {
    providers.push("smtp");
  }
  return providers;
}

function preferredProviders(): Provider[] {
  const configured = configuredProviders();
  const preferred = process.env.MAIL_PROVIDER?.trim().toLowerCase();

  if (preferred === "smtp" && configured.includes("smtp")) {
    return ["smtp", ...configured.filter((provider) => provider !== "smtp")];
  }

  if (preferred === "resend" && configured.includes("resend")) {
    return ["resend", ...configured.filter((provider) => provider !== "resend")];
  }

  return configured;
}

export function mailProvider(): Provider | null {
  return preferredProviders()[0] ?? null;
}

async function sendViaSmtp(args: MailArgs): Promise<MailResult> {
  const smtp = createSmtpTransport();
  if (!smtp) {
    throw new Error("smtp_unconfigured");
  }

  const info = await smtp.sendMail({
    from: args.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    headers: args.headers,
  });
  return {
    provider: "smtp",
    messageId: info.messageId,
  };
}

async function sendViaResend(args: MailArgs): Promise<MailResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    throw new Error("resend_unconfigured");
  }

  const resend = new Resend(resendKey);
  const result = await resend.emails.send({
    from: args.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    headers: args.headers,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    provider: "resend",
    messageId: result.data?.id ?? null,
  };
}

export async function sendMail(args: MailArgs): Promise<MailResult> {
  const providers = preferredProviders();
  if (providers.length === 0) {
    throw new Error("mail_unconfigured");
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      if (provider === "resend") {
        return await sendViaResend(args);
      }
      return await sendViaSmtp(args);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("mail_unconfigured");
}

export async function verifyMailTransport(): Promise<{ provider: "smtp" | "resend" | null }> {
  const provider = mailProvider();
  if (!provider) {
    throw new Error("mail_unconfigured");
  }
  if (provider === "smtp") {
    const smtp = createSmtpTransport();
    if (!smtp) {
      throw new Error("smtp_unconfigured");
    }
    await smtp.verify();
    return { provider: "smtp" };
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("resend_unconfigured");
  }
  return { provider: "resend" };
}
