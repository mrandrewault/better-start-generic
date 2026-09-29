import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { collectCandidates, canonicalUrl, enrichStoryImage } from "./feed-builder.js";
import { checkStories } from "./story-check.js";

// THE PANTRY
// A background job fills it every 30 minutes: it pulls new stories from every
// source, lets the word lists throw out obvious junk, asks the AI about the
// rest (each story only once), and saves the approved ones with a shelf life.
// The edition is then built from the shelf, not from whatever happens to be in
// the feeds that minute.

// The Supabase address is not a secret, so it can live in the code.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://agjhncujflnempdpaayo.supabase.co";

export const DAILY_BUDGET_USD = 3;        // the AI check stops for the day past this
const MAX_NEW_PER_RUN = 450;              // keeps each run short and predictable
const MAX_STORY_AGE_DAYS = 10;            // older stories are skipped, not judged
const SHELF_DAYS_GOOD = 7;                // how long an approved story stays out
const SHELF_DAYS_GREAT = 14;              // delight 8 or higher stays longer
const SHELF_LIMIT = 900;

let client = null;
export function pantryDb() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set.");
  if (!client) client = createClient(SUPABASE_URL, key, {auth: {persistSession: false, autoRefreshToken: false}});
  return client;
}

export const storyId = url => crypto.createHash("sha1").update(canonicalUrl(url || "")).digest("hex").slice(0, 24);
const ageDays = date => date ? (Date.now() - new Date(date)) / 864e5 : 0;
const validDate = date => { const time = date ? new Date(date).getTime() : NaN; return Number.isFinite(time) ? new Date(time).toISOString() : null; };

export async function spentToday(db = pantryDb()) {
  const midnight = new Date(); midnight.setUTCHours(0, 0, 0, 0);
  const {data, error} = await db.from("check_runs").select("cost_usd").gte("started_at", midnight.toISOString());
  if (error) throw new Error(`Could not read the logbook: ${error.message}`);
  return (data || []).reduce((sum, row) => sum + Number(row.cost_usd || 0), 0);
}

async function knownIds(db, ids) {
  const known = new Set();
  for (let index = 0; index < ids.length; index += 300) {
    const {data, error} = await db.from("story_inventory").select("id").in("id", ids.slice(index, index + 300));
    if (error) throw new Error(`Could not read the pantry: ${error.message}`);
    (data || []).forEach(row => known.add(row.id));
  }
  return known;
}

// One background run. Returns a plain summary for the logbook.
export async function stockPantry({maxNew = MAX_NEW_PER_RUN} = {}) {
  const db = pantryDb();
  const started = new Date().toISOString();
  const {data: run} = await db.from("check_runs").insert({started_at: started, notes: "running"}).select("id").single();
  const finish = async fields => { if (run?.id) await db.from("check_runs").update({finished_at: new Date().toISOString(), ...fields}).eq("id", run.id); return fields; };

  const budgetLeft = DAILY_BUDGET_USD - await spentToday(db);
  if (budgetLeft <= 0.02) return finish({notes: `Daily budget of $${DAILY_BUDGET_USD} reached. Skipped.`, cost_usd: 0});

  // 1. Every source, not a rotating slice.
  const {stories: candidates, sourceCount} = await collectCandidates({audited: 1000, perSource: 10});
  // 2. Word lists throw out obvious junk before we spend anything on it.
  const eligible = candidates.filter(story => !story.wordList.blocked && ageDays(story.date) <= MAX_STORY_AGE_DAYS);
  // 3. Only stories the pantry has never seen.
  const withIds = eligible.map(story => ({...story, id: storyId(story.url)}));
  const known = await knownIds(db, [...new Set(withIds.map(story => story.id))]);
  const seen = new Set();
  const fresh = withIds.filter(story => !known.has(story.id) && !seen.has(story.id) && seen.add(story.id));
  // Newest first, and never more than the budget allows (about $0.0007 a story).
  const affordable = Math.max(0, Math.floor(budgetLeft / 0.0008));
  const batch = fresh.sort((a, b) => ageDays(a.date) - ageDays(b.date)).slice(0, Math.min(maxNew, affordable));
  if (!batch.length) return finish({sources: sourceCount, fetched: candidates.length, new_stories: fresh.length, judged: 0, kept: 0, cost_usd: 0, notes: "Nothing new to check."});

  // 4. The AI story check.
  const {stories: judged, cost, errors} = await checkStories(batch, {parallel: 6});
  const checked = judged.filter(story => !story.ai.missing);   // failures get retried next run

  // 5. Approved stories without a picture get one from their own page.
  const keepers = checked.filter(story => story.ai.keep);
  const needImage = keepers.filter(story => !story.image).slice(0, 60);
  const withImages = new Map((await Promise.all(needImage.map(story => enrichStoryImage(story).catch(() => story)))).map(story => [story.id, story]));

  // 6. Save everything that was judged, kept or cut, so it is never paid for twice.
  const now = new Date();
  const rows = checked.map(original => {
    const story = withImages.get(original.id) || original;
    const published = validDate(story.date);
    const shelfBase = published && new Date(published) < now ? new Date(published) : now;
    const days = story.ai.delight >= 8 ? SHELF_DAYS_GREAT : SHELF_DAYS_GOOD;
    return {
      id: story.id, url: story.url, title: story.title, summary: (story.summary || "").slice(0, 600), source: story.source, source_url: story.sourceUrl || null,
      image: story.image || null, section: story.section || null, published_at: published, last_seen_at: now.toISOString(), checked_at: now.toISOString(),
      ai_keep: story.ai.keep, ai_safe: story.ai.safe, ai_delight: story.ai.delight, ai_topic: story.ai.topic, ai_reason: story.ai.reason,
      shelf_until: story.ai.keep ? new Date(shelfBase.getTime() + days * 864e5).toISOString() : null
    };
  });
  for (let index = 0; index < rows.length; index += 200) {
    const {error} = await db.from("story_inventory").upsert(rows.slice(index, index + 200), {onConflict: "id", ignoreDuplicates: true});
    if (error) errors.push(`Save failed: ${error.message}`);
  }
  return finish({sources: sourceCount, fetched: candidates.length, new_stories: fresh.length, judged: checked.length, kept: keepers.length, cost_usd: Number(cost.toFixed(4)), notes: errors.length ? errors.slice(0, 3).join(" | ").slice(0, 900) : "ok"});
}

// The shelf: AI-approved stories that are still in date, newest first.
export async function readShelf({limit = SHELF_LIMIT} = {}) {
  const db = pantryDb();
  const {data, error} = await db.from("story_inventory").select("*").eq("ai_keep", true).gt("shelf_until", new Date().toISOString()).order("first_seen_at", {ascending: false}).limit(limit);
  if (error) throw new Error(`Could not read the shelf: ${error.message}`);
  return (data || []).map(row => {
    const hours = (Date.now() - new Date(row.published_at || row.first_seen_at)) / 36e5;
    return {
      title: row.title, url: row.url, summary: row.summary || "", date: row.published_at || row.first_seen_at, source: row.source, publisher: row.source, aggregatorSource: row.source,
      independentPublisher: true, section: row.section || "", image: row.image || null, freshnessDays: SHELF_DAYS_GOOD,
      aiApproved: true, aiTopic: row.ai_topic, aiDelight: row.ai_delight, aiReason: row.ai_reason, mixLane: row.ai_topic,
      // Ranking: delight matters most, freshness gives a gentle lift.
      score: 30 + Number(row.ai_delight || 0) * 10 + (hours <= 24 ? 12 : hours <= 72 ? 6 : 0), interestHits: 0, noHits: 0
    };
  });
}
