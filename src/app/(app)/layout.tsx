import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Authenticated layout. Every route under (app)/ requires a valid session.
 * Unauthenticated users are redirected to the landing page.
 */
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  return <>{children}</>;
}
