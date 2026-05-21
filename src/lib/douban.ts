import * as cheerio from "cheerio";

const DOUBAN_HOST = "https://movie.douban.com";
const PAGE_SIZE = 15;

export type WishlistMovie = {
  title: string;
  detailUrl: string;
  poster: string;
  intro: string;
};

export type MovieDetails = {
  title: string;
  detailUrl: string;
  poster: string;
  intro: string;
  rating: string;
  ratingCount: string;
  hotReview: string;
};

function buildHeaders(referer?: string): HeadersInit {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Referer: referer ?? DOUBAN_HOST,
  };
}

async function fetchHtml(url: string, referer?: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(referer),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`豆瓣请求失败（${response.status}）`);
  }

  return response.text();
}

function toAbsoluteUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${DOUBAN_HOST}${url}`;
}

function cleanText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function parseWishlistPage(html: string): WishlistMovie[] {
  const $ = cheerio.load(html);
  const movies: WishlistMovie[] = [];

  $(".item").each((_, element) => {
    const title = cleanText(
      $(element).find("li.title a, em[property='v:itemreviewed']").first().text(),
    );

    const detailUrl = toAbsoluteUrl(
      $(element).find("li.title a, .pic a").first().attr("href"),
    );

    const poster =
      $(element).find(".pic img").first().attr("src")?.trim() ?? "";

    const intro = cleanText($(element).find("li.intro").first().text());

    if (!title || !detailUrl) return;

    movies.push({
      title,
      detailUrl,
      poster,
      intro,
    });
  });

  return movies;
}

function parseMovieDetails(html: string, fallbackUrl: string): MovieDetails {
  const $ = cheerio.load(html);

  const title = cleanText(
    $("span[property='v:itemreviewed']").first().text() || $("title").first().text(),
  );

  const poster =
    $("#mainpic img").first().attr("src")?.trim() ||
    $("meta[property='og:image']").attr("content")?.trim() ||
    "";

  const intro = cleanText(
    $("span[property='v:summary']").first().text() ||
      $(".related-info .indent").first().text(),
  );

  const rating =
    cleanText($("strong[property='v:average']").first().text()) || "暂无评分";

  const ratingCount =
    cleanText($("span[property='v:votes']").first().text()) || "0";

  const hotCommentNode = $(".hot-comments .comment-item").first();
  const hotCommentText = cleanText(hotCommentNode.find(".short").first().text());
  const hotCommentAuthor = cleanText(
    hotCommentNode.find(".comment-info a").first().text(),
  );

  const hotReview = hotCommentText
    ? `${hotCommentText}${hotCommentAuthor ? ` —— ${hotCommentAuthor}` : ""}`
    : "暂无热评";

  return {
    title,
    detailUrl: fallbackUrl,
    poster,
    intro,
    rating,
    ratingCount,
    hotReview,
  };
}

function normalizeUserId(input: string) {
  return input.trim().replace(/^@+/, "");
}

export async function fetchWishlistByUserId(userIdInput: string) {
  const userId = normalizeUserId(userIdInput);
  if (!userId) {
    throw new Error("请输入有效的豆瓣 ID");
  }

  const allMovies: WishlistMovie[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < 80; page += 1) {
    const start = page * PAGE_SIZE;
    const url = `${DOUBAN_HOST}/people/${encodeURIComponent(userId)}/wish?start=${start}&sort=time&rating=all&filter=all&mode=list`;
    const html = await fetchHtml(url, `${DOUBAN_HOST}/`);
    const movies = parseWishlistPage(html);

    if (movies.length === 0) {
      break;
    }

    for (const movie of movies) {
      if (seen.has(movie.detailUrl)) continue;
      seen.add(movie.detailUrl);
      allMovies.push(movie);
    }

    if (movies.length < PAGE_SIZE) {
      break;
    }
  }

  return {
    userId,
    movies: allMovies,
  };
}

export async function fetchMovieDetailsByUrl(inputUrl: string) {
  const detailUrl = toAbsoluteUrl(inputUrl.trim());
  if (!detailUrl.includes("movie.douban.com/subject/")) {
    throw new Error("无效的电影详情链接");
  }

  const html = await fetchHtml(detailUrl, `${DOUBAN_HOST}/`);
  return parseMovieDetails(html, detailUrl);
}
