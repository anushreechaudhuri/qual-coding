"use client";

import Link from "next/link";
import { ApiKeyForm } from "@/components/settings/ApiKeyForm";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-900">Settings</h1>
          <Link
            href="/projects"
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Back to projects
          </Link>
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-stone-900">API Keys</h2>
            <p className="mt-1 text-xs text-stone-500">
              Keys are stored in your browser only and sent directly to the
              respective API services. They are never stored on our server.
            </p>
          </div>
          <ApiKeyForm />
        </section>
      </div>
    </div>
  );
}
