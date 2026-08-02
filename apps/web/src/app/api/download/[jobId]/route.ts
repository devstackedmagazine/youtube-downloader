import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const res = await fetch(`${API_URL}/api/download/${params.jobId}/status`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
