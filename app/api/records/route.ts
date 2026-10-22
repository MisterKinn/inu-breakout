import { NextRequest, NextResponse } from "next/server";

const sheetUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL;

export async function GET() {
  if (!sheetUrl) return NextResponse.json({ error: "Google Sheets 연결이 설정되지 않았습니다." }, { status: 503 });
  try {
    const response = await fetch(sheetUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("sheet request failed");
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ error: "Google Sheets 기록을 불러오지 못했습니다." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body?.name || !/^\d+:\d{2}$/.test(body?.finishTime ?? "")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!sheetUrl) return NextResponse.json({ ok: false, error: "Google Sheets 연결이 설정되지 않았습니다." }, { status: 503 });
  try {
    const response = await fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ name: String(body.name).slice(0, 30), finishTime: body.finishTime }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ ok: false, error: "Google Sheets 저장이 거부되었습니다." }, { status: 502 });
    const result = await response.json();
    if (!result?.ok) return NextResponse.json({ ok: false, error: "Google Sheets 저장 응답이 올바르지 않습니다." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
