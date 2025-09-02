// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "wardrobe_settings";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const data = cookie ? safeParse(cookie) : {};
  return NextResponse.json(data ?? {}, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const value = JSON.stringify(body ?? {});
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return res;
}

function safeParse(str: string) {
  try { return JSON.parse(str); } catch { return {}; }
}
