import { writeFile } from "node:fs/promises";

const url = "http://localhost:3000/api/wishlist?userId=183054495";

const result = {
  ok: false,
  status: null,
  movies: -1,
  firstTitle: "",
  firstUrl: "",
  message: "",
  error: "",
};

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  result.status = response.status;
  const text = await response.text();
  const data = JSON.parse(text);

  result.ok = true;
  result.movies = Array.isArray(data.movies) ? data.movies.length : -1;
  result.firstTitle = data.movies?.[0]?.title ?? "";
  result.firstUrl = data.movies?.[0]?.detailUrl ?? "";
  result.message = data.message ?? "";
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
}

await writeFile("tmp-check-wishlist-result.json", JSON.stringify(result, null, 2), "utf8");

