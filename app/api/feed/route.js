import { feedResponse } from "../../../lib/feed-builder.js";

// Live, per-reader assembly. Used for personalized readers, for "more" while
// scrolling, and as the fallback when the shared edition is not enough.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  return feedResponse(new URL(request.url).searchParams);
}

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const params = new URLSearchParams();
  Object.entries(body || {}).forEach(([key, value]) => params.set(key, Array.isArray(value) ? value.join(",") : String(value ?? "")));
  return feedResponse(params);
}
