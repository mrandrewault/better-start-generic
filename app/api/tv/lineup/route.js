import { videoShelf } from "../../../../lib/video-pantry.js";
import { TV_CHANNELS, TV_CHANNEL_NAMES } from "../../../../lib/video-check.js";

// The TV player asks here for a channel's lineup.
// /api/tv/lineup?channel=animals   (or no channel for a mix of everything)
// Cached for 10 minutes; the player shuffles and skips what you have seen.
export const revalidate = 600;
export const dynamic = "force-dynamic";

export async function GET(request) {
  const channel = new URL(request.url).searchParams.get("channel");
  try {
    const videos = await videoShelf({channel: TV_CHANNELS.includes(channel) ? channel : null, limit: 250});
    return Response.json({channel: channel || "all", channels: TV_CHANNELS.map(id => ({id, name: TV_CHANNEL_NAMES[id]})), videos},
      {headers: {"cache-control": "public, s-maxage=600, stale-while-revalidate=3600"}});
  } catch (error) {
    return Response.json({error: String(error?.message || error), videos: []}, {status: 500});
  }
}
