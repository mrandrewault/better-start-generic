import { pantryDb, storyId } from "./pantry.js";
import { isDisallowed } from "./feed-builder.js";
import { STORY_CHECK_MODEL } from "./story-check.js";
import { PALETTES } from "./social-card.js";

// THE SOCIAL ROBOT
// Once a day it picks the best story on the pantry shelf, has Claude write a
// short on-brand caption, makes a Meanwhile card for it, and loads it into
// Buffer as a DRAFT for Instagram, Threads and TikTok. Nothing posts until
// Andrew approves it in Buffer.
//
// Look: every card is a Color Hunt style palette (four color bands) with the
// headline in the Meanwhile typeface. Palettes take turns, so no two posts in
// a row look alike. See social-card.js.


export const POSTS_PER_DAY = 8;            // stories per day on Threads and TikTok, one an hour
export const INSTAGRAM_PER_DAY = 4;        // Instagram gets only the best 4 (it dislikes high volume)
const POST_HOURS = [10, 11, 12, 13, 14, 15, 16, 17];   // New York time, 10 AM to 5 PM
const INSTAGRAM_HOURS = [10, 12, 14, 16];
export const SITE = process.env.SOCIAL_BASE_URL || "https://meanwhile.now";
const MIN_DELIGHT = 8;                     // only the very best stories go social
const LOOKBACK_DAYS = 5;                   // pick from stories checked in the last few days
const BUFFER_API = "https://api.buffer.com";


const TOPIC_LABELS = {
  music: "Music", sports: "Sports", fashion: "Style", entertainment: "Screen", business: "Ingenuity", food: "Food",
  tech: "Tech", gardening: "Gardens", outdoors: "Outdoors", books: "Books", beverage: "Drinks", home: "Home",
  crafts: "Making", arts: "Art", auto: "Wheels", thinking: "Ideas", history: "History", trivia: "Did you know",
  travel: "Travel", surprise: "Surprise"
};
export const topicLabel = topic => TOPIC_LABELS[topic] || "Good things";

// House style: no exclamation points, no dashes, no hype.
export function houseStyle(text) {
  return String(text || "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/!+/g, ".")
    .replace(/\.\./g, ".")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// 1. PICK: the best stories on the shelf that have never been posted.
export async function pickStories({count = POSTS_PER_DAY, db = pantryDb()} = {}) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString();
  const {data: rows, error} = await db.from("story_inventory")
    .select("id, url, title, summary, source, image, ai_topic, ai_delight, ai_reason, published_at, first_seen_at")
    .eq("ai_keep", true).gte("ai_delight", MIN_DELIGHT).gt("shelf_until", new Date().toISOString()).gte("checked_at", since)
    .order("ai_delight", {ascending: false}).order("first_seen_at", {ascending: false}).limit(150);
  if (error) throw new Error(`Could not read the pantry: ${error.message}`);
  const {data: used, error: usedError} = await db.from("social_posts").select("story_id, topic, source, created_at").in("status", ["picked", "drafted"]).order("created_at", {ascending: false}).limit(500);
  if (usedError) throw new Error(`Could not read the social log (did the setup SQL run?): ${usedError.message}`);
  const usedIds = new Set((used || []).map(row => row.story_id));
  // Variety: avoid the topics and sources used in the last few posts.
  const recentTopics = new Set((used || []).slice(0, 4).map(row => row.topic));
  const recentSources = new Set((used || []).slice(0, 6).map(row => row.source));
  const candidates = (rows || []).filter(row => !usedIds.has(row.id) && !isDisallowed({title: row.title, summary: row.summary, source: row.source, url: row.url}));
  const picked = [], topics = new Set(), sources = new Set();
  const take = strict => candidates.forEach(row => {
    if (picked.length >= count || picked.includes(row)) return;
    if (topics.has(row.ai_topic) || sources.has(row.source)) return;
    if (strict && (recentTopics.has(row.ai_topic) || recentSources.has(row.source))) return;
    picked.push(row); topics.add(row.ai_topic); sources.add(row.source);
  });
  take(true); take(false);
  // Big batches (the launch push) may need more than one story per topic.
  candidates.forEach(row => { if (picked.length < count && !picked.includes(row)) picked.push(row); });
  return picked;
}

// 2. WRITE: Claude writes the card line and caption, and gets a final veto.
const CAPTION_TOOL = {
  name: "record_posts",
  description: "Record one social post per story, in the same order.",
  input_schema: {
    type: "object",
    properties: {
      posts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {type: "string"},
            ok_for_social: {type: "boolean", description: "False if this story would be awkward as a public brand post: real people in hard times, health, children identified by name, anything that could read as political, anything sad on a second look."},
            card_line: {type: "string", description: "The headline for the card. It is printed right after the word \"Meanwhile,\" so it must read naturally as the rest of that sentence, for example \"a 90-year-old jazz club reopens with its original piano\". Start with a lowercase letter unless the first word is a name. 3 to 8 words (shorter is better, it is printed very big), faithful to the story, no clickbait, no exclamation points, no dashes, no period at the end."},
            caption: {type: "string", description: "2 or 3 short, warm sentences that tell people what the good thing is and why it is nice. Plain words. No exclamation points, no dashes, no emojis, no hashtags, no 'link in bio'."},
            hashtags: {type: "array", items: {type: "string"}, description: "3 to 5 specific, friendly hashtags without the # sign. No generic spam like goodnews or positivity."}
          },
          required: ["id", "ok_for_social", "card_line", "caption", "hashtags"]
        }
      }
    },
    required: ["posts"]
  }
};

