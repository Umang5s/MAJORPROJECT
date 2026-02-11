const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendEmail = async (to, subject, html) => {
  try {
    const data = await resend.emails.send({
      from: "Booking <onboarding@resend.dev>",
      to: to,
      subject: subject,
      html: html,
    });

    console.log("Email sent:", data);
  } catch (err) {
    console.error("Email error:", err);
  }
};
