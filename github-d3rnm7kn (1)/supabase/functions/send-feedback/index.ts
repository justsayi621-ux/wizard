import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FeedbackPayload {
  category: string;
  email: string;
  message: string;
  timestamp: string;
  userAgent: string;
}

const GMAIL_USER = "prospertaku098@gmail.com";
// Google App Password: "amag lmjh nrbu gamy" (spaces removed for SMTP auth)
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
    const body: FeedbackPayload = await req.json();

    if (!body.message || !body.message.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const category = body.category || "other";
    const email = body.email || "Not provided";
    const message = body.message.trim();
    const timestamp = body.timestamp || new Date().toISOString();
    const userAgent = body.userAgent || "Unknown";
    const label = categoryLabels[category] || category;

    // Store feedback in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && serviceRoleKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            category,
            email,
            message,
            user_agent: userAgent,
            created_at: timestamp,
          }),
        });
      } catch (dbErr) {
        console.error("DB insert failed:", dbErr);
      }
    }

    // Send email notification via Gmail SMTP
    let emailSent = false;
    try {
      const nodemailer = await import("npm:nodemailer@6.9.16");

      const transporter = nodemailer.default.createTransport({
        service: "gmail",
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASS,
        },
      });

      const subject = `[Free File Wizard] ${label} - ${message.substring(0, 40)}...`;
      const emailBody = [
        `New feedback received from Free File Wizard:`,
        ``,
        `Category: ${label}`,
        `User Email: ${email}`,
        `Time: ${timestamp}`,
        `Device: ${userAgent.substring(0, 100)}`,
        ``,
        `Message:`,
        message,
        ``,
        `---`,
        `Reply to the user at: ${email}`,
      ].join("\n");

      await transporter.sendMail({
        from: GMAIL_USER,
        to: GMAIL_USER,
        subject: subject,
        text: emailBody,
        replyTo: email !== "Not provided" ? email : undefined,
      });

      emailSent = true;
      console.log(`Email forwarded to ${GMAIL_USER}: ${subject}`);
    } catch (emailErr) {
      console.error("Email delivery failed:", emailErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Feedback received. Thank you!",
      emailNotified: emailSent,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
