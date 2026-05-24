import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GMAIL_USER = "prospertaku098@gmail.com";
const GMAIL_APP_PASS = "amag lmjh nrbu gamy";

const categoryLabels: Record<string, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  support: "Support / Help",
  faq: "Question / FAQ",
  collaboration: "Collaboration Request",
  other: "Other",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const record = body.record || body;

    const category = record.category || "other";
    const email = record.email || "Not provided";
    const message = record.message || "";
    const createdAt = record.created_at || new Date().toISOString();

    const label = categoryLabels[category] || category;
    const subject = `[Free File Wizard] ${label}`;
    const emailBody = [
      `New feedback received from Free File Wizard:`,
      ``,
      `Category: ${label}`,
      `User Email: ${email}`,
      `Time: ${createdAt}`,
      ``,
      `Message:`,
      message,
      ``,
      `---`,
      `View all feedback in your Supabase dashboard.`,
    ].join("\n");

    // Send via Gmail SMTP using nodemailer
    const nodemailer = await import("npm:nodemailer@6.9.16");

    const transporter = nodemailer.default.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASS,
      },
    });

    await transporter.sendMail({
      from: GMAIL_USER,
      to: GMAIL_USER,
      subject: subject,
      text: emailBody,
    });

    console.log(`Email sent to ${GMAIL_USER}: ${subject}`);

    return new Response(JSON.stringify({ success: true, method: "gmail_smtp" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Email notification error:", err);

    return new Response(JSON.stringify({
      success: true,
      method: "fallback_logged",
      note: "Feedback stored in database. Email delivery issue: " + (err instanceof Error ? err.message : String(err)),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
