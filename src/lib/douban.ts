import * as cheerio from "cheerio";
import type { Browser } from "puppeteer-core";

const DOUBAN_HOST = "https://movie.douban.com";
const MAX_WISHLIST_PAGES = 200;
const WISHLIST_PAGE_SIZE = 30;
const RANDOM_WISHLIST_PAGE_MAX_ATTEMPTS = readEnvInt("DOUBAN_RANDOM_PAGE_RETRY_MAX", 4, 1, 10);
const MOVIE_DETAIL_MAX_RETRIES = readEnvInt("DOUBAN_RETRY_MAX", 3, 1, 8);
const MOVIE_DETAIL_RETRY_BASE_DELAY_MS = readEnvInt("DOUBAN_RETRY_BASE_DELAY_MS", 800, 100, 10000);

type BrowserLike = Browser;
let browser: BrowserLike | null = null;

export type MovieDetails = {
  title: string;
  detailUrl: string;
  poster: string;
  intro: string;
  rating: string;
  ratingCount: string;
};

export type RandomPickDetails = MovieDetails & {
  userId: string;
  subjectId: string;
  randomPage: number;
  totalPages: number;
};

export type RandomPickProgress = {
  progress: number;
  stage: string;
  detail: string;
  randomPage?: number;
  totalPages?: number;
  attempt?: number;
  maxAttempts?: number;
};

function readEnvInt(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number) {
  const jitter = Math.floor(Math.random() * 300);
  return MOVIE_DETAIL_RETRY_BASE_DELAY_MS * 2 ** attempt + jitter;
}

async function getBrowser() {
  if (!browser) {
    const commonArgs = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
    const isServerless = process.env.VERCEL === "1" || Boolean(process.env.AWS_REGION);

    if (isServerless) {
      const chromium = (await import("@sparticuz/chromium")).default;
      const puppeteerCore = (await import("puppeteer-core")).default;

      browser = await puppeteerCore.launch({
        headless: true,
        executablePath: await chromium.executablePath(),
        args: [...chromium.args, ...commonArgs],
      });
    } else {
      const puppeteer = (await import("puppeteer")).default;
      browser = await puppeteer.launch({
        headless: true,
        args: commonArgs,
      });
    }
  }
  return browser;
}

function buildHeaders(referer?: string): HeadersInit {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/jpeg,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    Referer: referer ?? DOUBAN_HOST,
  };
}

function cleanText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http")) return url;
  return `${DOUBAN_HOST}${url}`;
}

function normalizeUserId(input: string) {
  const userId = input.trim().replace(/^@+/, "");
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) return "";
  return userId;
}

