import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { v4 as uuid } from "uuid";
import { getDb, nowIso } from "./db";
import type { AuthProvider, User } from "./types";

const COOKIE = "graphloom_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "graphloom-dev-secret-change-me"
);

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret);

  const db = getDb();
  const id = uuid();
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).run(id, userId, expires, nowIso());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
  });

  return token;
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.sub;
    if (!userId) return null;
    const db = getDb();
    const user = db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(userId) as User | undefined;
    return user ?? null;
  } catch {
    return null;
  }
}

export function findUserByEmail(email: string) {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`)
    .get(email) as User | undefined;
}

export async function registerPersonal(input: {
  email: string;
  name: string;
  password: string;
}) {
  const existing = findUserByEmail(input.email);
  if (existing) throw new Error("Email already registered");

  const db = getDb();
  const id = uuid();
  const password_hash = await hashPassword(input.password);
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, provider, provider_subject, created_at)
     VALUES (?, ?, ?, ?, 'personal', NULL, ?)`
  ).run(id, input.email.toLowerCase(), input.name, password_hash, nowIso());

  await createSession(id);
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as User;
}

export async function loginPersonal(email: string, password: string) {
  const user = findUserByEmail(email);
  if (!user || !user.password_hash) throw new Error("Invalid email or password");
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw new Error("Invalid email or password");
  await createSession(user.id);
  return user;
}

export async function loginOrRegisterSso(input: {
  provider: Extract<AuthProvider, "sso_google" | "sso_microsoft">;
  email: string;
  name: string;
  subject: string;
}) {
  const db = getDb();
  let user = db
    .prepare(
      `SELECT * FROM users WHERE provider = ? AND provider_subject = ?`
    )
    .get(input.provider, input.subject) as User | undefined;

  if (!user) {
    const byEmail = findUserByEmail(input.email);
    if (byEmail) {
      db.prepare(
        `UPDATE users SET provider = ?, provider_subject = ? WHERE id = ?`
      ).run(input.provider, input.subject, byEmail.id);
      user = byEmail;
    } else {
      const id = uuid();
      db.prepare(
        `INSERT INTO users (id, email, name, password_hash, provider, provider_subject, created_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?)`
      ).run(
        id,
        input.email.toLowerCase(),
        input.name,
        input.provider,
        input.subject,
        nowIso()
      );
      user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as User;
    }
  }

  await createSession(user.id);
  return user;
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    created_at: user.created_at,
  };
}
