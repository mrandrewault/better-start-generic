import { buildFeed } from "../../../lib/feed-builder.js";
import { readShelfCached } from "../../../lib/pantry.js";

// THE PERSONAL FEED
// Used for custom editions ("Make it yours"), for more stories while
// scrolling, and for readers who have already seen the shared edition.
//
// Build 34: it now cooks from the pantry first. Every story there has already
// passed the AI story check, so custom readers get the same safety as
// everyone else, and it is fast because nothing waits on live feeds.
// The reader's "seen it" list travels with the request, so the pantry only
// serves stories this reader has not seen yet. If the reader has somehow
// seen nearly the whole pantry, it falls back to the old live build.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PANTRY_MINIMUM = 60;   // the pantry needs at least this many stories
const ENOUGH_FRESH = 25;     // fewer unseen stories than this: build live instead

async function personalFeed(params) {
  let shelf = [];
  try { shelf = await readShelfCached(); } catch { shelf = []; }
  if (shelf.length >= PANTRY_MINIMUM) {
    try {
      const edition = await buildFeed(params, {pantryStories: shelf});
      if ((edition?.gallery || []).length >= ENOUGH_FRESH) return {...edition, feedSource: "pantry"};
    } catch {}
  }
  const live = await buildFeed(params);
  return {...live, feedSource: "live"};
}

const respond = async params => Response.json(await personalFeed(params), {headers: {"Cache-Control": "no-store"}});

export async function GET(request) {
  return respond(new URL(request.url).searchParams);
}

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const params = new URLSearchParams();
  Object.entries(body || {}).forEach(([key, value]) => params.set(key, Array.isArray(value) ? value.join(",") : String(value ?? "")));
  return respond(params);
}

