import { writeFile } from "node:fs/promises";

const decoder = new TextDecoder();
const result = {
  status: 0,
  progressCount: 0,
  stages: [],
  details: [],
  finalTitle: "",
  finalPage: 0,
  totalPages: 0,
  failureMessage: "",
  error: "",
};

function parseEventBlock(block) {
  const lines = block.split(/\r?\n/);
  let eventName = "message";
  const dataLines = [];

  for (const line of lines) {
	if (line.startsWith("event:")) eventName = line.slice(6).trim();
	if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }

  return { eventName, data: dataLines.join("\n") };
}

try {
  const response = await fetch("http://localhost:3000/api/movie/stream?userId=183054495", {
	signal: AbortSignal.timeout(120000),
	headers: { Accept: "text/event-stream" },
  });
  result.status = response.status;

  const reader = response.body?.getReader();
  if (!reader) throw new Error("stream body is missing");

  let buffer = "";
  let done = false;
  while (!done) {
	const chunk = await reader.read();
	done = chunk.done;
	buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done });

	const blocks = buffer.split(/\r?\n\r?\n/);
	buffer = blocks.pop() ?? "";

	for (const block of blocks) {
	  if (!block.trim()) continue;
	  const { eventName, data } = parseEventBlock(block);
	  if (!data) continue;
	  const payload = JSON.parse(data);

	  if (eventName === "progress") {
		result.progressCount += 1;
		result.stages.push(payload.stage ?? "");
		result.details.push(payload.detail ?? "");
	  } else if (eventName === "result") {
		result.finalTitle = payload.title ?? "";
		result.finalPage = payload.randomPage ?? 0;
		result.totalPages = payload.totalPages ?? 0;
	  } else if (eventName === "failure") {
		result.failureMessage = payload.message ?? "";
	  }
	}
  }
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
}

await writeFile("tmp-verify-random-stream-result.json", JSON.stringify(result, null, 2), "utf8");

