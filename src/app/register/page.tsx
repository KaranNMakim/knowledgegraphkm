"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not register");
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
          Create a personal account. A retail demo project is seeded automatically.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Name
            <input
              className="field mt-1"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
        <p className="mt-6 text-sm text-[var(--ink-soft)]">
          Prefer SSO?{" "}
          <Link href="/login?mode=sso" className="font-semibold text-[var(--sea)]">
            Continue with SSO
          </Link>
        </p>
      </div>
    </main>
  );
}
