import Parser from "rss-parser";
import fs from "fs";
import path from "path";

const parser = new Parser({
  // Publisher feeds are assembled in parallel and this runs behind the
  // preloaded first shelf. A single unhealthy source must never hold the
  // background bench open for nine seconds; the next rotating run can retry.
  timeout: 4000,
  headers: {"User-Agent": "BetterStart/2.0"},
  customFields: {item: [["media:content", "mediaContent"], ["media:thumbnail", "mediaThumbnail"]]}
});
const sourceFeedCache = new Map();
const storyImageCache = new Map();
const SOURCE_CACHE_MS = 10 * 60 * 1000;
const IMAGE_CACHE_MS = 30 * 60 * 1000;
async function parseSourceCached(source) {
  const prior = sourceFeedCache.get(source.url);
  if (prior && prior.expires > Date.now()) return prior.promise;
  const promise = parser.parseURL(source.url).catch(error => { sourceFeedCache.delete(source.url); throw error; });
  sourceFeedCache.set(source.url, {expires:Date.now() + SOURCE_CACHE_MS,promise});
  return promise;
}
const dataPath = name => path.join(process.cwd(), "data", name);
const load = name => JSON.parse(fs.readFileSync(dataPath(name), "utf8"));
const blockedTerms = Object.values(load("content-policy.json")).flat();
const policyText = value => ` ${String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
const stableHash = value => { let hash = 2166136261; for (const char of String(value || "")) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); };
const publicSpaceUnsafe = /\b(porn(?:ography|ographic)?|nsfw|nud(?:e|ity)|naked|topless|full[- ]?frontal|genitals?|penis|vulva|vagina|erotic(?:a)?|sexually explicit|adult content|figure stud(?:y|ies)|boudoir)\b/i;
const suggestiveFashionUnsafe = /\b(miami (?:fashion|swim) week|miami nightlife|swim week|bikini(?:s)?|micro[- ]?bikini|thong(?:s)?|lingerie|underwear runway|swimwear runway|see[- ]?through (?:dress|fashion|outfit)|sheer (?:dress|fashion|outfit))\b/i;
// Absolute editorial exclusions: these never enter the candidate pool.
const bannedSource = item => /(?:\b(?:nyt|new york times|espn)\b|(?:^|\.)(?:nytimes|espn)\.com\b)/i.test(`${item?.source || ""} ${item?.publisher || ""} ${item?.url || ""} ${item?.canonicalUrl || ""}`);
const routineSportsUnsafe = /\b(?:final score|box score|standings|power rankings?|depth chart|starting lineup|roster move|trade(?:d|s)?|free agen(?:t|cy)|draft pick|mock draft|signs? (?:a |with )|contract extension|waiver|injury report|quarterback|wide receiver|running back|head coach|playoffs? odds|game recap|match recap|season opener|transfer portal)\b/i;
const sportsSignal = /\b(?:sports?|athlete|team|baseball|football|basketball|soccer|tennis|golf|running|cycling|wnba|mlb|nfl|nba|nhl)\b/i;
const humanInterestSignal = /\b(?:community|neighbor|volunteer|mentor|teacher|student|youth|amateur|local|family|friendship|kindness|helps?|giving|donat|rescue|adopt|animal|dog|music|culture|artist|maker|craft|profile|human interest|inspir|uplift|persever|comeback|overcame|accessible|inclusion|scholarship|nonprofit|grassroots|tradition|legacy|celebrat|reunited|dream)\b/i;
const humanInterestSports = item => {
  const value = `${item?.title || ""} ${item?.summary || ""} ${item?.contentSnippet || ""}`;
  return sportsSignal.test(value) && humanInterestSignal.test(value) && !routineSportsUnsafe.test(value);
};
const mainstreamPublisher = /\b(?:associated press|ap news|reuters|cnn|fox news|msnbc|nbc news|cbs news|abc news|usa today|washington post|wall street journal|bloomberg|time magazine|newsweek|forbes|business insider|guardian|bbc|npr|vox|new york post|daily mail|huffpost|yahoo|people magazine|sports illustrated|the athletic|hearst|conde nast|gannett)\b/i;
const publisherName = (item, source = {}) => {
  const embedded = typeof item?.source === "string" ? item.source : item?.source?._ || item?.source?.value || item?.source?.title;
  return plain(embedded || source.name || "Unknown publisher");
};
const isIndependentPublisher = (publisher, source = {}) => {
  const value = `${publisher || ""} ${source.name || ""} ${source.url || ""}`;
  return !mainstreamPublisher.test(value) && !bannedSource({source:value});
};
const religionUnsafe = /\b(?:religion|religious|faith(?:ful)?|christian(?:ity)?|catholic(?:ism)?|protestant(?:ism)?|evangelical(?:ism)?|jewish|judaism|muslim|islam(?:ic)?|hindu(?:ism)?|buddhis(?:m|t)|sikh(?:ism)?|mormon(?:ism)?|latter[- ]day saints?|church|cathedral|chapel|synagogue|mosque|bible|biblical|torah|talmud|quran|koran|scripture|gospel|theology|theological|clergy|cleric|priest|pastor|pope|papal|vatican|rabbi|imam|monk|nun|worship|sermon|congregation|parish|diocese|god|jesus|christ|messiah|allah|yahweh|religious nationalism|christian nationalism|zionis(?:m|t)|antisemiti(?:c|sm)|islamophobi(?:a|c))\b/i;
const editoriallyExcluded = /\b(pickleball|tesla|cybertruck|elon musk|mark zuckerberg|meta platforms?|marvel cinematic|gordon ramsay|guy fieri|wall street|stock market|james patterson|young adult fiction|horror film|horror novel|hunting)\b/i;
// Confirmed archive repeats stay retired even for readers whose older browser
// history predates the permanent story ledger.
const retiredRepeat = /\b(?:james hetfield.*metallica|cis football (?:field|locations?)|runway magazine covers? celebrating 25th anniversary|rocky horror.*mad scientist|chanel iman.*runway.*2009|not all boredom is the same|lush foliage permeates xanthe burdett)\b/i;
// Meanwhile is a politics-free publication. This deliberately excludes the
// office and institution, not merely partisan vocabulary: a culture, travel,
// style or arts story about a political figure is still a political story.
const politicsUnsafe = /\b(?:trump|maga|maha|mar[- ]a[- ]lago|white house|oval office|first lady|first gentleman|president(?:ial)?|vice president|administration|cabinet|secretary of (?:state|defense|transportation|commerce|education|energy|labor|homeland security|health and human services|the interior|agriculture|the treasury|veterans affairs)|transportation secretary|state department|department of (?:state|defense|justice|transportation|commerce|education|energy|labor|homeland security)|pentagon|congress|congressional|senate|senator|house of representatives|representative|congressman|congresswoman|speaker of the house|supreme court|governor|lieutenant governor|mayor|prime minister|parliament|member of parliament|politician|political|republican|democrat|gop|campaign|election|ballot|rally|executive order|sean duffy|zohran mamdani|mamdani|benjamin netanyahu|netanyahu|israel(?:i)?|palestin(?:e|ian)|gaza|west bank|middle east conflict|christian nationalism|white nationalism|nationalis(?:m|t)|religious right|religious left|culture war|culture[- ]war|conservative|liberal|left[- ]wing|right[- ]wing|partisan|ideology|ideological|activis(?:m|t)|advocacy|protest|legislation|legislature|policy debate|government|federal agency|immigration|abortion|gun rights?|gun control|book ban|school board|voting rights?|civil rights legislation|geopolitic|diploma(?:cy|tic)|sanctions?)\b/i;
// Final zero-tolerance gate. These subjects never enter Meanwhile, even when
// presented as culture, personality, history, community or human interest.
const politicsReligionZeroTolerance = /\b(?:politics?|political figures?|politicians?|elected officials?|public officials?|government officials?|officeholders?|candidates?|republicans?|democrats?|gop|conservatives?|liberals?|presidents?|prime ministers?|governors?|mayors?|senators?|representatives?|congress(?:ional)?|parliament(?:arian)?|campaigns?|elections?|ballots?|zohran mamdani|mamdani|benjamin netanyahu|netanyahu|israel(?:i)?|palestin(?:e|ian)|gaza|west bank|hamas|hezbollah|idf|religions?|religious figures?|religious leaders?|christians?|christianity|jews?|jewish|judaism|muslims?|islam(?:ic)?|catholics?|catholicism|protestants?|protestantism|evangelicals?|evangelicalism|hindus?|hinduism|buddhists?|buddhism|sikhs?|sikhism|mormons?|churches?|synagogues?|mosques?|temples?|clergy|clerics?|priests?|pastors?|popes?|papal|vatican|rabbis?|imams?|monks?|nuns?|worship|sermons?|theology|faith)\b/i;
// This publication has a literal zero-politics contract. Include the language
// of civic institutions and influence campaigns, not merely party names.
const civicUnsafe = /(?:\b(?:politics?|politicians?|elected officials?|public officials?|government officials?|officeholders?|candidates?|pols?|u\.?s\.? sen\.?|sen\.|lobby(?:ing|ist|ists)?|state legislative|legislative|legislative aims?|legislatures?|lawmakers?|city council|county council|municipal council|councils?|councilmembers?|councillors?|commissioners?|public safety|public policy|regulators?|regulations?|regulatory|ministries?|ministers?|governance|public administration|statehouse|city hall|capitol|clean energy law|bipartisan|appropriations?|taxpayer|constituents?|courts?|judges?|attorneys? general|district attorneys?|prosecutors?|state agencies?|department of human services|fiscal transparency)\b|\b(?:pol[ií]tica|pol[ií]tico|gobierno|governo|candidatos?|senador(?:a)?|seguran[cç]a p[uú]blica|seguridad p[uú]blica|gouvernement|politique|ministre|d[eé]put[eé]|parlement|regierung|politik)\b)/i;
const civicPublisherUnsafe = /^(?:alabama reflector|alaska beacon|arizona mirror|calmatters|san jos[eé] spotlight|colorado newsline|ct examiner|connecticut mirror|honolulu civil beat|iowa capital dispatch|kansas reflector|the beacon kansas city|the maine monitor|maryland matters|commonwealth beacon|minnesota reformer|nebraska examiner|nevada current|new jersey monitor|source new mexico|north carolina newsline|north dakota monitor|rhode island current|texas tribune|el paso matters|utah news dispatch|mountain state spotlight|wisconsin examiner|dublin inquirer|streetsblog nyc|mission local|voice of san diego|florida phoenix|georgia recorder|idaho capital sun|indiana capital chronicle|kentucky lantern|louisiana illuminator|michigan advance|missouri independent|new hampshire bulletin|ohio capital journal|oklahoma voice|oklahoma watch|oregon capital chronicle|pennsylvania capital-star|virginia mercury|washington state standard|west virginia watch|wisconsin watch)$/i;
// The reader explicitly wants the Musk/Zuckerberg/Bezos corporate universe
// absent, including company and product names even in otherwise upbeat copy.
const barredTechEmpire = /\b(?:mark zuckerberg|zuckerberg|elon musk|musk|jeff bezos|bezos|meta(?: platforms?)?|facebook|instagram|threads|whatsapp|twitter|tweet(?:s|ed|ing)?|amazon|tesla|cybertruck|spacex|starlink|blue origin)\b|(?:^|[\s./])x\.com(?:[\s/?#]|$)/i;
// Topics that become culture-war coverage when paired with schools, children,
// libraries or curriculum are excluded regardless of the position taken.
const educationCultureWarUnsafe = /(?:\b(?:lgbtq?|transgender|gender identity|drag queen|pride)\b.{0,90}\b(?:child(?:ren)?|kids?|school|classroom|curriculum|education|library|books?|reading hour)\b|\b(?:child(?:ren)?|kids?|school|classroom|curriculum|education|library|books?|reading hour)\b.{0,90}\b(?:lgbtq?|transgender|gender identity|drag queen|pride)\b)/i;

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
function titleFingerprint(value = "") {
  return normalizeTitle(value).split(/\s+/).filter(word => word.length > 2).slice(0, 9).join(" ");
}
function titleFamily(value = "") {
  return [...new Set(normalizeTitle(value).split(/\s+/).filter(word => word.length > 3))].sort().slice(0, 14).join(" ");
}
function contentFingerprint(item = {}) {
  return normalizeTitle(`${item.title || ""} ${item.summary || item.contentSnippet || ""}`).split(/\s+/).filter(word => word.length > 2).slice(0, 24).join(" ");
}
function commonsAssetKey(item = {}) {
  const value = `${item.url || ""} ${item.image || ""}`;
  const match = value.match(/(?:File:|File%3A|\/)([^/?#]+?\.(?:jpe?g|png|webp|gif|tiff?))(?:[/?#]|$)/i);
  if (!match) return "";
  try { return `commons:${decodeURIComponent(match[1]).toLowerCase().replace(/[_\s]+/g, "-")}`; } catch { return `commons:${match[1].toLowerCase()}`; }
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
  ].filter(Boolean).map(url => String(url)
    .replace(/&amp;|&#0*38;/gi, "&")
    .replace(/^http:\/\//i, "https://"));
  return candidates.find(url => !/pixel|spacer|tracking|1x1|blank\.(gif|png)|favicon|avatar|default[-_ ]?image|site[-_ ]?logo|brandmark|lh3\.googleusercontent\.com\/J6_coFbogx/i.test(url)) || null;
}
function itemText(item) { return `${item.title || ""} ${item.contentSnippet || ""} ${item.content || ""}`.toLowerCase(); }
function isDisallowed(item) {
  const value = policyText(`${item.title || ""} ${item.summary || ""} ${item.contentSnippet || ""} ${item.source || ""} ${item.section || ""}`);
  const raw = `${item.title || ""} ${item.summary || ""} ${item.contentSnippet || ""} ${item.source || ""} ${item.section || ""} ${item.url || ""}`;
  const routineSports = sportsSignal.test(raw) && (!humanInterestSports(item) || routineSportsUnsafe.test(raw));
  return bannedSource(item) || routineSports || politicsReligionZeroTolerance.test(raw) || barredTechEmpire.test(raw) || civicUnsafe.test(raw) || retiredRepeat.test(raw) || politicsUnsafe.test(raw) || religionUnsafe.test(raw) || educationCultureWarUnsafe.test(raw) || editoriallyExcluded.test(raw) || bodyAnxiety.test(raw) || publicSpaceUnsafe.test(raw) || suggestiveFashionUnsafe.test(raw) || blockedTerms.some(term => value.includes(policyText(term)));
}
function wasRecentlyShown(item, avoidStories) {
  if (!avoidStories?.size) return false;
  const topic = titleFingerprint(item.title), family = titleFamily(item.title), content = contentFingerprint(item), asset = commonsAssetKey(item);
  return [canonicalUrl(item.url), `url:${canonicalUrl(item.url)}`, normalizeTitle(item.title), `title:${normalizeTitle(item.title)}`, topic && `topic:${topic}`, family && `family:${family}`, content && `content:${content}`, asset, item.image, `image:${item.image || ""}`, item.videoId, `video:${item.videoId || ""}`].filter(Boolean).some(value => avoidStories.has(stableHash(value)));
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
  return /profile|interview|explainer|guide|design|history|archive|craft|studio|maker|founder|leader|company|business|market|finance|style|fashion|couture|runway|atelier|collection|costume|wardrobe|beauty|cosmetic|photographer|photography|painting|drawing|illustration|artist|gallery|exhibition|supermodel|book|author|novelist|library|museum|yoga|pilates|movement|wellness|fitness|running|garden|plant|workshop|repair|restor|car|automotive|boat|sail|maritime|train|aviation|team|player|wnba|baseball|tennis|football|soccer/i.test(value) && !hasBadMood(value);
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
  return ranked[0] || {id:"general", label:"Meanwhile", references:[], accent:"classic", imageTarget:.80, score:0};
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
  const target = requestedTarget ?? Math.ceil(count * Math.max(.8, identity.imageTarget || 0));
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
  if (item.image || item.noImageEnrichment || !item.url || item.url === "#") return item;
  const prior = storyImageCache.get(item.url);
  if (prior && prior.expires > Date.now()) return prior.image ? {...item,image:prior.image,format:"visual",imageEnriched:true} : item;
  try {
    const response = await fetch(item.url, {redirect:"follow", headers:{"User-Agent":"Mozilla/5.0 BetterStart/5.0"}, signal:AbortSignal.timeout(1800)});
    if (!response.ok) return item;
    const html = await response.text();
    const image = html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i)?.[1]
      || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i)?.[1];
    const usableImage = image?.replace(/&amp;|&#0*38;/gi, "&").replace(/^http:\/\//i, "https://");
    const usable = usableImage && /^https:/i.test(usableImage) && !/lh3\.googleusercontent\.com\/J6_coFbogx|news\.google\.com|favicon|avatar|default[-_ ]?image|site[-_ ]?logo|brandmark/i.test(usableImage) ? usableImage : null;
    storyImageCache.set(item.url, {expires:Date.now() + IMAGE_CACHE_MS,image:usable});
    return usable ? {...item,image:usable,format:"visual",imageEnriched:true} : item;
  } catch { storyImageCache.set(item.url, {expires:Date.now() + 5 * 60 * 1000,image:null}); return item; }
}
async function enrichIdentityImages(items, identity) {
  // Image availability is a composition requirement, not a nice-to-have.
  // Try the most relevant stories first, then adjacent/editorial stories. This
  // keeps visual coverage high without attaching an unrelated photograph to a
  // text story.
  const candidates = items.filter(item => !item.image).sort((a, b) => {
    const relevance = item => (isIdentityStory(item, identity) ? 3 : 0) + (item.personalFit === "direct" ? 2 : item.personalFit === "adjacent" ? 1 : 0);
    const directPublisherPage = item => /news\.google\.com/i.test(item.url || "") ? 0 : 4;
    return directPublisherPage(b) - directPublisherPage(a) || relevance(b) - relevance(a) || b.score - a.score;
  }).slice(0, 200);
  if (!candidates.length) return items;
  const enriched = [];
  // Small batches avoid hammering publishers while still checking enough
  // source pages to build a genuinely visual edition.
  enriched.push(...await Promise.all(candidates.map(enrichStoryImage)));
  const byUrl = new Map(enriched.map(item => [item.url, item]));
  return items.map(item => byUrl.get(item.url) || item);
}

function distributeVisuals(items, identity, blockSize = 10) {
  const arranged = [...items];
  const targetFor = start => Math.min(
    blockSize,
    Math.ceil(Math.min(blockSize, arranged.length - start) * Math.max(.8, identity.imageTarget || 0))
  );
  for (let start = 0; start < arranged.length; start += blockSize) {
    const end = Math.min(arranged.length, start + blockSize), target = targetFor(start);
    let count = arranged.slice(start, end).filter(item => item.image).length;
    while (count < target) {
      const textIndex = arranged.slice(start, end).map((item, offset) => ({item, index:start + offset})).reverse().find(entry => !entry.item.image)?.index;
      const block = arranged.slice(start, end), visualSourceCount = source => block.filter(item => item.image && normalizeSource(item.source) === source).length;
      const visualLaneCount = lane => block.filter(item => item.image && (item.mixLane || contentLane(item)) === lane).length;
      const eligibleVisual = (item, index) => {
        if (index < end || !item.image) return false;
        const source = normalizeSource(item.source), lane = item.mixLane || contentLane(item);
        return visualSourceCount(source) < 2 && visualLaneCount(lane) < 2;
      };
      let visualIndex = arranged.findIndex((item, index) => eligibleVisual(item, index) && isIdentityStory(item, identity));
      if (visualIndex < 0) visualIndex = arranged.findIndex(eligibleVisual);
      if (textIndex === undefined || visualIndex < 0) break;
      [arranged[textIndex], arranged[visualIndex]] = [arranged[visualIndex], arranged[textIndex]];
      count++;
    }
  }
  return arranged;
}

function composeVisualWindows(items, identity, count = 140, blockSize = 20) {
  const pool = unique(items).map((item, priority) => ({
    ...item,
    mixLane:item.mixLane || contentLane(item),
    mixLabel:item.mixLabel || MIX_LABELS[item.mixLane || contentLane(item)],
    _visualPriority:priority
  }));
  const result = [];
  const globallyLimitedCounts = new Map();
  const globallyAllowed = item => {
    const source = normalizeSource(item.source);
    return !/^(?:nasa|jstor daily|colossal)$/.test(source) || (globallyLimitedCounts.get(source) || 0) < 1;
  };
  const takeBest = predicate => {
    const choices = pool.filter(predicate).sort((a, b) => a._visualPriority - b._visualPriority);
    const winner = choices[0];
    if (!winner) return null;
    pool.splice(pool.indexOf(winner), 1);
    const source = normalizeSource(winner.source);
    if (/^(?:nasa|jstor daily|colossal)$/.test(source)) globallyLimitedCounts.set(source, (globallyLimitedCounts.get(source) || 0) + 1);
    const {_visualPriority, ...story} = winner;
    return story;
  };
  while (result.length < count && pool.length) {
    const block = [], target = Math.ceil(Math.min(blockSize, count - result.length) * Math.max(.8, identity.imageTarget || 0));
    const sourceCount = source => block.filter(item => normalizeSource(item.source) === source).length;
    const laneCount = lane => block.filter(item => item.mixLane === lane).length;
    const chooseVisual = (sourceCap, laneCap) => takeBest(item =>
      (item.image || item.videoId) && globallyAllowed(item)
      && sourceCount(normalizeSource(item.source)) < sourceCap
      && laneCount(item.mixLane) < laneCap
    );
    while (block.filter(item => item.image || item.videoId).length < target) {
      const winner = chooseVisual(2, 2) || chooseVisual(2, 3) || chooseVisual(3, 3);
      if (!winner) break;
      block.push(winner);
    }
    while (block.length < Math.min(blockSize, count - result.length) && pool.length) {
      const winner = takeBest(item => globallyAllowed(item)
        && sourceCount(normalizeSource(item.source)) < 2
        && laneCount(item.mixLane) < 3)
        || takeBest(item => globallyAllowed(item) && sourceCount(normalizeSource(item.source)) < 3)
        || takeBest(globallyAllowed);
      if (!winner) break;
      block.push(winner);
    }
    result.push(...block);
  }
  return result;
}

function enforceVisualShare(items, target = .80, minimum = 100) {
  const visuals = items.filter(item => item.image || item.videoId);
  if (!visuals.length || visuals.length / items.length >= target) return items;
  const textAllowance = Math.floor(visuals.length * (1 - target) / target);
  let textCount = 0;
  return items.filter(item => {
    if (item.image || item.videoId) return true;
    if (textCount >= textAllowance) return false;
    textCount++; return true;
  });
}

// Last gate before serialization. Earlier editors may rank and backfill, but
// this contract cannot be relaxed by a later “make it 100” operation.
function enforceFinalMagazineContract(items, count = 100) {
  const pool = unique(items).map(item => ({...item, mixLane:item.mixLane || contentLane(item)}));
  const result = [], sourceCounts = new Map(), laneCounts = new Map();
  const canTake = (item, visualOnly = false) => {
    const source = normalizeSource(item.source), lane = item.mixLane;
    const block = result.slice(result.length - result.length % 20);
    const special = /^(?:nasa|jstor daily|colossal)$/.test(source);
    if (visualOnly && !(item.image || item.videoId)) return false;
    if ((sourceCounts.get(source) || 0) >= (special ? 1 : 8)) return false;
    if ((laneCounts.get(lane) || 0) >= 10) return false;
    if (block.filter(entry => normalizeSource(entry.source) === source).length >= 2) return false;
    if (block.filter(entry => entry.mixLane === lane).length >= 3) return false;
    return true;
  };
  const take = visualOnly => {
    const candidates = pool.filter(item => canTake(item, visualOnly));
    if (!candidates.length) return false;
    candidates.sort((a, b) => {
      const rarity = item => (sourceCounts.get(normalizeSource(item.source)) || 0) * 8 + (laneCounts.get(item.mixLane) || 0) * 5;
      return rarity(a) - rarity(b) || Number(Boolean(b.humanInterest)) - Number(Boolean(a.humanInterest)) || Number(b.score || 0) - Number(a.score || 0);
    });
    const winner = candidates[0], source = normalizeSource(winner.source), lane = winner.mixLane;
    pool.splice(pool.indexOf(winner), 1); result.push(winner);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    laneCounts.set(lane, (laneCounts.get(lane) || 0) + 1);
    return true;
  };
  while (result.length < count && pool.length) {
    const blockStart = result.length - result.length % 20;
    const blockTarget = Math.min(20, count - blockStart);
    const blockVisualTarget = Math.ceil(blockTarget * .8);
    while (result.length - blockStart < blockVisualTarget && take(true)) {}
    if (!take(false)) break;
  }
  return enforceVisualShare(result, .80);
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
    {query:"haute couture runway",lane:"fashion"},{query:"wildlife in natural habitat",lane:"outdoors"},
    {query:"international street life",lane:"surprise"},{query:"community volunteers helping",lane:"surprise"},
    {query:"inventor maker workshop",lane:"crafts"},{query:"live music performance",lane:"music"},
    {query:"astronomy observatory science",lane:"thinking"},{query:"beautiful travel destination",lane:"travel"},
    {query:"regional food market",lane:"food"},{query:"community sports competition",lane:"sports"},
    {query:"independent small business",lane:"business"},{query:"helpful robotics technology",lane:"tech"},
    {query:"home garden design",lane:"gardening"},{query:"everyday curiosity collection",lane:"trivia"},
    {query:"museum exhibition artwork",lane:"arts"}
  ]
};
const visualQueryVariants = {
  fashion:["haute couture runway 1990s","Paris couture runway","New York fashion week runway","fashion runway archive","couture collection catwalk","fashion designer atelier"],
  arts:["museum exhibition installation","public art sculpture","artist studio painting","theatre stage performance","contemporary craft exhibition","museum restoration artwork"],
  animals:["wildlife natural habitat","birds in natural habitat","ocean wildlife conservation","animal rescue sanctuary"],
  international:["international street market","everyday life world cities","community festival international","historic neighborhood street life"]
};
function variedVisualSearches(identity) {
  const rotation = Math.floor(Date.now() / 72e5), searches = visualSearches[identity.id] || visualSearches.general;
  return searches.map((search, index) => {
    const variants = visualQueryVariants[search.lane];
    return variants?.length ? {...search, query:variants[(rotation + index * 3) % variants.length]} : search;
  });
}
async function loadVisualShelf(identity, count = 80) {
  const searches = variedVisualSearches(identity), results = [];
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
  // NYT's desk feeds keep older entries available longer than this product's
  // live-feed promise permits, so they receive a deliberately tighter window.
  if (/^nyt\b/i.test(item.source || "")) return age <= 1.5;
  if (/^jstor daily$/i.test(item.source || "")) return age <= 3;
  if (/^nasa$/i.test(item.source || "")) return age <= 2;
  if (/^colossal$/i.test(item.source || "")) return age <= 2;
  // Universal source audit: no ordinary feed can fill a current edition from
  // a months-old archive. Specialist desks get a slightly wider weekly-publisher
  // window, while standing feeds must furnish work from the last two weeks.
  return age <= (item.sourcePack ? 14 : 7);
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
  const urls = new Set(), titles = new Set(), families = new Set(), contents = new Set(), assets = new Set(), output = [];
  for (const item of items) {
    const url = canonicalUrl(item.url), title = normalizeTitle(item.title), family = titleFamily(item.title), content = contentFingerprint(item), asset = commonsAssetKey(item);
    if (!url || !title || urls.has(url) || titles.has(title) || (family && families.has(family)) || (content && contents.has(content)) || (asset && assets.has(asset))) continue;
    urls.add(url); titles.add(title); if (family) families.add(family); if (content) contents.add(content); if (asset) assets.add(asset); output.push({...item, canonicalUrl: url, normalizedTitle: title});
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
  music:1, sports:1, fashion:1, entertainment:1, business:1,
  food:1, tech:1, gardening:1, outdoors:1, books:1,
  beverage:1, home:1, crafts:1, arts:1, auto:1,
  thinking:1, history:1, trivia:1, travel:1, surprise:1,
};

const MIX_LABELS = {
  music:"Music", sports:"Sports", fashion:"Fashion", entertainment:"Entertainment",
  business:"Business", food:"Food", tech:"Technology", gardening:"Gardening",
  outdoors:"Outdoors", books:"Books", beverage:"Beverage", home:"Home + architecture",
  crafts:"Crafts + making", arts:"Arts", auto:"Automotive", thinking:"Thinking",
  history:"History", trivia:"Trivia + curiosity", travel:"Travel", surprise:"Surprise"
};

// Classify the subject, never the presentation format. A photograph of Kyoto
// is travel; a photographed recipe is food; only art-about-art belongs in arts.
function contentLane(item) {
  const title = `${item?.title || ""} ${item?.summary || ""}`.toLowerCase();
  const section = String(item?.section || "").toLowerCase();
  const pack = String(item?.sourcePack || "").toLowerCase();
  const text = `${title} ${item?.source || ""} ${item?.sourcePackLabel || ""}`.toLowerCase();
  const matches = (pattern) => pattern.test(text);
  // Runway photographs sometimes arrive with generic "arts" or "visual shelf"
  // metadata. Classify their actual subject before trusting that metadata so
  // they cannot evade the fashion quota merely because they are photographs.
  if (/\b(fashion week|fashion show|fashion model|runway|catwalk|couture|haute couture|street style|menswear|womenswear)\b/.test(`${title} ${section}`)) return "fashion";
  if (item?.visualSubjectLane) return ({animals:"outdoors",international:"surprise",kindness:"surprise",ingenuity:"crafts",science:"thinking",money:"business",technology:"tech",grabBag:"trivia"}[item.visualSubjectLane] || item.visualSubjectLane);
  if (/fashion-style/.test(pack) && /fashion|designer|style|sneaker|clothing|wear|runway|couture|garment/.test(title)) return "fashion";
  if (/women-culture/.test(pack) && /fashion|style|runway|couture|costume|garment/.test(title)) return "fashion";
  if (/fashion/.test(section)) return "fashion";
  if (/beverage|wine|beer|brew/.test(section)) return "beverage";
  if (/trivia|curiosity/.test(section)) return "trivia";
  if (/automotive|cars?|boats?/.test(section)) return "auto";
  if (/business|finance|money/.test(section)) return "business";
  if (/garden|farm/.test(section)) return "gardening";
  if (/books|literature|writing/.test(section)) return "books";
  if (/history|archive/.test(section)) return "history";
  if (/music/.test(section)) return "music";
  if (/film|theat|entertainment|culture/.test(section)) return "entertainment";
  if (/science|ideas|math/.test(section)) return "thinking";
  if (/animals|nature|outdoor/.test(section)) return "outdoors";
  if (/people \+ joy|people \+ progress|giving|philanthrop/.test(section)) return "surprise";
  if (/tech/.test(section)) return "tech";
  if (/sports|fitness/.test(section)) return "sports";
  if (/food \+ travel/.test(section)) return /wine|beer|brew|cocktail|beverage|bar\b|coffee|tea\b|juice/.test(title) ? "beverage" : /food|restaurant|recipe|cook|chef|dining|bakery|cuisine/.test(title) ? "food" : "travel";
  if (/architecture|interior|home/.test(section)) return "home";
  if (/making|craft|diy|repair|workshop|furniture/.test(section)) return "crafts";
  if (/car|auto|transport/.test(section)) return "auto";
  if (/art|museum|photograph/.test(section)) return "arts";
  if (matches(/\b(fashion week|street style|runway|couture|fashion designer|wardrobe|costume design|textile|garment|vogue|menswear|womenswear)\b/)) return "fashion";
  if (matches(/\b(wine|winery|vineyard|beer|brewery|cocktail|beverage|wine bar|vinyl bar|non alcoholic|juice|coffee culture|tea culture)\b/)) return "beverage";
  if (matches(/\b(food|restaurant|recipe|cook|chef|dining|bakery|coffee|wine|cocktail|cuisine|ingredient)\b/)) return "food";
  if (matches(/\b(travel|trip|journey|hotel|destination|tourism|vacation|flight|airline|city guide|weekend getaway|road trip)\b/)) return "travel";
  if (matches(/\b(sport|baseball|football|basketball|tennis|soccer|golf|running|cycling|athlete|yankees|twins|giants|wnba|mlb|nfl|nba)/)) return "sports";
  if (matches(/\b(music|album|song|singer|band|jazz|record|concert|composer|synth|guitar|piano|orchestra)/)) return "music";
  if (matches(/\b(film|cinema|documentary|director|actor|comedy|theat(?:er|re)|ballet|criterion|festival|television|tv series)\b/)) return "entertainment";
  if (matches(/\b(garden|gardening|flower|pollinator|small farm|farmers market|horticultur|landscape design)\b/)) return "gardening";
  if (matches(/\b(camping|hiking|kayak|skiing|mountain bik|trail|outdoors|wildlife|bird|animal|habitat|forest|northern lights|fly fishing)\b/)) return "outdoors";
  if (matches(/\b(book|author|novel|fiction|poetry|writer|literature|pulitzer|short stor|essay)\b/)) return "books";
  if (matches(/\b(craft|furniture|rug|quilting|ceramic|pottery|woodwork|maker|workshop|diy|manufactur|cooper hewitt)\b/)) return "crafts";
  if (matches(/\b(home|house|interior|architecture|architect|renovation|decor|wallpaper|building design)\b/)) return "home";
  if (matches(/\b(car|automotive|automobile|classic auto|motorcycle|vehicle|roadster|electric car)\b/)) return "auto";
  if (matches(/\b(technology|tech|robot|software|hardware|digital|computer|artificial intelligence|\bai\b|wearable)\b/)) return "tech";
  if (matches(/\b(money|finance|financial|business|company|founder|entrepreneur|small business|independent brand|startup)\b/)) return "business";
  if (matches(/\b(history|historical|archive|anniversary|heritage|civilization|retro|vintage history)\b/)) return "history";
  if (matches(/\b(philosophy|futurist|mathemat|ted talk|big idea|invention|scientist|space|nasa|astronom|physics|research|discovery)\b/)) return "thinking";
  if (matches(/\b(did you know|trivia|strange but true|curiosity|why do|how does|explainer|deep dive|little known)\b/)) return "trivia";
  if (matches(/\b(art|artist|museum|gallery|photograph|sculpt|paint|collage|street art)\b/)) return "arts";
  return "surprise";
}

function personalizedCounts(interests = []) {
  const counts = {...BALANCED_MAGAZINE_COUNTS};
  const signals = interests.map(value => contentLane({title:value})).filter(lane => lane !== "grabBag");
  const boosts = [...new Set(signals)].slice(0, 3);
  boosts.forEach(lane => {
    // Fashion remains a five-percent editorial lane even when it is one of a
    // reader's interests. Personalization can change which fashion story wins,
    // but it cannot turn the wider-world edition into a runway feed.
    if (lane === "fashion") return;
    const desired = Math.min(5, counts[lane] + (boosts.length === 1 ? 3 : 2));
    let needed = desired - counts[lane];
    for (const donor of Object.keys(counts).reverse()) {
      if (!needed || donor === lane || boosts.includes(donor)) continue;
      const available = Math.max(0, counts[donor] - 1);
      const moved = Math.min(needed, available);
      counts[donor] -= moved; counts[lane] += moved; needed -= moved;
    }
  });
  return counts;
}

function isDogStory(item) {
  return /\b(dog|dogs|doggie|doggies|puppy|puppies|canine|greyhound|labrador|retriever|terrier|beagle|collie|shepherd|schnauzer|spaniel|corgi|dachshund)\b/i.test(`${item?.title || ""} ${item?.summary || ""} ${item?.section || ""} ${item?.source || ""}`);
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
    const blockPersonalizedCount = block.filter(item => item.personalFit !== "editorial").length;
    const blockIndependentCount = block.filter(item => item.independentPublisher).length;
    const blockHumanInterestCount = block.filter(item => item.humanInterest).length;
    const blockVisualCount = block.filter(item => item.image || item.videoId).length;
    const blockCounts = Object.fromEntries(Object.keys(targets).map(lane => [lane, block.filter(item => item.mixLane === lane).length]));
    const blockVisualShelfCount = block.filter(item => item.visualShelf).length;
    const blockSourceCount = source => block.filter(item => normalizeSource(item.source) === source).length;
    const blockVisualSourceCount = source => block.filter(item => (item.image || item.videoId) && normalizeSource(item.source) === source).length;
    const blockVisualLaneCount = lane => block.filter(item => (item.image || item.videoId) && item.mixLane === lane).length;
    const recentLanes = selected.slice(-2).map(item => item.mixLane);
    const lane = Object.keys(targets)
      .filter(candidate => !recentLanes.includes(candidate) && remaining.some(item => item.mixLane === candidate))
      .sort((a,b) => (targets[b] - blockCounts[b]) - (targets[a] - blockCounts[a]))[0]
      || Object.keys(targets).find(candidate => remaining.some(item => item.mixLane === candidate))
      || "grabBag";
    // Sports is seasoning: at most one human-interest sports story in every
    // other 20-card window, never routine team or transaction news.
    const sportsAllowedThisWindow = Math.floor(position / 20) % 2 === 1;
    const hardLaneLimit = item => item.mixLane === "sports" ? (sportsAllowedThisWindow ? 1 : 0) : item.mixLane === "fashion" ? 1 : 2;
    const obeysSourceAndFormatCaps = item => {
      const source = normalizeSource(item.source), pageCount = sourceCounts.get(source) || 0;
      const pageLimit = /^(?:nasa|jstor daily|colossal)$/.test(source) ? 1 : 5;
      const visual = item.image || item.videoId;
      return pageCount < pageLimit && !((item.visualShelf && blockVisualShelfCount >= 2) || blockSourceCount(source) >= 2 || (visual && (blockVisualSourceCount(source) >= 2 || blockVisualLaneCount(item.mixLane) >= 2)));
    };
    const belowHardLaneCap = item => blockCounts[item.mixLane] < hardLaneLimit(item);
    const belowTarget = item => blockCounts[item.mixLane] < targets[item.mixLane];
    // Personalization may influence no more than half of any 20-story window.
    // The other ten positions remain broad editorial choices, guaranteeing a
    // steady supply of subjects the reader did not explicitly request.
    const belowPersonalizationCap = item => blockPersonalizedCount < 10 || item.personalFit === "editorial";
    const preservesIndependentFloor = item => blockIndependentCount >= 18 || item.independentPublisher;
    const preservesHumanInterestMajority = item => {
      const remainingSlots = 20 - block.length;
      const stillNeeded = Math.max(0, 12 - blockHumanInterestCount);
      return stillNeeded < remainingSlots || item.humanInterest;
    };
    const preservesVisualFloor = item => {
      const remainingSlots = 20 - block.length;
      const stillNeeded = Math.max(0, 14 - blockVisualCount);
      return stillNeeded < remainingSlots || item.image || item.videoId;
    };
    const editorialContract = item => preservesIndependentFloor(item) && preservesHumanInterestMajority(item) && preservesVisualFloor(item);
    const exact = remaining.filter(item => item.mixLane === lane && belowTarget(item) && belowHardLaneCap(item) && obeysSourceAndFormatCaps(item) && belowPersonalizationCap(item) && editorialContract(item));
    const cappedPool = remaining.filter(item => belowTarget(item) && belowHardLaneCap(item) && obeysSourceAndFormatCaps(item) && belowPersonalizationCap(item) && editorialContract(item));
    // If a requested desk has no usable story, redistribute its space among
    // under-represented subjects. Never fall back to an unrestricted pool:
    // that old escape hatch was how runway inventory flooded sparse editions.
    const redistributed = remaining
      .filter(item => belowHardLaneCap(item) && obeysSourceAndFormatCaps(item) && belowPersonalizationCap(item) && editorialContract(item))
      .sort((a, b) => blockCounts[a.mixLane] - blockCounts[b.mixLane]);
    const emergency = remaining
      .filter(item => belowHardLaneCap(item) && belowPersonalizationCap(item) && editorialContract(item))
      .sort((a, b) => blockCounts[a.mixLane] - blockCounts[b.mixLane]);
    // One excellent dog is a standing part of every edition. It fills the
    // normal outdoors/animals position, rather than increasing that category.
    const dogPool = position === 0
      ? remaining.filter(item => isDogStory(item) && belowHardLaneCap(item) && obeysSourceAndFormatCaps(item) && belowPersonalizationCap(item))
      : [];
    const eligible = dogPool.length ? dogPool : exact.length ? exact : cappedPool.length ? cappedPool : redistributed.length ? redistributed : emergency;
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

// The strict editor can legitimately run out of candidates that satisfy every
// quota at the same position. That must never turn into a six-card response.
// Complete the bench from the same already-safe pool, preserving hard subject,
// publisher and source caps while treating visual/human-interest ratios as the
// ranking priority for the remainder rather than a reason to stop entirely.
function completeMagazineBench(selected, candidates, count = 140, random = Math.random) {
  const result = [], seededSourceCounts = new Map();
  unique(selected).forEach(item => {
    const source = normalizeSource(item.source), limit = /^(?:nasa|jstor daily|colossal)$/.test(source) ? 1 : 8;
    if ((seededSourceCounts.get(source) || 0) >= limit) return;
    seededSourceCounts.set(source, (seededSourceCounts.get(source) || 0) + 1); result.push(item);
  });
  const used = new Set(result.flatMap(item => [canonicalUrl(item.url), `title:${normalizeTitle(item.title)}`, `topic:${titleFingerprint(item.title)}`]));
  const remaining = unique(candidates).filter(item => !used.has(canonicalUrl(item.url)) && !used.has(`title:${normalizeTitle(item.title)}`) && !used.has(`topic:${titleFingerprint(item.title)}`));
  while (result.length < count && remaining.length) {
    const position = result.length, block = result.slice(position - position % 20);
    const sourceCount = source => block.filter(item => normalizeSource(item.source) === source).length;
    const laneCount = lane => block.filter(item => item.mixLane === lane || contentLane(item) === lane).length;
    const visualSourceCount = source => block.filter(item => (item.image || item.videoId) && normalizeSource(item.source) === source).length;
    const visualLaneCount = lane => block.filter(item => (item.image || item.videoId) && (item.mixLane === lane || contentLane(item) === lane)).length;
    const globalSourceCount = source => result.filter(item => normalizeSource(item.source) === source).length;
    const mainstreamCount = block.filter(item => !item.independentPublisher).length;
    const sportsAllowed = Math.floor(position / 20) % 2 === 1;
    const eligible = remaining.filter(item => {
      const lane = item.mixLane || contentLane(item), source = normalizeSource(item.source);
      if (lane === "sports" && (!sportsAllowed || laneCount("sports") >= 1 || !humanInterestSports(item))) return false;
      if (lane === "fashion" && laneCount("fashion") >= 1) return false;
      if (laneCount(lane) >= 3 || sourceCount(source) >= 2) return false;
      if (/^(?:nasa|jstor daily|colossal)$/.test(source) && globalSourceCount(source) >= 1) return false;
      if ((item.image || item.videoId) && (visualSourceCount(source) >= 2 || visualLaneCount(lane) >= 2)) return false;
      if (!item.independentPublisher && mainstreamCount >= 2) return false;
      return true;
    });
    const diversityFallback = remaining.filter(item => {
      const lane = item.mixLane || contentLane(item), source = normalizeSource(item.source);
      const visual = item.image || item.videoId;
      // The fallback may relax the ideal subject mix, but never the rules that
      // prevent one image-rich publisher (especially NASA) from taking over.
      return lane !== "sports"
        && !(/^(?:nasa|jstor daily|colossal)$/.test(source) && globalSourceCount(source) >= 1)
        && sourceCount(source) < 3
        && (!visual || (visualSourceCount(source) < 2 && visualLaneCount(lane) < 2))
        && (item.independentPublisher || mainstreamCount < 2);
    });
    const depthFallback = remaining.filter(item => {
      const lane = item.mixLane || contentLane(item), source = normalizeSource(item.source);
      return lane !== "sports"
        && !(/^(?:nasa|jstor daily|colossal)$/.test(source) && globalSourceCount(source) >= 1)
        && sourceCount(source) < 4
        && (item.independentPublisher || mainstreamCount < 2);
    });
    const pool = eligible.length ? eligible : diversityFallback.length ? diversityFallback : depthFallback;
    if (!pool.length) break;
    const recentSources = new Set(result.slice(-4).map(item => normalizeSource(item.source)));
    const ranked = pool.map(item => {
      const lane = item.mixLane || contentLane(item), source = normalizeSource(item.source);
      const visualCount = block.filter(entry => entry.image || entry.videoId).length;
      const humanCount = block.filter(entry => entry.humanInterest).length;
      let score = Number(item.score || 0) + random() * 7;
      if (item.image || item.videoId) score += visualCount < 14 ? 150 : 35;
      if (item.humanInterest) score += humanCount < 12 ? 100 : 25;
      if (item.independentPublisher) score += 70;
      score -= laneCount(lane) * 30 + sourceCount(source) * 70;
      if (recentSources.has(source)) score -= 120;
      return {item, score};
    }).sort((a, b) => b.score - a.score);
    const winner = ranked[0]?.item;
    if (!winner) break;
    remaining.splice(remaining.indexOf(winner), 1);
    result.push({...winner, mixLane:winner.mixLane || contentLane(winner), mixLabel:winner.mixLabel || MIX_LABELS[winner.mixLane || contentLane(winner)]});
    [canonicalUrl(winner.url), `title:${normalizeTitle(winner.title)}`, `topic:${titleFingerprint(winner.title)}`].forEach(key => used.add(key));
  }
  return result.slice(0, count);
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

function andrewGallerySources(editionName, visit) {
  if (!/^andrew(?:['’]s)? edition$/i.test(String(editionName || "").trim())) return [];
  const watchlist = load("andrew-gallery-watchlist.json");
  const chunks = Object.entries(watchlist).flatMap(([region, galleries]) => {
    const result = [];
    for (let index = 0; index < galleries.length; index += 4) result.push({region, galleries:galleries.slice(index, index + 4)});
    return result;
  });
  // Twelve four-gallery searches keep each refresh quick. The seeded start
  // rotates the desk through the entire list across visits and background fills.
  const rotation = Math.floor(seededRandom(`andrew-gallery-${visit}`)() * chunks.length);
  return Array.from({length:Math.min(12, chunks.length)}, (_, index) => chunks[(rotation + index * 5) % chunks.length]).map(({region, galleries}) => {
    const names = galleries.map(name => `\"${name}\"`).join(" OR ");
    const query = `(${names}) (exhibition OR artist OR painting OR photography OR drawing) -politics -war`;
    return {
      name:`Andrew’s Gallery Desk · ${region}`,
      url:`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
      section:"ARTS + MUSEUMS",
      pack:"andrew-gallery-desk",
      packLabel:"Andrew’s Gallery Desk",
      packHits:4
    };
  });
}

function rotatingAuditedSources(visit, count = 40) {
  const catalog = load("approved-sources.json").filter(source => !civicPublisherUnsafe.test(source.name || "")), random = seededRandom(`audited-source-pool-${visit}`);
  const shuffled = values => [...values].sort(() => random() - .5);
  const balancedPick = (values, target) => {
    const groups = new Map();
    shuffled(values).forEach(source => {
      const key = source.section || "WORLD + WONDER";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(source);
    });
    const keys = shuffled([...groups.keys()]), selected = [];
    while (selected.length < target && keys.some(key => groups.get(key)?.length)) {
      for (const key of keys) {
        const item = groups.get(key)?.shift();
        if (item) selected.push(item);
        if (selected.length >= target) break;
      }
    }
    return selected;
  };
  const usTarget = Math.round(count * .8), us = catalog.filter(source => source.country === "United States"), international = catalog.filter(source => source.country !== "United States");
  return [...balancedPick(us, usTarget), ...balancedPick(international, count - usTarget)].map(source => ({...source,pack:"audited-independent",packLabel:"Audited independent publishers",packHits:0}));
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

async function feedResponse(params) {
  const visit = params.get("visit") || String(Math.floor(Date.now() / 72e5)), editionName = params.get("editionName") || "", random = seededRandom(visit), avoidVideos = new Set((params.get("avoid") || "").split(",").filter(Boolean)), avoidStories = new Set((params.get("avoidStories") || "").split(",").filter(Boolean)), localPlaces = (params.get("places") || "").split("|").map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 20), interests = (params.get("interests") || "").split("|").map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 48);
  const taste = load("taste.json"), baseSources = load("sources.json"), packCatalog = load("source-packs.json"), activePacks = activateSourcePacks(interests, packCatalog), editorialIdentity = detectEditorialIdentity(interests, activePacks), specialistSources = activePacks.flatMap(pack => pack.sources.map(source => ({...source, pack:pack.id, packLabel:pack.label, packHits:pack.hits})));
  // The generic magazine needs real reporting inventory for every desk. Two
  // carefully chosen feeds from each under-supplied source pack provide that
  // breadth without activating a personalized editorial identity.
  const genericPackIds = new Set(["sports","business-culture","fashion-style","books-history","making-garden","cars-boats","outdoors","food-travel","arts-culture","science-tech","philanthropy-community"]);
  // The broad magazine desk remains active for personalized editions too.
  // Specialist sources supplement it; they never replace the wider world.
  const genericSources = packCatalog.filter(pack => genericPackIds.has(pack.id)).flatMap(pack => {
    // Arts needs the direct Colossal feed in the standing edition; unlike the
    // two Google relay feeds before it, that feed carries its own artwork.
    const take = pack.id === "food-travel" ? 4 : pack.id === "arts-culture" ? 3 : 2;
    return pack.sources.slice(0, take).map(source => ({...source, pack:pack.id, packLabel:pack.label, packHits:0}));
  });
  const gallerySources = andrewGallerySources(editionName, visit), auditedSources = rotatingAuditedSources(visit);
  const sources = unique([...baseSources, ...genericSources, ...specialistSources, ...auditedSources, ...gallerySources].map(source => ({...source,title:source.name,summary:""})))
    .filter(source => !bannedSource({source:source.name,url:source.url}))
    .map(({canonicalUrl,normalizedTitle,title,summary,...source}) => source);
  const results = await Promise.allSettled(sources.map(async source => {
    const feed = await parseSourceCached(source);
    return (feed.items || []).slice(0, 40).map((item, index) => {
      const scored = score(item, source, taste);
      const publisher = publisherName(item, source), independentPublisher = isIndependentPublisher(publisher, source);
      const story = {title: plain(item.title) || "Untitled", url: item.link || "#", summary: plain(item.contentSnippet || item.content || ""), date: item.isoDate || item.pubDate || null, source: publisher, aggregatorSource:source.name, publisher, independentPublisher, section: source.section, image: source.noImages ? null : imageFor(item), sourcePack:source.pack || null, sourcePackLabel:source.packLabel || null, sourcePackHits:source.packHits || 0, noImageEnrichment:Boolean(source.noImages), ...scored, score:scored.score + (independentPublisher ? 30 : -25) + (source.pack ? 18 + Math.min(24, (source.packHits || 0) * 4) : 0)};
      return {...story, humanInterest:humanInterestSignal.test(`${story.title} ${story.summary} ${story.section}`), geoClass: classifyGeography(story, localPlaces), format: formatFor(story, index)};
    });
  }));
  let all = [];
  results.forEach(result => { if (result.status === "fulfilled") all.push(...result.value); });
  all = unique(all.filter(item => item.score > 18 && !isDisallowed(item) && !wasRecentlyShown(item, avoidStories) && contextAllowed(item, editorialIdentity) && (isJoyful(item) || (item.sourcePack && isSpecialistWorthwhile(item))) && isFreshLocal(item)).map(item => personalize(item, interests)).sort((a, b) => b.score - a.score));
  all = await enrichIdentityImages(all, editorialIdentity);
  // These two visually strong archive feeds can otherwise leak into several
  // page regions. One shared gate means one NASA story and one JSTOR story in
  // the entire response, including the wire, Bright Spots and deep bench.
  const limitedSourceCounts = new Map();
  all = all.filter(item => {
    const source = normalizeSource(item.source);
    if (!/^(?:nasa|jstor daily|colossal)$/.test(source)) return true;
    if ((limitedSourceCounts.get(source) || 0) >= 1) return false;
    limitedSourceCounts.set(source, 1); return true;
  });

  // One shared registry across every page region makes duplicates impossible.
  const usedUrls = new Set(), usedTitles = new Set(), usedTopics = new Set(), usedAssets = new Set();
  const claim = items => items.filter(item => {
    const url = canonicalUrl(item.url), title = normalizeTitle(item.title), topic = titleFingerprint(item.title), asset = commonsAssetKey(item);
    if (usedUrls.has(url) || usedTitles.has(title) || (topic && usedTopics.has(topic)) || (asset && usedAssets.has(asset))) return false;
    usedUrls.add(url); usedTitles.add(title); if (topic) usedTopics.add(topic); if (asset) usedAssets.add(asset); return true;
  });
  const brightPool = all.filter(item => /PEOPLE|ANIMALS|PROGRESS|AROUND AMERICA/.test(item.section) || isGoodNews(item));
  const tickerStories = claim(compose(brightPool, 8, {}, random));
  const ribbonFavorite = tickerStories[0] || null;
  const goodNews = claim(compose(all.filter(isGoodNews), 1, {}, random))[0] || null;
  const videoPool = (await loadReaderVideos(avoidVideos)).filter(item => !wasRecentlyShown(item, avoidStories)).map(item => personalize(item, interests));
  // The Bright Spots promise includes one genuinely good dog. Prefer the
  // dedicated WeRateDogs channel, then another current dog video/story. If
  // every dog source is temporarily unavailable, the client quietly says
  // "excellent animals" instead of making a promise the edition cannot keep.
  const standingDog = videoPool.find(item => item.source === "WeRateDogs")
    || videoPool.find(isDogStory)
    || brightPool.find(item => !usedUrls.has(canonicalUrl(item.url)) && isDogStory(item));
  const favoriteSelection = standingDog ? claim([standingDog]) : [];
  favoriteSelection.push(...claim(compose(brightPool.filter(item => !usedUrls.has(canonicalUrl(item.url))), 6 - favoriteSelection.length, {}, random)));
  const hasGoodDog = favoriteSelection.some(isDogStory) || favoriteSelection.some(item => item.source === "WeRateDogs");
  const fashionFocus = editorialIdentity.id === "fashion";
  const focusMediaSignal = /fashion|runway|couture|designer|costume|wardrobe|atelier|supermodel|vogue|editorial photography|fashion photography|style archive|fashion week|women.?s tennis|wnba|author interview|novelist|book club/i;
  const relevantMedia = videoPool.filter(item => item.personalFit !== "editorial" && (!fashionFocus || focusMediaSignal.test(`${item.title} ${item.summary} ${item.section}`)));
  // A strongly signaled fashion/women's edition never gets padded with
  // unrelated generic videos just because those thumbnails are available.
  const mediaPool = fashionFocus ? relevantMedia : [...relevantMedia, ...videoPool.filter(item => item.personalFit === "editorial").slice(0, 30)];
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
  // Wikimedia Commons is intentionally quarantined. Its search results are a
  // shallow, slowly changing archive and repeatedly resurfaced the same assets.
  // Source images attached to current reporting remain eligible.
  const allVisualShelf = [];
  const magazinePool = galleryPool;
  const strictMagazine = balancedMagazine(magazinePool, 140, interests, random);
  const completedBench = completeMagazineBench(strictMagazine, magazinePool, 140, random);
  const benchKeys = new Set(completedBench.map(item => canonicalUrl(item.url)));
  const visualBackfill = magazinePool.filter(item =>
    (item.image || item.videoId)
    && !benchKeys.has(canonicalUrl(item.url))
    && normalizeSource(item.source) !== "nasa"
  );
  // Keep qualified visual reporting just behind the selected bench while the
  // window pass runs. It can replace a text card in a sparse later window,
  // rather than leaving all imagery concentrated near the top of the page.
  const availableMagazine = [...completedBench, ...visualBackfill].filter(item => {
    const url = canonicalUrl(item.url), title = normalizeTitle(item.title), topic = titleFingerprint(item.title), asset = commonsAssetKey(item);
    return !usedUrls.has(url) && !usedTitles.has(title) && !(topic && usedTopics.has(topic)) && !(asset && usedAssets.has(asset));
  });
  const selectedMagazine = composeVisualWindows(availableMagazine, editorialIdentity, 140, 20);
  // Preserve the editor's 20-story windows. The client may arrange cards
  // inside each ten-card layout cluster, but no visual pass can import a later
  // story and silently alter the opening subject mix.
  // Quality wins over an arbitrary card count. Never refill after this gate:
  // doing so was the precise bug that restored text cards and source floods.
  const gallery = claim(enforceFinalMagazineContract(selectedMagazine, 100));
  const galleryKeys = new Set(gallery.map(item => canonicalUrl(item.url)));
  const visualReserve = allVisualShelf.slice(56).filter(item => !galleryKeys.has(canonicalUrl(item.url))).slice(0, 24).map(item => ({...item, canonicalUrl:canonicalUrl(item.url)}));
  // Serendipity is composed from what remains after the primary magazine. It
  // must never starve Good Stuff and trigger a wall of visual-shelf backfill.
  reserveSerendipity(unusedStories().filter(item => item.noHits === 0 || item.personalFit === "editorial"));
  reserveSerendipity(unusedStories().filter(item => item.personalFit === "adjacent"));
  reserveSerendipity(unusedStories());
  const targetCounts = interests.length ? personalizedCounts(interests) : BALANCED_MAGAZINE_COUNTS;
  const openingWindow = gallery.slice(0, 20);
  const actualCounts = Object.fromEntries(Object.keys(BALANCED_MAGAZINE_COUNTS).map(lane => [lane, openingWindow.filter(item => item.mixLane === lane).length]));
  const personalizedCount = openingWindow.filter(item => item.personalFit !== "editorial").length;
  return Response.json({generatedAt: new Date().toISOString(), edition: Math.floor(Date.now() / 72e5), personalized:!!interests.length, hasGoodDog, editorialIdentity:{id:editorialIdentity.id,label:editorialIdentity.label,accent:editorialIdentity.accent,references:editorialIdentity.references,imageTarget:editorialIdentity.imageTarget}, composition:{window:20,targetCounts,actualCounts,personalization:{maximum:10,actual:personalizedCount,generic:openingWindow.length-personalizedCount},labels:MIX_LABELS}, activeSourcePacks:activePacks.map(pack => ({id:pack.id,label:pack.label,hits:pack.hits})), tickerStories, ribbonFavorite, goodNews, favorites: favoriteSelection, media, gallery, visualReserve, important, serendipity, sourceStatus: {total: sources.length, auditedPool:auditedSources.length, auditedCatalog:load("approved-sources.json").filter(source => !civicPublisherUnsafe.test(source.name || "")).length, specialist:specialistSources.length, successful: results.filter(result => result.status === "fulfilled").length}}, {headers: {"Cache-Control": "no-store"}});
}

export async function GET(request) {
  return feedResponse(new URL(request.url).searchParams);
}

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const params = new URLSearchParams();
  Object.entries(body || {}).forEach(([key, value]) => params.set(key, Array.isArray(value) ? value.join(",") : String(value ?? "")));
  return feedResponse(params);
}
