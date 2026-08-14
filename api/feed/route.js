
import Parser from "rss-parser";
import fs from "fs";
import path from "path";

const parser = new Parser({timeout:9000, headers:{"User-Agent":"BetterStart/1.0"}});
const load = n => JSON.parse(fs.readFileSync(path.join(process.cwd(),"data",n),"utf8"));

function text(item){return `${item.title||""} ${item.contentSnippet||""} ${item.content||""}`.toLowerCase()}
function score(item,src,taste){
  const t=text(item); let s=(src.quality||5)*5, hits=0, noHits=0;
  for(const q0 of taste.yes){const q=q0.toLowerCase();if(t.includes(q)){s+=8;hits++;if(hits>=7)break}}
  for(const q0 of taste.no){const q=q0.toLowerCase();if(t.includes(q)){s-=24;noHits++}}
  const age=item.isoDate?(Date.now()-new Date(item.isoDate))/36e5:24;
  if(age<=6)s+=10; else if(age<=24)s+=6; else if(age<=48)s+=2; else s-=Math.min(12,age/24);
  if(/you won't believe|internet is freaking|shocking|what happened next/i.test(item.title||""))s-=15;
  return {score:Math.round(s),hits,noHits};
}
function dedupe(items){
  const out=[], seen=[];
  for(const it of items.sort((a,b)=>b.score-a.score)){
    const sig=new Set((it.title||"").toLowerCase().replace(/[^a-z0-9 ]/g,"").split(/\s+/).filter(Boolean));
    let dup=false;
    for(const s of seen){
      let n=0; for(const w of sig) if(s.has(w))n++;
      if(n/Math.max(1,Math.min(sig.size,s.size))>.72){dup=true;break}
    }
    if(!dup){out.push(it);seen.push(sig)}
  }
  return out;
}

export async function GET(){
  const taste=load("taste.json"), sources=load("sources.json"), favorites=load("favorites.json");

  const sourceResults=await Promise.allSettled(sources.map(async src=>{
    const feed=await parser.parseURL(src.url);
    return (feed.items||[]).slice(0,12).map(item=>{
      const x=score(item,src,taste);
      return {
        title:item.title||"Untitled",
        url:item.link||"#",
        summary:item.contentSnippet||"",
        date:item.isoDate||item.pubDate||null,
        source:src.name,section:src.section,image:item.enclosure?.url||null,
        score:x.score,interestHits:x.hits,noHits:x.noHits
      }
    })
  }));

  let items=[];
  sourceResults.forEach(r=>{if(r.status==="fulfilled")items.push(...r.value)});
  items=dedupe(items).filter(x=>x.score>18);

  const favResults=await Promise.allSettled(favorites.map(async fav=>{
    const feed=await parser.parseURL(fav.url);
    return (feed.items||[]).slice(0,2).map(item=>({
      name:fav.name,title:item.title||"New post",url:item.link||"#",
      date:item.isoDate||item.pubDate||null,summary:item.contentSnippet||""
    }))
  }));
  let favItems=[];
  favResults.forEach(r=>{if(r.status==="fulfilled")favItems.push(...r.value)});
  favItems.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));

  const important=items.filter(x=>["NASA","NYT Technology","Guardian Science"].includes(x.source)).slice(0,4);
  const forYou=items.filter(x=>!important.some(i=>i.url===x.url)).slice(0,18);
  const serendipity=items.filter(x=>x.interestHits===0 && x.noHits===0 && x.score>=35).slice(0,3);

  return Response.json({
    generatedAt:new Date().toISOString(),
    forYou, important, favorites:favItems.slice(0,8), serendipity,
    sourceStatus:{total:sources.length,successful:sourceResults.filter(r=>r.status==="fulfilled").length}
  },{headers:{"Cache-Control":"s-maxage=900, stale-while-revalidate=1800"}})
}
