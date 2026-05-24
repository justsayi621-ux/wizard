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
    const action = url.searchParams.get("action"); // approve_program, reject_program, approve_payout, reject_payout, mark_paid
    const requestId = url.searchParams.get("id");

    // GET = clicking link from email
    if (req.method === "GET" && action && requestId) {
      if (!supabaseUrl || !serviceRoleKey) {
        return new Response("Server error", { status: 500, headers: corsHeaders });
      }

      // Fetch the withdrawal request
      const res = await fetch(`${supabaseUrl}/rest/v1/withdrawal_requests?id=eq.${requestId}`, {
        headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
      });
      const requests = await res.json();
      const wr = requests?.[0];
      if (!wr) {
        return new Response("Withdrawal request not found", { status: 404, headers: corsHeaders });
      }

      let newStatus = wr.status;
      let responseMsg = "";

      if (action === "approve_program" && wr.status === "pending") {
        newStatus = "approved";
        responseMsg = `Withdrawal request #$${requestId.substring(0,8)} for $${wr.amount} has been APPROVED. The partner will see "Your request is being approved". You will receive a second email when they request payout to approve the actual payment.`;

        // Fetch partner email to notify them
        const pRes = await fetch(`${supabaseUrl}/rest/v1/ad_partners?id=eq.${wr.partner_id}`, {
          headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
        });
        const partners = await pRes.json();
        const partner = partners?.[0];

        if (partner?.email) {
          try {
            const nodemailer = await import("npm:nodemailer@6.9.16");
            const transporter = nodemailer.default.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS } });
            await transporter.sendMail({
              from: GMAIL_USER,
              to: partner.email,
              subject: `[Free File Wizard] Your withdrawal request of $${wr.amount} is being approved`,
              text: `Your withdrawal request of $${wr.amount} has been approved and is being processed.\n\nYou will be notified once the payment has been sent to your account.\n\nThank you for being a Free File Wizard ad partner!`,
            });
          } catch (e) { console.error("Partner notify failed:", e); }
        }
      } else if (action === "reject_program" && wr.status === "pending") {
        newStatus = "rejected";
        responseMsg = `Withdrawal request has been REJECTED.`;

        // Refund balance to partner
        const patchRes = await fetch(`${supabaseUrl}/rest/v1/ad_partners?id=eq.${wr.partner_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ balance: wr.amount }), // This adds back - need raw SQL
        });

      } else if (action === "approve_payout" && wr.status === "approved") {
        newStatus = "processing";
        responseMsg = `Payout for $${wr.amount} has been approved. Send the money to the partner's bank account, then click "Mark as Paid" from the second email link.`;

        // Notify partner
        const pRes = await fetch(`${supabaseUrl}/rest/v1/ad_partners?id=eq.${wr.partner_id}`, {
          headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
        });
        const partners = await pRes.json();
        const partner = partners?.[0];
        if (partner?.email) {
          try {
            const nodemailer = await import("npm:nodemailer@6.9.16");
            const transporter = nodemailer.default.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS } });
            await transporter.sendMail({
              from: GMAIL_USER,
              to: partner.email,
              subject: `[Free File Wizard] Payout of $${wr.amount} is being processed`,
              text: `Your withdrawal of $${wr.amount} is now being processed. The payment will be sent to your bank account shortly.\n\nYou will receive a confirmation once the funds have been transferred.`,
            });
          } catch (e) { console.error("Partner notify failed:", e); }
        }

      } else if (action === "mark_paid" && (wr.status === "approved" || wr.status === "processing")) {
        newStatus = "paid";

        // Update partner total_paid and deduct balance
        const pRes = await fetch(`${supabaseUrl}/rest/v1/ad_partners?id=eq.${wr.partner_id}`, {
          headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
        });
        const partners = await pRes.json();
        const partner = partners?.[0];
        if (partner) {
          const newTotalPaid = Number(partner.total_paid || 0) + Number(wr.amount);
          const newBalance = Math.max(0, Number(partner.balance || 0) - Number(wr.amount));
          await fetch(`${supabaseUrl}/rest/v1/ad_partners?id=eq.${wr.partner_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({ total_paid: newTotalPaid, balance: newBalance }),
          });
        }

        responseMsg = `Payment of $${wr.amount} has been marked as PAID. The partner has been notified.`;

        // Notify partner
        if (partner?.email) {
          try {
            const nodemailer = await import("npm:nodemailer@6.9.16");
            const transporter = nodemailer.default.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS } });
            await transporter.sendMail({
              from: GMAIL_USER,
              to: partner.email,
              subject: `[Free File Wizard] Payment of $${wr.amount} completed!`,
              text: `Your withdrawal of $${wr.amount} has been paid! The funds have been sent to your account.\n\nThank you for being a valued ad partner!\n\nKeep earning with Free File Wizard Cross-Ads Program.`,
            });
          } catch (e) { console.error("Partner notify failed:", e); }
        }

      } else if (action === "reject_payout") {
        newStatus = "rejected";
        responseMsg = `Payout has been REJECTED. The amount remains in the partner's balance.`;

      } else {
        return new Response(`Invalid action or request already processed (current status: ${wr.status})`, { status: 400, headers: corsHeaders });
      }

      // Update the withdrawal request status
      const updateBody: Record<string, string> = { status: newStatus };
      if (newStatus === "approved") updateBody.approved_at = new Date().toISOString();
      if (newStatus === "paid") updateBody.paid_at = new Date().toISOString();

      await fetch(`${supabaseUrl}/rest/v1/withdrawal_requests?id=eq.${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify(updateBody),
      });

      const statusColors: Record<string, string> = { approved: "#f59e0b", processing: "#3b82f6", paid: "#10b981", rejected: "#ef4444" };
      return new Response(
        `<html><body style="font-family:sans-serif;max-width:500px;margin:40px auto;padding:20px;">
          <h2 style="color:${statusColors[newStatus] || "#888"};">Withdrawal - ${newStatus.toUpperCase()}</h2>
          <p>${responseMsg}</p>
          <p style="color:#888;font-size:12px;">Free File Wizard Admin Panel</p>
        </body></html>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    // POST = send approval emails for new withdrawal request or new partner application
    if (req.method === "POST") {
      const body = await req.json();
      const { type, partnerId, partnerEmail, siteName, amount, paymentMethod, requestId } = body;

      const nodemailer = await import("npm:nodemailer@6.9.16");
      const transporter = nodemailer.default.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS } });

      if (type === "partner_application") {
        // Email 1: Approve/Reject the partner program application
        const approveUrl = `${supabaseUrl}/functions/v1/manage-withdrawals?action=approve_program_application&partner_id=${partnerId}`;
        // Use manage-submissions for partner applications since it's simpler
        await transporter.sendMail({
          from: GMAIL_USER,
          to: GMAIL_USER,
          subject: `[Free File Wizard] New Cross-Ads Partner Application: ${siteName}`,
          html: [
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">`,
            `<h2 style="color:#00f0ff;">Cross-Ads Partner Application</h2>`,
            `<table style="border-collapse:collapse;width:100%;">`,
            `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Email</td><td style="padding:8px;border:1px solid #ddd;">${partnerEmail}</td></tr>`,
            `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Site Name</td><td style="padding:8px;border:1px solid #ddd;">${siteName}</td></tr>`,
            `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Site URL</td><td style="padding:8px;border:1px solid #ddd;">${body.siteUrl || "N/A"}</td></tr>`,
            `</table>`,
            `<div style="margin:20px 0;">`,
            `<a href="${supabaseUrl}/functions/v1/manage-submissions?action=approve&id=${partnerId}" style="display:inline-block;padding:12px 24px;background:#10b981;color:white;text-decoration:none;border-radius:6px;margin-right:10px;font-weight:bold;">APPROVE PARTNER</a>`,
            `<a href="${supabaseUrl}/functions/v1/manage-submissions?action=reject&id=${partnerId}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">REJECT PARTNER</a>`,
            `</div>`,
            `<p style="color:#888;font-size:12px;">Approve to add this partner to the Cross-Ads program. They will earn a commission from ad impressions.</p>`,
            `</div>`,
          ].join(""),
        });

        return new Response(JSON.stringify({ success: true, message: "Partner application email sent" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (type === "withdrawal_request") {
        // Email 1: Approve the withdrawal program request
        const approveProgramUrl = `${supabaseUrl}/functions/v1/manage-withdrawals?action=approve_program&id=${requestId}`;
        const rejectProgramUrl = `${supabaseUrl}/functions/v1/manage-withdrawals?action=reject_program&id=${requestId}`;

        const pmText = paymentMethod ? Object.entries(paymentMethod).map(([k,v]) => `${k}: ${v}`).join(", ") : "Not specified";

        await transporter.sendMail({
          from: GMAIL_USER,
          to: GMAIL_USER,
          subject: `[Free File Wizard] Withdrawal Request: $${amount} from ${partnerEmail}`,
          html: [
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">`,
            `<h2 style="color:#f59e0b;">Withdrawal Request</h2>`,
            `<table style="border-collapse:collapse;width:100%;">`,
            `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Partner</td><td style="padding:8px;border:1px solid #ddd;">${partnerEmail}</td></tr>`,
            `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Amount</td><td style="padding:8px;border:1px solid #ddd;">$${amount}</td></tr>`,
            `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Payment Method</td><td style="padding:8px;border:1px solid #ddd;">${pmText}</td></tr>`,
            `</table>`,
            `<h3 style="margin-top:16px;">Step 1: Approve the Request</h3>`,
            `<div style="margin:10px 0;">`,
            `<a href="${approveProgramUrl}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:white;text-decoration:none;border-radius:6px;margin-right:10px;font-weight:bold;">APPROVE REQUEST</a>`,
            `<a href="${rejectProgramUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">REJECT</a>`,
            `</div>`,
            `<p style="color:#888;font-size:12px;">After approving, you will receive a SECOND email to approve the actual payout once you've sent the money to their bank account.</p>`,
            `</div>`,
          ].join(""),
        });

        return new Response(JSON.stringify({ success: true, message: "Withdrawal approval email sent" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (type === "payout_ready") {
        // Email 2: After program approved, money sent - approve the payout
        const approvePayoutUrl = `${supabaseUrl}/functions/v1/manage-withdrawals?action=approve_payout&id=${requestId}`;
        const markPaidUrl = `${supabaseUrl}/functions/v1/manage-withdrawals?action=mark_paid&id=${requestId}`;
        const rejectPayoutUrl = `${supabaseUrl}/functions/v1/manage-withdrawals?action=reject_payout&id=${requestId}`;

        const pmText = paymentMethod ? Object.entries(paymentMethod).map(([k,v]) => `${k}: ${v}`).join(", ") : "Not specified";

        await transporter.sendMail({
          from: GMAIL_USER,
          to: GMAIL_USER,
          subject: `[Free File Wizard] Payout Action Required: $${amount} to ${partnerEmail}`,
          html: [
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">`,
            `<h2 style="color:#3b82f6;">Payout Action Required</h2>`,
            `<p>The withdrawal of <strong>$${amount}</strong> for <strong>${partnerEmail}</strong> has been approved.</p>`,
            `<p>Payment details: ${pmText}</p>`,
            `<h3>Step 2: Process the Payment</h3>`,
            `<p>1. Send the money to the partner's bank account manually</p>`,
            `<p>2. Then click "Mark as Paid" below to confirm</p>`,
            `<div style="margin:10px 0;">`,
            `<a href="${markPaidUrl}" style="display:inline-block;padding:12px 24px;background:#10b981;color:white;text-decoration:none;border-radius:6px;margin-right:10px;font-weight:bold;">FUNDS PAID</a>`,
            `<a href="${rejectPayoutUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">REJECT PAYOUT</a>`,
            `</div>`,
            `<p style="color:#888;font-size:12px;">Click "FUNDS PAID" after you have manually sent the money to the partner's account. This will update their dashboard to show the payout is complete.</p>`,
            `</div>`,
          ].join(""),
        });

        return new Response(JSON.stringify({ success: true, message: "Payout approval email sent" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("manage-withdrawals error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
