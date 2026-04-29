import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignInButton } from "@/components/auth/SignInButton";

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
        <SignInButton />
        <p className="text-xs text-stone-400">
          Signs in with Google to enable Drive backup. Your data stays in your
          browser.
        </p>
      </div>
    </div>
  );
}
