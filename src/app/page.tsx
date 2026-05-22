"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SpotlightCard from "@/components/spotlight-card";
import type { MovieDetails } from "@/lib/douban";

type MovieResponse = MovieDetails & {
  userId?: string;
  subjectId?: string;
  randomPage?: number;
  totalPages?: number;
  message?: string;
};

type ProgressState = {
  progress: number;
  stage: string;
  detail: string;
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

function getPosterProxyUrl(rawUrl: string) {
  const safe = getSafeImageUrl(rawUrl);
  if (!safe) return "";
  return `/api/image?url=${encodeURIComponent(safe)}`;
}

export default function Home() {
  const [userId, setUserId] = useState("");
  const [loadingMovie, setLoadingMovie] = useState(false);
  const [error, setError] = useState("");
  const [currentMovie, setCurrentMovie] = useState<MovieDetails | null>(null);
  const [randomMeta, setRandomMeta] = useState<{ randomPage: number; totalPages: number } | null>(
    null,
  );
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const statusText = useMemo(() => {
    if (loadingMovie && progressState) {
      return `${progressState.stage} · ${progressState.progress}%`;
    }
    if (loadingMovie) return "正在随机抽取电影并加载详情...";
    if (randomMeta) return `最近一次来自第 ${randomMeta.randomPage}/${randomMeta.totalPages} 页`;
    return "输入豆瓣 ID 后点击开始随机";
  }, [loadingMovie, progressState, randomMeta]);

  const startRandom = async () => {
    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
      setError("请输入豆瓣 ID");
      return;
    }

    if (loadingMovie) return;

    setLoadingMovie(true);
    setError("");
    setProgressState({
      progress: 0,
      stage: "准备开始",
      detail: "正在连接随机抽取进度流...",
    });

    eventSourceRef.current?.close();

    const source = new EventSource(`/api/movie/stream?userId=${encodeURIComponent(trimmedUserId)}`);
    eventSourceRef.current = source;
    let settled = false;

    source.addEventListener("progress", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as ProgressState;
      setProgressState(payload);
    });

    source.addEventListener("result", (event) => {
      settled = true;
      const data = JSON.parse((event as MessageEvent<string>).data) as MovieResponse;
      setCurrentMovie(data);
      if (typeof data.randomPage === "number" && typeof data.totalPages === "number") {
        setRandomMeta({ randomPage: data.randomPage, totalPages: data.totalPages });
      } else {
        setRandomMeta(null);
      }
      setProgressState({
        progress: 100,
        stage: "完成",
        detail: `已抽到：${data.title}`,
      });
      setLoadingMovie(false);
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    });

    source.addEventListener("failure", (event) => {
      settled = true;
      const data = JSON.parse((event as MessageEvent<string>).data) as { message?: string };
      setError(data.message ?? "抽取失败");
      setLoadingMovie(false);
      setProgressState(null);
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    });

    source.onerror = () => {
      if (settled) {
        return;
      }
      setError("进度连接中断，请重试");
      setLoadingMovie(false);
      setProgressState(null);
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    };
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

          <h1 className="bg-linear-to-b from-white via-white/95 to-white/70 bg-clip-text text-4xl font-semibold leading-tight tracking-[-0.03em] text-transparent md:text-6xl lg:text-7xl">
            随机抽取你的
            <span className="ml-2 inline-block animate-shimmer bg-size-[200%_100%] bg-linear-to-r from-[#5E6AD2] via-indigo-400 to-[#5E6AD2] bg-clip-text text-transparent">
              豆瓣想看电影
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#8A8F98] md:text-lg">
            输入豆瓣 ID 后点击开始随机，系统会先随机选择该用户想看列表中的一页，再从该页随机抽取一部电影并展示详情。
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

              <button
                type="button"
                onClick={startRandom}
                disabled={loadingMovie}
                className="h-11 w-full rounded-lg bg-[#5E6AD2] px-4 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(94,106,210,0.5),0_4px_12px_rgba(94,106,210,0.3),inset_0_1px_0_0_rgba(255,255,255,0.2)] transition-all duration-200 ease-out hover:bg-[#6872D9] hover:shadow-[0_0_0_1px_rgba(94,106,210,0.6),0_8px_24px_rgba(94,106,210,0.4),inset_0_1px_0_0_rgba(255,255,255,0.24)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMovie ? "抽取中..." : "开始随机"}
              </button>

              {progressState ? (
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/4 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-[#EDEDEF]">{progressState.stage}</span>
                    <span className="font-mono text-white/60">{progressState.progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-[#5E6AD2] via-indigo-400 to-cyan-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${progressState.progress}%` }}
                    />
                  </div>
                  <p className="text-sm leading-relaxed text-[#8A8F98]">{progressState.detail}</p>
                </div>
              ) : null}

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
              <div className="flex min-h-90 items-center justify-center text-center text-[#8A8F98]">
                点击开始随机后将在这里显示电影详情。
              </div>
            ) : (
              <article className="grid gap-6 sm:grid-cols-[180px_1fr]">
                <div>
                  {getPosterProxyUrl(currentMovie.poster) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getPosterProxyUrl(currentMovie.poster)}
                      alt={`${currentMovie.title} 海报`}
                      className="h-65 w-full rounded-xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-65 items-center justify-center rounded-xl border border-white/10 bg-white/3 text-sm text-[#8A8F98]">
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
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      评分人数：{currentMovie.ratingCount}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-[#8A8F98]">{currentMovie.intro || "暂无简介"}</p>


                  <a
                    href={currentMovie.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-[#EDEDEF] transition-all duration-200 hover:bg-white/8 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/50 focus:ring-offset-2 focus:ring-offset-[#050506]"
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
