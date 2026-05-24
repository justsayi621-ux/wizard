import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GMAIL_USER = "prospertaku098@gmail.com";
const GMAIL_APP_PASS = "amag lmjh nrbu gamy";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const itemId = url.searchParams.get("id");

    // GET request = clicking approve/reject link from email
    if (req.method === "GET" && action && itemId) {
      if (!supabaseUrl || !serviceRoleKey) {
        return new Response("Server configuration error", { status: 500, headers: corsHeaders });
      }

      const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : null;
      if (!newStatus) {
        return new Response("Invalid action. Use approve or reject.", { status: 400, headers: corsHeaders });
      }

      // Update the submission status
      const res = await fetch(`${supabaseUrl}/rest/v1/community_submissions?id=eq.${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const updated = await res.json();
      const item = updated?.[0];

      if (item) {
        // Notify submitter if they provided email
        if (item.submitter_email && newStatus === "approved") {
          try {
            const nodemailer = await import("npm:nodemailer@6.9.16");
            const transporter = nodemailer.default.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS } });
            await transporter.sendMail({
              from: GMAIL_USER,
              to: item.submitter_email,
              subject: `[Free File Wizard] Your ${item.type} "${item.name}" has been approved!`,
              text: `Great news! Your ${item.type} submission "${item.name}" has been approved and is now live on Free File Wizard.\n\nView it at: https://freefilewizard.com\n\nThank you for contributing!`,
            });
          } catch (e) { console.error("Submitter notify failed:", e); }
        }
        if (item.submitter_email && newStatus === "rejected") {
          try {
            const nodemailer = await import("npm:nodemailer@6.9.16");
            const transporter = nodemailer.default.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS } });
            await transporter.sendMail({
              from: GMAIL_USER,
              to: item.submitter_email,
              subject: `[Free File Wizard] Your ${item.type} "${item.name}" was not approved`,
              text: `Your ${item.type} submission "${item.name}" was not approved at this time. This could be due to content guidelines or quality standards.\n\nYou're welcome to submit again with improvements.\n\nThank you for your interest in Free File Wizard.`,
            });
          } catch (e) { console.error("Submitter notify failed:", e); }
        }

        const typeLabel = item.type === "game" ? "Game" : "Web App";
        const statusLabel = newStatus === "approved" ? "APPROVED" : "REJECTED";
        return new Response(
          `<html><body style="font-family:sans-serif;max-width:500px;margin:40px auto;padding:20px;">
            <h2 style="color:${newStatus === "approved" ? "#10b981" : "#ef4444"};">${typeLabel} "${item.name}" - ${statusLabel}</h2>
            <p>The ${item.type} has been ${newStatus}.</p>
            ${newStatus === "approved" ? `<p>It is now live on Free File Wizard.</p>` : `<p>It has been removed from the review queue.</p>`}
            <p style="color:#888;font-size:12px;">Free File Wizard Admin Panel</p>
          </body></html>`,
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      return new Response("Item not found", { status: 404, headers: corsHeaders });
    }

    // POST request = send approval email for a new submission
    if (req.method === "POST") {
      const body = await req.json();
      const { submissionId, type, name, url, company, description, submitter_email } = body;

      if (!submissionId) {
        return new Response(JSON.stringify({ error: "submissionId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const baseUrl = supabaseUrl?.replace(/\/$/, "") || "";
      const approveUrl = `${baseUrl}/functions/v1/manage-submissions?action=approve&id=${submissionId}`;
      const rejectUrl = `${baseUrl}/functions/v1/manage-submissions?action=reject&id=${submissionId}`;

      const typeLabel = type === "game" ? "Game" : "Web App";

      const nodemailer = await import("npm:nodemailer@6.9.16");
      const transporter = nodemailer.default.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS } });

      await transporter.sendMail({
        from: GMAIL_USER,
        to: GMAIL_USER,
        subject: `[Free File Wizard] Review: New ${typeLabel} - "${name}"`,
        html: [
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">`,
          `<h2 style="color:#00f0ff;">New ${typeLabel} Submission</h2>`,
          `<table style="border-collapse:collapse;width:100%;">`,
          `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Name</td><td style="padding:8px;border:1px solid #ddd;">${name}</td></tr>`,
          `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Type</td><td style="padding:8px;border:1px solid #ddd;">${typeLabel}</td></tr>`,
          `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">URL</td><td style="padding:8px;border:1px solid #ddd;"><a href="${url}">${url}</a></td></tr>`,
          `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Company</td><td style="padding:8px;border:1px solid #ddd;">${company || "N/A"}</td></tr>`,
          `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Description</td><td style="padding:8px;border:1px solid #ddd;">${description || "N/A"}</td></tr>`,
          `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Submitter</td><td style="padding:8px;border:1px solid #ddd;">${submitter_email || "Anonymous"}</td></tr>`,
          `</table>`,
          `<div style="margin:20px 0;">`,
          `<a href="${approveUrl}" style="display:inline-block;padding:12px 24px;background:#10b981;color:white;text-decoration:none;border-radius:6px;margin-right:10px;font-weight:bold;">APPROVE</a>`,
          `<a href="${rejectUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">REJECT</a>`,
          `</div>`,
          `<p style="color:#888;font-size:12px;">Click APPROVE to make this ${typeLabel} live, or REJECT to decline it. The submitter will be notified automatically.</p>`,
          `</div>`,
        ].join(""),
      });

      return new Response(JSON.stringify({ success: true, message: "Approval email sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("manage-submissions error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
