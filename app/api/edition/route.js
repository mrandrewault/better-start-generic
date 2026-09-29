import { buildFeed, ACTIVE_POLICY_VERSION, canonicalUrl, normalizeTitle, isDisallowed } from "../../../lib/feed-builder.js";
import { readShelf } from "../../../lib/pantry.js";

// THE SHARED EDITION
// Every visitor without a custom profile gets this same finished edition.
// Vercel builds it in the background and serves the saved copy from its
// worldwide cache, so opening Meanwhile no longer waits on dozens of feeds.
//
// How freshness works: a saved copy is served for up to 30 minutes. The first
// visit after that still gets the saved copy instantly, and Vercel quietly
// builds the next one behind the scenes.
//
// Safety net: if a background build comes out too thin (sources down, too
// few pictures), it throws an error on purpose. Vercel then keeps serving
// the last good edition instead of replacing it with a weak one.
export const revalidate = 1800;
export const dynamic = "force-static";
export const maxDuration = 120;

// More desks = more of the 191 sources checked each time = a deeper edition.
const DESKS = 6;
// Today's filters let roughly 70 to 150 stories through per build. The floor
// sits well below that, so only a truly broken build gets thrown out.
const MIN_GALLERY = 45;
const MIN_VISUAL_SHARE = 0.6;
const SUMMARY_LIMIT = 360;
// The edition is built from the AI-approved pantry once it holds this many
// stories. Until then (or if the pantry cannot be reached) it uses live feeds.
const PANTRY_MINIMUM = 60;

const trim = item => item && typeof item === "object"
  ? {...item, summary: typeof item.summary === "string" && item.summary.length > SUMMARY_LIMIT ? `${item.summary.slice(0, SUMMARY_LIMIT).replace(/\s+\S*$/, "")}…` : item.summary}
  : item;

export async function GET() {
  const slot = Math.floor(Date.now() / (revalidate * 1000));
  let pantryShelf = [];
  try { pantryShelf = await readShelf(); } catch { pantryShelf = []; }
  const fromPantry = pantryShelf.length >= PANTRY_MINIMUM;
  // Pantry mode: two desks share the approved shelf, each composing its own
  // balanced magazine, so the merged edition runs deep. Live mode: six desks
  // of live feeds, exactly as before.
  const desks = fromPantry
    ? await Promise.all([0, 1].map(desk => buildFeed(new URLSearchParams({visit: `pantry-${slot}-desk-${desk}`}), {pantryStories: desk ? [...pantryShelf].reverse() : pantryShelf}).catch(() => null)))
    : await Promise.all(Array.from({length: DESKS}, (_, desk) =>
        buildFeed(new URLSearchParams({visit: `shared-${slot}-desk-${desk}`})).catch(() => null)
      ));
  const working = desks.filter(Boolean);
  const primary = working[0];
  const deploying = process.env.NEXT_PHASE === "phase-production-build";
  if (!primary) {
    if (deploying) return Response.json({policyVersion: ACTIVE_POLICY_VERSION, shared: true, gallery: [], quality: {gallery: 0}});
    throw new Error("Shared edition: every desk failed. Keeping the last good edition.");
  }

  // One registry across all desks and shelves, so a story can only appear once.
  const usedUrls = new Set(), usedTitles = new Set();
  const claim = items => (items || []).filter(item => {
    if (!item || isDisallowed(item)) return false;
    const url = canonicalUrl(item.url || ""), title = normalizeTitle(item.title || "");
    if (usedUrls.has(url) || (title && usedTitles.has(title))) return false;
    usedUrls.add(url); if (title) usedTitles.add(title); return true;
  }).map(trim);
  const shelf = (name, limit) => claim(working.flatMap(edition => edition?.[name] || [])).slice(0, limit);

  const tickerStories = claim(primary.tickerStories);
  const goodNews = claim([primary.goodNews])[0] || null;
  const favorites = claim(primary.favorites);
  const edition = {
    ...primary,
    shared: true,
    sharedSlot: slot,
    desks: working.length,
    tickerStories,
    ribbonFavorite: tickerStories[0] || null,
    goodNews,
    favorites,
    gallery: shelf("gallery", 300),
    important: shelf("important", 30),
    media: shelf("media", 90),
    serendipity: shelf("serendipity", 180),
    visualReserve: shelf("visualReserve", 72)
  };

  const visual = edition.gallery.filter(item => item.image || item.videoId).length;
  const visualShare = edition.gallery.length ? visual / edition.gallery.length : 0;
  edition.quality = {gallery: edition.gallery.length, visualShare: Math.round(visualShare * 100) / 100, desks: working.length, policyVersion: ACTIVE_POLICY_VERSION, source: fromPantry ? "pantry" : "live", shelf: pantryShelf.length};
  edition.source = fromPantry ? "pantry" : "live";

  // During a deploy, never block the release over a thin first build. The
  // page checks the size itself and falls back to the live method when needed.
  if (!deploying && (edition.gallery.length < MIN_GALLERY || visualShare < MIN_VISUAL_SHARE)) {
    throw new Error(`Shared edition too thin: ${JSON.stringify(edition.quality)}. Keeping the last good edition.`);
  }
  return Response.json(edition);
}
