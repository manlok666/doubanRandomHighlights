import { NextRequest } from "next/server";
import {
  fetchRandomMovieDetailsByUserId,
  type RandomPickProgress,
} from "@/lib/douban";

const encoder = new TextEncoder();

function toSseChunk(event: string, payload: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";

  if (!userId) {
    return new Response(JSON.stringify({ message: "缺少 userId 参数" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emitProgress = (progress: RandomPickProgress) => {
        controller.enqueue(toSseChunk("progress", progress));
      };

      controller.enqueue(
        toSseChunk("progress", {
          progress: 0,
          stage: "已连接",
          detail: "准备开始随机抽取",
        }),
      );

      void (async () => {
        try {
          const result = await fetchRandomMovieDetailsByUserId(userId, emitProgress);
          controller.enqueue(toSseChunk("result", result));
        } catch (error) {
          const message = error instanceof Error ? error.message : "随机抽取失败";
          controller.enqueue(toSseChunk("failure", { message }));
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
