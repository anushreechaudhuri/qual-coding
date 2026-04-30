export default function PrivacyPolicy() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl prose prose-stone prose-sm">
        <h1>Privacy Policy</h1>
        <p className="text-stone-500">Last updated: April 30, 2026</p>

        <h2>What Qual Coding does</h2>
        <p>
          Qual Coding is an open-source qualitative coding tool for researchers.
          It helps you upload, transcribe, code, and analyze interviews, field
          notes, and documents.
        </p>

        <h2>Where your data lives</h2>
        <p>
          All your research data (projects, documents, codes, memos, transcripts)
          is stored locally in your browser using IndexedDB. We do not operate
          any server-side database. Your data never leaves your device unless you
          explicitly choose to sync it.
        </p>

        <h2>Google Sign-In</h2>
        <p>
          Sign-in with Google is optional. If you choose to sign in, we receive
          your name, email address, and profile picture from Google. This is used
          solely to identify your session. We do not store this information on
          any server.
        </p>

        <h2>Google Drive Integration</h2>
        <p>
          If you sign in with Google, the app may request access to Google Drive
          (using the <code>drive.file</code> scope) to sync your data. This
          permission allows the app to create and manage files that it created
          in your Google Drive. It cannot access any other files in your Drive.
          Sync is optional and can be disabled at any time.
        </p>

        <h2>API Keys</h2>
        <p>
          The app uses external APIs (Gemini for audio transcription, Reducto
          for document parsing) with your own API keys (BYO). Keys are stored
          in your browser&apos;s localStorage and sent directly to the respective
          API services. They are never stored on or transmitted through our
          servers except as a pass-through proxy to avoid CORS restrictions.
        </p>

        <h2>Data we collect</h2>
        <p>
          We do not collect, store, or transmit any of your research data,
          personal information, or usage analytics. The app runs entirely in
          your browser. Our server handles only authentication (Google OAuth)
          and proxies API calls to external services.
        </p>

        <h2>Third-party services</h2>
        <ul>
          <li><strong>Google</strong>: Authentication and optional Drive sync</li>
          <li><strong>Gemini API</strong>: Audio transcription (using your API key)</li>
          <li><strong>Reducto API</strong>: Document parsing (using your API key)</li>
          <li><strong>Vercel</strong>: Hosting the web application</li>
        </ul>
        <p>
          Each of these services has its own privacy policy. Data sent to Gemini
          and Reducto is governed by their respective terms of service.
        </p>

        <h2>Open source</h2>
        <p>
          Qual Coding is open source under the MIT license. You can inspect the
          full source code at{" "}
          <a href="https://github.com/anushreechaudhuri/qual-coding">
            github.com/anushreechaudhuri/qual-coding
          </a>.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about this privacy policy, contact the maintainer via
          the GitHub repository.
        </p>
      </div>
    </div>
  );
}
