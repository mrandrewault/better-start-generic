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
const blockedTerms = Object.values(load("content-policy.json")).flat();
const policyText = value => ` ${String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
const stableHash = value => { let hash = 2166136261; for (const char of String(value || "")) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); };
const publicSpaceUnsafe = /\b(porn(?:ography|ographic)?|nsfw|nud(?:e|ity)|naked|topless|full[- ]?frontal|genitals?|penis|vulva|vagina|erotic(?:a)?|sexually explicit|adult content|figure stud(?:y|ies)|boudoir)\b/i;

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
  const mediaContent = Array.isArray(item.mediaContent) ? item.mediaContent : [item.mediaContent];
  const mediaThumbnail = Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail : [item.mediaThumbnail];
  const candidates = [
    item.enclosure?.url,
    ...mediaContent.map(value => value?.$?.url || value?.url),
    ...mediaThumbnail.map(value => value?.$?.url || value?.url),
    html.match(/<img[^>]+(?:data-lazy-src|data-src|src)=["']([^"']+)/i)?.[1],
    html.match(/<img[^>]+srcset=["']([^"' ,]+)/i)?.[1]
  ].filter(Boolean);
  return candidates.find(url => !/pixel|spacer|tracking|1x1|blank\.(gif|png)|favicon|avatar|default[-_ ]?image|site[-_ ]?logo|brandmark|lh3\.googleusercontent\.com\/J6_coFbogx/i.test(url)) || null;
}
function itemText(item) { return `${item.title || ""} ${item.contentSnippet || ""} ${item.content || ""}`.toLowerCase(); }
function isDisallowed(item) {
  const value = policyText(`${item.title || ""} ${item.summary || ""} ${item.contentSnippet || ""} ${item.source || ""} ${item.section || ""}`);
  const raw = `${item.title || ""} ${item.summary || ""} ${item.contentSnippet || ""} ${item.source || ""} ${item.section || ""}`;
  const corporateAmazon = /\bamazon(?:'s)?\b/i.test(raw) && !/\bamazon (?:rainforest|river|basin|forest|region|wildlife)\b/i.test(raw);
  return corporateAmazon || /\bjeff bezos\b/i.test(raw) || bodyAnxiety.test(raw) || publicSpaceUnsafe.test(raw) || blockedTerms.some(term => value.includes(policyText(term)));
}
function wasRecentlyShown(item, avoidStories) {
  if (!avoidStories?.size) return false;
  return [canonicalUrl(item.url), `url:${canonicalUrl(item.url)}`, normalizeTitle(item.title), `title:${normalizeTitle(item.title)}`, item.image, `image:${item.image || ""}`, item.videoId, `video:${item.videoId || ""}`].filter(Boolean).some(value => avoidStories.has(stableHash(value)));
}
function hasBadMood(value) {
  return /killed|deadly|fatal|crash|unsafe|controvers|war|attack|crisis|disaster|outrage|scandal|cancer|dies?\b|death|threat|fear|horrific|tariffs?|banned|terrible|abuse|neglect|euthan|injur|defeat|worsen|\bworst\b/i.test(value);
}
function isJoyful(item) {
  const value = `${item.title || ""} ${item.summary || ""}`;
  return /discover|new|beautiful|guide|best|love|return|release|photo|album|art|music|food|travel|space|nature|design|book|film|restor|celebrat|rescue|record|garden|recipe|festival|museum|wins?\b|victory|comeback|advance|adopt|reunited|kindness|community|uplifting|inspir|opens?|achievement|breakthrough|volunteer|conservation|recovery|success|helps?|creates?|invent/i.test(value) && !hasBadMood(value);
}
function isSpecialistWorthwhile(item) {
  const value = `${item.title || ""} ${item.summary || ""}`;
  return /profile|interview|explainer|guide|design|history|archive|craft|studio|maker|founder|leader|company|business|market|finance|style|fashion|couture|runway|atelier|collection|costume|wardrobe|beauty|cosmetic|photographer|supermodel|book|author|novelist|library|museum|yoga|pilates|movement|wellness|fitness|running|garden|plant|workshop|repair|restor|car|automotive|boat|sail|maritime|train|aviation|team|player|wnba|baseball|tennis|football|soccer/i.test(value) && !hasBadMood(value);
}
const bodyAnxiety = /\b(bmi|body fat|weight[- ]loss|lose weight|obesity|overweight|fat burning|belly fat|calorie deficit|dieting|slim down|thinness|being thin|beach body|anti-aging)\b/i;
const distressedAnimal = /\b(abuse|abandoned|starving|dying|near death|neglect|euthan|dumped|injured|horrific|suffering|thousands of miles away)\b/i;
function detectEditorialIdentity(interests, activePacks) {
  const identities = load("editorial-identities.json"), haystack = ` ${interests.join(" ").toLowerCase()} `;
  const ranked = Object.entries(identities).map(([id, identity]) => {
    const signalHits = identity.signals.reduce((total, signal) => total + (haystack.includes(signal) ? 1 : 0), 0);
    const packHits = activePacks.reduce((total, pack) => total + (identity.packs.includes(pack.id) ? pack.hits : 0), 0);
    return {id, ...identity, score:signalHits * 3 + packHits * 2};
  }).filter(identity => identity.score > 0).sort((a, b) => b.score - a.score);
  return ranked[0] || {id:"general", label:"Meanwhile", references:[], accent:"classic", imageTarget:.52, score:0};
}
function contextAllowed(item, identity) {
  const value = `${item.title || ""} ${item.summary || ""}`;
  if (identity.id === "fashion" && (bodyAnxiety.test(value) || distressedAnimal.test(value))) return false;
  if (identity.id === "sports" && /\b(odds|betting|sportsbook|parlay|wager)\b/i.test(value)) return false;
  return true;
}

function visualFirst(items, identity, count = 20, requestedTarget) {
  // A color field is useful art direction, but it is not editorial imagery.
  // Identity image targets therefore count only honest story images/video stills.
  const target = requestedTarget ?? Math.ceil(count * Math.max(.6, identity.imageTarget || 0));
  const opening = items.slice(0, count), rest = items.slice(count);
  let visualCount = opening.filter(item => item.image).length;
  while (visualCount < target) {
    const replacement = rest.findIndex(item => item.image && isIdentityStory(item, identity));
    const fallback = replacement >= 0 ? replacement : rest.findIndex(item => item.image);
    const textSlot = opening.map((item, index) => ({item, index})).reverse().find(entry => !entry.item.image)?.index;
    if (fallback < 0 || textSlot === undefined) break;
    const [visual] = rest.splice(fallback, 1), [text] = opening.splice(textSlot, 1, visual);
    rest.unshift(text); visualCount++;
  }
  return [...opening, ...rest];
}
function isIdentityStory(item, identity) {
  if (identity.id === "general") return item.personalFit !== "editorial";
  return identity.packs.includes(item.sourcePack) || identity.signals.some(signal => policyText(`${item.title} ${item.summary} ${item.section} ${item.source}`).includes(policyText(signal)));
}
async function enrichStoryImage(item) {
  if (item.image || !item.url || item.url === "#") return item;
  try {
    const response = await fetch(item.url, {redirect:"follow", headers:{"User-Agent":"Mozilla/5.0 BetterStart/5.0"}, signal:AbortSignal.timeout(2800)});
    if (!response.ok) return item;
    const html = await response.text();
    const image = html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i)?.[1]
      || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i)?.[1];
    return image && /^https?:/i.test(image) && !/lh3\.googleusercontent\.com\/J6_coFbogx|news\.google\.com|favicon|avatar|default[-_ ]?image|site[-_ ]?logo|brandmark/i.test(image) ? {...item, image, format:"visual", imageEnriched:true} : item;
  } catch { return item; }
}
async function enrichIdentityImages(items, identity) {
  // Image availability is a composition requirement, not a nice-to-have.
  // Try the most relevant stories first, then adjacent/editorial stories. This
  // keeps visual coverage high without attaching an unrelated photograph to a
  // text story.
  const candidates = items.filter(item => !item.image).sort((a, b) => {
    const relevance = item => (isIdentityStory(item, identity) ? 3 : 0) + (item.personalFit === "direct" ? 2 : item.personalFit === "adjacent" ? 1 : 0);
    return relevance(b) - relevance(a) || b.score - a.score;
  }).slice(0, 72);
  if (!candidates.length) return items;
  const enriched = [];
  // Small batches avoid hammering publishers while still checking enough
  // source pages to build a genuinely visual edition.
  for (let index = 0; index < candidates.length; index += 12) {
    enriched.push(...await Promise.all(candidates.slice(index, index + 12).map(enrichStoryImage)));
  }
  const byUrl = new Map(enriched.map(item => [item.url, item]));
  return items.map(item => byUrl.get(item.url) || item);
}

function distributeVisuals(items, identity, blockSize = 10) {
  const arranged = [...items];
  const targetFor = start => Math.min(
    blockSize,
    Math.ceil(Math.min(blockSize, arranged.length - start) * Math.max(.5, identity.imageTarget || 0))
  );
  for (let start = 0; start < arranged.length; start += blockSize) {
    const end = Math.min(arranged.length, start + blockSize), target = targetFor(start);
    let count = arranged.slice(start, end).filter(item => item.image).length;
    while (count < target) {
      const textIndex = arranged.slice(start, end).map((item, offset) => ({item, index:start + offset})).reverse().find(entry => !entry.item.image)?.index;
      let visualIndex = arranged.findIndex((item, index) => index >= end && item.image && isIdentityStory(item, identity));
      if (visualIndex < 0) visualIndex = arranged.findIndex((item, index) => index >= end && item.image);
      if (textIndex === undefined || visualIndex < 0) break;
      [arranged[textIndex], arranged[visualIndex]] = [arranged[visualIndex], arranged[textIndex]];
      count++;
    }
  }
  return arranged;
}

const visualSearches = {
  fashion:[{query:"haute couture runway",lane:"fashion"},{query:"fashion week street style",lane:"fashion"}],
  outdoors:[{query:"wildlife in natural habitat",lane:"animals"},{query:"hiking trail landscape",lane:"travel"}],
  sports:[{query:"women sports competition",lane:"sports"},{query:"community athletics",lane:"sports"}],
  business:[{query:"independent small business owner",lane:"money"},{query:"craft workshop maker",lane:"ingenuity"}],
  food:[{query:"regional food market",lane:"food"},{query:"restaurant kitchen chef",lane:"food"}],
  culture:[{query:"museum exhibition artwork",lane:"arts"},{query:"live theatre performance",lane:"arts"}],
  science:[{query:"astronomy observatory science",lane:"science"},{query:"scientific instrument laboratory",lane:"science"}],
  general:[
    {query:"haute couture runway",lane:"fashion"},{query:"wildlife in natural habitat",lane:"animals"},
    {query:"international street life",lane:"international"},{query:"community volunteers helping",lane:"kindness"},
    {query:"inventor maker workshop",lane:"ingenuity"},{query:"live music performance",lane:"music"},
    {query:"astronomy observatory science",lane:"science"},{query:"beautiful travel destination",lane:"travel"},
    {query:"regional food market",lane:"food"},{query:"community sports competition",lane:"sports"},
    {query:"independent small business",lane:"money"},{query:"helpful robotics technology",lane:"technology"},
    {query:"home garden design",lane:"home"},{query:"everyday curiosity collection",lane:"grabBag"},
    {query:"museum exhibition artwork",lane:"arts"}
  ]
};
async function loadVisualShelf(identity, count = 80) {
  const searches = visualSearches[identity.id] || visualSearches.general, results = [];
  await Promise.all(searches.map(async ({query, lane}) => {
    try {
      const params = new URLSearchParams({action:"query",generator:"search",gsrsearch:query,gsrnamespace:"6",gsrlimit:"10",prop:"imageinfo",iiprop:"url|mime|extmetadata",iiurlwidth:"1400",format:"json",origin:"*"});
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {headers:{"User-Agent":"BetterStart/10.0 (visual shelf; attributed Commons media)"}, signal:AbortSignal.timeout(5500)});
      if (!response.ok) return;
      const payload = await response.json();
      Object.values(payload?.query?.pages || {}).forEach(page => {
        const info = page.imageinfo?.[0], metadata = info?.extmetadata || {}, image = info?.thumburl || info?.url;
        const title = plain(page.title?.replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "));
        const artist = plain(metadata.Artist?.value || metadata.Credit?.value || "Wikimedia Commons contributor").slice(0, 90);
        const license = plain(metadata.LicenseShortName?.value || metadata.UsageTerms?.value || "Open license").slice(0, 50);
        const safetyMetadata = `${title} ${plain(metadata.ImageDescription?.value || "")} ${plain(metadata.Categories?.value || "")} ${plain(metadata.DepictedPeople?.value || "")}`;
        if (!image || !/^image\/(jpeg|png|webp)$/i.test(info?.mime || "") || title.length < 8 || /(?:^|\s)(?:img|dsc|photo|file)?[-_ ]?\d{5,}(?:\s|$)/i.test(title) || isDisallowed({title:safetyMetadata})) return;
        results.push({title, url:`https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`, summary:"", date:null, source:`${artist} · ${license}`, section:"VISUAL SHELF", image, score:78, interestHits:1, noHits:0, personalFit:"editorial", format:"visual", sourcePack:"visual-shelf", sourcePackLabel:`${MIX_LABELS[lane]} visual shelf`, visualShelf:true, visualSubjectLane:lane});
      });
    } catch {}
  }));
  return unique(results).slice(0, count);
}
function isFreshLocal(item) {
  if (!item.date) return true;
  const age = (Date.now() - new Date(item.date)) / 864e5;
  // If a publication has stopped producing fresh material, move laterally to
  // another source in the category instead of recycling its archive forever.
  return age <= (item.sourcePack ? 120 : 45);
}
function isGoodNews(item) {
  const value = `${item.title || ""} ${item.summary || ""}`;
  return /discover|beautiful|love|return|restor|celebrat|rescue|breakthrough|success|wins?\b|record|opens?|reun|reviv|saved?|found/i.test(value) && isJoyful(item);
}
function classifyGeography(item, localPlaces = []) {
  const value = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  const isPlaceList = /\b(best|top|favorite|favourite|guide|where to eat|where to stay|restaurants?|cafes?|coffee shops?|bakeries|donut shops?|things to do)\b[\s\S]{0,90}\b(near|in|around|at)\b/i.test(value);
  if (!isPlaceList) return "neutral";
  if (localPlaces.some(place => place && value.includes(place))) return "local";
  return "wanderlust";
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
const adjacentSignals = {
  "music": ["art", "film", "culture", "audio", "design"],
  "sports": ["fitness", "health", "outdoor", "people"],
  "food": ["travel", "local", "culture", "design"],
  "science": ["nature", "technology", "engineering", "space"],
  "nature": ["outdoor", "animals", "travel", "science"],
  "animals": ["nature", "outdoor", "people"],
  "movies": ["film", "culture", "music", "art"],
  "books": ["ideas", "culture", "history", "art"],
  "business": ["money", "technology", "design", "people"],
  "design": ["art", "architecture", "photography", "style"],
  "travel": ["food", "outdoor", "local", "culture"],
  "gaming": ["technology", "design", "music", "art"],
  "family": ["local", "books", "animals", "outdoor"],
  "health": ["fitness", "sports", "outdoor", "science"]
};
function personalize(item, interests = []) {
  if (!interests.length) return {...item, personalFit:"editorial", personalHits:0};
  const haystack = policyText(`${item.title} ${item.summary} ${item.source} ${item.section} ${item.sourcePackLabel || ""}`);
  const stop = new Set(["things","stories","discoveries","ideas","together","especially","good"]);
  const roots = interests.flatMap(term => String(term).toLowerCase().split(/\s+|\+|\//)).map(word => word.replace(/[^a-z0-9-]/g,"" )).filter(word => word.length > 3 && !stop.has(word));
  const directTerms = [...new Set([...interests, ...roots])];
  const direct = directTerms.filter(term => haystack.includes(policyText(term))).length + Math.min(3, item.sourcePackHits || 0);
  const neighbors = [...new Set(roots.flatMap(root => adjacentSignals[root] || []))];
  const adjacent = neighbors.filter(term => haystack.includes(policyText(term))).length;
  return {...item, score:item.score + Math.min(42, direct * 11) + Math.min(18, adjacent * 4), personalFit:direct ? "direct" : adjacent ? "adjacent" : "editorial", personalHits:direct};
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
const normalizeSource = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const BALANCED_MAGAZINE_RECIPE = [
  "arts",
  "animals",
  "international",
  "kindness",
  "ingenuity",
  "fashion",
  "fashion",
  "music",
  "science",
  "science",
  "travel",
  "travel",
  "food",
  "food",
  "sports",
  "money",
  "technology",
  "home",
  "grabBag",
  "grabBag",
];

const BALANCED_MAGAZINE_COUNTS = {
  arts: 1,
  animals: 1,
  international: 1,
  kindness: 1,
  ingenuity: 1,
  fashion: 2,
  music: 1,
  science: 2,
  travel: 2,
  food: 2,
  sports: 1,
  money: 1,
  technology: 1,
  home: 1,
  grabBag: 2,
};

const MIX_LABELS = {
  arts:"Arts", animals:"Animals", international:"International", kindness:"Human kindness",
  ingenuity:"Human ingenuity", fashion:"Fashion", music:"Music", science:"Science",
  travel:"Travel", food:"Food", sports:"Sports", money:"Money + business",
  technology:"Technology + innovation", home:"Home, gardens + design", grabBag:"Lively grab bag"
};

// Classify the subject, never the presentation format. A photograph of Kyoto
// is travel; a photographed recipe is food; only art-about-art belongs in arts.
function contentLane(item) {
  if (item?.visualSubjectLane) return item.visualSubjectLane;
  const title = `${item?.title || ""} ${item?.summary || ""}`.toLowerCase();
  const section = String(item?.section || "").toLowerCase();
  const pack = String(item?.sourcePack || "").toLowerCase();
  const text = `${title} ${item?.source || ""} ${item?.sourcePackLabel || ""}`.toLowerCase();
  const matches = (pattern) => pattern.test(text);
  if (/fashion-style/.test(pack) && /fashion|designer|style|sneaker|clothing|wear|archive|runway|couture|garment/.test(title)) return "fashion";
  if (/women-culture/.test(pack) && /fashion|style|runway|couture|costume|garment/.test(title)) return "fashion";
  if (/fashion/.test(section)) return "fashion";
  if (/business|finance|money/.test(section)) return "money";
  if (/giving|philanthrop|community foundation|public good/.test(section)) return "kindness";
  if (/making|diy|repair|workshop/.test(section)) return "ingenuity";
  if (/garden/.test(section)) return "home";
  if (/books|history|ideas/.test(section)) return "grabBag";
  if (/music/.test(section)) return "music";
  if (/animals/.test(section)) return "animals";
  if (/people \+ joy/.test(section)) return "kindness";
  if (/people \+ progress/.test(section)) return "ingenuity";
  if (/tech/.test(section)) return "technology";
  if (/sports|fitness/.test(section)) return "sports";
  if (/world/.test(section)) return "international";
  if (/science|nature/.test(section)) return "science";
  if (/food \+ travel/.test(section)) return /food|restaurant|recipe|chef|dining|bakery|coffee|wine|cuisine/.test(title) ? "food" : "travel";
  if (/architecture/.test(section)) return "home";
  if (/art|film|culture/.test(section)) return "arts";
  if (matches(/\b(fashion week|street style|runway|couture|fashion designer|wardrobe|costume design|textile|garment|vogue|menswear|womenswear)\b/)) return "fashion";
  if (matches(/\b(food|restaurant|recipe|cook|chef|dining|bakery|coffee|wine|cocktail|cuisine|ingredient)\b/)) return "food";
  if (matches(/\b(travel|trip|journey|hotel|destination|tourism|vacation|flight|airline|city guide|weekend getaway|road trip)\b/)) return "travel";
  if (matches(/\b(sport|baseball|football|basketball|tennis|soccer|golf|running|cycling|athlete|yankees|twins|giants|wnba|mlb|nfl|nba)/)) return "sports";
  if (matches(/\b(animal|dog|cat|wildlife|bird|pet|rescue|zoo|habitat|species|creature)/)) return "animals";
  if (matches(/\b(music|album|song|singer|band|jazz|record|concert|composer|synth|guitar|piano|orchestra)/)) return "music";
  if (matches(/\b(home|house|interior|garden|diy|renovation|furniture|decor|woodwork|craft|repair)/)) return "home";
  if (matches(/\b(technology|tech|robot|software|hardware|digital|computer|apple|iphone|mac|artificial intelligence|\bai\b)/)) return "technology";
  if (matches(/\b(science|scientist|space|nasa|astronom|physics|biology|chemistry|research|planet|fossil|nature|ecology)/)) return "science";
  if (matches(/\b(money|finance|financial|business|market|invest|economy|company|founder|entrepreneur|small business)/)) return "money";
  if (matches(/\b(kindness|volunteer|philanthrop|donat|charity|community|neighbor|mutual aid|generosity)/)) return "kindness";
  if (matches(/\b(invent|engineer|breakthrough|maker|discovery|create|build|restore|solution|achievement|ingenuity)/)) return "ingenuity";
  if (matches(/\b(international|world|global|europe|asia|africa|paris|london|japan|italy|france|spain|canada|denmark|sweden|greece|india|australia)/)) return "international";
  // Trusted desk metadata wins when the headline itself is ambiguous. This
  // prevents a design publication from impersonating animals, food or fashion
  // because one incidental word appeared in an article summary.
  if (matches(/\b(art|artist|museum|gallery|photograph|architecture|theat(?:er|re)|dance|film|cinema|sculpt|paint)\b/)) return "arts";
  return "grabBag";
}

function personalizedCounts(interests = []) {
  const counts = {...BALANCED_MAGAZINE_COUNTS};
  const signals = interests.map(value => contentLane({title:value})).filter(lane => lane !== "grabBag");
  const boosts = [...new Set(signals)].slice(0, 3);
  boosts.forEach(lane => {
    const desired = Math.min(5, counts[lane] + (boosts.length === 1 ? 3 : 2));
    let needed = desired - counts[lane];
    for (const donor of ["grabBag", "science", "travel", "food", "fashion", "arts", "animals", "international", "kindness", "ingenuity", "music", "sports", "money", "technology", "home"]) {
      if (!needed || donor === lane || boosts.includes(donor)) continue;
      const available = Math.max(0, counts[donor] - 1);
      const moved = Math.min(needed, available);
      counts[donor] -= moved; counts[lane] += moved; needed -= moved;
    }
  });
  return counts;
}

function balancedMagazine(candidates, count, interests = [], random = Math.random) {
  const remaining = unique(candidates).map((item) => ({ ...item, mixLane: contentLane(item) }));
  const selected = [];
  const sourceCounts = new Map();
  const targets = interests.length ? personalizedCounts(interests) : BALANCED_MAGAZINE_COUNTS;
  let visualArtCount = 0;

  for (let position = 0; position < count && remaining.length; position += 1) {
    const blockPosition = position % 20;
    const block = selected.slice(position - blockPosition);
    const blockCounts = Object.fromEntries(Object.keys(targets).map(lane => [lane, block.filter(item => item.mixLane === lane).length]));
    const blockVisualShelfCount = block.filter(item => item.visualShelf).length;
    const blockSourceCount = source => block.filter(item => normalizeSource(item.source) === source).length;
    const recentLanes = selected.slice(-2).map(item => item.mixLane);
    const lane = Object.keys(targets)
      .filter(candidate => !recentLanes.includes(candidate) && remaining.some(item => item.mixLane === candidate))
      .sort((a,b) => (targets[b] - blockCounts[b]) - (targets[a] - blockCounts[a]))[0]
      || Object.keys(targets).find(candidate => remaining.some(item => item.mixLane === candidate))
      || "grabBag";
    const obeysFormatAndSourceCaps = item => blockCounts[item.mixLane] < targets[item.mixLane] && !((item.visualShelf && blockVisualShelfCount >= 2) || blockSourceCount(normalizeSource(item.source)) >= 2);
    const exact = remaining.filter((item) => item.mixLane === lane && obeysFormatAndSourceCaps(item));
    const cappedPool = remaining.filter(obeysFormatAndSourceCaps);
    const eligible = exact.length ? exact : cappedPool.length ? cappedPool : remaining;
    const recentSources = new Set(selected.slice(-4).map((item) => normalizeSource(item.source)));

    const ranked = eligible
      .map((item) => {
        const source = normalizeSource(item.source);
        const isVisualShelf = Boolean(item.visualShelf) || /visual shelf/i.test(item.source || "");
        let score = Number(item.score || 0) + random() * 8;
        if (item.mixLane === lane) score += 45;
        if (item.image) score += 22;
        if (item.personalFit === "direct") score += 25;
        if (item.personalFit === "adjacent") score += 10;
        score -= (sourceCounts.get(source) || 0) * 22;
        if (recentSources.has(source)) score -= 80;
        if (recentLanes.includes(item.mixLane)) score -= 50;
        if (isVisualShelf && item.mixLane === "arts" && visualArtCount >= 2 && position < 20) score -= 10000;
        return { item, score, isVisualShelf };
      })
      .sort((a, b) => b.score - a.score);

    const winner = ranked[0];
    if (!winner) break;
    const index = remaining.indexOf(winner.item);
    remaining.splice(index, 1);
    const source = normalizeSource(winner.item.source);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    if (winner.isVisualShelf && winner.item.mixLane === "arts") visualArtCount += 1;
    selected.push({ ...winner.item, mixLabel:MIX_LABELS[winner.item.mixLane] });
  }

  return selected;
}

// A greedy magazine editor: every choice is judged by how much it improves the
// current page, with diminishing returns for repeated sources/topics/formats.
function compose(candidates, count, seed = {}, random = Math.random) {
  const chosen = [], sourceCounts = {...seed.sources}, topicCounts = {...seed.topics}, formatCounts = {...seed.formats}, geoCounts = {local:0,wanderlust:0}, wanderlustCap = Math.max(1, Math.floor(count * .2));
  const pool = [...candidates];
  const sourceTotal = new Set(pool.map(item => item.source).filter(Boolean)).size;
  const sourceLimit = sourceTotal > 1 ? Math.max(1, Math.ceil(count / sourceTotal) + (count > 20 ? 1 : 0)) : count;
  while (chosen.length < count && pool.length) {
    let winner = 0, best = -Infinity;
    pool.forEach((item, index) => {
      const recent = chosen.slice(-10);
      const sourceAtLimit = (sourceCounts[item.source] || 0) >= sourceLimit && pool.some(other => other.source !== item.source && (sourceCounts[other.source] || 0) < sourceLimit);
      const sourcePenalty = sourceAtLimit ? 10000 : (sourceCounts[item.source] || 0) * 35 + (recent.some(previous => previous.source === item.source) ? 500 : 0);
      const topicPenalty = (topicCounts[item.section] || 0) * 6 + (chosen.slice(-2).some(previous => previous.section === item.section) ? 30 : 0);
      const formatPenalty = (formatCounts[item.format] || 0) * 8;
      // Prefer stories that bring real photography, artwork or video texture.
      // Text-only pieces still make the edition, but must win on substance.
      const visualBonus = item.image ? 22 : -9;
      const serendipityBonus = item.interestHits === 0 && chosen.length > 3 ? 5 : 0;
      const moodBonus = /discover|new|beautiful|guide|best|love|return|release|photo|album/i.test(`${item.title} ${item.summary}`) ? 4 : 0;
      const geographyBonus = item.geoClass === "local" ? 20 : item.geoClass === "wanderlust" ? (geoCounts.wanderlust < wanderlustCap ? 6 : -90) : 0;
      const compositionScore = item.score - sourcePenalty - topicPenalty - formatPenalty + visualBonus + serendipityBonus + moodBonus + geographyBonus + random() * 14;
      if (compositionScore > best) { best = compositionScore; winner = index; }
    });
    const [item] = pool.splice(winner, 1); chosen.push(item);
    sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
    topicCounts[item.section] = (topicCounts[item.section] || 0) + 1;
    formatCounts[item.format] = (formatCounts[item.format] || 0) + 1;
    if (item.geoClass === "local" || item.geoClass === "wanderlust") geoCounts[item.geoClass]++;
  }
  return chosen;
}
function seededRandom(value = "meanwhile") {
  let state = 2166136261;
  for (let index = 0; index < value.length; index++) state = Math.imul(state ^ value.charCodeAt(index), 16777619);
  return () => { state += 0x6D2B79F5; let result = state; result = Math.imul(result ^ result >>> 15, result | 1); result ^= result + Math.imul(result ^ result >>> 7, result | 61); return ((result ^ result >>> 14) >>> 0) / 4294967296; };
}
function activateSourcePacks(interests, packs) {
  if (!interests.length) return [];
  const words = new Set(interests.flatMap(value => String(value).toLowerCase().split(/\s+|\+|\//)).map(value => value.replace(/[^a-z0-9-]/g, "")).filter(value => value.length > 3));
  return packs.map(pack => {
    const hits = pack.signals.reduce((total, signal) => total + (interests.some(interest => interest.includes(signal) || signal.includes(interest)) || words.has(signal) ? 1 : 0), 0);
    return {...pack, hits};
  }).filter(pack => pack.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 4);
}

async function sharedVideoSources() {
  const fallback = load("video-sources.json"), url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return fallback;
  try { const response = await fetch(url, {method:"POST", headers:{authorization:`Bearer ${token}`,"content-type":"application/json"}, body:JSON.stringify(["GET","betterstart:sources"]), cache:"no-store"}); const value = (await response.json()).result; return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
async function loadReaderVideos(avoid = new Set()) {
  const videoSources = await sharedVideoSources();
  const results = await Promise.allSettled(videoSources.map(async source => {
    const url = source.type === "playlist" ? `https://www.youtube.com/feeds/videos.xml?playlist_id=${source.id}` : `https://www.youtube.com/feeds/videos.xml?channel_id=${source.id}`;
    const feed = await parser.parseURL(url);
    return (feed.items || []).slice(0, 12).map(item => { const videoId = item.id?.split(":").pop() || item.link?.match(/[?&]v=([^&]+)/)?.[1]; return {title:plain(item.title),url:item.link,summary:"",date:item.isoDate||item.pubDate||null,source:source.name,section:source.category === "music" ? "MUSIC" : source.category === "art" ? "ART + DESIGN" : source.category === "animals" ? "ANIMALS + JOY" : "PEOPLE + JOY",image:videoId?`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`:null,score:70,interestHits:3,noHits:0,videoId,format:"video"}; });
  }));
  const items=[]; results.forEach(result=>{if(result.status==="fulfilled")items.push(...result.value);});
  return unique(items.filter(item=>item.videoId&&!avoid.has(item.videoId)&&!isDisallowed(item)));
}

