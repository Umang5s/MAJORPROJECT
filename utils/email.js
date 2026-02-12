const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");

const {
  EMAIL_PROVIDER,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_SECURE,
  SITE_URL,
  RESEND_API_KEY,
  RESEND_FROM // optional: set a verified from address in Render env
} = process.env;

let transporter;

async function createTransporter() {
  if (transporter) return transporter;

  // If using explicit SMTP config (e.g., Brevo SMTP on Render)
  if (EMAIL_PROVIDER === "smtp" && EMAIL_HOST) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: Number(EMAIL_PORT) || 587,
      secure: EMAIL_SECURE === "true",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
    return transporter;
  }

  // Gmail with app password (local)
  if (EMAIL_PROVIDER === "gmail" && EMAIL_USER && EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
    return transporter;
  }

  // Fallback: Ethereal for development (auto-create)
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });

  console.log("Ethereal account created. Check preview URLs from send function.");
  return transporter;
}

async function renderTemplate(templateName, data) {
  // mapping to handle small filename differences
  const templateMap = {
    bookingConfirmation: "bookingconformation", // if your file is bookingconformation.ejs (typo)
    bookingconformation: "bookingconformation",
    cancellation: "cancellation",
    hostCancelled: "hostcancelled",
    hostcancelled: "hostcancelled",
    ownerCancellation: "ownercancelled",
    ownercancelled: "ownercancelled",
    ownerNewBooking: "ownerNewBooking",
    ownernewbooking: "ownerNewBooking",
  };

  const mapped = templateMap[templateName] || templateName;
  const filePath = path.join(__dirname, "..", "views", "emails", `${mapped}.ejs`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Email template not found: ${filePath}`);
  }

  return ejs.renderFile(filePath, data);
}

/**
 * sendEmail(args)
 * - args.templateName: template filename (without .ejs)
 * - args.to: recipient email
 * - args.subject: subject
 * - args.data: object passed to ejs template
 */
async function sendEmail({ templateName, to, subject, data = {} }) {
  if (!to) {
    console.warn("sendEmail called without 'to' address - aborting send.", { templateName, data });
    return;
  }

  try {
    const html = await renderTemplate(templateName, data);

    // === PRODUCTION via Resend API (preferred if API key provided) ===
    if (RESEND_API_KEY) {
      const resend = new Resend(RESEND_API_KEY);

      const fromAddress = RESEND_FROM || `NoReply <no-reply@${process.env.CLOUD_NAME || "example.com"}>`;
      await resend.emails.send({
        from: fromAddress,
        to,
        subject,
        html,
      });

      console.log("✅ Production email sent (Resend) →", to);
      return;
    }

    // === LOCAL / SMTP ===
    const transport = await createTransporter();
    const info = await transport.sendMail({
      from: `"NightNest" <${process.env.EMAIL_USER || "no-reply@nightnest.com"}>`,
      to,
      subject,
      html,
    });

    // If Ethereal preview available
    if (nodemailer.getTestMessageUrl && info) {
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log("Preview URL:", preview);
    }

    console.log("📧 Local/SMPP email sent →", to);
    return info;
  } catch (err) {
    console.error("Error sending email:", err);
    throw err; // rethrow so controller can catch/log if needed
  }
}

module.exports = { sendEmail };
