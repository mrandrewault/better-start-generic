import { buildFeed, ACTIVE_POLICY_VERSION, canonicalUrl, normalizeTitle, isDisallowed } from "../../../lib/feed-builder.js";

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
export const maxDuration = 60;

const DESKS = 3;
const MIN_GALLERY = 120;
const MIN_VISUAL_SHARE = 0.6;
const SUMMARY_LIMIT = 360;

const trim = item => item && typeof item === "object"
  ? {...item, summary: typeof item.summary === "string" && item.summary.length > SUMMARY_LIMIT ? `${item.summary.slice(0, SUMMARY_LIMIT).replace(/\s+\S*$/, "")}…` : item.summary}
  : item;

export async function GET() {
  const slot = Math.floor(Date.now() / (revalidate * 1000));
  const desks = await Promise.all(Array.from({length: DESKS}, (_, desk) =>
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
  edition.quality = {gallery: edition.gallery.length, visualShare: Math.round(visualShare * 100) / 100, desks: working.length, policyVersion: ACTIVE_POLICY_VERSION};

  // During a deploy, never block the release over a thin first build. The
  // page checks the size itself and falls back to the live method when needed.
  if (!deploying && (edition.gallery.length < MIN_GALLERY || visualShare < MIN_VISUAL_SHARE)) {
    throw new Error(`Shared edition too thin: ${JSON.stringify(edition.quality)}. Keeping the last good edition.`);
  }
  return Response.json(edition);
}
