import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignInButton } from "@/components/auth/SignInButton";
import Link from "next/link";

export default async function LandingPage() {
  const session = await auth();

  if (session) {
    redirect("/projects");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Qual Coding
        </h1>
        <p className="text-stone-600 text-base leading-relaxed">
          Open-source qualitative coding for multilingual fieldwork. Upload
          interviews, field notes, and documents. Code, memo, and export your
          analysis. Works offline.
        </p>
        <div className="space-y-3">
          <SignInButton />
          <Link
            href="/projects"
            className="block text-sm text-stone-500 hover:text-stone-700 underline underline-offset-2"
          >
            Continue without sign-in
          </Link>
        </div>
        <p className="text-xs text-stone-400">
          Sign in with Google enables Drive backup. Without sign-in, all data
          stays in your browser. You can sign in later anytime.
        </p>
      </div>
    </div>
  );
}
