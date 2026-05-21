import { NextRequest, NextResponse } from "next/server";
import { fetchWishlistByUserId } from "@/lib/douban";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";

  if (!userId) {
    return NextResponse.json({ message: "缺少 userId 参数" }, { status: 400 });
  }

  try {
    const result = await fetchWishlistByUserId(userId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取想看列表失败";
    return NextResponse.json({ message }, { status: 500 });
  }
}