export async function GET(request) {
  const params = new URL(request.url).searchParams, random = seededRandom(params.get("visit") || String(Math.floor(Date.now() / 72e5))), avoidVideos = new Set((params.get("avoid") || "").split(",").filter(Boolean)), avoidStories = new Set((params.get("avoidStories") || "").split(",").filter(Boolean)), localPlaces = (params.get("places") || "").split("|").map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 20), interests = (params.get("interests") || "").split("|").map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 48);
  const taste = load("taste.json"), baseSources = load("sources.json"), packCatalog = load("source-packs.json"), activePacks = activateSourcePacks(interests, packCatalog), editorialIdentity = detectEditorialIdentity(interests, activePacks), specialistSources = activePacks.flatMap(pack => pack.sources.map(source => ({...source, pack:pack.id, packLabel:pack.label, packHits:pack.hits})));
  // The generic magazine needs real reporting inventory for every desk. Two
  // carefully chosen feeds from each under-supplied source pack provide that
  // breadth without activating a personalized editorial identity.
  const genericPackIds = new Set(["sports","business-culture","fashion-style","making-garden","food-travel","science-tech","philanthropy-community"]);
  const genericSources = interests.length ? [] : packCatalog.filter(pack => genericPackIds.has(pack.id)).flatMap(pack => pack.sources.slice(0, 2).map(source => ({...source, pack:pack.id, packLabel:pack.label, packHits:0})));
  const sources = unique([...baseSources, ...genericSources, ...specialistSources].map(source => ({...source,title:source.name,summary:""}))).map(({canonicalUrl,normalizedTitle,title,summary,...source}) => source);
  const results = await Promise.allSettled(sources.map(async source => {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).slice(0, 40).map((item, index) => {
      const scored = score(item, source, taste);
      const story = {title: plain(item.title) || "Untitled", url: item.link || "#", summary: plain(item.contentSnippet || item.content || ""), date: item.isoDate || item.pubDate || null, source: source.name, section: source.section, image: imageFor(item), sourcePack:source.pack || null, sourcePackLabel:source.packLabel || null, sourcePackHits:source.packHits || 0, ...scored, score:scored.score + (source.pack ? 18 + Math.min(24, (source.packHits || 0) * 4) : 0)};
      return {...story, geoClass: classifyGeography(story, localPlaces), format: formatFor(story, index)};
    });
  }));
  let all = [];
  results.forEach(result => { if (result.status === "fulfilled") all.push(...result.value); });
  all = unique(all.filter(item => item.score > 18 && !isDisallowed(item) && !wasRecentlyShown(item, avoidStories) && contextAllowed(item, editorialIdentity) && (isJoyful(item) || (item.sourcePack && isSpecialistWorthwhile(item))) && isFreshLocal(item)).map(item => personalize(item, interests)).sort((a, b) => b.score - a.score));
  all = await enrichIdentityImages(all, editorialIdentity);

  // One shared registry across every page region makes duplicates impossible.
  const usedUrls = new Set(), usedTitles = new Set();
  const claim = items => items.filter(item => {
    const url = canonicalUrl(item.url), title = normalizeTitle(item.title);
    if (usedUrls.has(url) || usedTitles.has(title)) return false;
    usedUrls.add(url); usedTitles.add(title); return true;
  });
  const brightPool = all.filter(item => /PEOPLE|ANIMALS|PROGRESS|AROUND AMERICA/.test(item.section) || isGoodNews(item));
  const tickerStories = claim(compose(brightPool, 8, {}, random));
  const ribbonFavorite = tickerStories[0] || null;
  const favoriteSelection = claim(compose(brightPool.filter(item => !usedUrls.has(canonicalUrl(item.url))), 6, {}, random));
  const goodNews = claim(compose(all.filter(isGoodNews), 1, {}, random))[0] || null;
  const videoPool = (await loadReaderVideos(avoidVideos)).filter(item => !wasRecentlyShown(item, avoidStories)).map(item => personalize(item, interests));
  const fashionFocus = editorialIdentity.id === "fashion";
  const focusMediaSignal = /fashion|runway|couture|designer|costume|wardrobe|atelier|supermodel|vogue|editorial photography|fashion photography|style archive|fashion week|women.?s tennis|wnba|author interview|novelist|book club/i;
  const relevantMedia = videoPool.filter(item => item.personalFit !== "editorial" && (!fashionFocus || focusMediaSignal.test(`${item.title} ${item.summary} ${item.section}`)));
  // A strongly signaled fashion/women's edition never gets padded with
  // unrelated generic videos just because those thumbnails are available.
  const mediaPool = fashionFocus ? relevantMedia : [...relevantMedia, ...videoPool.filter(item => item.personalFit === "editorial").slice(0, 5)];
  // Playable media competes for the same subject slots as every other story.
  // Keeping it in a separate stream would quietly turn format into category.
  const mediaCandidates = compose(mediaPool, 24, {}, random);
  const media = [];
  const importantPool = all.filter(item => ["NASA", "Guardian Science", "Science Breakthroughs", "Technology for Good", "Nature Restored"].includes(item.source));
  const important = claim(compose(importantPool, 3, {}, random));
  if (important.length < 3) {
    const backfillPool = all.filter(item => (!usedUrls.has(canonicalUrl(item.url)) && !usedTitles.has(normalizeTitle(item.title))) && /SCIENCE|NATURE|TECH|PROGRESS|PEOPLE|ANIMALS|OUTDOOR/i.test(item.section || ""));
    important.push(...claim(compose(backfillPool, 3 - important.length, {}, random)));
  }
  // Reserve a deep, fresh surprise shelf before the main gallery claims the
  // remaining pool. This keeps serendipity available without weakening the
  // page-wide URL/title dedupe or the cross-visit freshness rules.
  const unusedStories = () => all.filter(item =>
    !usedUrls.has(canonicalUrl(item.url)) &&
    !usedTitles.has(normalizeTitle(item.title))
  );
  const serendipity = [];
  const reserveSerendipity = pool => {
    if (serendipity.length >= 60) return;
    serendipity.push(...claim(compose(pool, 60 - serendipity.length, {}, random)));
  };
  const galleryPool = [...all.filter(item => !usedUrls.has(canonicalUrl(item.url)) && !usedTitles.has(normalizeTitle(item.title))), ...mediaCandidates];
  // Standalone photography enters the same subject-aware selection pool. Its
  // topic is inferred from its subject; only genuinely art-led work counts as arts.
  const allVisualShelf = (await loadVisualShelf(editorialIdentity)).filter(item => !wasRecentlyShown(item, avoidStories));
  const magazinePool = [...galleryPool, ...allVisualShelf.slice(0, 56)];
  const selectedMagazine = balancedMagazine(magazinePool, 140, interests, random);
  // Preserve the editor's 20-story windows. The client may arrange cards
  // inside each ten-card layout cluster, but no visual pass can import a later
  // story and silently alter the opening subject mix.
  const gallery = claim(selectedMagazine);
  const galleryKeys = new Set(gallery.map(item => canonicalUrl(item.url)));
  const visualReserve = allVisualShelf.slice(56).filter(item => !galleryKeys.has(canonicalUrl(item.url))).slice(0, 24).map(item => ({...item, canonicalUrl:canonicalUrl(item.url)}));
  // Serendipity is composed from what remains after the primary magazine. It
  // must never starve Good Stuff and trigger a wall of visual-shelf backfill.
  reserveSerendipity(unusedStories().filter(item => item.noHits === 0 || item.personalFit === "editorial"));
  reserveSerendipity(unusedStories().filter(item => item.personalFit === "adjacent"));
  reserveSerendipity(unusedStories());
  const targetCounts = interests.length ? personalizedCounts(interests) : BALANCED_MAGAZINE_COUNTS;
  const actualCounts = Object.fromEntries(Object.keys(BALANCED_MAGAZINE_COUNTS).map(lane => [lane, gallery.slice(0, 20).filter(item => item.mixLane === lane).length]));
  return Response.json({generatedAt: new Date().toISOString(), edition: Math.floor(Date.now() / 72e5), personalized:!!interests.length, editorialIdentity:{id:editorialIdentity.id,label:editorialIdentity.label,accent:editorialIdentity.accent,references:editorialIdentity.references,imageTarget:editorialIdentity.imageTarget}, composition:{window:20,targetCounts,actualCounts,labels:MIX_LABELS}, activeSourcePacks:activePacks.map(pack => ({id:pack.id,label:pack.label,hits:pack.hits})), tickerStories, ribbonFavorite, goodNews, favorites: favoriteSelection, media, gallery, visualReserve, important, serendipity, sourceStatus: {total: sources.length, specialist:specialistSources.length, successful: results.filter(result => result.status === "fulfilled").length}}, {headers: {"Cache-Control": "no-store"}});
}
