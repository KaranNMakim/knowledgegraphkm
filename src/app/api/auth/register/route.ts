import { NextResponse } from "next/server";
import { publicUser, registerPersonal } from "@/lib/auth";
import { ensureDemoProject } from "@/lib/seed";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    if (!email || !name || password.length < 6) {
      return NextResponse.json(
        { error: "Name, email, and password (6+ chars) required" },
        { status: 400 }
      );
    }
    const user = await registerPersonal({ email, name, password });
    const demoId = ensureDemoProject(user.id);
    return NextResponse.json({ user: publicUser(user), demoProjectId: demoId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Registration failed" },
      { status: 400 }
    );
  }
}
