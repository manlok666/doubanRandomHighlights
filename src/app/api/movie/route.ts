import { NextRequest, NextResponse } from "next/server";
import { fetchMovieDetailsByUrl } from "@/lib/douban";

export async function GET(request: NextRequest) {
  const detailUrl = request.nextUrl.searchParams.get("detailUrl")?.trim() ?? "";

  if (!detailUrl) {
    return NextResponse.json({ message: "缺少 detailUrl 参数" }, { status: 400 });
  }

  try {
    const result = await fetchMovieDetailsByUrl(detailUrl);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取电影详情失败";
    return NextResponse.json({ message }, { status: 500 });
  }
}
