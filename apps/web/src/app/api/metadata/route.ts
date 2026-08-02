import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"\;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
  const res = await fetch(`${API_URL}/api/metadata?url=${encodeURIComponent(url)}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
