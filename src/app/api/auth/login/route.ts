import { NextResponse } from "next/server";
import { loginPersonal, publicUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const user = await loginPersonal(email, password);
    return NextResponse.json({ user: publicUser(user) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Login failed" },
      { status: 401 }
    );
  }
}
