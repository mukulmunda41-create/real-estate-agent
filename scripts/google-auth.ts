// One-time helper to get a Google Calendar refresh token.
// Reads GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from .env.local, opens a browser
// for consent, captures the code on a local server, exchanges it, and writes
// GOOGLE_REFRESH_TOKEN back into .env.local automatically.
//
// Run: npx tsx scripts/google-auth.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import http from "node:http";
import { exec } from "node:child_process";
import fs from "node:fs";

const PORT = 4567;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

if (!clientId || !clientSecret) {
  console.error("❌ GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing in .env.local");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // force a refresh_token even if previously authorized
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  if (!url.pathname.startsWith("/callback")) {
    res.writeHead(200);
    res.end("waiting…");
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("No authorization code received. Close this and re-run.");
    return;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const json = await tokenRes.json();

  if (json.refresh_token) {
    let env = fs.readFileSync(".env.local", "utf8");
    if (/^GOOGLE_REFRESH_TOKEN=.*$/m.test(env)) {
      env = env.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${json.refresh_token}`);
    } else {
      env += `\nGOOGLE_REFRESH_TOKEN=${json.refresh_token}\n`;
    }
    fs.writeFileSync(".env.local", env);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h2>✅ Done! Refresh token saved. You can close this tab.</h2>");
    console.log("\n✅ Refresh token saved to .env.local");
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h2>⚠️ No refresh token returned. Check the terminal.</h2>");
    console.log("\n⚠️ No refresh_token in response:", JSON.stringify(json, null, 2));
  }
  server.close();
  setTimeout(() => process.exit(0), 200);
});

server.listen(PORT, () => {
  console.log("\n1) Make sure this redirect URI is added to your OAuth client in Google Cloud Console:");
  console.log(`   ${REDIRECT}\n`);
  console.log("2) Opening your browser to authorize… If it doesn't open, paste this URL:\n");
  console.log(authUrl + "\n");
  exec(`open "${authUrl}"`);
});