function extractSubjectId(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const byPath = trimmed.match(/\/subject\/(\d+)(?:\/|$)/);
  if (byPath?.[1]) return byPath[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return "";
}

function hasAntiBotChallenge(html: string) {
  return (
    html.includes("<form name=\"sec\"") ||
    html.includes("id=\"tok\"") ||
    html.includes("sha512(") ||
    html.includes("载入中 ...")
  );
}

function isAntiBotError(error: unknown) {
  return error instanceof Error && error.message.includes("反爬验证");
}

function assertDoubanPageUsable(html: string, context: "movie" | "wishlist") {
  if (hasAntiBotChallenge(html)) {
    throw new Error("豆瓣触发了反爬验证，请稍后重试");
  }
  const $ = cheerio.load(html);
  const title = cleanText($("title").first().text());
  if (title.includes("页面不存在") || title.includes("404")) {
    throw new Error(context === "movie" ? "电影不存在或已下线" : "该用户不存在或列表不可访问");
  }
}

async function fetchDoubanHtml(pathnameAndQuery: string, refererPath = "/") {
  const url = new URL(pathnameAndQuery, DOUBAN_HOST);
  const isWishlistPath = pathnameAndQuery.includes("/people/");

  if (!isWishlistPath) {
    try {
      const browserInstance = await getBrowser();
      const page = await browserInstance.newPage();
      try {
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        );
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setExtraHTTPHeaders({
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/jpeg,*/*;q=0.8",
        });
        await page.goto(url.toString(), { waitUntil: "networkidle2", timeout: 30000 });
        await sleep(2500);
        const html = await page.content();
        assertDoubanPageUsable(html, pathnameAndQuery.includes("/subject/") ? "movie" : "wishlist");
        return html;
      } finally {
        await page.close();
      }
    } catch (error) {
      if (isAntiBotError(error)) throw error;
    }
  }

  const referer = new URL(refererPath, DOUBAN_HOST).toString();
  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(referer),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`豆瓣请求失败（${response.status}）`);
  }
  const html = await response.text();
  assertDoubanPageUsable(html, pathnameAndQuery.includes("/subject/") ? "movie" : "wishlist");
  return html;
}

function extractTotalPages(html: string) {
  const $ = cheerio.load(html);
  const byAttr = Number.parseInt($(".paginator .thispage").first().attr("data-total-page") ?? "", 10);
  if (Number.isFinite(byAttr) && byAttr > 0) return byAttr;

  let maxPage = 1;
  $(".paginator a").each((_, element) => {
    const n = Number.parseInt(cleanText($(element).text()), 10);
    if (Number.isFinite(n) && n > maxPage) maxPage = n;
  });
  return maxPage;
}

function parseWishlistPageSubjectIds(html: string) {
  const $ = cheerio.load(html);
  const ids = new Set<string>();
  $(".list-view .item, .grid-view .item, .item").each((_, element) => {
    const href = $(element).find(".title a, li.title a, .pic a").first().attr("href")?.trim() ?? "";
    const id = extractSubjectId(href);
    if (id) ids.add(id);
  });
  return [...ids];
}

function randomInt(maxExclusive: number) {
  return Math.floor(Math.random() * maxExclusive);
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function pickRandomPage(totalPages: number, triedPages: Set<number>) {
  const candidates: number[] = [];
  for (let page = 1; page <= totalPages; page += 1) {
    if (!triedPages.has(page)) candidates.push(page);
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates[randomInt(candidates.length)] ?? null;
}

function parseMovieDetails(html: string, fallbackUrl: string): MovieDetails {
  const $ = cheerio.load(html);
  const hasMovieTitleNode = $("span[property='v:itemreviewed']").length > 0;
  const hasMovieInfoNode = $("#info").length > 0 || $("strong[property='v:average']").length > 0;
  if (!hasMovieTitleNode && !hasMovieInfoNode) {
    throw new Error("未能解析到电影详情，可能被反爬拦截或条目不可访问");
  }

  return {
    title: cleanText($("span[property='v:itemreviewed']").first().text() || $("title").first().text()),
    detailUrl: fallbackUrl,
    poster:
      $("#mainpic img").first().attr("src")?.trim() ||
      $("meta[property='og:image']").attr("content")?.trim() ||
      "",
    intro: cleanText($("span[property='v:summary']").first().text() || $(".related-info .indent").first().text()),
    rating: cleanText($("strong[property='v:average']").first().text()) || "暂无评分",
    ratingCount: cleanText($("span[property='v:votes']").first().text()) || "0",
  };
}

export async function fetchMovieDetailsByUrl(inputUrl: string) {
  const subjectId = extractSubjectId(inputUrl);
  if (!subjectId) throw new Error("无效的电影详情链接");

  const detailPath = `/subject/${subjectId}/`;
  const detailUrl = toAbsoluteUrl(detailPath);

  for (let attempt = 0; attempt < MOVIE_DETAIL_MAX_RETRIES; attempt += 1) {
    try {
      const html = await fetchDoubanHtml(detailPath);
      return parseMovieDetails(html, detailUrl);
    } catch (error) {
      if (!isAntiBotError(error) || attempt === MOVIE_DETAIL_MAX_RETRIES - 1) {
        throw error;
      }
      await sleep(getRetryDelay(attempt));
    }
  }

  throw new Error("获取电影详情失败");
}

export async function fetchRandomMovieDetailsByUserId(
  userIdInput: string,
  onProgress?: (progress: RandomPickProgress) => void,
): Promise<RandomPickDetails> {
  const userId = normalizeUserId(userIdInput);
  if (!userId) throw new Error("请输入有效的豆瓣 ID");

  const emitProgress = (progress: RandomPickProgress) => {
    onProgress?.({
      ...progress,
      progress: clampProgress(progress.progress),
    });
  };

  emitProgress({
    progress: 5,
    stage: "校验用户",
    detail: `正在校验豆瓣 ID：${userId}`,
  });

  const firstPath = `/people/${encodeURIComponent(userId)}/wish?start=0&sort=time&rating=all&filter=all&mode=list`;
  emitProgress({
    progress: 15,
    stage: "读取第一页",
    detail: "正在读取想看列表第一页，用于确认总页数",
    randomPage: 1,
  });
  const firstHtml = await fetchDoubanHtml(firstPath);
  const totalPages = Math.min(extractTotalPages(firstHtml), MAX_WISHLIST_PAGES);
  const firstPageIds = parseWishlistPageSubjectIds(firstHtml);

  emitProgress({
    progress: 28,
    stage: "分析列表",
    detail: `列表共 ${totalPages} 页，第一页找到 ${firstPageIds.length} 部候选电影`,
    randomPage: 1,
    totalPages,
  });

  if (firstPageIds.length === 0 && totalPages <= 1) {
    throw new Error("该用户暂无公开的想看电影");
  }

  let pickedIds = firstPageIds;
  let randomPage = 1;

  if (totalPages > 1) {
    const triedPages = new Set<number>();
    const maxAttempts = Math.min(totalPages, RANDOM_WISHLIST_PAGE_MAX_ATTEMPTS);

    pickedIds = [];
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const pageCandidate = pickRandomPage(totalPages, triedPages);
      if (pageCandidate === null) {
        break;
      }

      triedPages.add(pageCandidate);

       emitProgress({
        progress: 35 + (attempt / Math.max(1, maxAttempts)) * 25,
        stage: "随机页抽取",
        detail: `正在尝试第 ${pageCandidate}/${totalPages} 页（第 ${attempt + 1}/${maxAttempts} 次）`,
        randomPage: pageCandidate,
        totalPages,
        attempt: attempt + 1,
        maxAttempts,
      });

      if (pageCandidate === 1) {
        if (firstPageIds.length > 0) {
          pickedIds = firstPageIds;
          randomPage = 1;
          emitProgress({
            progress: 62,
            stage: "锁定候选页",
            detail: `已选中第 1/${totalPages} 页，其中有 ${pickedIds.length} 部候选电影`,
            randomPage,
            totalPages,
            attempt: attempt + 1,
            maxAttempts,
          });
          break;
        }
        continue;
      }

      const start = (pageCandidate - 1) * WISHLIST_PAGE_SIZE;
      const pagePath = `/people/${encodeURIComponent(userId)}/wish?start=${start}&sort=time&rating=all&filter=all&mode=list`;
      const pageHtml = await fetchDoubanHtml(pagePath, firstPath);
      const pageIds = parseWishlistPageSubjectIds(pageHtml);
      if (pageIds.length > 0) {
        pickedIds = pageIds;
        randomPage = pageCandidate;
        emitProgress({
          progress: 62,
          stage: "锁定候选页",
          detail: `已选中第 ${randomPage}/${totalPages} 页，其中有 ${pickedIds.length} 部候选电影`,
          randomPage,
          totalPages,
          attempt: attempt + 1,
          maxAttempts,
        });
        break;
      }

      emitProgress({
        progress: 35 + ((attempt + 1) / Math.max(1, maxAttempts)) * 25,
        stage: "随机页抽取",
        detail: `第 ${pageCandidate}/${totalPages} 页没有可用电影，继续尝试其他页`,
        randomPage: pageCandidate,
        totalPages,
        attempt: attempt + 1,
        maxAttempts,
      });
    }

    if (pickedIds.length === 0 && firstPageIds.length > 0) {
      pickedIds = firstPageIds;
      randomPage = 1;
      emitProgress({
        progress: 62,
        stage: "回退第一页",
        detail: `随机页未命中有效电影，回退到第一页并使用其中的 ${pickedIds.length} 部候选电影`,
        randomPage,
        totalPages,
      });
    }
  }

  if (pickedIds.length === 0) {
    throw new Error("该用户暂无公开的想看电影");
  }

  const subjectId = pickedIds[randomInt(pickedIds.length)];
  emitProgress({
    progress: 78,
    stage: "抽取电影",
    detail: `已从第 ${randomPage}/${totalPages} 页随机选中电影条目 ${subjectId}`,
    randomPage,
    totalPages,
  });

  emitProgress({
    progress: 88,
    stage: "抓取详情",
    detail: `正在获取电影 ${subjectId} 的详情信息`,
    randomPage,
    totalPages,
  });
  const detail = await fetchMovieDetailsByUrl(subjectId);

  emitProgress({
    progress: 100,
    stage: "完成",
    detail: `已完成随机抽取：${detail.title}`,
    randomPage,
    totalPages,
  });

  return {
    ...detail,
    userId,
    subjectId,
    randomPage,
    totalPages,
  };
}

