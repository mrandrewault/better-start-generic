import fs from "fs";
import path from "path";
import { pantryDb } from "./pantry.js";
import { isDisallowed } from "./feed-builder.js";
import { checkVideos, TV_CHANNELS } from "./video-check.js";

// THE VIDEO PANTRY (Meanwhile TV)
// A background job, every hour:
//   1. Looks up any YouTube channels we only know by @handle (once each).
//   2. Reads every channel's free public feed of its latest 15 videos.
//   3. Word lists throw out obvious junk. Shorts are set aside.
//   4. The AI checks each new video once, picks its TV channel, and writes the
//      "Meanwhile, in Norway, ..." title card.
//   5. Approved videos go on the shelf for the TV player.
// The source list lives in data/tv-sources.json.

export const VIDEO_DAILY_BUDGET_USD = 1.5;
const MAX_NEW_PER_RUN = 300;
const MAX_LOOKUPS_PER_RUN = 80;
const SHELF_DAYS = 120;                    // good videos stay good for a long time
const UA = {"User-Agent": "Mozilla/5.0 (compatible; MeanwhileTV/1.0; +https://meanwhile.now)", "Accept-Language": "en-US,en;q=0.9"};

export const videoSources = () => JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "tv-sources.json"), "utf8"));

const decode = value => String(value || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const tag = (block, name) => decode(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "");
const attr = (block, name, attribute) => block.match(new RegExp(`<${name}[^>]*\\s${attribute}="([^"]*)"`, "i"))?.[1] || "";

async function fetchText(url, ms = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {headers: UA, signal: controller.signal, cache: "no-store"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timer); }
}

// @handle -> channel id, by reading the channel page once.
async function lookupHandle(handle) {
  const html = await fetchText(`https://www.youtube.com/${handle.startsWith("@") ? handle : `@${handle}`}`);
  const id = html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] || html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] || html.match(/"channelId":"(UC[\w-]{22})"/)?.[1];
  if (!id) throw new Error("channel not found");
  const title = decode(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || "");
  return {id, title};
}

