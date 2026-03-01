import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Force Node runtime (Edge can't use Node libs like net/tls that nodemailer needs)
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    // Basic validation
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof message !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !message.trim()
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Very basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = port === 465; // only true for 465

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,                          // false for 587 (STARTTLS)
      auth: {
        user: process.env.SMTP_USER!,  // the actual Gmail account
        pass: process.env.SMTP_PASS!,  // the App Password
      },
    });

    // Optional: helpful connection check before send
    await transporter.verify().catch(err => {
      console.error('SMTP verify failed:', err);
      throw err;
    });

    const info = await transporter.sendMail({
      from: process.env.CONTACT_FROM || `"Contact Form" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO || process.env.SMTP_USER,
      subject: `New Contact — ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p>${message.replace(/\n/g, '<br/>')}</p>`,
      replyTo: email,
    });

    return NextResponse.json({ ok: true, id: info.messageId });
  } catch (err) {
    console.error("Email send failed:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
