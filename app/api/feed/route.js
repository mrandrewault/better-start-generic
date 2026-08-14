import Parser from "rss-parser";
import fs from "fs";
import path from "path";

const parser = new Parser({
  timeout: 9000,
  headers: {"User-Agent": "BetterStart/2.0"},
  customFields: {item: [["media:content", "mediaContent"], ["media:thumbnail", "mediaThumbnail"]]}
});
const dataPath = name => path.join(process.cwd(), "data", name);
const load = name => JSON.parse(fs.readFileSync(dataPath(name), "utf8"));

function plain(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/&\w+;/g, " ").replace(/\s+/g, " ").trim();
}
function normalizeTitle(value = "") {
  return plain(value).toLowerCase().replace(/\b(the|a|an|and|or|but|to|of|for|in|on|at|with|from)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}
function canonicalUrl(value = "") {
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "source", "output"].forEach(key => url.searchParams.delete(key));
    url.hostname = url.hostname.replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return `${url.hostname}${url.pathname}${url.searchParams.toString() ? `?${url.searchParams}` : ""}`;
  } catch { return value.replace(/\/$/, ""); }
}
function imageFor(item) {
  const html = item.content || item["content:encoded"] || "";
  return item.enclosure?.url || item.mediaContent?.$?.url || item.mediaThumbnail?.$?.url || html.match(/<img[^>]+src=["']([^"']+)/i)?.[1] || null;
}
function itemText(item) { return `${item.title || ""} ${item.contentSnippet || ""} ${item.content || ""}`.toLowerCase(); }
function isDisallowed(item) {
  const value = `${item.title || ""} ${item.summary || ""} ${item.contentSnippet || ""}`.toLowerCase();
  return /\b(trump|maga|maha|white house|mar-a-lago|gop|republicans?|democrats?|congress|senate|house speaker|pentagon|department of justice|doj|ice agents?|fbi|supreme court|presidential election|midterms?|campaign|politics?|political|rfk jr|jd vance|war|military strike|murder|shooting|violence|violent|attack|assault|abuse|rage|outrage|scandal|feud|crisis|disaster|death|deadly|killed|guns?|ufc|mma|gambling|religious?|church|megachurch|anti-vax|antivax|vaccine conspiracy|anti-science|culture war)\b/i.test(value);
}
function isJoyful(item) {
  const value = `${item.title || ""} ${item.summary || ""}`;
  return /discover|new|beautiful|guide|best|love|return|release|photo|album|art|music|food|travel|space|nature|design|book|film|restor|celebrat|rescue|record|garden|recipe|festival|museum|wins?\b|victory|comeback|advance|adopt|reunited|kindness|community|uplifting|inspir|opens?|achievement|breakthrough|volunteer|conservation|recovery|success|helps?|creates?|invent/i.test(value) && !/killed|deadly|war|attack|crisis|disaster|outrage|scandal|cancer|dies?\b|death|threat|fear|horrific|tariffs?|banned|terrible|abuse|neglect|euthan|injur|defeat|worsen|\bworst\b/i.test(value);
}
function isFreshLocal(item) {
  if (!item.date) return true;
  const evergreenSources = new Set(["NPR Music", "Criterion", "NYT Arts", "NYT Books", "Guardian Science", "Guardian Culture", "Dezeen", "Eater", "NASA"]);
  if (evergreenSources.has(item.source)) return true;
  return (Date.now() - new Date(item.date)) / 864e5 <= 45;
}
function isGoodNews(item) {
  const value = `${item.title || ""} ${item.summary || ""}`;
  return /discover|beautiful|love|return|restor|celebrat|rescue|breakthrough|success|wins?\b|record|opens?|reun|reviv|saved?|found/i.test(value) && isJoyful(item);
}
function score(item, source, taste) {
  const text = itemText(item); let value = (source.quality || 5) * 5, hits = 0, noHits = 0;
  for (const raw of taste.yes) if (text.includes(raw.toLowerCase())) { value += 8; if (++hits >= 7) break; }
  for (const raw of taste.no) if (text.includes(raw.toLowerCase())) { value -= 24; noHits++; }
  const hours = item.isoDate ? (Date.now() - new Date(item.isoDate)) / 36e5 : 24;
  value += hours <= 6 ? 10 : hours <= 24 ? 6 : hours <= 48 ? 2 : -Math.min(12, hours / 24);
  if (/kindness|community|rescue|breakthrough|discovery|restored|conservation|volunteer|inspiring|uplifting/i.test(text)) value += 12;
  if (/you won't believe|internet is freaking|shocking|what happened next/i.test(item.title || "")) value -= 15;
  return {score: Math.round(value), interestHits: hits, noHits};
}
function formatFor(item, index) {
  if (item.videoId) return "video";
  if (item.image && index % 7 === 0) return "feature";
  if (item.image && (/photography|art \+ design/i.test(item.section) || index % 3 === 1)) return "visual";
  if (!item.image || (item.summary || "").length < 90) return "blurb";
  return "article";
}
function unique(items) {
  const urls = new Set(), titles = new Set(), output = [];
  for (const item of items) {
    const url = canonicalUrl(item.url), title = normalizeTitle(item.title);
    if (!url || !title || urls.has(url) || titles.has(title)) continue;
    urls.add(url); titles.add(title); output.push({...item, canonicalUrl: url, normalizedTitle: title});
  }
  return output;
}

// A greedy magazine editor: every choice is judged by how much it improves the
// current page, with diminishing returns for repeated sources/topics/formats.
function compose(candidates, count, seed = {}, random = Math.random) {
  const chosen = [], sourceCounts = {...seed.sources}, topicCounts = {...seed.topics}, formatCounts = {...seed.formats};
  const pool = [...candidates];
  while (chosen.length < count && pool.length) {
    let winner = 0, best = -Infinity;
    pool.forEach((item, index) => {
      const recent = chosen.slice(-10);
      const sourcePenalty = (sourceCounts[item.source] || 0) * 10 + (recent.some(previous => previous.source === item.source) ? 500 : 0);
      const topicPenalty = (topicCounts[item.section] || 0) * 6 + (chosen.slice(-2).some(previous => previous.section === item.section) ? 30 : 0);
      const formatPenalty = (formatCounts[item.format] || 0) * 8;
      const visualBonus = item.image && !(formatCounts.visual || 0) ? 12 : 0;
      const serendipityBonus = item.interestHits === 0 && chosen.length > 3 ? 5 : 0;
      const moodBonus = /discover|new|beautiful|guide|best|love|return|release|photo|album/i.test(`${item.title} ${item.summary}`) ? 4 : 0;
      const compositionScore = item.score - sourcePenalty - topicPenalty - formatPenalty + visualBonus + serendipityBonus + moodBonus + random() * 14;
      if (compositionScore > best) { best = compositionScore; winner = index; }
    });
    const [item] = pool.splice(winner, 1); chosen.push(item);
    sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
    topicCounts[item.section] = (topicCounts[item.section] || 0) + 1;
    formatCounts[item.format] = (formatCounts[item.format] || 0) + 1;
  }
  return chosen;
}
function playlistFeature(random = Math.random, avoid = new Set()) {
  const files = fs.readdirSync(dataPath(".")).filter(name => name.endsWith("-videos.csv"));
  if (!files.length) return null;
  const file = files[Math.floor(random() * files.length)], rows = fs.readFileSync(dataPath(file), "utf8").trim().split(/\r?\n/).slice(1).map(row => row.split(",")[0]).filter(id => id && !avoid.has(id));
  const videoId = rows[Math.floor(random() * rows.length)];
  if (!videoId) return null;
  const playlist = file.replace(/-videos\.csv$/, "");
  return {title: `A video from Andrew's ${playlist} shelf`, url: `https://www.youtube.com/watch?v=${videoId}`, source: "YouTube library", section: /camera/i.test(playlist) ? "PHOTOGRAPHY" : "MUSIC", summary: `A daily find from the existing ${playlist} playlist.`, date: null, image: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, score: 52, interestHits: 1, noHits: 0, videoId, format: "video"};
}

function youtubeSubscriptions() {
  const lines = fs.readFileSync(dataPath("subscriptions.csv"), "utf8").split(/\r?\n/).slice(1);
  return lines.map(line => {
    const match = line.match(/^([^,]+),[^,]*,(?:"([^"]+)"|(.+))$/);
    return match ? {id: match[1], name: match[2] || match[3]} : null;
  }).filter(Boolean).filter(channel => !/andrew ault|drsuperfresh/i.test(channel.name));
}
async function loadYouTubeDiscoveries() {
  const affinity = /music|jazz|synth|record|photo|camera|film|cinema|norm|comedy|dead|beatles|stones|dylan|criterion|leica|moog|piano|concert/i;
  const channels = youtubeSubscriptions().filter(channel => affinity.test(channel.name));
  const day = Math.floor(Date.now() / 86400000), rotated = channels.slice(day % Math.max(1, channels.length)).concat(channels.slice(0, day % Math.max(1, channels.length))).slice(0, 16);
  const results = await Promise.allSettled(rotated.map(async channel => {
    const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`);
    return (feed.items || []).slice(0, 2).map(item => {
      const videoId = item.id?.split(":").pop() || item.link?.match(/[?&]v=([^&]+)/)?.[1];
      return {title: plain(item.title), url: item.link, summary: `A recent find from one of Andrew's YouTube subscriptions.`, date: item.isoDate || item.pubDate || null, source: channel.name, section: /photo|camera|leica/i.test(channel.name) ? "PHOTOGRAPHY" : /film|cinema/i.test(channel.name) ? "FILM + CULTURE" : "MUSIC", image: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null, score: 66, interestHits: 2, noHits: 0, videoId, format: "video"};
    });
  }));
  const items = []; results.forEach(result => { if (result.status === "fulfilled") items.push(...result.value); });
  return items.filter(item => item.videoId && !isDisallowed(item) && isJoyful(item)).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}
async function loadPlaylistDiscoveries(random = Math.random, avoid = new Set()) {
  const preferred = ["funny shit-videos.csv", "Movie clips-videos.csv", "Film Class-videos.csv", "Favorites-videos.csv", "Blue Notes-videos.csv", "Synth-videos.csv", "GD-videos.csv", "Camera-videos.csv", "Concerts-videos.csv"];
  const picks = [];
  preferred.forEach(file => {
    const rows = fs.readFileSync(dataPath(file), "utf8").trim().split(/\r?\n/).slice(1).map(row => row.split(",")[0]).filter(id => id && !avoid.has(id));
    for (let pick = 0; pick < 2 && rows.length; pick++) { const index = Math.floor(random() * rows.length), [videoId] = rows.splice(index, 1); picks.push({videoId, shelf: file.replace(/-videos\.csv$/, "")}); }
  });
  const results = await Promise.allSettled(picks.map(async pick => {
    const url = `https://www.youtube.com/watch?v=${pick.videoId}`;
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {next: {revalidate: 86400}});
    if (!response.ok) return null;
    const meta = await response.json();
    return {title: meta.title, url, summary: "", date: null, source: meta.author_name, section: /camera/i.test(pick.shelf) ? "PHOTOGRAPHY" : /movie|film/i.test(pick.shelf) ? "FILM + CULTURE" : "MUSIC", image: meta.thumbnail_url || `https://i.ytimg.com/vi/${pick.videoId}/hqdefault.jpg`, score: 68, interestHits: 3, noHits: 0, videoId: pick.videoId, format: "video"};
  }));
  const items = []; results.forEach(result => { if (result.status === "fulfilled" && result.value) items.push(result.value); });
  return items.filter(item => !/andrew ault|drsuperfresh/i.test(item.source) && !isDisallowed(item));
}
async function loadBandcampReleases() {
  const sources = load("bandcamp-sources.json");
  const results = await Promise.allSettled(sources.map(async source => {
    const response = await fetch(new URL("music", source.url), {headers: {"User-Agent": "BetterStart/2.0"}, next: {revalidate: 3600}});
    const html = await response.text(), items = [];
    const blockPattern = /<li data-item-id="(album|track)-(\d+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<img src="([^"]+)"[\s\S]*?<p class="title">([\s\S]*?)<\/p>[\s\S]*?<\/li>/g;
    for (const match of html.matchAll(blockPattern)) {
      const titleText = plain(match[5].replace(/<br\s*\/?>/gi, " — "));
      const url = new URL(match[3], source.url).toString();
      items.push({title: titleText, url, summary: `A new-release shelf pick from ${source.name}. Click to listen.`, date: null, source: source.name, section: "MUSIC", image: match[4], score: 72, interestHits: 3, noHits: 0, format: "bandcamp", embedUrl: `https://bandcamp.com/EmbeddedPlayer/${match[1]}=${match[2]}/size=large/bgcol=fffefa/linkcol=d23d32/tracklist=false/artwork=small/transparent=true/`});
      if (items.length >= 3) break;
    }
    return items;
  }));
  const items = []; results.forEach(result => { if (result.status === "fulfilled") items.push(...result.value); });
  return items;
}
async function loadInstagramProfile() {
  try {
    const url = "https://www.instagram.com/andrew.ault.photography/";
    const html = await (await fetch(url, {headers: {"User-Agent": "Mozilla/5.0"}, next: {revalidate: 21600}})).text();
    const image = html.match(/property="og:image" content="([^"]+)/)?.[1]?.replace(/&amp;/g, "&");
    return {title: "A visual pause from Andrew Ault Photography", url, summary: "A doorway into Andrew's public photography feed.", date: null, source: "@andrew.ault.photography", section: "PHOTOGRAPHY", image, score: 70, interestHits: 3, noHits: 0, format: "social"};
  } catch { return null; }
}