const VOICE = `You write social posts for Meanwhile (meanwhile.now), a visual magazine of good things happening all over the world: music, art, food, gardens, travel, design, history, ingenuity, small wonders. The voice is warm, curious, laid back and a little witty, like a friend saying "hey, did you see this?". Never preachy, never hype, never salesy. Never use exclamation points, em dashes or en dashes. Be accurate: only say what the story says.`;

// Claude writes captions 5 stories at a time, so a big batch never runs out
// of room halfway through (missing answers used to count as a "no").
export async function writePosts(rows, options = {}) {
  const out = [];
  for (let index = 0; index < rows.length; index += 5) out.push(...await writeBatch(rows.slice(index, index + 5), options));
  return out;
}

async function writeBatch(rows, {apiKey = process.env.ANTHROPIC_API_KEY} = {}) {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  if (!rows.length) return [];
  const list = rows.map((row, index) => [`id: ${index}`, `headline: ${row.title}`, `summary: ${String(row.summary || "").slice(0, 600) || "(none)"}`, `publisher: ${row.source || "(unknown)"}`, `topic: ${row.ai_topic}`].join("\n")).join("\n\n");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {"x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json"},
    body: JSON.stringify({
      model: STORY_CHECK_MODEL, max_tokens: 4096, system: VOICE,
      tools: [CAPTION_TOOL], tool_choice: {type: "tool", name: "record_posts"},
      messages: [{role: "user", content: `Write one post per story.\n\n${list}`}]
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Caption writer failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  const result = await response.json();
  const posts = result.content?.find(block => block.type === "tool_use")?.input?.posts || [];
  const byId = new Map(posts.map(post => [String(post.id), post]));
  return rows.map((row, index) => {
    const post = byId.get(String(index));
    if (!post || !post.ok_for_social) return null;   // no verdict or a veto: skip it
    const tags = (post.hashtags || []).map(tag => String(tag).replace(/[^A-Za-z0-9_]/g, "")).filter(Boolean).slice(0, 5);
    const caption = houseStyle(post.caption);
    return {
      row,
      cardLine: houseStyle(post.card_line).replace(/[.]$/, ""),
      caption,
      text: `${caption}\n\nVia ${row.source}. Read the story: tap the link in our bio, then tap this card.\n\n${tags.map(tag => `#${tag}`).join(" ")} #meanwhile`.trim(),
      threadsText: `${caption}\n\nVia ${row.source}: ${row.url}`,
      tiktokTitle: `Meanwhile, ${houseStyle(post.card_line).replace(/[.]$/, "")}`.slice(0, 90)
    };
  }).filter(Boolean);
}

// Card addresses Buffer will fetch. They must be public, so always the live site.
export const cardUrl = (id, size = "feed", base = SITE) => `${base}/api/social/card?id=${encodeURIComponent(id)}&size=${size}&v=4`;

// Each post gets the next palette in line, so the grid keeps changing color.
const dressPosts = (posts, startIndex) => posts.map((post, offset) => ({...post, palette: PALETTES[(startIndex + offset) % PALETTES.length]}));

// 3. BUFFER: talk to Buffer's robot door.
async function buffer(query, variables = {}) {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new Error("BUFFER_API_KEY is not set.");
  const response = await fetch(BUFFER_API, {
    method: "POST",
    headers: {"content-type": "application/json", authorization: `Bearer ${key}`},
    body: JSON.stringify({query, variables}),
    cache: "no-store"
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.errors?.length) throw new Error(`Buffer said: ${response.status} ${JSON.stringify(result.errors || result).slice(0, 400)}`);
  return result.data;
}

export async function bufferChannels() {
  const data = await buffer(`query { account { organizations { id } } }`);
  const orgs = data?.account?.organizations || [];
  const all = [];
  for (const org of orgs) {
    const result = await buffer(`query Channels($input: ChannelsInput!) { channels(input: $input) { id service name isDisconnected } }`, {input: {organizationId: org.id}});
    all.push(...(result?.channels || []));
  }
  return all.filter(channel => !channel.isDisconnected && ["instagram", "threads", "tiktok"].includes(String(channel.service).toLowerCase()));
}

// A New York clock time today, as an exact moment (handles summer and winter time).
export function newYorkTime(hour, minute = 0, now = new Date()) {
  const zone = "America/New_York";
  const day = new Intl.DateTimeFormat("en-CA", {timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit"}).format(now);
  const guess = new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"}).formatToParts(guess).map(part => [part.type, part.value]));
  const shownAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() + (guess.getTime() - shownAsUtc));
}

// dueAt given: the post is SCHEDULED for that time (Andrew can delete it from
// Buffer's Queue before then). No dueAt: it lands as a draft for approval.
async function createDraft(channel, post, {story = false, dueAt = null} = {}) {
  const service = String(channel.service).toLowerCase();
  const input = {
    channelId: channel.id,
    schedulingType: "automatic",
    ...(dueAt ? {mode: "customScheduled", dueAt: dueAt.toISOString()} : {mode: "addToQueue", saveToDraft: true}),
    text: service === "threads" ? post.threadsText : post.text,
    assets: [{image: {url: cardUrl(post.row.id, service === "tiktok" || story ? "tall" : "feed")}}]
  };
  if (service === "instagram") input.metadata = {instagram: {type: story ? "story" : "post", shouldShareToFeed: !story}};
  if (service === "tiktok") input.metadata = {tiktok: {title: post.tiktokTitle}};
  const data = await buffer(`mutation Create($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id status } } ... on MutationError { message } } }`, {input});
  const result = data?.createPost || {};
  if (!result.post) throw new Error(`${service}: ${result.message || "no post returned"}`);
  return {service: story ? "instagram story" : service, id: result.post.id, status: result.post.status, at: dueAt ? dueAt.toISOString() : null};
}

// Save planned posts so the card maker can read the card line, and so a story
// is never posted twice.
async function savePlan(posts, status, batch, db) {
  if (!posts.length) return [];
  const rows = posts.map(post => ({
    story_id: post.row.id, batch, status, card_line: post.cardLine, palette: JSON.stringify(post.palette), caption: post.text, threads_caption: post.threadsText,
    topic: post.row.ai_topic, source: post.row.source, title: post.row.title, url: post.row.url
  }));
  const {data, error} = await db.from("social_posts").insert(rows).select("id, story_id");
  if (error) throw new Error(`Could not save the plan: ${error.message}`);
  return data || [];
}

// Preview: pick and write, save as "preview" (never sent, never blocks a story).
export async function planPreview({count = 3} = {}) {
  const db = pantryDb();
  const {count: made} = await db.from("social_posts").select("id", {count: "exact", head: true});
  const posts = dressPosts(await writePosts(await pickStories({count, db})), made || 0);
  await savePlan(posts, "preview", `preview-${new Date().toISOString().slice(0, 16)}`, db);
  return posts;
}

// The daily job: pick, write, save, send drafts to Buffer.
// count: how many stories (each one goes to Instagram, Threads and TikTok).
// force: skip the "already ran today" check (used for the launch push).
// Claude can veto a story as awkward for social, so the robot always writes
// a few spare candidates and keeps the first ones that pass.
export async function runDaily({count = POSTS_PER_DAY, force = false} = {}) {
  const db = pantryDb();
  const today = new Date().toISOString().slice(0, 10);
  if (!force) {
    const {data: already} = await db.from("social_posts").select("id").eq("batch", today).in("status", ["picked", "drafted"]).limit(1);
    if (already?.length) return {ok: true, notes: "Already ran today."};
  }
  const channels = await bufferChannels();
  if (!channels.length) return {ok: false, notes: "No Instagram, Threads or TikTok channel found in Buffer."};
  const candidates = await pickStories({count: count * 2 + 3, db});
  if (!candidates.length) return {ok: false, notes: "No new stories with delight 8+ on the shelf. Nothing sent."};
  const written = await writePosts(candidates);
  const {count: sent} = await db.from("social_posts").select("id", {count: "exact", head: true}).in("status", ["picked", "drafted"]);
  const posts = dressPosts(written.slice(0, count), sent || 0);
  if (!posts.length) return {ok: false, notes: `Claude passed on all ${candidates.length} candidates for social. Nothing sent.`};
  const saved = await savePlan(posts, "picked", force ? `${today}-push` : today, db);
  const report = [];
  // The daily run SCHEDULES posts hourly (Andrew can veto in Buffer's Queue).
  // The launch push by hand makes drafts instead.
  const schedule = !force;
  const now = Date.now();
  for (const [index, post] of posts.entries()) {
    const results = [], errors = [];
    for (const channel of channels) {
      const service = String(channel.service).toLowerCase();
      // Instagram only takes the best few of the day (stories come sorted best first).
      if (schedule && service === "instagram" && index >= INSTAGRAM_PER_DAY) continue;
      const hour = service === "instagram" ? INSTAGRAM_HOURS[index] : POST_HOURS[index % POST_HOURS.length];
      let dueAt = schedule ? newYorkTime(hour, 0) : null;
      // A time that already passed (a late run) moves to later today, spaced out.
      if (dueAt && dueAt.getTime() < now + 5 * 60e3) dueAt = new Date(now + (10 + index * 15) * 60e3);
      try { results.push(await createDraft(channel, post, {dueAt})); }
      catch (error) { errors.push(String(error?.message || error).slice(0, 300)); }
      // Instagram also gets the first story of the day as a Story.
      if (index === 0 && service === "instagram") {
        try { results.push(await createDraft(channel, post, {story: true, dueAt})); }
        catch (error) { errors.push(`story: ${String(error?.message || error).slice(0, 280)}`); }
      }
    }
    const rowId = saved.find(row => row.story_id === post.row.id)?.id;
    if (rowId) await db.from("social_posts").update({status: results.length ? "drafted" : "picked", buffer_ids: results, error: errors.join(" | ") || null, sent_at: new Date().toISOString()}).eq("id", rowId);
    report.push({title: post.row.title, cardLine: post.cardLine, drafts: results.map(result => result.service), errors});
  }
  return {ok: true, channels: channels.map(channel => channel.service), candidates: candidates.length, posts: report};
}

export async function latestPlans({limit = 12} = {}) {
  const {data, error} = await pantryDb().from("social_posts").select("*").order("created_at", {ascending: false}).limit(limit);
  if (error) throw new Error(`Could not read the social log (did the setup SQL run?): ${error.message}`);
  return data || [];
}

export async function cardData(id) {
  const db = pantryDb();
  const [{data: plan}, {data: story}] = await Promise.all([
    db.from("social_posts").select("card_line, palette, topic, source").eq("story_id", id).order("created_at", {ascending: false}).limit(1).maybeSingle(),
    db.from("story_inventory").select("title, source, ai_topic, ai_keep").eq("id", id).maybeSingle()
  ]);
  if (!story || !story.ai_keep) return null;
  return {
    line: plan?.card_line || houseStyle(story.title),
    topic: plan?.topic || story.ai_topic,
    source: plan?.source || story.source,
    palette: (() => { try { return JSON.parse(plan?.palette || "null"); } catch { return null; } })()
  };
}

export { storyId };
