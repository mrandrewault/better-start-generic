import { cardData } from "../../../../lib/social.js";
import { renderCard } from "../../../../lib/social-card.js";

// A Meanwhile social card as a picture, for one pantry story.
// /api/social/card?id=<story id>&size=feed (Instagram, Threads) or size=tall (TikTok)
// It only draws cards for AI-approved pantry stories.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const id = String(params.get("id") || "").slice(0, 40);
  const size = params.get("size") === "tall" ? "tall" : "feed";
  try {
    const card = id ? await cardData(id) : null;
    if (!card) return new Response("No card for that story.", {status: 404});
    const jpeg = await renderCard(card, size);
    return new Response(jpeg, {headers: {"content-type": "image/jpeg", "cache-control": "public, max-age=86400, s-maxage=86400"}});
  } catch (error) {
    return new Response(`Card failed: ${String(error?.message || error)}`, {status: 500});
  }
}
