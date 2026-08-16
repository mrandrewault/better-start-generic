"use client";
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";

const FALLBACK = "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1400&q=80";
const BATCH_SIZE = 25;
const SERENDIPITY_BATCH_SIZE = 9;
const EDITION_MS = 2 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const categoryClass = section => `cat-${(section || "news").toLowerCase().replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, "")}`;
const normalizedIdentityTitle = value => (value || "").toLowerCase().replace(/\b(the|a|an|and|or|but|to|of|for|in|on|at|with|from)\b/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const identityKeys = item => [`url:${item?.canonicalUrl || item?.url || ""}`, `title:${item?.normalizedTitle || normalizedIdentityTitle(item?.title)}`].filter(key => !key.endsWith(":"));
const claimUnique = (items = [], seen = new Set()) => items.filter(item => {
  const keys = identityKeys(item);
  if (!keys.length || keys.some(key => seen.has(key))) return false;
  keys.forEach(key => seen.add(key));
  return true;
});
const arrangeForFrames = items => {
  const arranged = [...items];
  const compactSlots = [1, 3, 4, 7, 8, 9].filter(index => index < arranged.length);
  const visualSlots = [0, 2, 5, 6].filter(index => index < arranged.length);
  const needsVisualFrame = item => !!item?.image || ["video", "bandcamp", "visual", "social", "joy"].includes(item?.format);
  visualSlots.filter(index => !needsVisualFrame(arranged[index])).forEach(index => {
    const swap = compactSlots.find(candidate => needsVisualFrame(arranged[candidate]));
    if (swap !== undefined) [arranged[index], arranged[swap]] = [arranged[swap], arranged[index]];
  });
  return arranged;
};
function age(date) { if (!date) return "From the shelf"; const hours = (Date.now() - new Date(date)) / 36e5; return hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min ago` : hours < 24 ? `${Math.round(hours)} hr ago` : `${Math.round(hours / 24)}d ago`; }
const itemKey = item => item.canonicalUrl || item.url;
const prioritizeUnseen = items => {
  const seen = new Set(recentHistory("betterStartReaderStoryHistory").map(entry => entry.id));
  return items.filter(item => !seen.has(itemKey(item)));
};
const blendPool = (previous = [], next = []) => {
  // Keep only one fifth of the current wall when the automatic two-hour
  // refresh runs. A browser reload passes preserve=false and keeps nothing.
  const keep = previous.slice(0, Math.ceil(Math.min(previous.length, next.length) * .20));
  const used = new Set(keep.map(itemKey));
  return [...keep, ...prioritizeUnseen(next).filter(item => !used.has(itemKey(item)))].slice(0, next.length);
};
const prepareEdition = (next, previous, preserve) => ({...next, gallery: preserve ? blendPool(previous?.gallery, next.gallery) : prioritizeUnseen(next.gallery), media: preserve ? blendPool(previous?.media, next.media) : prioritizeUnseen(next.media), serendipity: preserve ? blendPool(previous?.serendipity, next.serendipity) : prioritizeUnseen(next.serendipity)});
function Feedback({item, onRate, onSave, onShare, saved}) { return <div className="controls" aria-label="Story feedback"><button onClick={() => onRate(item, "more")}>♡ More like this</button><button className={saved ? "savedControl" : ""} onClick={() => onSave(item)}>{saved ? "Saved ✓" : "Save"}</button><button onClick={() => onShare(item)}>Share</button><button onClick={() => onRate(item, "less")}>Less</button><button onClick={() => onRate(item, "political")}>Too political</button><button onClick={() => onRate(item, "depressing")}>Too depressing</button></div>; }
function RollingFact({label, children}) { return <div className="rollingFact"><b>{label}</b><span className="ticker"><i>{children}</i></span></div>; }
function GoodNewsWire({items = []}) { return <div className="rollingFact newsWire"><b>Good news wire</b><span className="ticker"><i>{items.length ? items.map((item, index) => <a href={item.url} target="_blank" rel="noreferrer" key={item.canonicalUrl || item.url}>{item.title}<em>{item.source}</em>{index < items.length - 1 && <strong>✦</strong>}</a>) : "Finding several small reasons for optimism…"}</i></span></div>; }
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
  const shareDoodle = () => canvasRef.current?.toBlob(async blob => { if (!blob) return; const file = new File([blob], "better-start-doodle.png", {type: "image/png"}), text = "I made this little doodle on Better Start—rage-free news, information and good times."; try { if (navigator.canShare?.({files: [file]})) await navigator.share({files: [file], title: "My Better Start doodle", text}); else { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); URL.revokeObjectURL(link.href); setMessage("Doodle downloaded—ready to send to a pal."); } } catch {} }, "image/png");
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
function Story({item, index, onRate, onSave, onShare, saved}) {
  const tileRef = useRef(null);
  const type = item.format || "article";
  const [playing, setPlaying] = useState(false);
  const playable = type === "video" || type === "bandcamp";
  const playerUrl = type === "video" ? `https://www.youtube-nocookie.com/embed/${item.videoId}?autoplay=1&rel=0` : item.embedUrl;
  useLayoutEffect(() => {
    const tile = tileRef.current;
    const cluster = tile?.closest(".tetrisCluster");
    if (!tile || !cluster) return;
    const fitContents = () => {
      const headline = tile.querySelector("h3");
      if (!headline) return;
      headline.style.fontSize = "";
      let size = parseFloat(getComputedStyle(headline).fontSize);
      while ((tile.scrollHeight > tile.clientHeight + 1 || headline.scrollWidth > headline.clientWidth + 1) && size > 14) {
        size -= 1;
        headline.style.fontSize = `${size}px`;
      }
    };
    const observer = new ResizeObserver(fitContents);
    observer.observe(cluster);
    tile.querySelectorAll("img").forEach(image => image.addEventListener("load", fitContents));
    requestAnimationFrame(fitContents);
    return () => observer.disconnect();
  }, [item.canonicalUrl, playing]);
  return <article ref={tileRef} className={`tile tile-${type} tile-pattern-${index % 9} ${item.image ? "tile-has-image" : "tile-no-image"} ${categoryClass(item.section)}`}>
    {playable && playing ? <div className="inlinePlayer"><iframe src={playerUrl} title={item.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div> : item.image && (playable ? <button className="imageLink mediaTrigger" onClick={() => setPlaying(true)} aria-label={`Play ${item.title}`}><img src={item.image} alt="" onError={event => {event.currentTarget.src = FALLBACK;}} /><span className="play">▶</span></button> : <a className="imageLink" href={item.url} target="_blank" rel="noreferrer"><img src={item.image} alt="" onError={event => {event.currentTarget.src = FALLBACK;}} /></a>)}
    <div className="tileBody"><div className="kicker"><span>{item.section}</span><span>{type === "bandcamp" ? "New release" : type === "video" ? "Saved find" : age(item.date)}</span></div><h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h3>{item.summary && type !== "visual" && <p>{item.summary.slice(0, type === "feature" ? 280 : 170)}</p>}<div className="meta">{item.source}</div><Feedback item={item} onRate={onRate} onSave={onSave} onShare={onShare} saved={saved}/></div>
  </article>;
}

export default function Home() {
  const [data, setData] = useState(null), [batches, setBatches] = useState(1), [serendipityCount, setSerendipityCount] = useState(3), [radio, setRadio] = useState(false), [now, setNow] = useState(new Date()), [saved, setSaved] = useState([]), [showSaved, setShowSaved] = useState(false), [editionNote, setEditionNote] = useState("Composing edition"), [joyHistory, setJoyHistory] = useState([]);
  useEffect(() => {
    setSaved(JSON.parse(localStorage.getItem("betterStartReaderSaved") || "[]")); setJoyHistory(recentHistory("betterStartReaderJoyHistory"));
    let lastLoad = Date.now();
    const loadEdition = async preserve => {
      const visit = `${Math.floor(Date.now() / EDITION_MS)}-${Date.now()}-${Math.random()}`, mediaHistory = recentHistory("betterStartReaderMediaHistory"), avoid = [...new Set(mediaHistory.map(entry => entry.id))].slice(-120).join(",");
      try { const today = new Date().toISOString().slice(0, 10), priorDay = localStorage.getItem("betterStartReaderDay"), hardRefresh = priorDay !== today; const next = await (await fetch(`/api/feed?visit=${encodeURIComponent(visit)}&avoid=${encodeURIComponent(avoid)}`, {cache: "no-store"})).json(); localStorage.setItem("betterStartReaderDay", today); setJoyHistory(recentHistory("betterStartReaderJoyHistory")); setData(previous => prepareEdition(next, previous, preserve && !hardRefresh)); setEditionNote(`${preserve && !hardRefresh ? "Freshened" : "New"} ${new Date().toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})} edition`); lastLoad = Date.now(); } catch {}
    };
    loadEdition(false);
    const clock = setInterval(() => setNow(new Date()), 60000), editionTimer = setInterval(() => loadEdition(true), EDITION_MS);
    const onVisible = () => { if (!document.hidden && Date.now() - lastLoad >= EDITION_MS) loadEdition(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(clock); clearInterval(editionTimer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const daypart = now.getHours() < 10 ? "sunrise" : now.getHours() < 12 ? "lateMorning" : now.getHours() < 17 ? "afternoon" : "evening";
  const helloThought = daypart === "sunrise" ? "Fresh coffee. Open curtains. The world still contains wonders." : daypart === "lateMorning" ? "A bright little detour before the day gets away." : daypart === "afternoon" ? "A second wind, made of curiosity instead of caffeine." : "A softer landing for the end of the day.";
  const date = now.toLocaleDateString(undefined, {weekday: "long", month: "long", day: "numeric"});
  const uniqueFavorites = useMemo(() => { const seen = new Set(); (data?.tickerStories || [data?.ribbonFavorite]).filter(Boolean).forEach(item => identityKeys(item).forEach(key => seen.add(key))); return claimUnique(data?.favorites || [], seen); }, [data]);
  const wall = useMemo(() => { const pageSeen = new Set(); [...(data?.tickerStories || [data?.ribbonFavorite]), data?.goodNews, ...(data?.favorites || []), ...(data?.important || [])].filter(Boolean).forEach(item => identityKeys(item).forEach(key => pageSeen.add(key))); const stories = claimUnique(data?.gallery || [], pageSeen), media = claimUnique(data?.media || [], pageSeen), mixed = []; while (stories.length || media.length) { mixed.push(...stories.splice(0, 3)); if (media.length) mixed.push(media.shift()); } const result = [], pool = [...mixed], lastSeen = new Map(); while (pool.length) { const recent = result.slice(-20).map(item => item.source); let index = pool.findIndex(item => !recent.includes(item.source)); if (index < 0) { let oldest = Infinity; pool.forEach((item, candidate) => { const seen = lastSeen.get(item.source) ?? -Infinity; if (seen < oldest) { oldest = seen; index = candidate; } }); } const item = pool.splice(Math.max(0, index), 1)[0]; lastSeen.set(item.source, result.length); result.push(item); } const edition = data?.edition || 0, joyful = [], reserved = [...joyHistory]; for (let start = 0, bench = 0; start < result.length; start += 24, bench++) { const group = result.slice(start, start + 24), position = Math.min(group.length, 6 + bench % 5), joyType = JOY_TYPES[(edition + bench) % JOY_TYPES.length], choice = chooseJoy(joyType, edition, bench, reserved); reserved.push({signature: choice.signature, ts: Date.now()}); group.splice(position, 0, {format: "joy", joyType, variant: choice.variant, signature: choice.signature, edition, title: "A small Better Start joy break", source: "Better Start Joy Bench", section: "JOY", canonicalUrl: `joy-${edition}-${bench}-${choice.signature}`, url: `#joy-${edition}-${bench}`}); joyful.push(...group); } return joyful; }, [data, joyHistory]);
  const uniqueSerendipity = useMemo(() => { const pageSeen = new Set(); [...(data?.tickerStories || [data?.ribbonFavorite]), data?.goodNews, ...(data?.favorites || []), ...(data?.important || []), ...wall].filter(item => item && item.format !== "joy").forEach(item => identityKeys(item).forEach(key => pageSeen.add(key))); return claimUnique(data?.serendipity || [], pageSeen); }, [data, wall]);
  const visibleBatches = useMemo(() => Array.from({length: batches}, (_, index) => wall.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE)).filter(batch => batch.length), [wall, batches]);
  useEffect(() => { if (!wall.length) return; const visible = wall.slice(0, batches * BATCH_SIZE), nowSeen = Date.now(), stories = recentHistory("betterStartReaderStoryHistory"), storyIds = new Set(stories.map(entry => entry.id)); visible.filter(item => item.format !== "joy" && !storyIds.has(itemKey(item))).forEach(item => stories.push({id:itemKey(item),ts:nowSeen})); localStorage.setItem("betterStartReaderStoryHistory", JSON.stringify(stories.slice(-1200))); const media = recentHistory("betterStartReaderMediaHistory"), mediaIds = new Set(media.map(entry => entry.id)); visible.filter(item => item.videoId && !mediaIds.has(item.videoId)).forEach(item => media.push({id: item.videoId, ts: nowSeen})); localStorage.setItem("betterStartReaderMediaHistory", JSON.stringify(media.slice(-300))); const joy = recentHistory("betterStartReaderJoyHistory"), joyIds = new Set(joy.map(entry => entry.signature)); visible.filter(item => item.signature && !joyIds.has(item.signature)).forEach(item => joy.push({signature: item.signature, ts: nowSeen})); localStorage.setItem("betterStartReaderJoyHistory", JSON.stringify(joy.slice(-300))); }, [wall, batches]);
  const rate = (item, action) => { const ratings = JSON.parse(localStorage.getItem("betterStartReaderFeedback") || "[]"); ratings.push({url: item.url, title: item.title, source: item.source, action, ts: Date.now()}); localStorage.setItem("betterStartReaderFeedback", JSON.stringify(ratings.slice(-250))); };
  const toggleSave = item => setSaved(current => { const exists = current.some(savedItem => itemKey(savedItem) === itemKey(item)), next = exists ? current.filter(savedItem => itemKey(savedItem) !== itemKey(item)) : [{...item, savedAt: Date.now()}, ...current]; localStorage.setItem("betterStartReaderSaved", JSON.stringify(next.slice(0, 200))); return next.slice(0, 200); });
  const share = async item => { const text = `I found this on Better Start — rage-free news, information and good times.\n\n${item.title}`, params = new URLSearchParams({u: item.url, t: item.title, s: item.source || "", c: item.section || ""}); if (item.image) params.set("i", item.image); const shareUrl = `${location.origin}/share?${params}`; try { if (navigator.share) await navigator.share({title: `${item.title} — Better Start`, text, url: shareUrl}); else { await navigator.clipboard.writeText(`${text}\n${shareUrl}`); setEditionNote("Branded share link copied"); } } catch {} };
  const savedKeys = useMemo(() => new Set(saved.map(itemKey)), [saved]);
  return <main className={`shell daypart-${daypart}`}>
    <header className="mast"><div><div className="brand">Better Start Reader</div><div className="edition">Rage-free news, discovery & good times</div></div><div className="mastTools"><button className="savedButton" onClick={() => setShowSaved(value => !value)}>Saved <b>{saved.length}</b></button><button className={`radio ${radio ? "radioOn" : ""}`} onClick={() => setRadio(!radio)} aria-label={`Better Start Radio ${radio ? "on" : "off"}`} title="Better Start Radio placeholder"><span>♪</span><small>{radio ? "ON" : "RADIO"}</small></button></div></header>
    <div className="hello"><h1>{greeting}.</h1><div className="helloAside"><p>{date}</p><span>{helloThought}</span></div></div>

    <section className="ribbon" aria-label="Quick facts"><div className="weatherFact"><b>{greeting}</b><span>{date}</span></div><GoodNewsWire items={data?.tickerStories || (data?.ribbonFavorite ? [data.ribbonFavorite] : [])}/><RollingFact label={editionNote}>Fresh stories, useful discoveries and excellent creatures.</RollingFact></section>

    {showSaved && <section className="savedShelf"><div className="sectionHead"><div><span>Your keepers</span><h2>Saved Good Stuff</h2></div><button onClick={() => setShowSaved(false)}>Close</button></div>{saved.length ? <div className="savedGrid">{saved.map(item => <article key={itemKey(item)}><span>{item.section}</span><h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h3><div><button onClick={() => share(item)}>Share</button><button onClick={() => toggleSave(item)}>Remove</button></div></article>)}</div> : <p className="emptySaved">Things you save will wait here—even when the wall refreshes.</p>}</section>}

    <section className="favoritesSection"><div className="sectionHead"><div><span>A few especially nice things</span><h2>Bright Spots</h2></div><p>Kindness, ingenuity & excellent dogs</p></div><div className="favorites">{uniqueFavorites.map(item => <a className="favorite" href={item.url} target="_blank" rel="noreferrer" key={item.canonicalUrl}><span>{age(item.date)}</span><h3>{item.title}</h3><b>{item.source}</b></a>)}</div></section>

    <section className="gallerySection"><div className="sectionHead wallHead"><div><span>Every good magazine on the table</span><h2>Good Stuff</h2></div><p>Chosen for joy, curiosity & variety</p></div>{visibleBatches.length ? visibleBatches.map((batch, batchIndex) => <div className="galleryBatch" key={batchIndex}>{Array.from({length: Math.ceil(batch.length / 10)}, (_, clusterIndex) => { const cluster = arrangeForFrames(batch.slice(clusterIndex * 10, (clusterIndex + 1) * 10)), variant = (batchIndex * 3 + clusterIndex) % 3; return <div className={`tetrisCluster clusterVariant-${variant} clusterCount-${cluster.length} ${cluster.length <= 5 ? "partialCluster" : ""}`} key={clusterIndex}>{cluster.map((item, index) => item.format === "joy" ? <JoyTile item={item} index={batchIndex * BATCH_SIZE + clusterIndex * 10 + index} key={item.canonicalUrl} /> : <Story item={item} index={batchIndex * BATCH_SIZE + clusterIndex * 10 + index} onRate={rate} onSave={toggleSave} onShare={share} saved={savedKeys.has(itemKey(item))} key={item.canonicalUrl} />)}</div>; })}</div>) : <div className="loading"><span>Composing today&apos;s wall</span><i /><i /><i /></div>}
      {batches * BATCH_SIZE < wall.length && <div className="loadWrap"><button className="loadBtn" onClick={() => setBatches(count => count + 1)}>Load 25 More Good Things<span>↓</span></button></div>}
    </section>

    <section className="important"><div className="importantIntro"><span>Worth knowing</span><h2>Good News With Consequence</h2><p>A small, calm briefing about discoveries, progress and people making things better.</p></div><div className="importantGrid">{(data?.important || []).map((item, index) => <Story item={item} index={index} onRate={rate} onSave={toggleSave} onShare={share} saved={savedKeys.has(itemKey(item))} key={item.canonicalUrl} />)}</div></section>
    {!!uniqueSerendipity.length && <section className="serendipity"><div className="sectionHead"><div><span>One more magazine underneath</span><h2>You Didn&apos;t Ask For This…</h2></div><p>Worth the detour</p></div><div className="serendipityWall">{Array.from({length: Math.ceil(Math.min(serendipityCount, uniqueSerendipity.length) / 10)}, (_, clusterIndex) => { const cluster = arrangeForFrames(uniqueSerendipity.slice(clusterIndex * 10, Math.min(serendipityCount, (clusterIndex + 1) * 10))), variant = (clusterIndex + 1) % 3; return <div className={`tetrisCluster clusterVariant-${variant} clusterCount-${cluster.length} ${cluster.length <= 5 ? "partialCluster" : ""}`} key={clusterIndex}>{cluster.map((item, index) => <Story item={item} index={clusterIndex * 10 + index} onRate={rate} onSave={toggleSave} onShare={share} saved={savedKeys.has(itemKey(item))} key={item.canonicalUrl} />)}</div>; })}</div>{serendipityCount < uniqueSerendipity.length && <div className="loadWrap"><button className="loadBtn surpriseBtn" onClick={() => setSerendipityCount(count => count + SERENDIPITY_BATCH_SIZE)}>Add More Stuff I Didn&apos;t Ask For<span>↓</span></button></div>}</section>}
    <footer><b>BETTER START</b><span>Good things worth knowing · No outrage required</span></footer>
  </main>;
}
