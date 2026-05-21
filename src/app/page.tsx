"use client";

import { useMemo, useState } from "react";
import SpotlightCard from "@/components/spotlight-card";
import type { MovieDetails, WishlistMovie } from "@/lib/douban";

type WishlistResponse = {
  userId: string;
  movies: WishlistMovie[];
  message?: string;
};

type MovieResponse = MovieDetails & {
  message?: string;
};

function getSafeImageUrl(url: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function getRandomMovie(movies: WishlistMovie[], currentUrl: string | null) {
  if (movies.length <= 1) return movies[0] ?? null;
  const candidates = movies.filter((movie) => movie.detailUrl !== currentUrl);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? movies[0];
}

export default function Home() {
  const [userId, setUserId] = useState("");
  const [movies, setMovies] = useState<WishlistMovie[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMovie, setLoadingMovie] = useState(false);
  const [error, setError] = useState("");
  const [currentMovie, setCurrentMovie] = useState<MovieDetails | null>(null);

  const canStart = movies.length > 0 && !loadingMovie;

  const statusText = useMemo(() => {
    if (loadingList) return "正在读取豆瓣想看列表...";
    if (loadingMovie) return "正在随机抽取电影并加载详情...";
    if (movies.length > 0) return `已加载 ${movies.length} 部想看电影`;
    return "输入豆瓣 ID 后点击加载列表";
  }, [loadingList, loadingMovie, movies.length]);

  const loadWishlist = async () => {
    if (!userId.trim()) {
      setError("请输入豆瓣 ID");
      return;
    }

    setLoadingList(true);
    setError("");
    setCurrentMovie(null);

    try {
      const response = await fetch(`/api/wishlist?userId=${encodeURIComponent(userId.trim())}`);
      const data = (await response.json()) as WishlistResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "加载想看列表失败");
      }

      setMovies(data.movies);

      if (data.movies.length === 0) {
        setError("未找到公开的想看电影，或该用户想看列表不可访问");
      }
    } catch (requestError) {
      setMovies([]);
      setError(requestError instanceof Error ? requestError.message : "加载失败");
    } finally {
      setLoadingList(false);
    }
  };

  const startRandom = async () => {
    const picked = getRandomMovie(movies, currentMovie?.detailUrl ?? null);
    if (!picked) {
      setError("暂无可抽取的电影");
      return;
    }

    setLoadingMovie(true);
    setError("");

    try {
      const response = await fetch(
        `/api/movie?detailUrl=${encodeURIComponent(picked.detailUrl)}`,
      );
      const data = (await response.json()) as MovieResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "加载电影详情失败");
      }

      setCurrentMovie({
        ...data,
        poster: data.poster || picked.poster,
        intro: data.intro || picked.intro,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "抽取失败");
    } finally {
      setLoadingMovie(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050506] text-[#EDEDEF]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0a0a0f_0%,#050506_50%,#020203_100%)]" />
      <div className="noise-layer pointer-events-none absolute inset-0" />
      <div className="grid-layer pointer-events-none absolute inset-0" />

      <div className="blob blob-primary" />
      <div className="blob blob-secondary" />
      <div className="blob blob-tertiary" />
      <div className="blob blob-bottom" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-16 md:px-8 md:py-24 lg:py-32">
        <section className="mx-auto w-full max-w-4xl">
          <p className="mb-4 font-mono text-xs tracking-widest text-white/60">
            DOUBAN RANDOM HIGHLIGHTS
          </p>

          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.03em] text-transparent md:text-6xl lg:text-7xl bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text">
            随机抽取你的
            <span className="ml-2 inline-block animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-[#5E6AD2] via-indigo-400 to-[#5E6AD2] bg-clip-text text-transparent">
              豆瓣想看电影
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#8A8F98] md:text-lg">
            输入豆瓣 ID，读取你的想看列表，点击开始即可随机展示一部电影，包含海报、简介、评分、评分人数、热评和详情链接。
          </p>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.35fr]">
          <SpotlightCard>
            <div className="space-y-6">
              <div>
                <label htmlFor="userId" className="mb-2 block text-sm text-white/80">
                  豆瓣 ID
                </label>
                <input
                  id="userId"
                  type="text"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  placeholder="例如：manlok666"
                  className="h-11 w-full rounded-lg border border-white/10 bg-[#0F0F12] px-4 text-sm text-[#EDEDEF] outline-none transition-all duration-200 focus:border-[#5E6AD2] focus:ring-2 focus:ring-[#5E6AD2]/50 focus:ring-offset-2 focus:ring-offset-[#050506]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={loadWishlist}
                  disabled={loadingList || loadingMovie}
                  className="h-11 rounded-lg bg-[#5E6AD2] px-4 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(94,106,210,0.5),0_4px_12px_rgba(94,106,210,0.3),inset_0_1px_0_0_rgba(255,255,255,0.2)] transition-all duration-200 ease-out hover:bg-[#6872D9] hover:shadow-[0_0_0_1px_rgba(94,106,210,0.6),0_8px_24px_rgba(94,106,210,0.4),inset_0_1px_0_0_rgba(255,255,255,0.24)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingList ? "加载中..." : "加载列表"}
                </button>

                <button
                  type="button"
                  onClick={startRandom}
                  disabled={!canStart}
                  className="h-11 rounded-lg bg-white/[0.05] px-4 text-sm font-medium text-[#EDEDEF] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all duration-200 ease-out hover:bg-white/[0.08] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_30px_rgba(0,0,0,0.5)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingMovie ? "抽取中..." : "开始随机"}
                </button>
              </div>

              <p className="text-sm text-[#8A8F98]" aria-live="polite">
                {statusText}
              </p>

              {error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            {!currentMovie ? (
              <div className="flex min-h-[360px] items-center justify-center text-center text-[#8A8F98]">
                点击「开始随机」后将在这里显示电影详情。
              </div>
            ) : (
              <article className="grid gap-6 sm:grid-cols-[180px_1fr]">
                <div>
                  {getSafeImageUrl(currentMovie.poster) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getSafeImageUrl(currentMovie.poster)}
                      alt={`${currentMovie.title} 海报`}
                      className="h-[260px] w-full rounded-xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-[260px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-sm text-[#8A8F98]">
                      暂无海报
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold tracking-tight text-[#EDEDEF] md:text-3xl">
                    {currentMovie.title}
                  </h2>

                  <div className="flex flex-wrap gap-3 text-sm text-[#EDEDEF]">
                    <span className="rounded-full border border-[#5E6AD2]/30 bg-[#5E6AD2]/15 px-3 py-1">
                      豆瓣评分：{currentMovie.rating}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                      评分人数：{currentMovie.ratingCount}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-[#8A8F98]">{currentMovie.intro || "暂无简介"}</p>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="mb-2 text-xs font-mono tracking-widest text-white/60">热评</p>
                    <p className="text-sm leading-relaxed text-[#EDEDEF]">{currentMovie.hotReview}</p>
                  </div>

                  <a
                    href={currentMovie.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-white/[0.05] px-4 py-2 text-sm text-[#EDEDEF] transition-all duration-200 hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/50 focus:ring-offset-2 focus:ring-offset-[#050506]"
                  >
                    查看豆瓣详情 →
                  </a>
                </div>
              </article>
            )}
          </SpotlightCard>
        </section>
      </main>
    </div>
  );
}
