/**
 * Module augmentation for Auth.js v5.
 *
 * Extends the Session and JWT types so TypeScript knows about
 * the access token and error fields we add in the callbacks.
 */

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    error?: string;
  }
}
