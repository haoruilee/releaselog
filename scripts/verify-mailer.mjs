import nodemailer from "nodemailer";

const preferred = (process.env.MAIL_PROVIDER ?? "").trim().toLowerCase();

if (preferred === "resend") {
  if (!process.env.RESEND_API_KEY?.trim()) {
    console.error("RESEND_API_KEY not configured");
    process.exit(1);
  }
  console.log("Resend verify: configured");
  process.exit(0);
}

const host = process.env.SMTP_HOST;
const port = Number.parseInt(process.env.SMTP_PORT ?? "465", 10);
const secure = (process.env.SMTP_SECURE ?? "1") !== "0";
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!host || !user || !pass || !Number.isFinite(port)) {
  if (process.env.RESEND_API_KEY?.trim()) {
    console.log("Resend verify: configured");
    process.exit(0);
  }
  console.error("SMTP/Resend env not configured");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
});

await transporter.verify();
console.log("SMTP verify: OK");
