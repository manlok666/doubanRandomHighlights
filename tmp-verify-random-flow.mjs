import { writeFile } from "node:fs/promises";

const result = {
  wishlistStatus: 0,
  wishlistBody: "",
  randomRuns: [],
  detailStatus: 0,
  detailTitle: "",
  error: "",
};

try {
  const wishlistRes = await fetch("http://localhost:3000/api/wishlist?userId=183054495", {
    signal: AbortSignal.timeout(30000),
  });
  result.wishlistStatus = wishlistRes.status;
  result.wishlistBody = await wishlistRes.text();

  for (let i = 0; i < 5; i += 1) {
    const movieRes = await fetch("http://localhost:3000/api/movie?userId=183054495", {
      signal: AbortSignal.timeout(60000),
    });
    const movieData = await movieRes.json();

    const run = {
      status: movieRes.status,
      title: movieData.title ?? "",
      subjectId: movieData.subjectId ?? "",
      randomPage: movieData.randomPage ?? 0,
      totalPages: movieData.totalPages ?? 0,
      imageStatus: 0,
      imageType: "",
      message: movieData.message ?? "",
    };

    if (movieData.poster) {
      const imageUrl = `http://localhost:3000/api/image?url=${encodeURIComponent(movieData.poster)}`;
      const imageRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
      run.imageStatus = imageRes.status;
      run.imageType = imageRes.headers.get("content-type") ?? "";
    }

    result.randomRuns.push(run);
  }

  const detailRes = await fetch("http://localhost:3000/api/movie?detailUrl=1292052", {
    signal: AbortSignal.timeout(60000),
  });
  result.detailStatus = detailRes.status;
  const detailData = await detailRes.json();
  result.detailTitle = detailData.title ?? "";
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
}

await writeFile("tmp-verify-random-flow-result.json", JSON.stringify(result, null, 2), "utf8");

