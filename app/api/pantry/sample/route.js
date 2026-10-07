import { pantryDb } from "../../../../lib/pantry.js";

// A LIVE TASTE of someone's edition, for the "Make it yours" page.
// /api/pantry/sample?topics=music,food&terms=jazz|coffee&because=Jazz|Coffee
//   topics: pantry topics to pull from (the AI's own topic tags)
//   terms:  words to look for in headlines, so picks like "Jazz" float up
// Answers with up to 8 AI-approved stories, each with a "because" label.
export const dynamic = "force-dynamic";

const TOPICS = new Set(["music", "sports", "fashion", "entertainment", "business", "food", "tech", "gardening", "outdoors", "books", "beverage", "home", "crafts", "arts", "auto", "thinking", "history", "trivia", "travel", "surprise"]);
const clean = value => String(value || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim();

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const topics = String(params.get("topics") || "").split(",").map(value => value.trim()).filter(value => TOPICS.has(value)).slice(0, 12);
  // terms and their labels arrive as pairs: "jazz" because of "Jazz".
  const terms = String(params.get("terms") || "").split("|").map(value => value.split("~")).map(([word, label]) => ({word: clean(word), label: String(label || word || "").slice(0, 40)})).filter(term => term.word.length > 2).slice(0, 40);
  try {
    let query = pantryDb().from("story_inventory").select("id, title, url, source, image, summary, ai_topic, ai_delight")
      .eq("ai_keep", true).gt("shelf_until", new Date().toISOString()).not("image", "is", null)
      .order("ai_delight", {ascending: false}).order("first_seen_at", {ascending: false}).limit(topics.length ? 240 : 60);
    if (topics.length) query = query.in("ai_topic", topics);
    const {data, error} = await query;
    if (error) throw error;
    // Score: a headline that mentions one of the reader's words wins.
    const scored = (data || []).map(story => {
      const text = ` ${clean(`${story.title} ${String(story.summary || "").slice(0, 300)}`)} `;
      const hit = terms.find(term => text.includes(` ${term.word}`));
      return {story, hit, score: (hit ? 100 : 0) + Number(story.ai_delight || 0)};
    }).sort((a, b) => b.score - a.score);
    // Variety: take the best of each topic in turn, never two from one source in a row.
    const picked = [], sources = new Set();
    const take = row => { if (picked.length < 8 && !picked.includes(row) && !sources.has(row.story.source)) { picked.push(row); sources.add(row.story.source); } };
    scored.filter(row => row.hit).forEach(take);
    const byTopic = new Map();
    scored.forEach(row => byTopic.set(row.story.ai_topic, [...(byTopic.get(row.story.ai_topic) || []), row]));
    for (let round = 0; picked.length < 8 && round < 8; round += 1) [...byTopic.values()].forEach(list => list[round] && take(list[round]));
    const stories = picked.map(({story, hit}) => ({
      id: story.id, title: story.title, url: story.url, source: story.source, image: story.image, topic: story.ai_topic,
      because: hit ? hit.label : null
    }));
    return Response.json({stories}, {headers: {"cache-control": "public, s-maxage=300, stale-while-revalidate=600"}});
  } catch (error) {
    return Response.json({stories: [], error: String(error?.message || error)}, {status: 200});
  }
}
