const nodemailer = require("nodemailer");
const { Resend } = require("resend");

let sendEmail;

if (process.env.NODE_ENV === "production") {
  // ===== PRODUCTION (Render) =====
  const resend = new Resend(process.env.RESEND_API_KEY);

  sendEmail = async (to, subject, html) => {
    try {
      const data = await resend.emails.send({
        from: "Booking <onboarding@resend.dev>",
        to,
        subject,
        html,
      });

      console.log("Email sent (production):", data);
    } catch (err) {
      console.error("Production email error:", err);
    }
  };

} else {
  // ===== DEVELOPMENT (Localhost) =====
  sendEmail = async (to, subject, html) => {
    let testAccount = await nodemailer.createTestAccount();

    let transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    let info = await transporter.sendMail({
      from: '"ApnaStay" <test@apnastay.com>',
      to,
      subject,
      html,
    });

    console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
  };
}

module.exports = { sendEmail };
