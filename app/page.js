"use client";
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {EDITION_PALETTES, mastheadPalette} from "./palettes";
import {supabase, supabaseConfigured} from "../lib/supabase";

const BATCH_SIZE = 20;
const EDITION_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const STORY_HISTORY_KEY = "betterStartReaderStoryHistory";
const SEEN_STORY_LEDGER_KEY = "meanwhileSeenStoryHashesV2";
const STORY_HISTORY_LIMIT = 1500;
const SEEN_STORY_LEDGER_LIMIT = 50000;
const DAYPART_MESSAGES = {
  morning:[
    "Let’s start the day off rage-free, shall we?",
    "Mornings are for nice things, not rage.",
    "This is a rage-free zone.",
    "Oh, what a beautiful rage-bait-free morning.",
    "Let’s ease into the day with good things.",
    "Ease into the day with more ease.",
    "No rage in the morning, please.",
    "Not everything is crazy and terrible.",
    "There are lots of good things happening. Here are some of them.",
    "Good days are built on good mornings.",
    "The world is already yelling. We don’t have to.",
    "Coffee first. Outrage never.",
    "Good morning. The algorithm can wait."
  ],
  afternoon:[
    "Enjoy a little mental recess.",
    "Take a break from the crazy.",
    "World got you down? Play around here for a while.",
    "Take a break for a while.",
    "Now’s as good a time as any to take a break.",
    "Enjoy more joy.",
    "Enjoy some joy.",
    "A small, sanctioned escape from the discourse.",
    "Consider this your browser’s quiet room.",
    "Nothing urgent here. That’s the point."
  ],
  evening:[
    "Sweet dreams are made of this. Literally.",
    "A softer landing for your day.",
    "Take it easier.",
    "Wind down with some good news.",
    "Leave the bad news behind.",
    "This is a rage-bait-free safe space.",
    "Nighttime’s the right time for feeling good. Or at least reading about good.",
    "The doomscroll has closed for the evening.",
    "Put the outrage to bed before you.",
    "Some news can wait until never."
  ]
};
const SMALL_DELIGHTS = [
  "Octopuses have three hearts.",
  "A group of flamingos is called a flamboyance.",
  "The earthy smell after rain has a name: petrichor.",
  "Bananas are berries. Strawberries are not.",
  "Sea otters sometimes hold hands while sleeping so they do not drift apart.",
  "The dot over a lowercase i or j is called a tittle.",
  "A day on Venus lasts longer than a year on Venus.",
  "Scotland’s national animal is the unicorn.",
  "The telephone helped turn ‘hello’ into an everyday greeting.",
  "What ordinary object in your home has the best design?",
  "Somewhere nearby, someone is learning how to do something for the first time.",
  "A well-made chair is a small piece of architecture.",
  "The shortest distance between two people may be a shared joke.",
  "Honey can remain edible for an extraordinarily long time when properly sealed.",
  "Butterflies taste with receptors on their feet.",
  "The tiny pocket on blue jeans was originally made for a pocket watch.",
  "What skill would you happily practice for ten quiet minutes today?",
  "Libraries lend more than books: many now offer tools, instruments and museum passes.",
  "The word ‘muscle’ comes from a Latin word meaning ‘little mouse.’",
  "There are more possible chess games than atoms in the observable universe.",
  "The first modern public aquarium opened in London in 1853.",
  "A collection of crows is traditionally called a murder; a collection of ravens, an unkindness.",
  "What would make today feel five percent more interesting?",
  "Every map is also a record of what its maker thought was important.",
  "A song you have forgotten is still waiting somewhere to surprise you.",
  "The grooves on a vinyl record form one continuous spiral.",
  "The oldest known recipes were written on clay tablets.",
  "Tree roots can form partnerships with vast underground fungal networks.",
  "A jiffy is an informal word, but scientists also use it for several very short units of time.",
  "What is the nicest sound within earshot right now?"
];
const PROFILE_KEY = "betterStartPersonalProfileV1";
const hexToHsl = hex => {
  const value = hex.replace("#", ""), r = parseInt(value.slice(0, 2), 16) / 255, g = parseInt(value.slice(2, 4), 16) / 255, b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, lightness = (max + min) / 2;
  let hue = 0;
  if (delta) hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  return {h:hue,s:saturation * 100,l:lightness * 100};
};
const mixedInk = (position = 0, palette = EDITION_PALETTES[0]) => {
  const base = hexToHsl(palette[(position * 3) % palette.length]), cycle = Math.floor(position / palette.length);
  const hue = (base.h + ((cycle % 9) - 4) * 1.2 + (position % 2 ? 1.1 : -1.1) + 360) % 360;
  const saturation = Math.max(28, Math.min(94, base.s + ((cycle * 5 + position) % 11) - 5));
  const lightness = Math.max(25, Math.min(88, base.l + ((cycle * 9 + position * 2) % 19) - 9));
  const darkInk = lightness > 61 || (lightness > 52 && saturation < 65);
  const foreground = darkInk ? "#11100e" : "#fffdf7";
  return {backgroundColor:`hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`,color:foreground,"--tile-ink":foreground,"--accent":foreground};
};
const categoryClass = section => `cat-${(section || "news").toLowerCase().replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, "")}`;
const normalizedIdentityTitle = value => (value || "").toLowerCase().replace(/\b(the|a|an|and|or|but|to|of|for|in|on|at|with|from)\b/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const emergencyBlocked = /\b(trump|maga|maha|nazi|neo[- ]?nazi|white supremac|shooting|gunman|murder|war|terroris|rape|sexual abuse|suicide|overdose|deadly|killed|outrage|religious|christian nationalism|white nationalism|nationalis(?:m|t)|religious right|religious left|culture[- ]?war|conservative|liberal|left[- ]wing|right[- ]wing|partisan|ideology|ideological|activis(?:m|t)|advocacy|protest|legislation|legislature|policy debate|government|federal agency|immigration|abortion|gun rights?|gun control|book ban|school board|voting rights?|civil rights legislation|geopolitic|diploma(?:cy|tic)|sanctions?|anti[- ]?vax|ufc|mma|gambling|google pixel|samsung galaxy|android phone|jeff bezos|bmi|body fat|weight[- ]loss|being thin|obesity|overweight|porn(?:ography|ographic)?|nsfw|nud(?:e|ity)|naked|topless|full[- ]?frontal|genitals?|penis|vulva|vagina|erotic(?:a)?|sexually explicit|miami (?:fashion|swim) week|miami nightlife|swim week|bikini(?:s)?|micro[- ]?bikini|thong(?:s)?|lingerie|underwear runway|swimwear runway|see[- ]?through (?:dress|fashion|outfit)|sheer (?:dress|fashion|outfit))\b/i;
const religionBlocked = /\b(?:religion|religious|faith(?:ful)?|christian(?:ity)?|catholic(?:ism)?|protestant(?:ism)?|evangelical(?:ism)?|jewish|judaism|muslim|islam(?:ic)?|hindu(?:ism)?|buddhis(?:m|t)|sikh(?:ism)?|mormon(?:ism)?|church|cathedral|chapel|synagogue|mosque|bible|biblical|torah|talmud|quran|koran|scripture|gospel|theology|clergy|priest|pastor|pope|papal|vatican|rabbi|imam|monk|nun|worship|sermon|congregation|parish|diocese|god|jesus|christ|messiah|allah|yahweh|zionis(?:m|t)|antisemiti(?:c|sm)|islamophobi(?:a|c))\b/i;
const bannedSource = item => /(?:\b(?:nyt|new york times)\b|(?:^|\.)nytimes\.com\b)/i.test(`${item?.source || ""} ${item?.url || ""} ${item?.canonicalUrl || ""}`);
const corporateAmazonBlocked = value => /\bamazon(?:'s)?\b/i.test(value) && !/\bamazon (?:rainforest|river|basin|forest|region|wildlife)\b/i.test(value);
const titleFingerprint = value => normalizedIdentityTitle(value).split(/\s+/).filter(word => word.length > 2).slice(0, 9).join(" ");
const titleFamily = value => [...new Set(normalizedIdentityTitle(value).split(/\s+/).filter(word => word.length > 3))].sort().slice(0, 14).join(" ");
const retiredRepeat = /\b(?:james hetfield.*metallica|cis football (?:field|locations?)|runway magazine covers? celebrating 25th anniversary|rocky horror.*mad scientist|chanel iman.*runway.*2009|not all boredom is the same)\b/i;
const educationCultureWarBlocked = /(?:\b(?:lgbtq?|transgender|gender identity|drag queen|pride)\b.{0,90}\b(?:child(?:ren)?|kids?|school|classroom|curriculum|education|library|books?|reading hour)\b|\b(?:child(?:ren)?|kids?|school|classroom|curriculum|education|library|books?|reading hour)\b.{0,90}\b(?:lgbtq?|transgender|gender identity|drag queen|pride)\b)/i;
const titleWords = value => new Set(normalizedIdentityTitle(value).split(/\s+/).filter(word => word.length > 3));
const nearSameTitle = (left, right) => {
  const a = titleWords(left), b = titleWords(right);
  if (a.size < 3 || b.size < 3) return false;
  let shared = 0; a.forEach(word => { if (b.has(word)) shared++; });
  return shared >= 4 && shared / Math.min(a.size, b.size) >= .72;
};
const commonsAssetKey = item => {
  const value = `${item?.url || ""} ${item?.image || ""}`, match = value.match(/(?:File:|File%3A|\/)([^/?#]+?\.(?:jpe?g|png|webp|gif|tiff?))(?:[/?#]|$)/i);
  if (!match) return "";
  try { return `commons:${decodeURIComponent(match[1]).toLowerCase().replace(/[_\s]+/g, "-")}`; } catch { return `commons:${match[1].toLowerCase()}`; }
};
const contentFingerprint = item => normalizedIdentityTitle(`${item?.title || ""} ${item?.summary || ""}`).split(/\s+/).filter(word => word.length > 2).slice(0, 24).join(" ");
const identityKeys = item => [`url:${item?.canonicalUrl || item?.url || ""}`, `title:${item?.normalizedTitle || normalizedIdentityTitle(item?.title)}`, `topic:${titleFingerprint(item?.title)}`, `family:${titleFamily(item?.title)}`, `content:${contentFingerprint(item)}`, commonsAssetKey(item), `image:${item?.image || ""}`, `video:${item?.videoId || ""}`].filter(key => key && !key.endsWith(":"));
const stableHash = value => { let hash = 2166136261; for (const char of String(value || "")) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); };
const readSeenLedger = () => { try { const value = JSON.parse(localStorage.getItem(SEEN_STORY_LEDGER_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
const identityHashes = item => [...new Set([itemKey(item), ...identityKeys(item)].filter(Boolean).map(stableHash))];
const permanentSeenHashes = () => new Set([
  ...readSeenLedger(),
  ...storyHistory().flatMap(entry => [entry.id, ...(entry.keys || [])]).filter(Boolean).map(stableHash)
]);
const writeSeenLedger = hashes => {
  try { localStorage.setItem(SEEN_STORY_LEDGER_KEY, JSON.stringify([...hashes].slice(-SEEN_STORY_LEDGER_LIMIT))); return true; }
  catch { return false; }
};
const claimUnique = (items = [], seen = new Set()) => items.filter(item => {
  const safetyText = `${item?.title || ""} ${item?.summary || ""} ${item?.source || ""} ${item?.section || ""}`;
  if (bannedSource(item) || emergencyBlocked.test(safetyText) || religionBlocked.test(safetyText) || educationCultureWarBlocked.test(safetyText) || corporateAmazonBlocked(safetyText) || retiredRepeat.test(safetyText)) return false;
  const keys = identityKeys(item);
  if (!keys.length || keys.some(key => seen.has(key))) return false;
  keys.forEach(key => seen.add(key));
  return true;
});
const sourceKey = item => (item?.source || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const spreadAdjacentSources = (items = [], initialPrevious = "") => {
  const pool = [...items], result = [];
  while (pool.length) {
    const previous = sourceKey(result.at(-1)) || initialPrevious;
    const recent = new Set(result.slice(-4).map(sourceKey).filter(Boolean));
    let index = pool.findIndex(item => {
      const source = sourceKey(item);
      return !source || (source !== previous && !recent.has(source));
    });
    if (index < 0) index = pool.findIndex(item => !sourceKey(item) || sourceKey(item) !== previous);
    // If the only remaining stories are from the immediately previous source,
    // omit them from this display rather than violate the spacing promise.
    if (index < 0) break;
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
};
const arrangeForFrames = items => {
  const arranged = [...items];
  // Large frames are reserved for photography, video, playable media or joy.
  // Text-only stories belong in compact frames.
  const compactSlots = [1, 3, 4, 8, 9].filter(index => index < arranged.length);
  const visualSlots = [0, 2, 5, 6, 7].filter(index => index < arranged.length);
  const needsVisualFrame = item => !!item?.image || ["video", "bandcamp", "visual", "social", "joy"].includes(item?.format);
  visualSlots.filter(index => !needsVisualFrame(arranged[index])).forEach(index => {
    const swap = compactSlots.find(candidate => needsVisualFrame(arranged[candidate]));
    if (swap !== undefined) [arranged[index], arranged[swap]] = [arranged[swap], arranged[index]];
  });
  // This is the final DOM order used by mobile. Recheck source spacing here,
  // after visual-frame swaps, so a layout pass can never reunite publications.
  return spreadAdjacentSources(arranged);
};
const arrangeFrameClusters = (items = []) => {
  const clusters = [], ordered = [];
  for (let start = 0; start < items.length; start += 10) {
    const arranged = arrangeForFrames(items.slice(start, start + 10));
    const cluster = spreadAdjacentSources(arranged, sourceKey(ordered.at(-1)));
    if (!cluster.length) continue;
    clusters.push(cluster);
    ordered.push(...cluster);
  }
  return clusters;
};
const rebalanceVisualBlocks = (items, blockSize = 10, ratio = .5) => {
  const arranged = [...items];
  for (let start = 0; start < arranged.length; start += blockSize) {
    const end = Math.min(arranged.length, start + blockSize), target = Math.ceil((end - start) * ratio);
    let count = arranged.slice(start, end).filter(needsVisual => !!needsVisual?.image || ["video", "bandcamp", "social", "visual", "joy"].includes(needsVisual?.format)).length;
    while (count < target) {
      const textIndex = arranged.slice(start, end).map((item, offset) => ({item, index:start + offset})).reverse().find(entry => !entry.item.image && !["video", "bandcamp", "social", "visual", "joy"].includes(entry.item.format))?.index;
      const visualIndex = arranged.findIndex((item, index) => index >= end && (!!item.image || ["video", "bandcamp", "social", "visual", "joy"].includes(item.format)));
      if (textIndex === undefined || visualIndex < 0) break;
      [arranged[textIndex], arranged[visualIndex]] = [arranged[visualIndex], arranged[textIndex]];
      count++;
    }
  }
  return arranged;
};
function age(date) { if (!date) return "From the shelf"; const hours = (Date.now() - new Date(date)) / 36e5; return hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min ago` : hours < 24 ? `${Math.round(hours)} hr ago` : `${Math.round(hours / 24)}d ago`; }
const itemKey = item => item.canonicalUrl || item.url || item.normalizedTitle || normalizedIdentityTitle(item.title);
const savedPlaces = () => { try { const value = JSON.parse(localStorage.getItem("betterStartReaderPlaces") || "[]"); return Array.isArray(value) ? value.slice(0, 20).join("|") : ""; } catch { return ""; } };
const storyHistory = () => { try { const value = JSON.parse(localStorage.getItem(STORY_HISTORY_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
const storyHistoryKeys = () => new Set(storyHistory().flatMap(entry => [entry.id, ...(entry.keys || [])]).filter(Boolean));
const recentStoryAvoidance = () => {
  // Compact hashes let the complete permanent ledger travel in the POST body
  // without repeatedly serializing full titles, URLs and image records.
  return [...permanentSeenHashes()].slice(-SEEN_STORY_LEDGER_LIMIT).join(",");
};
const localDayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const requestFeed = async payload => {
  const response = await fetch("/api/feed", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(payload), cache:"no-store"});
  if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
  return response.json();
};
const filterEditionGlobally = next => {
  // The browser is the final permanent gate. In addition to exact URL, image,
  // Commons asset and title-family keys, compare titles fuzzily so archive
  // captions cannot return with a punctuation, date or wording variation.
  const history = storyHistory();
  const seen = new Set();
  const seenHashes = permanentSeenHashes();
  const priorTitles = history.flatMap(entry => entry.keys || []).filter(key => key.startsWith("title:")).map(key => key.slice(6));
  const take = items => claimUnique((items || []).filter(item => {
    if (identityHashes(item).some(hash => seenHashes.has(hash))) return false;
    if (priorTitles.some(title => nearSameTitle(item?.title, title))) return false;
    identityHashes(item).forEach(hash => seenHashes.add(hash));
    return true;
  }), seen);
  const tickerStories = take(next?.tickerStories || (next?.ribbonFavorite ? [next.ribbonFavorite] : []));
  const goodNews = take(next?.goodNews ? [next.goodNews] : [])[0] || null;
  return {...next,
    tickerStories,
    ribbonFavorite:tickerStories[0] || null,
    goodNews,
    favorites:take(next?.favorites),
    important:take(next?.important),
    gallery:take(next?.gallery),
    media:take(next?.media),
    serendipity:take(next?.serendipity),
    visualReserve:take(next?.visualReserve)
  };
};
const blendPool = (previous = [], next = []) => {
  // Keep only one fifth of the current wall when the automatic two-hour
  // refresh runs. Slow editorial desks never occupy that carry-over, and an
  // item may survive only one refresh. This prevents the same "good" card
  // from becoming permanent furniture while preserving a little continuity.
  const keep = previous
    .filter(item => Date.now() - (item._firstShownAt || 0) < DAY_MS)
    .filter(item => !item._carriedOnce)
    .filter(item => !/^nyt (?:arts|books)$/i.test(item.source || ""))
    // The incoming edition already contains its single current fashion slot.
    // Do not carry yesterday's runway card into the same twenty-card window.
    .filter(item => item.mixLane !== "fashion")
    .slice(0, Math.ceil(Math.min(previous.length, next.length) * .20))
    .map(item => ({...item, _carriedOnce:true}));
  const used = new Set(keep.map(itemKey));
  return [...keep, ...next.filter(item => !used.has(itemKey(item)))].slice(0, next.length);
};
const stampNew = items => (items || []).map(item => ({...item, _firstShownAt:item._firstShownAt || Date.now()}));
const prepareEdition = (next, previous, preserve) => {
  const clean = filterEditionGlobally(next);
  return {...clean,
    gallery:stampNew(preserve ? blendPool(previous?.gallery, clean.gallery) : clean.gallery),
    media:stampNew(preserve ? blendPool(previous?.media, clean.media) : clean.media),
    serendipity:stampNew(preserve ? blendPool(previous?.serendipity, clean.serendipity) : clean.serendipity)
  };
};
function Feedback({item, onRate, onSave, onShare, saved}) { return <div className="controls" aria-label="Story feedback"><button onClick={() => onRate(item, "more")}>♡ More like this</button><button className={saved ? "savedControl" : ""} onClick={() => onSave(item)}>{saved ? "Saved ✓" : "Save"}</button><button onClick={() => onShare(item)}>Share</button><button onClick={() => onRate(item, "less")}>Less</button><button onClick={() => onRate(item, "political")}>Too political</button><button onClick={() => onRate(item, "depressing")}>Too depressing</button></div>; }
function MeasuredTicker({children}) { const tickerRef = useRef(null); useLayoutEffect(() => { const ticker = tickerRef.current, track = ticker?.querySelector("i"); if (!ticker || !track) return; const setSpeed = () => track.style.setProperty("--ticker-duration", `${Math.max(18, track.scrollWidth / 33.3).toFixed(2)}s`); const observer = new ResizeObserver(setSpeed); observer.observe(ticker); observer.observe(track); requestAnimationFrame(setSpeed); document.fonts?.ready.then(setSpeed); return () => observer.disconnect(); }, [children]); return <span className="ticker" ref={tickerRef}><i>{children}</i></span>; }
function RollingFact({label, children}) { return <div className="rollingFact"><b>{label}</b><MeasuredTicker>{children}</MeasuredTicker></div>; }
function GoodNewsWire({items = []}) { return <div className="rollingFact newsWire"><b>Good news wire</b><MeasuredTicker>{items.length ? items.map((item, index) => <a href={item.url} target="_blank" rel="noreferrer" key={item.canonicalUrl || item.url}>{item.title}<em>{item.source}</em>{index < items.length - 1 && <strong>✦</strong>}</a>) : "Finding several small reasons for optimism…"}</MeasuredTicker></div>; }
function AccountPanel({user, email, setEmail, status, onSendLink, onSignOut, onClose}) {
  return <div className="accountVeil" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="accountPanel" role="dialog" aria-modal="true" aria-labelledby="account-title"><button className="accountClose" onClick={onClose} aria-label="Close account window">×</button><span className="accountEyebrow">Your Meanwhile</span><h2 id="account-title">{user ? "You’re signed in." : "Keep your edition wherever you go."}</h2>{user ? <><p>Your preferences, saved stories and reading history can now follow you between devices.</p><strong className="accountAddress">{user.email}</strong><div className="accountActions"><button onClick={onClose}>Keep reading</button><button className="accountSecondary" onClick={onSignOut}>Sign out</button></div></> : <><p>Enter your email and we’ll send you a secure sign-in link. No password to remember.</p><form onSubmit={onSendLink}><label htmlFor="account-email">Email address</label><input id="account-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/><button type="submit">Email me a sign-in link</button></form></>}{status && <small className="accountStatus">{status}</small>}</section></div>;
}
const JOY_TYPES = ["chime", "question", "ripple", "doodle"];
const QUESTIONS = [
  {question: "Which animal has fingerprints so similar to ours that they can confuse investigators?", answer: "The koala. Its fingerprints have loops and whorls remarkably like human ones."},
  {question: "What color was the Statue of Liberty when it first arrived in New York?", answer: "Copper-brown. Its familiar green patina formed gradually through oxidation."},
  {question: "Which planet would float if you could place it in an unimaginably large bathtub?", answer: "Saturn. Its average density is lower than water’s."},
  {question: "What everyday musical instrument contains more than 12,000 individual parts?", answer: "A grand piano—an intricate little city of wood, felt, wire and metal."},
  {question: "What is a group of flamingos called?", answer: "A flamboyance, which seems exactly right."},
  {question: "Which fruit carries its seeds on the outside?", answer: "The strawberry. Each apparent seed is technically its own tiny fruit."},
  {question: "Which sea creature has three hearts?", answer: "The octopus—two hearts serve the gills and one circulates blood through the body."},
  {question: "What is the tiny plastic tip at the end of a shoelace called?", answer: "An aglet. It keeps the lace from fraying and makes threading much easier."},
  {question: "Which bird can fly backward?", answer: "The hummingbird, thanks to shoulder joints that let its wings rotate almost completely."},
  {question: "What was the first toy advertised on television?", answer: "Mr. Potato Head, in 1952."},
  {question: "Which country has more bicycles than people?", answer: "The Netherlands—bicycles comfortably outnumber residents."},
  {question: "What is the smell after rain called?", answer: "Petrichor, a word assembled from Greek roots for stone and the fluid of the gods."},
  {question: "Which mammal sleeps while holding hands so it won’t drift away?", answer: "Sea otters often hold paws while resting together in floating groups called rafts."},
  {question: "How long is a day on Venus compared with its year?", answer: "A Venusian day is longer: about 243 Earth days, while its year lasts about 225."},
  {question: "Which common kitchen ingredient can remain edible for thousands of years?", answer: "Honey. Sealed honey resists spoilage because it is acidic and contains very little water."},
  {question: "What do you call the dot above a lowercase i or j?", answer: "A tittle—a tiny word for a tiny typographic detail."},
  {question: "Which animal makes a cube-shaped dropping?", answer: "The wombat. Its unusually shaped intestines create remarkably stackable cubes."},
  {question: "What is the world’s largest living structure?", answer: "Australia’s Great Barrier Reef, built by countless tiny coral polyps."},
  {question: "Which instrument was played in space before any other?", answer: "The harmonica, played aboard Gemini 6 in 1965."},
  {question: "What color is an airplane’s so-called black box?", answer: "Bright orange, so it is easier to locate."},
  {question: "Which tree produces the world’s largest seed?", answer: "The coco de mer palm. A single seed can weigh more than 35 pounds."},
  {question: "What is a group of porcupines called?", answer: "A prickle—another collective noun that knew exactly what it was doing."},
  {question: "Which famous landmark grows slightly taller in summer?", answer: "The Eiffel Tower expands in the heat and can gain around six inches."},
  {question: "What does a cloud weigh?", answer: "A typical cumulus cloud can weigh around a million pounds, held aloft by dispersed droplets and rising air."}
];
const recentHistory = key => JSON.parse(localStorage.getItem(key) || "[]").filter(entry => Date.now() - entry.ts < WEEK_MS);
const chooseJoy = (type, edition, bench, history) => {
  const count = type === "question" ? QUESTIONS.length : 32, start = Math.abs(edition * 7 + bench * 11) % count;
  const recent = new Set(history.map(entry => entry.signature));
  for (let offset = 0; offset < count; offset++) { const variant = (start + offset) % count, signature = `${type}-${variant}`; if (!recent.has(signature)) return {variant, signature}; }
  const oldest = history.filter(entry => entry.signature.startsWith(`${type}-`)).sort((a, b) => a.ts - b.ts)[0];
  const variant = oldest ? Number(oldest.signature.split("-").pop()) : start;
  return {variant, signature: `${type}-${variant}`};
};
function playJoyTone(frequency) {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  const context = window.__betterStartAudio || (window.__betterStartAudio = new Audio());
  const oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.type = "sine"; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(.16, context.currentTime + .015); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .65); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .7);
}
function PocketEtch({variant}) {
  const canvasRef = useRef(null), drawing = useRef(false), [width, setWidth] = useState(4), [message, setMessage] = useState("Draw with mouse, finger, or right-click");
  const palettes = [["#f8ead1", "#263d38"], ["#dceeff", "#2457b8"], ["#ffe0da", "#8b2f3e"], ["#e6f0d8", "#385b32"], ["#20231f", "#f2cf4a"], ["#f1e4ff", "#633d91"]], [paper, ink] = palettes[variant % palettes.length];
  const setup = () => { const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.max(1, rect.width * ratio); canvas.height = Math.max(1, rect.height * ratio); const context = canvas.getContext("2d"); context.scale(ratio, ratio); context.fillStyle = paper; context.fillRect(0, 0, rect.width, rect.height); context.lineCap = "round"; context.lineJoin = "round"; };
  useEffect(() => { setup(); const observer = new ResizeObserver(setup); if (canvasRef.current) observer.observe(canvasRef.current); return () => observer.disconnect(); }, [paper]);
  const point = event => { const rect = event.currentTarget.getBoundingClientRect(); return {x: event.clientX - rect.left, y: event.clientY - rect.top}; };
  const start = event => { event.preventDefault(); drawing.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); const canvas = canvasRef.current, context = canvas.getContext("2d"), spot = point(event); context.strokeStyle = ink; context.fillStyle = ink; context.lineWidth = width; context.beginPath(); context.arc(spot.x, spot.y, width / 2, 0, Math.PI * 2); context.fill(); context.beginPath(); context.moveTo(spot.x, spot.y); setMessage("A tiny masterpiece is happening"); };
  const move = event => { if (!drawing.current) return; event.preventDefault(); const context = canvasRef.current.getContext("2d"), spot = point(event); context.strokeStyle = ink; context.lineWidth = width; context.lineTo(spot.x, spot.y); context.stroke(); };
  const stop = () => { drawing.current = false; };
  const erase = () => { setup(); setMessage("Clean slate. Goof around again."); };
  const shareDoodle = () => canvasRef.current?.toBlob(async blob => { if (!blob) return; const file = new File([blob], "meanwhile-doodle.png", {type: "image/png"}), text = "I made this little doodle on Meanwhile—rage-free news, information and good times."; try { if (navigator.canShare?.({files: [file]})) await navigator.share({files: [file], title: "My Meanwhile doodle", text}); else { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); URL.revokeObjectURL(link.href); setMessage("Doodle downloaded—ready to send to a pal."); } } catch {} }, "image/png");
  return <div className="joyBody doodleBody" style={{"--doodle-paper": paper, "--doodle-ink": ink}}><div className="joyTop"><span>JOY BREAK · POCKET ETCH</span><span>{message}</span></div><canvas ref={canvasRef} aria-label="Pocket Etch drawing canvas" onContextMenu={event => event.preventDefault()} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} /><div className="doodleTools"><div><button className={width === 2 ? "active" : ""} onClick={() => setWidth(2)}>Pencil</button><button className={width === 4 ? "active" : ""} onClick={() => setWidth(4)}>Marker</button><button className={width === 8 ? "active" : ""} onClick={() => setWidth(8)}>Crayon</button></div><div><button onClick={erase}>Shake it clean</button><button onClick={shareDoodle}>Share my doodle</button></div></div></div>;
}
function JoyTile({item, index}) {
  const [revealed, setRevealed] = useState(false), [muted, setMuted] = useState(false), [ripples, setRipples] = useState([]);
  const hue = item.variant * 37 % 360, colors = Array.from({length: 5}, (_, color) => `hsl(${(hue + color * 58) % 360} 72% 58%)`), roots = [196, 220, 246.94, 261.63, 293.66, 329.63], root = roots[item.variant % roots.length], ratios = [1, 1.25, 1.5, 1.875, 2], notes = ratios.map(ratio => root * ratio);
  const addRipple = event => { const rect = event.currentTarget.getBoundingClientRect(), id = Date.now(); setRipples(current => [...current.slice(-7), {id, x: event.clientX - rect.left, y: event.clientY - rect.top, color: colors[(current.length + item.edition) % colors.length]}]); setTimeout(() => setRipples(current => current.filter(ripple => ripple.id !== id)), 900); };
  const question = QUESTIONS[item.variant % QUESTIONS.length];
  return <article className={`tile tile-joy joy-${item.joyType} tile-pattern-${index % 9}`} data-joy-signature={item.signature}>
    {item.joyType === "chime" && <div className="joyBody chimeBody"><div className="joyTop"><span>JOY BREAK · COLOR CHIME</span><button onClick={() => setMuted(value => !value)} aria-label={muted ? "Turn sound on" : "Mute sound"}>{muted ? "Sound off" : "Sound on"}</button></div><h3>Tap a color.<br/>Make the morning ring.</h3><div className="chimeKeys">{colors.map((color, note) => <button key={color} style={{"--key": color}} onClick={() => !muted && playJoyTone(notes[note])} aria-label={`Play note ${note + 1}`}><i /></button>)}</div><p>No score. No song to finish. Just five nice sounds.</p></div>}
    {item.joyType === "question" && <div className="joyBody questionBody"><div className="joyTop"><span>ONE DELIGHTFUL QUESTION</span><span>?</span></div><h3>{question.question}</h3>{revealed ? <p className="joyAnswer">{question.answer}</p> : <button className="revealButton" onClick={() => setRevealed(true)}>Reveal the delightful answer <span>→</span></button>}</div>}
    {item.joyType === "ripple" && <button className="joyBody rippleBody" onPointerDown={addRipple} aria-label="Make colorful ripples"><div className="joyTop"><span>JOY BREAK · RIPPLE CANVAS</span><span>Touch anywhere</span></div><h3>Leave a little color behind.</h3>{ripples.map(ripple => <i className="joyRipple" key={ripple.id} style={{left: ripple.x, top: ripple.y, "--ripple": ripple.color}} />)}<small>Tap · tap · tap</small></button>}
    {item.joyType === "doodle" && <PocketEtch variant={item.variant} />}
  </article>;
}
function Story({item, index, paletteIndex = index, palette, onRate, onSave, onShare, saved}) {
  const tileRef = useRef(null);
  const [imageRejected, setImageRejected] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setImageRejected(false); setPlaying(false); }, [item.canonicalUrl]);
  // A failed image changes the presentation, never the story. Replacing the
  // entire card with visual-shelf photography would bypass the edition mix.
  const replacement = item;
  const hasImage = !!replacement.image && !imageRejected;
  const type = replacement.format || "article";
  const playable = type === "video" || type === "bandcamp";
  const playerUrl = type === "video" ? `https://www.youtube-nocookie.com/embed/${replacement.videoId}?autoplay=1&rel=0` : replacement.embedUrl;
  const inspectImage = event => {
    const image = event.currentTarget, longEdge = Math.max(image.naturalWidth, image.naturalHeight), shortEdge = Math.min(image.naturalWidth, image.naturalHeight);
    if (longEdge < 900 || shortEdge < 500 || image.naturalWidth * image.naturalHeight < 700000) setImageRejected(true);
  };
  useLayoutEffect(() => {
    const tile = tileRef.current;
    const body = tile?.querySelector(".tileBody");
    if (!tile || !body) return;
    const fitContents = () => {
      const headline = tile.querySelector("h3");
      if (!headline) return;
      tile.classList.remove("fit-tight");
      headline.style.fontSize = "";
      let size = parseFloat(getComputedStyle(headline).fontSize);
      const fits = () => {
        const tileBox = tile.getBoundingClientRect(), bodyBox = body.getBoundingClientRect(), headlineBox = headline.getBoundingClientRect();
        return headline.scrollWidth <= headline.clientWidth + 1 && body.scrollHeight <= body.clientHeight + 1 && bodyBox.top >= tileBox.top - 1 && bodyBox.bottom <= tileBox.bottom + 1 && headlineBox.top >= tileBox.top - 1 && headlineBox.bottom <= tileBox.bottom - 5;
      };
      while (!fits() && size > 13) {
        size -= .75;
        headline.style.fontSize = `${size}px`;
      }
      if (!fits()) {
        tile.classList.add("fit-tight");
        while (!fits() && size > 11) {
          size -= .5;
          headline.style.fontSize = `${size}px`;
        }
      }
    };
    const observer = new ResizeObserver(fitContents);
    observer.observe(tile);
    tile.querySelectorAll("img").forEach(image => image.addEventListener("load", fitContents));
    requestAnimationFrame(fitContents);
    document.fonts?.ready.then(() => requestAnimationFrame(fitContents));
    return () => { observer.disconnect(); tile.querySelectorAll("img").forEach(image => image.removeEventListener("load", fitContents)); };
  }, [replacement.canonicalUrl, playing]);
  const inkStyle = !hasImage && !playable ? mixedInk(paletteIndex, palette) : undefined;
  return <article ref={tileRef} style={inkStyle} className={`tile tile-${type} tile-pattern-${index % 9} ${hasImage ? "tile-has-image" : "tile-no-image tile-text-art tile-mixed-ink"} ${categoryClass(replacement.section)}`}>
    {playable && playing ? <div className="inlinePlayer"><iframe src={playerUrl} title={replacement.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div> : hasImage && (playable ? <button className="imageLink mediaTrigger" onClick={() => setPlaying(true)} aria-label={`Play ${replacement.title}`}><img src={replacement.image} alt="" onLoad={inspectImage} onError={() => setImageRejected(true)} /><span className="play">▶</span></button> : <a className="imageLink" href={replacement.url} target="_blank" rel="noreferrer"><img src={replacement.image} alt="" onLoad={inspectImage} onError={() => setImageRejected(true)} /></a>)}
    <div className="tileBody"><div className="kicker"><span>{replacement.mixLabel || replacement.section}</span><span>{type === "bandcamp" ? "New release" : type === "video" ? "Saved find" : age(replacement.date)}</span></div><h3><a href={replacement.url} target="_blank" rel="noreferrer">{replacement.title}</a></h3>{replacement.summary && type !== "visual" && <p>{replacement.summary.slice(0, type === "feature" ? 280 : 170)}</p>}<div className="meta">{replacement.sourcePackLabel && <i>From {replacement.sourcePackLabel}</i>}{replacement.source}</div><Feedback item={replacement} onRate={onRate} onSave={onSave} onShare={onShare} saved={saved}/></div>
  </article>;
}

export default function Home() {
  const [data, setData] = useState(null), [batches, setBatches] = useState(1), [moreGoodLoading, setMoreGoodLoading] = useState(false), [radio, setRadio] = useState(false), [now, setNow] = useState(new Date()), [saved, setSaved] = useState([]), [showSaved, setShowSaved] = useState(false), [showWelcome, setShowWelcome] = useState(false), [showSaveNudge, setShowSaveNudge] = useState(false), [showGenericNudge, setShowGenericNudge] = useState(false), [theme, setTheme] = useState("light"), [editionNote, setEditionNote] = useState("Composing edition"), [joyHistory, setJoyHistory] = useState([]), [profile, setProfile] = useState(null), [paletteIndex, setPaletteIndex] = useState(0), [user, setUser] = useState(null), [accountOpen, setAccountOpen] = useState(false), [accountEmail, setAccountEmail] = useState(""), [accountStatus, setAccountStatus] = useState("");
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data:{session}}) => setUser(session?.user || null));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!profile || user || showWelcome || sessionStorage.getItem("meanwhileSaveNudgeSeen") === "yes") return;
    const timer = setTimeout(() => setShowSaveNudge(true), 120000);
    return () => clearTimeout(timer);
  }, [profile, user, showWelcome]);
  useEffect(() => {
    if (profile || showWelcome || sessionStorage.getItem("meanwhileGenericNudgeSeen") === "yes") return;
    const timer = setTimeout(() => setShowGenericNudge(true), 180000);
    return () => clearTimeout(timer);
  }, [profile, showWelcome]);
  useEffect(() => {
    const savedTheme = localStorage.getItem("meanwhileTheme");
    setTheme(savedTheme || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("meanwhileTheme", theme);
  }, [theme]);
  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    const hydrateAccount = async () => {
      const localProfile = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; } })();
      const localSaved = (() => { try { return JSON.parse(localStorage.getItem("betterStartReaderSaved") || "[]"); } catch { return []; } })();
      const localHistory = storyHistory();
      const fetchCloudHistory = async () => {
        const rows = [], pageSize = 1000;
        for (let start = 0; start < SEEN_STORY_LEDGER_LIMIT; start += pageSize) {
          const {data:page, error} = await supabase.from("story_history").select("story_key,identity_keys,last_seen_at").eq("user_id", user.id).order("last_seen_at", {ascending:false}).range(start, start + pageSize - 1);
          if (error || !page?.length) break;
          rows.push(...page);
          if (page.length < pageSize) break;
        }
        return {data:rows};
      };
      const [{data:cloudProfile}, {data:cloudSaved}, {data:cloudHistory}] = await Promise.all([
        supabase.from("profiles").select("preferences").eq("user_id", user.id).maybeSingle(),
        supabase.from("saved_stories").select("story_key,story,saved_at").eq("user_id", user.id).order("saved_at", {ascending:false}).limit(200),
        fetchCloudHistory()
      ]);
      if (!active) return;
      const chosenProfile = cloudProfile?.preferences && Object.keys(cloudProfile.preferences).length ? cloudProfile.preferences : localProfile;
      if (chosenProfile) { localStorage.setItem(PROFILE_KEY, JSON.stringify(chosenProfile)); setProfile(chosenProfile); }
      if (!cloudProfile && localProfile) await supabase.from("profiles").upsert({user_id:user.id, preferences:localProfile});
      const mergedSaved = [...(cloudSaved || []).map(row => ({...row.story, savedAt:new Date(row.saved_at).getTime()})), ...localSaved].filter((item,index,array) => array.findIndex(candidate => itemKey(candidate) === itemKey(item)) === index).slice(0,200);
      localStorage.setItem("betterStartReaderSaved", JSON.stringify(mergedSaved)); setSaved(mergedSaved);
      if (localSaved.length) await supabase.from("saved_stories").upsert(localSaved.map(story => ({user_id:user.id, story_key:itemKey(story), story})), {onConflict:"user_id,story_key"});
      const completeHistory = [...localHistory, ...(cloudHistory || []).map(row => ({id:row.story_key, keys:row.identity_keys || [], ts:new Date(row.last_seen_at).getTime()}))].filter((entry,index,array) => array.findIndex(candidate => candidate.id === entry.id) === index);
      const mergedHistory = completeHistory.slice(-STORY_HISTORY_LIMIT);
      try { localStorage.setItem(STORY_HISTORY_KEY, JSON.stringify(mergedHistory)); } catch {}
      const syncedLedger = permanentSeenHashes();
      completeHistory.forEach(entry => [entry.id, ...(entry.keys || [])].filter(Boolean).forEach(value => syncedLedger.add(stableHash(value))));
      writeSeenLedger(syncedLedger);
      setAccountStatus("Your Meanwhile is synced.");
    };
    hydrateAccount();
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    setSaved(JSON.parse(localStorage.getItem("betterStartReaderSaved") || "[]")); setJoyHistory(recentHistory("betterStartReaderJoyHistory"));
    setShowWelcome(localStorage.getItem("meanwhileWelcomeSeenV1") !== "yes");
    const priorPalette = Number(localStorage.getItem("betterStartPaletteIndex") || "-1"), nextPalette = (priorPalette + 1) % EDITION_PALETTES.length;
    localStorage.setItem("betterStartPaletteIndex", String(nextPalette)); setPaletteIndex(nextPalette);
    let activeProfile = null;
    try { activeProfile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch {}
    setProfile(activeProfile);
    let lastLoad = Date.now();
    const loadEdition = async preserve => {
      const visit = `${Math.floor(Date.now() / EDITION_MS)}-${Date.now()}-${Math.random()}`, mediaHistory = recentHistory("betterStartReaderMediaHistory"), avoid = [...new Set(mediaHistory.map(entry => entry.id))].slice(-120).join(","), avoidStories = recentStoryAvoidance(), places = savedPlaces(), profileTerms = activeProfile ? [...(activeProfile.broadInterests || []), ...(activeProfile.specificInterests || []), ...(activeProfile.details || []), ...(activeProfile.granularInterests || []), ...(activeProfile.anythingElse || [])].slice(0, 72).join("|") : "";
      try { const today = localDayKey(new Date()), priorDay = localStorage.getItem("betterStartReaderDay"), hardRefresh = priorDay !== today; const next = await requestFeed({visit,avoid,avoidStories,places,interests:profileTerms}); localStorage.setItem("betterStartReaderDay", today); setJoyHistory(recentHistory("betterStartReaderJoyHistory")); setData(previous => prepareEdition(next, previous, preserve && !hardRefresh)); setEditionNote(`${preserve && !hardRefresh ? "Freshened" : "New"} ${new Date().toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})} edition`); lastLoad = Date.now(); } catch {}
    };
    loadEdition(false);
    const clock = setInterval(() => setNow(new Date()), 60000), editionTimer = setInterval(() => loadEdition(true), EDITION_MS);
    const onVisible = () => { if (!document.hidden && Date.now() - lastLoad >= EDITION_MS) loadEdition(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(clock); clearInterval(editionTimer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const daypart = now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening";
  const daypartMessages = DAYPART_MESSAGES[daypart], helloThought = daypartMessages[Math.abs(Math.floor(now.getTime() / EDITION_MS)) % daypartMessages.length];
  const date = now.toLocaleDateString(undefined, {weekday: "long", month: "long", day: "numeric"});
  const smallDelight = SMALL_DELIGHTS[Math.abs(data?.edition || Math.floor(Date.now() / EDITION_MS)) % SMALL_DELIGHTS.length];
  const uniqueFavorites = useMemo(() => { const seen = new Set(); (data?.tickerStories || [data?.ribbonFavorite]).filter(Boolean).forEach(item => identityKeys(item).forEach(key => seen.add(key))); return spreadAdjacentSources(claimUnique(data?.favorites || [], seen)); }, [data]);
  // The API has already composed gallery in balanced 20-story windows. Keep
  // that canonical order: merging the auxiliary shelves here used to destroy
  // the topic quotas and was the source of sports-heavy and repeated pages.
  const wall = useMemo(() => claimUnique(data?.gallery || []), [data]);
  const visibleBatches = useMemo(() => {
    const visibleWall = spreadAdjacentSources(wall.slice(0, batches * BATCH_SIZE));
    return Array.from({length: Math.ceil(visibleWall.length / BATCH_SIZE)}, (_, index) => visibleWall.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE)).filter(batch => batch.length);
  }, [wall, batches]);
  useEffect(() => { if (!wall.length) return; const visible = [...(data?.tickerStories || []), data?.goodNews, ...(data?.favorites || []), ...wall.slice(0, batches * BATCH_SIZE)].filter(Boolean), nowSeen = Date.now(), stories = storyHistory(), storyKeys = new Set(stories.flatMap(entry => [entry.id, ...(entry.keys || [])]).filter(Boolean)), seenLedger = permanentSeenHashes(), newHistory = []; visible.filter(item => item.format !== "joy").forEach(item => { const keys = identityKeys(item), id = itemKey(item); if (!id) return; identityHashes(item).forEach(hash => seenLedger.add(hash)); if (keys.some(key => storyKeys.has(key)) || storyKeys.has(id)) return; stories.push({id,keys,ts:nowSeen}); newHistory.push({user_id:user?.id, story_key:id, identity_keys:keys, story:item, last_seen_at:new Date(nowSeen).toISOString()}); storyKeys.add(id); keys.forEach(key => storyKeys.add(key)); }); writeSeenLedger(seenLedger); try { localStorage.setItem(STORY_HISTORY_KEY, JSON.stringify(stories.slice(-STORY_HISTORY_LIMIT))); } catch {} if (supabase && user && newHistory.length) supabase.from("story_history").upsert(newHistory, {onConflict:"user_id,story_key"}); const media = recentHistory("betterStartReaderMediaHistory"), mediaIds = new Set(media.map(entry => entry.id)); visible.filter(item => item.videoId && !mediaIds.has(item.videoId)).forEach(item => media.push({id: item.videoId, ts: nowSeen})); localStorage.setItem("betterStartReaderMediaHistory", JSON.stringify(media.slice(-300))); const joy = recentHistory("betterStartReaderJoyHistory"), joyIds = new Set(joy.map(entry => entry.signature)); visible.filter(item => item.signature && !joyIds.has(item.signature)).forEach(item => joy.push({signature: item.signature, ts:nowSeen})); localStorage.setItem("betterStartReaderJoyHistory", JSON.stringify(joy.slice(-300))); }, [data, wall, batches, user]);
  const rate = (item, action) => { const ratings = JSON.parse(localStorage.getItem("betterStartReaderFeedback") || "[]"); ratings.push({url: item.url, title: item.title, source: item.source, action, ts: Date.now()}); localStorage.setItem("betterStartReaderFeedback", JSON.stringify(ratings.slice(-250))); if (supabase && user) supabase.from("story_feedback").insert({user_id:user.id, story_key:itemKey(item), action, story:item}); };
  const toggleSave = item => setSaved(current => { const exists = current.some(savedItem => itemKey(savedItem) === itemKey(item)), next = exists ? current.filter(savedItem => itemKey(savedItem) !== itemKey(item)) : [{...item, savedAt: Date.now()}, ...current]; localStorage.setItem("betterStartReaderSaved", JSON.stringify(next.slice(0, 200))); if (supabase && user) { if (exists) supabase.from("saved_stories").delete().eq("user_id", user.id).eq("story_key", itemKey(item)); else supabase.from("saved_stories").upsert({user_id:user.id, story_key:itemKey(item), story:item}); } return next.slice(0, 200); });
  const sendSignInLink = async event => { event.preventDefault(); if (!supabase) { setAccountStatus("Supabase is not connected to this deployment yet."); return; } setAccountStatus("Sending your secure link…"); const {error} = await supabase.auth.signInWithOtp({email:accountEmail, options:{emailRedirectTo:location.origin}}); setAccountStatus(error ? error.message : "Check your email. Your sign-in link is on the way."); };
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setUser(null); setAccountStatus("Signed out on this device."); };
  const share = async item => { const text = `I found this on Meanwhile — rage-free news, information and good times.\n\n${item.title}`, params = new URLSearchParams({u: item.url, t: item.title, s: item.source || "", c: item.section || ""}); if (item.image) params.set("i", item.image); const shareUrl = `${location.origin}/share?${params}`; try { if (navigator.share) await navigator.share({title: `${item.title} — Meanwhile`, text, url: shareUrl}); else { await navigator.clipboard.writeText(`${text}\n${shareUrl}`); setEditionNote("Branded share link copied"); } } catch {} };
  const loadMoreGoodThings = async () => {
    if (moreGoodLoading) return;
    if (batches * BATCH_SIZE < wall.length) { setBatches(count => count + 1); return; }
    setMoreGoodLoading(true); setEditionNote("Finding more good things");
    try {
      const mediaHistory = recentHistory("betterStartReaderMediaHistory");
      const currentItems = [...(data?.tickerStories || []), data?.goodNews, ...(data?.favorites || []), ...(data?.important || []), ...(data?.gallery || []), ...(data?.media || []), ...(data?.serendipity || [])].filter(Boolean);
      const avoid = [...new Set(mediaHistory.map(entry => entry.id))].slice(-120).join(",");
      const currentStoryKeys = currentItems.flatMap(item => [itemKey(item), ...identityKeys(item)]);
      const avoidStories = [...new Set([...recentStoryAvoidance().split(",").filter(Boolean), ...currentStoryKeys.map(stableHash)])].slice(-SEEN_STORY_LEDGER_LIMIT).join(",");
      const places = savedPlaces(), profileTerms = profile ? [...(profile.broadInterests || []), ...(profile.specificInterests || []), ...(profile.details || []), ...(profile.granularInterests || []), ...(profile.anythingElse || [])].slice(0, 72).join("|") : "";
      const visit = `more-good-${Date.now()}-${Math.random()}`;
      const next = await requestFeed({visit,avoid,avoidStories,places,interests:profileTerms});
      const fresh = filterEditionGlobally(next);
      const existing = data?.gallery || [], seen = new Set(existing.flatMap(identityKeys));
      const additions = claimUnique(fresh?.gallery || [], seen);
      if (additions.length) {
        setData(previous => ({...previous, gallery:stampNew([...(previous?.gallery || []), ...additions])}));
        setBatches(count => count + 1); setEditionNote("More good things arrived");
      }
      else setEditionNote("You’re caught up — no repeats to show");
    } catch { setEditionNote("Couldn’t fetch more just yet"); }
    finally { setMoreGoodLoading(false); }
  };
  const savedKeys = useMemo(() => new Set(saved.map(itemKey)), [saved]);
  const clearProfile = () => { localStorage.removeItem(PROFILE_KEY); location.href = "/"; };
  const closeWelcome = () => { localStorage.setItem("meanwhileWelcomeSeenV1", "yes"); setShowWelcome(false); };
  const closeSaveNudge = () => { sessionStorage.setItem("meanwhileSaveNudgeSeen", "yes"); setShowSaveNudge(false); };
  const closeGenericNudge = () => { sessionStorage.setItem("meanwhileGenericNudgeSeen", "yes"); setShowGenericNudge(false); };
  const openSaveAccount = () => { closeSaveNudge(); setAccountStatus(""); setAccountOpen(true); };
  const identityClass = `identity-${data?.editorialIdentity?.id || "general"}`;
  const palette = EDITION_PALETTES[paletteIndex], masthead = mastheadPalette(palette), paletteStyle = {"--palette-1":palette[0],"--palette-2":palette[1],"--palette-3":palette[2],"--palette-4":palette[3]};
  const editionTitle = profile?.title?.replace(/^Meanwhile\s*[—-]\s*/i, "") || "";
  return <main style={paletteStyle} className={`shell daypart-${daypart} ${identityClass}`} data-editorial-identity={data?.editorialIdentity?.label || "Meanwhile"}>
    {showWelcome && <div className="welcomeVeil" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeWelcome(); }}><section className="welcomeNote" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><button className="welcomeClose" onClick={closeWelcome} aria-label="Close welcome message">×</button><span className="welcomeEyebrow">A small note before you begin</span><h2 id="welcome-title">Welcome to Meanwhile</h2><p className="welcomeSubline">A celebration of everything going on in the world besides the news.</p><ol><li>Explore a mix of science, food, travel, fashion, animals, ingenuity, kindness, culture and other good times.</li><li>Make your own personal edition of your favorite things.</li><li>Come back all the time. Everything is constantly refreshed.</li></ol><div className="welcomeActions"><button onClick={closeWelcome}>Start reading <span>→</span></button><a href="/make-it-yours" onClick={closeWelcome}>Make it mine</a></div></section></div>}
    {showSaveNudge && <div className="saveNudge" role="dialog" aria-labelledby="save-nudge-title"><button className="saveNudgeClose" onClick={closeSaveNudge} aria-label="Dismiss save edition message">×</button><span>Your edition is looking good</span><h2 id="save-nudge-title">Want to keep it?</h2><p>Sign up with your email and we’ll save your personalized Meanwhile.</p><small>We won’t spam you or sell your information. Promise. We just want to help you keep your edition.</small><div><button onClick={openSaveAccount}>Save my edition</button><button onClick={closeSaveNudge}>Maybe later</button></div></div>}
    {showGenericNudge && <div className="saveNudge genericNudge" role="dialog" aria-labelledby="generic-nudge-title"><button className="saveNudgeClose" onClick={closeGenericNudge} aria-label="Dismiss personalized edition invitation">×</button><span>Meanwhile, but more you</span><h2 id="generic-nudge-title">Want your own edition?</h2><p>Tell us a little about what you love and we’ll weave more of it into your feed.</p><small>It never becomes a filter bubble. At least half of every edition stays broad, surprising and edited by Meanwhile.</small><div><a href="/make-it-yours" onClick={closeGenericNudge}>Make it mine</a><button onClick={closeGenericNudge}>Keep reading</button></div></div>}
    {accountOpen && <AccountPanel user={user} email={accountEmail} setEmail={setAccountEmail} status={accountStatus} onSendLink={sendSignInLink} onSignOut={signOut} onClose={() => setAccountOpen(false)} />}
    <header className="mast"><div className="mastIdentity"><div className="brand brandVignelli" aria-label="Meanwhile">{"Meanwhile".split("").map((letter,index) => <span aria-hidden="true" style={{color:masthead[index]}} key={`${letter}-${index}`}>{letter}</span>)}</div>{editionTitle && <div className="editionName">{editionTitle}</div>}<div className="edition">Rage-free news, discovery & good times</div></div><div className="mastTools"><a className="personalizeButton" href="/make-it-yours">{profile ? "Tune my edition" : "Make it yours"}</a>{profile && <button className="genericButton" onClick={clearProfile}>Generic Edition</button>}<button className="accountButton" onClick={() => { setAccountStatus(user ? "Your Meanwhile is synced." : ""); setAccountOpen(true); }}>{user ? "My account" : "Sign in"}</button><button className="savedButton" onClick={() => setShowSaved(value => !value)}>Saved <b>{saved.length}</b></button><button className={`radio ${radio ? "radioOn" : ""}`} onClick={() => setRadio(!radio)} aria-label={`Meanwhile Radio ${radio ? "on" : "off"}`} title="Meanwhile Radio placeholder"><span>♪</span><small>{radio ? "ON" : "RADIO"}</small></button><button className="themeToggle" onClick={() => setTheme(value => value === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}><span>{theme === "dark" ? "☀" : "☾"}</span><small>{theme === "dark" ? "LIGHT" : "DARK"}</small></button></div></header>
    <div className="hello"><h1>{greeting}.</h1><div className="helloAside"><p>{date}</p><span>{helloThought}</span></div></div>

    <section className="ribbon" aria-label="Quick facts"><div className="weatherFact"><b>{greeting}</b><span>{date}</span></div><GoodNewsWire items={spreadAdjacentSources(data?.tickerStories || (data?.ribbonFavorite ? [data.ribbonFavorite] : []))}/><RollingFact label={editionNote}>{smallDelight}</RollingFact></section>

    {showSaved && <section className="savedShelf"><div className="sectionHead"><div><span>Your keepers</span><h2>Saved Good Stuff</h2></div><button onClick={() => setShowSaved(false)}>Close</button></div>{saved.length ? <div className="savedGrid">{saved.map(item => <article key={itemKey(item)}><span>{item.section}</span><h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h3><div><button onClick={() => share(item)}>Share</button><button onClick={() => toggleSave(item)}>Remove</button></div></article>)}</div> : <p className="emptySaved">Things you save will wait here—even when the wall refreshes.</p>}</section>}

    <section className="favoritesSection"><div className="sectionHead"><div><span>A few especially nice things</span><h2>Bright Spots</h2></div><p>Kindness, ingenuity & excellent dogs</p></div><div className="favorites">{uniqueFavorites.map(item => <a className="favorite" href={item.url} target="_blank" rel="noreferrer" key={item.canonicalUrl}><span>{age(item.date)}</span><h3>{item.title}</h3><b>{item.source}</b></a>)}</div></section>

    <section className="gallerySection"><div className="sectionHead wallHead"><div><span>Every good magazine on the table</span><h2>Good Stuff</h2></div><p>{profile ? "Your interests, with the wider world left in" : "A deliberately broad, lively mix"}</p></div>{visibleBatches.length ? <div className="galleryWall">{visibleBatches.map((batch, batchIndex) => <div className="galleryBatch" key={batchIndex}>{arrangeFrameClusters(batch).map((cluster, clusterIndex) => { const variant = (batchIndex * 3 + clusterIndex) % 3; return <div className={`tetrisCluster clusterVariant-${variant} clusterCount-${cluster.length} ${cluster.length <= 5 ? "partialCluster" : ""}`} key={clusterIndex}>{cluster.map((item, index) => { const absoluteIndex = batchIndex * BATCH_SIZE + clusterIndex * 10 + index; return item.format === "joy" ? <JoyTile item={item} index={absoluteIndex} key={item.canonicalUrl} /> : <Story item={item} index={absoluteIndex} paletteIndex={absoluteIndex} palette={palette} onRate={rate} onSave={toggleSave} onShare={share} saved={savedKeys.has(itemKey(item))} key={item.canonicalUrl} />; })}</div>; })}</div>)}</div> : <div className="loading" role="status" aria-live="polite"><span>Getting everything ready…</span><div className="loadingTrack" aria-hidden="true"><i /></div><small>Finding good things from around the world</small></div>}
      {data && <div className="loadWrap"><button className="loadBtn" onClick={loadMoreGoodThings} disabled={moreGoodLoading}>{moreGoodLoading ? "Finding More Good Things…" : "Load 20 More Good Things"}<span>↓</span></button></div>}
    </section>

    <footer><b>MEANWHILE</b><span>Good things worth knowing · No outrage required</span></footer>
  </main>;
}
