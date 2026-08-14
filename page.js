
"use client";
import {useEffect,useState} from "react";
const FALLBACK="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";

function age(d){if(!d)return"";const h=(Date.now()-new Date(d))/36e5;return h<1?`${Math.max(1,Math.round(h*60))} min ago`:h<24?`${Math.round(h)} hr ago`:`${Math.round(h/24)}d ago`}
function Feedback({item,onRate}){return <div className="controls"><button onClick={()=>onRate(item,"more")}>♡ More like this</button><button onClick={()=>onRate(item,"less")}>× Less</button><button onClick={()=>onRate(item,"political")}>Too political</button><button onClick={()=>onRate(item,"depressing")}>Too depressing</button></div>}
function Card({item,onRate}){return <article className="card"><img src={item.image||FALLBACK} alt=""/><div className="kicker">{item.section}</div><h3><a href={item.url} target="_blank">{item.title}</a></h3>{item.summary&&<p>{item.summary.slice(0,220)}</p>}<div className="meta">{item.source} · {age(item.date)}</div><Feedback item={item} onRate={onRate}/></article>}

export default function Home(){
 const [data,setData]=useState(null),[weather,setWeather]=useState(null),[more,setMore]=useState(false),[now,setNow]=useState(new Date());
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);fetch("/api/feed").then(r=>r.json()).then(setData).catch(()=>{});fetch("/api/weather").then(r=>r.json()).then(setWeather).catch(()=>{});return()=>clearInterval(t)},[]);
 const greeting=now.getHours()<12?"GOOD MORNING":now.getHours()<17?"GOOD AFTERNOON":"GOOD EVENING";
 const date=now.toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"});
 const rate=(item,action)=>{const a=JSON.parse(localStorage.getItem("betterStartFeedback")||"[]");a.push({url:item.url,title:item.title,source:item.source,action,ts:Date.now()});localStorage.setItem("betterStartFeedback",JSON.stringify(a.slice(-250)))};
 const f=data?.forYou||[], hero=f[0], side=f.slice(1,4), flow=f.slice(4,more?18:10);

 return <main className="shell">
  <header className="mast"><div className="brand">Better Start — Andrew&apos;s Edition</div><div className="micro">{data?`${data.sourceStatus.successful}/${data.sourceStatus.total} live feeds connected`:"Loading live edition…"}</div></header>
  <div className="greeting">{greeting}</div><div className="date">{date}</div>

  <div className="glance">
   <div className="glanceCard"><div className="glanceKicker">Weather · New Canaan</div><div className="glanceMain">{weather?.high?`${weather.high}° / ${weather.low}°`:"Loading…"}</div><div className="glanceSub">{weather?.precip!=null?`${weather.precip}% precipitation · ${weather.current}° now`:"Live forecast"}</div></div>
   <div className="glanceCard"><div className="glanceKicker">Today's soundtrack</div><div className="glanceMain">Better Start Radio</div><div className="glanceSub">Reserved for the simple one-button music idea.</div></div>
   <div className="glanceCard"><div className="glanceKicker">Freshest favorite</div><div className="glanceMain">{data?.favorites?.[0]?.name||"Loading…"}</div><div className="glanceSub">{data?.favorites?.[0]?.title?.slice(0,85)||"Checking favorites…"}</div></div>
   <div className="glanceCard"><div className="glanceKicker">Visual break</div><div className="glanceMain">Today's Eye</div><div className="glanceSub">Three photo/art favorites rotate here.</div></div>
  </div>

  <section className="section"><div className="sectionHead"><h2>Just In From Your Favorites</h2><span>Recent posts, not a firehose</span></div><div className="favorites">
   {(data?.favorites||[]).slice(0,6).map((x,i)=><a className="fav" href={x.url} target="_blank" key={i}><div className="kicker">Favorite · {age(x.date)}</div><h3>{x.title}</h3><div className="meta">{x.name}</div></a>)}
  </div></section>

  <section className="section"><div className="sectionHead"><h2>For You</h2><span>Strongest personal matches</span></div>
   {hero?<><div className="heroGrid"><article className="hero"><img src={hero.image||FALLBACK} alt=""/><div className="kicker">{hero.section}</div><h1><a href={hero.url} target="_blank">{hero.title}</a></h1>{hero.summary&&<div className="heroDek">{hero.summary.slice(0,300)}</div>}<div className="meta">{hero.source} · {age(hero.date)}</div><Feedback item={hero} onRate={rate}/></article>
   <div className="sideList">{side.map((s,i)=><article className="story" key={i}><div className="kicker">{s.section}</div><h3><a href={s.url} target="_blank">{s.title}</a></h3>{s.summary&&<p>{s.summary.slice(0,170)}</p>}<div className="meta">{s.source} · {age(s.date)}</div><Feedback item={s} onRate={rate}/></article>)}</div></div>
   <div className="fullFlow">{flow.map((s,i)=><Card item={s} onRate={rate} key={i}/>)}</div><div className="loadWrap"><button className="loadBtn" onClick={()=>setMore(!more)}>{more?"Show fewer stories":"Load more good news"}</button></div></>:<div className="status">Gathering live stories…</div>}
  </section>

  <section className="section"><div className="sectionHead"><h2>You Should Know</h2><span>Importance override</span></div><div className="grid3">{(data?.important||[]).map((s,i)=><Card item={s} onRate={rate} key={i}/>)}</div></section>

  <section className="section"><div className="sectionHead"><h2>Today's Eye</h2><span>Photo & art inspiration</span></div><div className="eye"><div><span className="kicker">Visual favorite</span><strong>Magnum Photos</strong></div><div><span className="kicker">Visual favorite</span><strong>ICP / Aperture</strong></div><div><span className="kicker">Visual favorite</span><strong>Leica Gallery</strong></div></div></section>

  <section className="section"><div className="sectionHead"><h2>You Didn&apos;t Ask For This…</h2><span>Serendipity</span></div><div className="grid3">{(data?.serendipity||[]).map((s,i)=><Card item={s} onRate={rate} key={i}/>)}</div></section>
  <div className="status">Live RSS-first V1. Feedback stays in this browser. No unread counts, no inbox debt.</div>
 </main>
}