async function readFeed(channelId) {
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  const channelName = tag(xml.split("<entry")[0], "title");
  return [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(match => {
    const block = match[0];
    const id = tag(block, "yt:videoId");
    const link = attr(block, "link", "href");
    return {
      id, title: tag(block, "title"), channelName, channelId,
      description: tag(block, "media:description"),
      publishedAt: tag(block, "published") || null,
      thumbnail: attr(block, "media:thumbnail", "url") || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      views: Number(attr(block, "media:statistics", "views")) || 0,
      isShort: /\/shorts\//.test(link)
    };
  }).filter(video => video.id);
}

async function inParallel(items, size, work) {
  const results = [];
  for (let index = 0; index < items.length; index += size) results.push(...await Promise.allSettled(items.slice(index, index + size).map(work)));
  return results;
}

export async function videoSpentToday(db = pantryDb()) {
  const midnight = new Date(); midnight.setUTCHours(0, 0, 0, 0);
  const {data} = await db.from("video_runs").select("cost_usd").gte("started_at", midnight.toISOString());
  return (data || []).reduce((sum, row) => sum + Number(row.cost_usd || 0), 0);
}

export async function stockVideos({maxNew = MAX_NEW_PER_RUN} = {}) {
  const db = pantryDb();
  const {data: run} = await db.from("video_runs").insert({started_at: new Date().toISOString(), notes: "running"}).select("id").single();
  const finish = async fields => { if (run?.id) await db.from("video_runs").update({finished_at: new Date().toISOString(), ...fields}).eq("id", run.id); return fields; };

  // 1. The source list, with channel ids looked up where needed.
  const sources = videoSources();
  const {data: known} = await db.from("video_channels").select("key, channel_id, title, error");
  const byKey = new Map((known || []).map(row => [row.key, row]));
  const keyOf = source => source.id || source.handle.toLowerCase();
  const todo = sources.filter(source => !source.id && !byKey.get(keyOf(source))?.channel_id && !byKey.get(keyOf(source))?.error).slice(0, MAX_LOOKUPS_PER_RUN);
  const lookups = await inParallel(todo, 10, async source => ({source, ...(await lookupHandle(source.handle))}));
  const lookupRows = lookups.map((result, index) => result.status === "fulfilled"
    ? {key: keyOf(todo[index]), handle: todo[index].handle, channel_id: result.value.id, title: result.value.title, tv_channel: todo[index].channel, error: null, checked_at: new Date().toISOString()}
    : {key: keyOf(todo[index]), handle: todo[index].handle, channel_id: null, title: null, tv_channel: todo[index].channel, error: String(result.reason?.message || result.reason).slice(0, 200), checked_at: new Date().toISOString()});
  if (lookupRows.length) await db.from("video_channels").upsert(lookupRows, {onConflict: "key"});
  lookupRows.forEach(row => byKey.set(row.key, row));
  const ready = sources.map(source => ({...source, channelId: source.id || byKey.get(keyOf(source))?.channel_id})).filter(source => source.channelId);

  // 2. Read every channel's latest videos.
  const feeds = await inParallel(ready, 20, async source => (await readFeed(source.channelId)).map(video => ({...video, suggested: source.channel, sourceKey: keyOf(source)})));
  const all = feeds.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const feedErrors = feeds.filter(result => result.status === "rejected").length;

  // 3. Obvious junk out, Shorts set aside, only videos we have never seen.
  const eligible = all.filter(video => !video.isShort && !isDisallowed({title: video.title, summary: video.description.slice(0, 300), source: video.channelName, url: `https://youtu.be/${video.id}`}));
  const ids = [...new Set(eligible.map(video => video.id))];
  const seen = new Set();
  for (let index = 0; index < ids.length; index += 300) {
    const {data} = await db.from("video_inventory").select("id").in("id", ids.slice(index, index + 300));
    (data || []).forEach(row => seen.add(row.id));
  }
  const fresh = [...new Map(eligible.filter(video => !seen.has(video.id)).map(video => [video.id, video])).values()];

  // 4. The AI check, newest first, within the daily budget.
  const budgetLeft = VIDEO_DAILY_BUDGET_USD - await videoSpentToday(db);
  if (budgetLeft <= 0.02) return finish({sources: ready.length, fetched: all.length, new_videos: fresh.length, judged: 0, kept: 0, cost_usd: 0, notes: "Daily video budget reached."});
  const batch = fresh.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt))).slice(0, Math.min(maxNew, Math.floor(budgetLeft / 0.0009)));
  if (!batch.length) return finish({sources: ready.length, fetched: all.length, new_videos: 0, judged: 0, kept: 0, cost_usd: 0, notes: `Nothing new.${feedErrors ? ` ${feedErrors} feeds failed.` : ""}`});
  const {videos: judged, cost, errors} = await checkVideos(batch, {parallel: 5});
  const checked = judged.filter(video => video.ai);

  // 5. Save every verdict, kept or cut, so nothing is paid for twice.
  const now = new Date();
  const rows = checked.map(video => ({
    id: video.id, title: video.title.slice(0, 300), description: video.description.slice(0, 1000), channel_name: video.channelName,
    channel_id: video.channelId, source_key: video.sourceKey, published_at: video.publishedAt, thumbnail: video.thumbnail, views: video.views,
    ai_keep: video.ai.keep, ai_safe: video.ai.safe, ai_delight: video.ai.delight, tv_channel: video.ai.channel,
    place: video.ai.place || null, intro: video.ai.intro || null, ai_reason: video.ai.reason, checked_at: now.toISOString(),
    shelf_until: video.ai.keep ? new Date(now.getTime() + SHELF_DAYS * 864e5).toISOString() : null
  }));
  for (let index = 0; index < rows.length; index += 200) {
    const {error} = await db.from("video_inventory").upsert(rows.slice(index, index + 200), {onConflict: "id", ignoreDuplicates: true});
    if (error) errors.push(`Save failed: ${error.message}`);
  }
  const kept = rows.filter(row => row.ai_keep).length;
  return finish({sources: ready.length, fetched: all.length, new_videos: fresh.length, judged: rows.length, kept, cost_usd: Number(cost.toFixed(4)),
    notes: [errors.slice(0, 2).join(" | "), feedErrors ? `${feedErrors} feeds failed` : ""].filter(Boolean).join(" | ").slice(0, 900) || "ok"});
}

// The shelf for one TV channel (or everything), best and newest first.
export async function videoShelf({channel = null, limit = 200} = {}) {
  let query = pantryDb().from("video_inventory").select("id, title, channel_name, tv_channel, place, intro, ai_delight, published_at, thumbnail")
    .eq("ai_keep", true).gt("shelf_until", new Date().toISOString()).order("checked_at", {ascending: false}).limit(limit);
  if (channel && TV_CHANNELS.includes(channel)) query = query.eq("tv_channel", channel);
  const {data, error} = await query;
  if (error) throw new Error(`Could not read the video shelf: ${error.message}`);
  return data || [];
}
