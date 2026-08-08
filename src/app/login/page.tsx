"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const ssoMode = params.get("mode") === "sso";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<"sso_google" | "sso_microsoft">(
    "sso_google"
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onPersonal(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    router.push("/projects");
  }

  async function onSso(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, provider }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "SSO failed");
      return;
    }
    router.push("/projects");
  }

  return (
    <main className="min-h-screen mesh grid place-items-center px-4 py-10">
      <div className="surface w-full max-w-md rounded-2xl p-8 shadow-[var(--shadow)] fade-up">
        <Link href="/" className="brand-mark text-3xl">
          GraphLoom
        </Link>
        <p className="mt-2 text-[var(--ink-soft)]">
          {ssoMode ? "Sign in with organization SSO" : "Sign in with your personal account"}
        </p>

        <div className="mt-6 flex gap-2 border-b border-[var(--line)]">
          <Link href="/login" className={`tab ${!ssoMode ? "tab-active" : ""}`}>
            Personal
          </Link>
          <Link href="/login?mode=sso" className={`tab ${ssoMode ? "tab-active" : ""}`}>
            SSO
          </Link>
        </div>

        {ssoMode ? (
          <form onSubmit={onSso} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Identity provider
              <select
                className="field mt-1"
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as "sso_google" | "sso_microsoft")
                }
              >
                <option value="sso_google">Google Workspace (demo)</option>
                <option value="sso_microsoft">Microsoft Entra ID (demo)</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Work email
              <input
                className="field mt-1"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </label>
            <label className="block text-sm font-medium">
              Display name
              <input
                className="field mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <button className="btn btn-secondary w-full" disabled={loading}>
              {loading ? "Connecting…" : "Continue with SSO"}
            </button>
            <p className="text-xs text-[var(--ink-soft)]">
              Demo SSO accepts an identity payload locally. Point these buttons at your OIDC
              tenant in production.
            </p>
          </form>
        ) : (
          <form onSubmit={onPersonal} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Email
              <input
                className="field mt-1"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input
                className="field mt-1"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}

        <p className="mt-6 text-sm text-[var(--ink-soft)]">
          Need an account?{" "}
          <Link href="/register" className="font-semibold text-[var(--sea)]">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center">Loading…</main>}>
      <LoginForm />
    </Suspense>
  );
}
