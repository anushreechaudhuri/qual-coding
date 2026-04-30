/**
 * App layout. Works with or without authentication.
 * Unauthenticated users get full local functionality (IndexedDB).
 * Authenticated users additionally get Drive sync.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
