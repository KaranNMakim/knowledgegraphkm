"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) router.replace("/projects");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="text-[var(--ink-soft)]">Loading GraphLoom…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen mesh relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="drift absolute -right-10 top-24 h-72 w-72 rounded-full bg-[rgba(15,107,98,0.16)] blur-2xl" />
        <div className="drift absolute left-10 bottom-10 h-56 w-56 rounded-full bg-[rgba(196,86,44,0.14)] blur-2xl" style={{ animationDelay: "1.5s" }} />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="brand-mark text-2xl text-[var(--ink)]">GraphLoom</div>
        <div className="flex gap-3">
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/register" className="btn btn-primary">
            Create account
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="fade-up">
          <p className="brand-mark mb-4 text-5xl leading-[1.05] text-[var(--ink)] md:text-6xl lg:text-7xl">
            GraphLoom
          </p>
          <h1 className="max-w-xl text-2xl font-medium leading-snug text-[var(--ink-soft)] md:text-3xl">
            Weave knowledge graphs from the databases your organization already trusts.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[var(--ink-soft)]">
            Connect MSSQL, Postgres, MySQL, NoSQL, and CSV sources. Infer joins from data
            overlap, confirm relationships, upload plain-English ontologies, and keep a living
            data dictionary across projects.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn btn-primary">
              Start with personal account
            </Link>
            <Link href="/login?mode=sso" className="btn btn-secondary">
              Continue with SSO
            </Link>
          </div>
        </div>

        <div className="fade-up-delay surface relative rounded-2xl p-6 shadow-[var(--shadow)]">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--sea)]">
              Retail demo graph
            </span>
            <span className="chip">preloaded</span>
          </div>
          <svg viewBox="0 0 420 280" className="h-auto w-full" aria-hidden>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0f6b62" />
                <stop offset="100%" stopColor="#c4562c" />
              </linearGradient>
            </defs>
            <line x1="90" y1="70" x2="210" y2="140" stroke="url(#g1)" strokeWidth="2" />
            <line x1="330" y1="70" x2="210" y2="140" stroke="url(#g1)" strokeWidth="2" />
            <line x1="210" y1="140" x2="120" y2="230" stroke="#0f6b62" strokeWidth="2" opacity="0.7" />
            <line x1="210" y1="140" x2="300" y2="230" stroke="#c4562c" strokeWidth="2" opacity="0.7" />
            <line x1="90" y1="70" x2="330" y2="70" stroke="#1c3d4d" strokeWidth="1.5" opacity="0.25" />
            {[
              [90, 70, "product"],
              [330, 70, "consumer"],
              [210, 140, "sales"],
              [120, 230, "promo"],
              [300, 230, "store"],
            ].map(([x, y, label], i) => (
              <g key={String(label)}>
                <circle
                  cx={x as number}
                  cy={y as number}
                  r="28"
                  fill={i === 2 ? "#0b2431" : "#f7f2ea"}
                  stroke={i === 2 ? "#178a7e" : "#0f6b62"}
                  strokeWidth="2"
                >
                  <animate
                    attributeName="r"
                    values="26;30;26"
                    dur={`${3 + i * 0.4}s`}
                    repeatCount="indefinite"
                  />
                </circle>
                <text
                  x={x as number}
                  y={(y as number) + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fill={i === 2 ? "#efe8dc" : "#0b2431"}
                  fontFamily="Outfit, sans-serif"
                  fontWeight="600"
                >
                  {label as string}
                </text>
              </g>
            ))}
          </svg>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            New accounts open into a retail project with product, consumer, date, promotion,
            store, sales, and inventory masters — plus suggested joins ready to confirm.
          </p>
        </div>
      </section>
    </main>
  );
}
