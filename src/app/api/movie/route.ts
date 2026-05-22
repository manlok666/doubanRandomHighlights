import { NextRequest, NextResponse } from "next/server";
import { fetchMovieDetailsByUrl, fetchRandomMovieDetailsByUserId } from "@/lib/douban";

export async function GET(request: NextRequest) {
  const detailUrl = request.nextUrl.searchParams.get("detailUrl")?.trim() ?? "";
  const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";

  if (!detailUrl && !userId) {
    return NextResponse.json({ message: "缺少 detailUrl 或 userId 参数" }, { status: 400 });
  }

  try {
    const result = detailUrl
      ? await fetchMovieDetailsByUrl(detailUrl)
      : await fetchRandomMovieDetailsByUserId(userId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取电影详情失败";
    return NextResponse.json({ message }, { status: 500 });
  }
}
