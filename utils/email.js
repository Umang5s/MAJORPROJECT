const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

const {
  EMAIL_PROVIDER,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_SECURE,
  SITE_URL
} = process.env;

let transporter;

async function createTransporter() {
  if (transporter) return transporter;

  // If using explicit SMTP config
  if (EMAIL_PROVIDER === 'smtp' && EMAIL_HOST) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: Number(EMAIL_PORT) || 587,
      secure: EMAIL_SECURE === 'true',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
    return transporter;
  }

  // If using Gmail with App Password (EMAIL_PROVIDER=gmail)
  if (EMAIL_PROVIDER === 'gmail' && EMAIL_USER && EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      }
    });
    return transporter;
  }

  // Fallback: Ethereal for development (auto-create test account)
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });

  console.log('Ethereal account created. Check preview URLs from send function.');
  return transporter;
}

async function renderTemplate(templateName, data) {
  const filePath = path.join(__dirname, '..', 'views', 'emails', `${templateName}.ejs`);
  return ejs.renderFile(filePath, data);
}

/**
 * sendEmail
 * - templateName: filename inside views/emails without extension
 * - to: recipient email
 * - subject: email subject
 * - data: object passed to ejs template
 */
async function sendEmail({ templateName, to, subject, data = {} }) {
  try {
    const transport = await createTransporter();
    const html = await renderTemplate(templateName, data);

    const info = await transport.sendMail({
      from: `"NightNest" <${process.env.EMAIL_USER || 'no-reply@nightnest.com'}>`,
      to,
      subject,
      html,
    });

    // If using Ethereal prints preview URL to console
    if (nodemailer.getTestMessageUrl && info) {
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log('Preview URL: %s', preview);
    }

    return info;
  } catch (err) {
    console.error('Error sending email:', err);
    // fail silently or rethrow depending on your choice
    // rethrow if you want controller to handle the error
    throw err;
  }
}

module.exports = { sendEmail };