function seededRandom(value = "better-start") {
  let state = 2166136261;
  for (let index = 0; index < value.length; index++) state = Math.imul(state ^ value.charCodeAt(index), 16777619);
  return () => { state += 0x6D2B79F5; let result = state; result = Math.imul(result ^ result >>> 15, result | 1); result ^= result + Math.imul(result ^ result >>> 7, result | 61); return ((result ^ result >>> 14) >>> 0) / 4294967296; };
}

export async function GET(request) {
  const params = new URL(request.url).searchParams, random = seededRandom(params.get("visit") || String(Math.floor(Date.now() / 72e5)));
  const taste = load("taste.json"), sources = load("sources.json");
  const results = await Promise.allSettled(sources.map(async source => {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).slice(0, 40).map((item, index) => {
      const scored = score(item, source, taste);
      const story = {title: plain(item.title) || "Untitled", url: item.link || "#", summary: plain(item.contentSnippet || item.content || ""), date: item.isoDate || item.pubDate || null, source: source.name, section: source.section, image: imageFor(item), ...scored};
      return {...story, format: formatFor(story, index)};
    });
  }));
  let all = [];
  results.forEach(result => { if (result.status === "fulfilled") all.push(...result.value); });
  all = unique(all.filter(item => item.score > 18 && !isDisallowed(item) && isJoyful(item) && isFreshLocal(item)).sort((a, b) => b.score - a.score));

  // One shared registry across every page region makes duplicates impossible.
  const usedUrls = new Set(), usedTitles = new Set();
  const claim = items => items.filter(item => {
    const url = canonicalUrl(item.url), title = normalizeTitle(item.title);
    if (usedUrls.has(url) || usedTitles.has(title)) return false;
    usedUrls.add(url); usedTitles.add(title); return true;
  });
  const brightPool = all.filter(item => /PEOPLE|ANIMALS|PROGRESS|AROUND AMERICA/.test(item.section) || isGoodNews(item));
  const ribbonFavorite = claim(compose(brightPool, 1, {}, random))[0] || null;
  const favoriteSelection = claim(compose(brightPool.filter(item => !usedUrls.has(canonicalUrl(item.url))), 6, {}, random));
  const goodNews = claim(compose(all.filter(isGoodNews), 1, {}, random))[0] || null;
  const media = [];
  const importantPool = all.filter(item => ["NASA", "Guardian Science", "Science Breakthroughs", "Technology for Good", "Nature Restored"].includes(item.source));
  const important = claim(compose(importantPool, 3, {}, random));
  const galleryPool = all.filter(item => !usedUrls.has(canonicalUrl(item.url)) && !usedTitles.has(normalizeTitle(item.title)));
  const gallery = claim(compose(galleryPool, 140, {}, random));
  const serendipityPool = all.filter(item => item.noHits === 0 && !usedUrls.has(canonicalUrl(item.url)) && !usedTitles.has(normalizeTitle(item.title)));
  const serendipity = claim(compose(serendipityPool, 60, {}, random));

  return Response.json({generatedAt: new Date().toISOString(), edition: Math.floor(Date.now() / 72e5), ribbonFavorite, goodNews, favorites: favoriteSelection, media, gallery, important, serendipity, sourceStatus: {total: sources.length, successful: results.filter(result => result.status === "fulfilled").length}}, {headers: {"Cache-Control": "no-store"}});
}
