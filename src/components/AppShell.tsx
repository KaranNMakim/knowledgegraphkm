"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

type User = { id: string; name: string; email: string; provider: string };

export function AppShell({
  children,
  projectId,
  projectName,
}: {
  children: ReactNode;
  projectId?: string;
  projectName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user) router.replace("/login");
        else setUser(data.user);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const tabs = projectId
    ? [
        { href: `/projects/${projectId}`, label: "Overview" },
        { href: `/projects/${projectId}/connectors`, label: "Connectors" },
        { href: `/projects/${projectId}/harmonization`, label: "Harmonization" },
        { href: `/projects/${projectId}/relationships`, label: "Relationships" },
        { href: `/projects/${projectId}/ontology`, label: "Ontology" },
        { href: `/projects/${projectId}/dictionary`, label: "Dictionary" },
        { href: `/projects/${projectId}/graph`, label: "Graph" },
      ]
    : [];

  if (!user) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="text-[var(--ink-soft)]">Loading workspace…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[rgba(247,242,234,0.72)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="brand-mark text-2xl">
              GraphLoom
            </Link>
            {projectName && (
              <span className="hidden text-sm text-[var(--ink-soft)] md:inline">
                / {projectName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="chip">
              {user.provider.startsWith("sso") ? "SSO" : "Personal"} · {user.name}
            </span>
            <button className="btn btn-ghost py-2" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
        {tabs.length > 0 && (
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 md:px-6">
            {tabs.map((tab) => {
              const active =
                pathname === tab.href ||
                (tab.label !== "Overview" && pathname.startsWith(tab.href));
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`tab whitespace-nowrap ${active ? "tab-active" : ""}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
