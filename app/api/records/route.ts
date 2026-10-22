import { NextRequest, NextResponse } from "next/server";

const sheetUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL;

export async function GET() {
  if (!sheetUrl) return NextResponse.json([]);
  try {
    const response = await fetch(sheetUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("sheet request failed");
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body?.name || !/^\d+:\d{2}$/.test(body?.finishTime ?? "")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!sheetUrl) return NextResponse.json({ ok: true, localOnly: true });
  try {
    const response = await fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ name: String(body.name).slice(0, 30), finishTime: body.finishTime }),
      cache: "no-store",
    });
    return NextResponse.json({ ok: response.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
