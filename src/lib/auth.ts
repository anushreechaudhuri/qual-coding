/**
 * Auth.js v5 configuration.
 *
 * Uses Google OAuth with the drive.appdata scope so we get Drive access
 * in the same sign-in flow. The jwt and session callbacks expose the
 * access token to client components (needed by the sync engine).
 *
 * Required env vars:
 *   AUTH_GOOGLE_ID      - Google OAuth client ID
 *   AUTH_GOOGLE_SECRET   - Google OAuth client secret
 *   AUTH_SECRET          - Random string for encrypting JWTs
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: process.env.ENABLE_DRIVE_SYNC === "true"
            ? "openid email profile https://www.googleapis.com/auth/drive.file"
            : "openid email profile",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      // On initial sign-in, persist the OAuth tokens into the JWT
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
      }

      // If the access token hasn't expired, return as-is
      if (
        typeof token.expires_at === "number" &&
        Date.now() < token.expires_at * 1000
      ) {
        return token;
      }

      // Access token expired: attempt refresh
      if (token.refresh_token) {
        try {
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.AUTH_GOOGLE_ID!,
              client_secret: process.env.AUTH_GOOGLE_SECRET!,
              grant_type: "refresh_token",
              refresh_token: token.refresh_token as string,
            }),
          });

          const refreshed = await response.json();

          if (!response.ok) throw refreshed;

          token.access_token = refreshed.access_token;
          token.expires_at = Math.floor(
            Date.now() / 1000 + (refreshed.expires_in as number)
          );
          if (refreshed.refresh_token) {
            token.refresh_token = refreshed.refresh_token;
          }
        } catch {
          token.error = "RefreshTokenError";
        }
      }

      return token;
    },

    async session({ session, token }) {
      // Expose the access token to client components via useSession()
      session.accessToken = token.access_token as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
});
