import { NextRequest } from "next/server";

function isTrustedPosterHost(hostname: string) {
  return /(^|\.)doubanio\.com$/i.test(hostname) || /(^|\.)pixhost\.to$/i.test(hostname);
}

function isAllowedImageUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    // Restrict to known poster hosts to reduce proxy abuse risk.
    return isTrustedPosterHost(url.hostname);
  } catch {
    return false;
  }
}

function getRefererForImageHost(raw: string) {
  try {
    const url = new URL(raw);
    if (/(^|\.)doubanio\.com$/i.test(url.hostname)) {
      return "https://movie.douban.com/";
    }
    if (/(^|\.)pixhost\.to$/i.test(url.hostname)) {
      return "https://doubaninfo.com/";
    }
  } catch {
    // no-op
  }
  return "https://movie.douban.com/";
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!rawUrl) {
    return new Response("missing url", { status: 400 });
  }
  if (!isAllowedImageUrl(rawUrl)) {
    return new Response("invalid image url", { status: 400 });
  }

  const upstream = await fetch(rawUrl, {
    headers: {
      Referer: getRefererForImageHost(rawUrl),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    cache: "force-cache",
  });

  if (!upstream.ok) {
    return new Response("image fetch failed", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

