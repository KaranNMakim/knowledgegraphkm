import { NextResponse } from "next/server";
import { loginOrRegisterSso, publicUser } from "@/lib/auth";
import { ensureDemoProject } from "@/lib/seed";
import { v4 as uuid } from "uuid";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const provider =
      body.provider === "sso_microsoft" ? "sso_microsoft" : "sso_google";
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim() || email.split("@")[0];
    if (!email) {
      return NextResponse.json({ error: "Email required for SSO demo" }, { status: 400 });
    }

    // Demo SSO: accepts identity payload as if returned by IdP callback.
    const user = await loginOrRegisterSso({
      provider,
      email,
      name,
      subject: String(body.subject || `${provider}:${email}`),
    });

    const hasProjects = ensureDemoProject(user.id);
    return NextResponse.json({
      user: publicUser(user),
      demoProjectId: hasProjects,
      note: "SSO is simulated for local demo. Wire real OIDC client credentials in production.",
      requestId: uuid(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "SSO failed" },
      { status: 400 }
    );
  }
}
