import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

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
    const contentType = req.headers.get("Content-Type") || "";
    if (!contentType.includes("multipart/form-data") && !contentType.includes("video/") && !contentType.includes("application/octet-stream")) {
      // Try to handle as raw binary
    }

    const contentLength = parseInt(req.headers.get("Content-Length") || "0");
    if (contentLength > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "File too large. Max 100MB." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read the raw video bytes
    const videoBuffer = await req.arrayBuffer();
    if (videoBuffer.byteLength === 0) {
      return new Response(JSON.stringify({ error: "Empty file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Since we can't run ffmpeg in Edge Functions, we return the video
    // and let the client handle audio extraction via Web Audio API.
    // For WebM videos, we can extract audio tracks client-side.
    // We'll return metadata about the file and a processing hint.
    const uint8 = new Uint8Array(videoBuffer);
    const header = Array.from(uint8.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join(' ');

    // Detect file type from magic bytes
    let fileType = "unknown";
    if (uint8[0] === 0x1A && uint8[1] === 0x45 && uint8[2] === 0xDF && uint8[3] === 0xA3) {
      fileType = "webm";
    } else if (uint8[4] === 0x66 && uint8[5] === 0x74 && uint8[6] === 0x79 && uint8[7] === 0x70) {
      fileType = "mp4";
    } else if (uint8[0] === 0x00 && uint8[1] === 0x00 && uint8[2] === 0x00 && (uint8[3] === 0x14 || uint8[3] === 0x1C)) {
      fileType = "mp4";
    }

    return new Response(JSON.stringify({
      success: true,
      fileType,
      fileSize: videoBuffer.byteLength,
      headerHex: header,
      message: "Video analyzed. Use the Web Audio API client-side to extract audio from the video element.",
      supportedClientSide: fileType === "webm",
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
