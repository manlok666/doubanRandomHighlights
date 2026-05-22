import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
	{ message: "该接口已下线，请使用 /api/movie?userId=xxx 进行随机抽取" },
	{ status: 410 },
  );
}

