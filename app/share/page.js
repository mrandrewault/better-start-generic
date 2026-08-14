const safeText = (value, fallback = "Something good worth sharing") => typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : fallback;
const safeUrl = value => {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; }
  catch { return null; }
};

export function generateMetadata({searchParams}) {
  const title = safeText(searchParams?.t);
  const source = safeText(searchParams?.s, "the original publisher");
  const image = safeUrl(searchParams?.i);
  return {
    title: `${title} — Shared from Better Start`,
    description: `I found this on Better Start — rage-free news, information and good times. Read the original story from ${source}.`,
    openGraph: {title, description: `Shared from Better Start · Rage-free news, information and good times.`, type: "article", siteName: "Better Start", ...(image ? {images: [{url: image}]} : {})},
    twitter: {card: image ? "summary_large_image" : "summary", title, description: "Shared from Better Start · Rage-free news, information and good times.", ...(image ? {images: [image]} : {})}
  };
}

export default function SharedStory({searchParams}) {
  const title = safeText(searchParams?.t), source = safeText(searchParams?.s, "Original source"), section = safeText(searchParams?.c, "GOOD STUFF"), url = safeUrl(searchParams?.u), image = safeUrl(searchParams?.i);
  return <main className="sharePage">
    <header className="shareMast"><a href="/" className="shareBrand">Better Start</a><span>Shared good stuff</span></header>
    <article className={`shareStory ${image ? "shareHasImage" : ""}`}>
      {image && <div className="shareImage"><img src={image} alt="" /></div>}
      <div className="shareCopy"><span className="shareKicker">{section}</span><h1>{title}</h1><p className="shareSource">Originally published by {source}</p><p className="sharePromise">I found this on Better Start—<strong>rage-free news, information and good times.</strong></p>{url ? <a className="shareRead" href={url} target="_blank" rel="noreferrer">Read the original story <span>↗</span></a> : <p>The original story link wasn&apos;t included.</p>}</div>
    </article>
    <aside className="shareInvite"><span>A better way into the day</span><h2>Interesting things.<br/>None of the rage.</h2><p>Better Start composes a joyful mix of news, music, art, science, food, film, photography, animals, sports and delightful detours.</p><a href="/">See today&apos;s Better Start <span>→</span></a></aside>
    <footer className="shareFooter">BETTER START · READ SOMETHING GOOD</footer>
  </main>;
}
