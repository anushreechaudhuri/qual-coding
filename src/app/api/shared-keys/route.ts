/**
 * Server-side password-protected API key distribution.
 *
 * Trusted testers enter a shared password to receive API keys.
 * The password is verified server-side against a SHA-256 hash
 * stored in env vars. Keys are never in the client bundle.
 *
 * Required env vars:
 *   SHARED_KEYS_PASSWORD_HASH - SHA-256 hex hash of the password
 *   SHARED_GEMINI_KEY         - Gemini API key to share
 *   SHARED_REDUCTO_KEY        - Reducto API key to share
 *   SHARED_ANTHROPIC_KEY      - Anthropic API key to share (optional)
 *   SHARED_OPENAI_KEY         - OpenAI API key to share (optional)
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const passwordHash = process.env.SHARED_KEYS_PASSWORD_HASH;
  if (!passwordHash) {
    return NextResponse.json(
      { error: "Shared keys not configured" },
      { status: 404 }
    );
  }

  const { password } = await req.json();
  if (!password) {
    return NextResponse.json(
      { error: "Password required" },
      { status: 400 }
    );
  }

  // Hash the provided password and compare
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Constant-time comparison to prevent timing attacks
  if (hashHex.length !== passwordHash.length) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  let match = true;
  for (let i = 0; i < hashHex.length; i++) {
    if (hashHex[i] !== passwordHash[i]) match = false;
  }

  if (!match) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Password correct: return the shared keys
  const keys: Record<string, string> = {};
  if (process.env.SHARED_GEMINI_KEY) keys.gemini = process.env.SHARED_GEMINI_KEY;
  if (process.env.SHARED_REDUCTO_KEY) keys.reducto = process.env.SHARED_REDUCTO_KEY;
  if (process.env.SHARED_ANTHROPIC_KEY) keys.anthropic = process.env.SHARED_ANTHROPIC_KEY;
  if (process.env.SHARED_OPENAI_KEY) keys.openai = process.env.SHARED_OPENAI_KEY;

  return NextResponse.json({ keys });
}
