"use client";
import {useEffect,useMemo,useState} from "react";

const STORAGE_KEY="betterStartQuickPicksV1";
const PROFILE_KEY="betterStartPersonalProfileV1";
const topics=[
  {id:"music",label:"Music",color:"red",children:["Hip-hop + rap","Pop","Rock","R&B + soul","Jazz","Country","Classical","Electronic","Latin music","Indie","Live music","New releases"]},
  {id:"film",label:"Movies + TV",color:"blue",children:["New movies","Great television","Classic film","Documentaries","Comedy","International cinema","Animation","Film craft"]},
  {id:"food",label:"Food",color:"orange",size:"lg",children:["Restaurants","Cooking","Bakeries","Regional food","Food history","Coffee + tea","Markets","Small producers"]},
  {id:"science",label:"Science + nature",color:"green",children:["Space","Astronomy","Nature","Engineering","Mathematics","Oceans","Medicine","How things work"]},
  {id:"animals",label:"Animals",color:"yellow",size:"md",children:["Dogs","Cats","Wildlife","Animal rescue","Birds","Ocean life","Animal intelligence","Conservation"]},
  {id:"sports",label:"Sports",color:"rust",children:["NFL + fantasy football","Baseball","Basketball","Women’s sports","Soccer","Tennis","College sports","Great sports stories","Sports history"]},
  {id:"photography",label:"Photography",color:"navy",size:"xl",children:["Documentary","Street photography","Film cameras","Landscape","Photo history","Portraits","Darkrooms","New photographers"]},
  {id:"books",label:"Books + ideas",color:"brown",size:"lg",children:["Fiction","History","Essays","Biography","Poetry","Book design","Independent magazines","Archives + museums"]},
  {id:"outdoors",label:"Nature + outdoors",color:"green",size:"xl",children:["Hiking","National parks","Gardens","Forests","Birding","Camping","Beautiful landscapes","Conservation"]},
  {id:"travel",label:"Travel",color:"orange",size:"md",children:["Day trips","Great cities","Train travel","Small towns","Road trips","Museums","Hotels","Places to eat"]},
  {id:"design",label:"Art + design",color:"blue",size:"lg",children:["Architecture","Graphic design","Fine art","Furniture","Museums","Typography","Craft","Creative studios"]},
  {id:"comedy",label:"Comedy",color:"yellow",size:"sm",children:["Stand-up","Sketches","Funny interviews","Classic comedy","Late-night archives","Absurdity","Comic actors","Smart silliness"]},
  {id:"local",label:"Local discoveries",color:"rust",size:"md",children:["New restaurants","Neighborhood history","Day trips","Local arts","Independent shops","Parks + trails","Community wins","Things happening nearby"]},
  {id:"making",label:"Making things",color:"brown",size:"sm",children:["Woodworking","Ceramics","Printmaking","Home studios","Repair","Analog tools","Creative process","Beautiful objects"]},
  {id:"people",label:"Good people",color:"red",size:"md",children:["Human ingenuity","Kindness","Community projects","Creative lives","Big achievements","Small victories","Mentors","Unexpected friendships"]},
  {id:"philanthropy",label:"Philanthropy + community",color:"green",size:"lg",children:["Money put to good use","Community foundations","Libraries + schools","Arts access","Scholarships","Housing + food access","Public spaces","Giving with results"]},
  {id:"technology",label:"Technology",color:"navy",children:["Apple","Audio gear","Cameras","Clean energy","Inventors","Robotics","Creative tools","Thoughtful AI"]},
  {id:"business",label:"Business + money",color:"green",children:["Markets","Entrepreneurship","Personal finance","Interesting companies","Real estate","Workplace ideas","Economic history","New inventions"]},
  {id:"health",label:"Health + fitness",color:"red",children:["Yoga","Pilates","Fitness","Women’s running","Running","Cycling","Mobility","Wellness retreats","Nutrition","Healthy aging","Everyday health"]},
  {id:"home",label:"Home + garden",color:"yellow",children:["Interior design","Gardens","Renovation","Organization","House history","Small spaces","Plants","Useful home ideas"]},
  {id:"family",label:"Family",color:"orange",children:["Things to do together","Parenting ideas","Children’s books","Education","College","Family travel","Youth sports","Useful local resources"]},
  {id:"style",label:"Style + fashion",color:"blue",children:["Fashion Week","Runway + couture","Fashion insiders","Independent fashion press","Costume design","International fashion","Boutique labels","Fashion photography","Vintage runway","1990s fashion","Department stores","Beauty + cosmetics","Emerging designers","Personal style"]},
  {id:"women",label:"Women + culture",color:"red",children:["Women writers","Women leaders","Women in the arts","Women’s sports","Women’s tennis","Women’s running","Pilates","Wellness retreats","Costume design","Fashion photography","Book clubs + reading","Women founders"]},
  {id:"gaming",label:"Gaming",color:"navy",children:["New games","Retro gaming","Game design","Nintendo","PlayStation","Xbox","PC gaming","Indie games"]},
  {id:"cars",label:"Cars, boats + transportation",color:"rust",children:["New cars","Classic cars","Automotive design","Motorcycles","Boats + sailing","Boatbuilding","Trains","Aviation"]}
];
const doorways=[
  {id:"music-on",label:"Music is usually playing",signals:["music"],color:"red",size:"xl"},
  {id:"team",label:"I follow a team",signals:["sports"],color:"rust",size:"lg"},
  {id:"fantasy",label:"Fantasy football is life",signals:["sports"],color:"green",size:"md"},
  {id:"eat",label:"I’m always looking for somewhere good to eat",signals:["food","local","travel"],color:"orange",size:"xl"},
  {id:"works",label:"I want to know how things work",signals:["science","technology","making"],color:"navy",size:"lg"},
  {id:"outside",label:"I’d rather be outside",signals:["outdoors","travel","animals"],color:"green",size:"lg"},
  {id:"business",label:"I keep up with business and money",signals:["business","technology"],color:"green",size:"xl"},
  {id:"fashion-first",label:"Fashion with a capital F",signals:["style","women","photography"],color:"blue",size:"xl"},
  {id:"money-mind",label:"Mind on my money",signals:["business"],color:"green",size:"lg"},
  {id:"movie",label:"I love a good movie",signals:["film","comedy"],color:"blue",size:"lg"},
  {id:"read",label:"I read for fun",signals:["books"],color:"brown",size:"md"},
  {id:"design",label:"I notice good design",signals:["design","photography","style"],color:"blue",size:"lg"},
  {id:"make",label:"I like making or fixing things",signals:["making","technology","home"],color:"brown",size:"md"},
  {id:"trip",label:"I’m usually planning a trip",signals:["travel","food","outdoors"],color:"orange",size:"lg"},
  {id:"games",label:"I play games",signals:["gaming","technology"],color:"navy",size:"md"},
  {id:"active",label:"Staying active matters to me",signals:["health","sports","outdoors"],color:"red",size:"lg"},
  {id:"family",label:"I enjoy finding things to do with my family",signals:["family","local","travel"],color:"yellow",size:"xl"},
  {id:"style",label:"I care about personal style",signals:["style","design"],color:"blue",size:"md"},
  {id:"nearby",label:"I like knowing what’s happening nearby",signals:["local","food","family"],color:"rust",size:"lg"},
  {id:"animals",label:"Animals make almost everything better",signals:["animals","outdoors"],color:"yellow",size:"xl"},
  {id:"new",label:"I’ll happily learn about something completely new",signals:["science","people","books"],color:"red",size:"lg"}
  ,{id:"giving",label:"I like people putting money to good use",signals:["philanthropy","people","business"],color:"green",size:"xl"}
  ,{id:"projects",label:"I almost always have a project going",signals:["making","home"],color:"brown",size:"lg"}
  ,{id:"garden",label:"I’m happiest in a garden",signals:["home","outdoors"],color:"green",size:"md"}
  ,{id:"water",label:"I love boats and being on the water",signals:["cars","outdoors","travel"],color:"navy",size:"xl"}
  ,{id:"history",label:"History sends me down rabbit holes",signals:["books","design"],color:"brown",size:"lg"}
  ,{id:"fashion",label:"I follow fashion beyond what’s in stores",signals:["style","women","photography"],color:"blue",size:"xl"}
  ,{id:"women-stories",label:"I want more stories about remarkable women",signals:["women","books","people"],color:"red",size:"lg"}
  ,{id:"costumes",label:"I notice the costumes before the plot",signals:["style","film","women"],color:"yellow",size:"lg"}
  ,{id:"fashion-week",label:"Fashion Week is my World Series",signals:["style","women","photography"],color:"red",size:"xl"}
  ,{id:"bergdorfs",label:"Scatter my ashes at Bergdorf’s",signals:["style","women","travel"],color:"blue",size:"lg"}
  ,{id:"bon-marche",label:"Le Bon Marché is my happy place",signals:["style","women","travel"],color:"yellow",size:"lg"}
  ,{id:"runway-save",label:"I save runway looks",signals:["style","photography"],color:"blue",size:"md"}
  ,{id:"magazine-photo",label:"I buy magazines for the photography",signals:["style","photography","books"],color:"brown",size:"lg"}
  ,{id:"designer-not-trend",label:"I follow designers, not trends",signals:["style","women"],color:"red",size:"lg"}
  ,{id:"costume-binge",label:"I’ll watch anything with excellent production design",signals:["style","film","design"],color:"navy",size:"xl"}
];
const primaryDoorwayIds=["music-on","team","eat","works","outside","business","fashion-first","movie","read","design","active","animals","giving"];
const primaryDoorways=doorways.filter(item=>primaryDoorwayIds.includes(item.id));
const specifics={
  "Hip-hop + rap":["New hip-hop","Golden age hip-hop","Beat-making","Independent rap","Live performances","Hip-hop history"],"Pop":["New pop","Live performances","Songwriting","Pop history","Great producers"],"Rock":["Classic rock","Indie rock","Live archives","New releases","Rock history"],"R&B + soul":["Classic soul","New R&B","Motown","Live sessions","Great vocalists"],"Jazz":["Alice Coltrane","Bill Frisell","Blue Note","Hard bop","ECM","Spiritual jazz"],"Country":["Classic country","Americana","New country","Songwriters","Live sessions"],"Classical":["Solo piano","20th-century composers","Chamber music","Orchestras","New recordings"],"Electronic":["Ambient","Synthesizers","Dance music","Experimental electronic","Studio craft"],
  "NFL + fantasy football":["NFL","Fantasy lineups","Player news","Great plays","Football history"],
  "Baseball":["MLB","Ballparks","Baseball history","Minor leagues","Great defensive plays"],"Tennis":["Grand Slams","US Open","Tennis history","Rising players"],"Great sports stories":["Comebacks","Teamwork","Amateur athletes","Sportsmanship"],
  "Space":["NASA","Telescopes","The Moon","New discoveries","Space photography"],"Astronomy":["Eclipses","Night skies","Planetary science","Cosmic mysteries"],"How things work":["Ingenious machines","Everyday engineering","Unexpected inventions"],
  "Dogs":["Excellent dogs","Working dogs","Senior dogs","Dog photography"],"Animal rescue":["Second chances","Wildlife rehabilitation","Sanctuaries"],"Animal intelligence":["Clever creatures","Animal communication","Unexpected behavior"],
  "Classic film":["Film noir","70mm","Restorations","Old Hollywood","Movie palaces"],"Documentaries":["Art documentaries","Music films","Nature films","Curious people"],"Film craft":["Cinematography","Sound design","Practical effects","Production design"],
  "Restaurants":["Neighborhood favorites","New openings","Chef stories","Useful best-of lists"],"Bakeries":["Bread","Doughnuts","Pastry","Small bakeries"],"Coffee + tea":["Coffee shops","Roasters","Tea culture","Beautiful cafés"],
  "Street photography":["New York street photography","Contact sheets","Photo walks","Great light"],"Film cameras":["Leica","Medium format","Darkroom craft","Vintage lenses"],"Photo history":["Photo archives","Master photographers","Lost negatives"],
  "Architecture":["Modernism","Adaptive reuse","Small spaces","Public buildings","Architecture history"],"Graphic design":["Posters","Identity design","Print","Great packaging"],"Museums":["Small museums","New exhibitions","Museum architecture"],
  "Hiking":["Local trails","Mountain walks","Coastal paths","Trail restoration"],"Gardens":["Botanical gardens","Garden design","Native plants","Secret gardens"],"Beautiful landscapes":["Photo essays","Scenic routes","Natural wonders"],
  "Day trips":["Within driving distance","Worth the detour","Unexpected nearby places"],"Great cities":["New York","Paris","Copenhagen","Tokyo","London"],"Small towns":["Main streets","Independent shops","Local character"],
  "Stand-up":["Great sets","Comedian interviews","Comedy history"],"Classic comedy":["Norm Macdonald","Steve Martin","SCTV","Vintage television"],"Smart silliness":["Joyful nonsense","Tiny visual jokes","Playful websites"],
  "Apple":["Mac","iPhone","Apple design","Creative workflows"],"Audio gear":["Synthesizers","Speakers","Recording studios","Hi-fi"],"Creative tools":["Cameras","Music tools","Design software","Clever utilities"],
  "Markets":["Companies worth knowing","Long-term investing","Market history","Useful explainers"],"Entrepreneurship":["Founders","Small businesses","How companies grow","Useful business ideas"],"Personal finance":["Saving","Retirement","Simple money habits","Useful explainers"],"Interesting companies":["Great products","Company histories","Thoughtful leaders","Behind the scenes"],
  "Fitness":["Strength","Mobility","Everyday movement","Training ideas"],"Running":["Running stories","Great routes","Training","Running gear"],"Healthy aging":["Longevity research","Strength + balance","Healthy habits","Active lives"],
  "Things to do together":["Weekend ideas","Museums","Outdoor activities","Local events"],"Children’s books":["Picture books","Middle grade","Illustrators","New releases"],"Family travel":["Easy trips","Great museums","National parks","Useful travel ideas"],
  "New games":["Reviews","Upcoming releases","Game studios","Beautiful games"],"Retro gaming":["Classic consoles","Arcades","Game history","Restorations"],"Game design":["How games are made","Visual design","Music + sound","Independent studios"],
  "Personal style":["Everyday style","Great basics","Independent brands","Style history"],"Sneakers":["New releases","Sneaker design","Classic models","Independent shops"],"Watches":["Watch design","Vintage watches","Independent makers","How watches work"],
  "Classic cars":["Automotive history","Beautiful restorations","Design icons","Great road stories"],"Automotive design":["Concept cars","Design history","Interiors","How cars are made"],"Trains":["Rail journeys","Train design","Historic railways","Great stations"]
  ,"Boats + sailing":["Sailboats","Cruising stories","Maritime history","Beautiful harbors","Sailing craft"]
  ,"Boatbuilding":["Wooden boats","Restorations","Working boatyards","Marine design"]
  ,"Yoga":["Yoga practice","Mobility","Breathwork","Yoga history","Teachers worth knowing"]
  ,"History":["Social history","Design history","Archives","Archaeology","Local history","Museums"]
  ,"Gardens":["Garden design","Native plants","Botanical gardens","Small gardens","Horticultural craft"]
  ,"Runway + couture":["Paris couture","Milan fashion week","Atelier craft","Runway reviews","Fashion houses","Emerging designers"]
  ,"International fashion":["French fashion","Italian fashion","Japanese designers","London fashion","Global street style"]
  ,"Womenswear":["Missoni","Pucci","Oscar de la Renta","Prada","Vintage designer fashion","Independent labels"]
  ,"Costume design":["Television wardrobes","Film costume design","Emily in Paris style","Period costume","Costume designer interviews"]
  ,"Fashion photography":["Editorial photography","Legendary image-makers","1990s supermodels","Fashion archives","New photographers"]
  ,"1990s fashion":["Supermodel era","Runway archives","Carolyn Bessette-Kennedy style","Minimalism","Vintage magazines"]
  ,"Beauty + cosmetics":["Beauty as design","Cosmetic history","Independent founders","Fragrance","Packaging + formulation"]
  ,"Women’s sports":["WNBA","Women’s soccer","Women’s tennis","Elite runners","Athlete profiles","Great comebacks"]
  ,"Women’s tennis":["WTA","US Open","Player profiles","Tennis history","Rising players"]
  ,"Women’s running":["Runner profiles","Movement for joy","Training","Trail running","Running communities"]
  ,"Pilates":["Pilates practice","Studio design","Mobility","Teachers worth knowing","Movement history"]
  ,"Wellness retreats":["Destination wellness","Spa design","Restorative travel","Mindful movement","Beautiful settings"]
  ,"Women leaders":["Creative leaders","Women founders","Scientists","Designers","Cultural leaders"]
  ,"Women writers":["Margaret Atwood","Chimamanda Ngozi Adichie","Zadie Smith","Elena Ferrante","Sally Rooney","Isabel Allende","Barbara Kingsolver","Donna Tartt","Jhumpa Lahiri","Ali Smith","Bernardine Evaristo","Elif Shafak","Yaa Gyasi","Celeste Ng","Ottessa Moshfegh","Rachel Kushner","Carmen Maria Machado","Han Kang","Claire Keegan","Maggie O’Farrell","Edwidge Danticat","Ling Ma","Sigrid Nunez","Rachel Cusk","Banana Yoshimoto","Sayaka Murata","Gillian Flynn","Taffy Brodesser-Akner","Claudia Rankine","Roxane Gay","Rebecca Solnit","Mary Karr","Joy Harjo","Natasha Trethewey","Maggie Nelson","Leslie Jamison","Elizabeth Strout","N. K. Jemisin","Susanna Clarke","Martha Wells","Naomi Alderman","V. E. Schwab","Rebecca Yarros","S. A. Chakraborty","Nnedi Okorafor","Leigh Bardugo","Elin Hilderbrand","Ann Patchett"]
  ,"Women in the arts":["Artists","Photographers","Architects","Curators","Major retrospectives"]
  ,"Fashion Week":["Paris Fashion Week","Milan Fashion Week","Couture Week","Resort collections","Front-row reports","Street style"]
  ,"Fashion insiders":["Miranda Priestly energy","Grace Coddington","André Leon Talley","Diana Vreeland","Isabella Blow","Bill Cunningham","Creative-director moves"]
  ,"Independent fashion press":["The Gentlewoman","AnOther","System Magazine","Acne Paper","Vestoj","1 Granary","SHOWstudio","Purple Magazine"]
  ,"Boutique labels":["The Row","Khaite","Toteme","Alaïa","Loewe","Dries Van Noten","Gabriela Hearst","Ulla Johnson"]
  ,"Vintage runway":["Archive pulls","Vintage YSL","Vintage Halston","Phoebe Philo years","Lee McQueen","Runway archaeology"]
  ,"Department stores":["Bergdorf Goodman","Le Bon Marché","Liberty London","La Rinascente","Fashion windows","Legendary buyers"]
  ,"Emerging designers":["Fashion-school graduates","Central Saint Martins","Independent ateliers","Design competitions","Names to know"]
  ,"Book clubs + reading":["Reese’s Book Club","Read with Jenna","Service95 Books","Independent booksellers","Beach reads","Literary fiction"]
  ,"Women founders":["Fashion founders","Beauty founders","Creative entrepreneurs","Women-led companies","Independent studios"]
  ,"Money put to good use":["MacKenzie Scott","Giving Pledge follow-through","Transformational gifts","Community-led giving","What changed afterward"]
  ,"Community foundations":["Local grantmakers","Mutual aid","Neighborhood funds","Rural communities","Small organizations doing big work"]
  ,"Libraries + schools":["New libraries","Literacy access","Scholarships","Teacher support","Arts education"]
  ,"Giving with results":["Measurable impact","Long-term follow-up","Beneficiaries first","Quiet generosity","Responsible corporate giving"]
};
const defaultSpecifics=label=>[`${label} stories`,`${label} discoveries`,`${label} history`,`${label} people`];
const readerDefaults={design:"Established Meanwhile Reader layout on desktop and mobile",safety:"Established rage-free, politics-free and blocked-content policy",radio:"Ambient",feedback:"More like this, Less, Too political and Too depressing",memory:"No duplicate content and no repeats within seven days",connections:"Offer optional service connections only in context, after the person uses the relevant feature"};
const roundRobin=(groups,limit)=>{const result=[];for(let row=0;result.length<limit;row++){let added=false;groups.forEach(group=>{if(result.length<limit&&group[row]){result.push(group[row]);added=true}});if(!added)break}return result};

function Bubble({label,selected,onClick,index,depth,size="md",color="blue"}){return <button type="button" className={`bubble size-${size} color-${color} ${selected?"selected":""} depth-${depth}`} style={{"--delay":`${(index%11)*-0.23}s`,"--tilt":`${(index%5)-2}deg`}} aria-pressed={selected} onClick={onClick}><span>{label}</span><i>{selected?"✓":"+"}</i></button>}
function StepHeader({eyebrow,title,copy}){return <div className="stepHeader"><span>{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>}
const toggle=(list,item)=>list.includes(item)?list.filter(value=>value!==item):[...list,item];

export default function MakeItYours(){
  const [step,setStep]=useState(0),[doorwayPicks,setDoorwayPicks]=useState([]),[neighborhoods,setNeighborhoods]=useState([]),[details,setDetails]=useState([]),[extra,setExtra]=useState(""),[name,setName]=useState(""),[loaded,setLoaded]=useState(false),[ready,setReady]=useState(false);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(saved){setStep(Math.min(saved.step||0,4));setDoorwayPicks(saved.doorwayPicks||[]);setNeighborhoods(saved.neighborhoods||[]);setDetails(saved.details||[]);setExtra(saved.extra||"");setName(saved.name||"");}}catch{}setLoaded(true)},[]);
  useEffect(()=>{if(loaded)localStorage.setItem(STORAGE_KEY,JSON.stringify({step,doorwayPicks,neighborhoods,details,extra,name,updatedAt:new Date().toISOString()}))},[step,doorwayPicks,neighborhoods,details,extra,name,loaded]);
  useEffect(()=>{window.scrollTo({top:0,behavior:"smooth"})},[step]);
  const broad=useMemo(()=>[...new Set(doorways.filter(item=>doorwayPicks.includes(item.id)).flatMap(item=>item.signals))],[doorwayPicks]);
  const secondaryDoorways=useMemo(()=>{const signals=new Set(primaryDoorways.filter(item=>doorwayPicks.includes(item.id)).flatMap(item=>item.signals));const related=doorways.filter(item=>!primaryDoorwayIds.includes(item.id)&&item.signals.some(signal=>signals.has(signal)));const usefulExtras=doorways.filter(item=>!primaryDoorwayIds.includes(item.id)&&["nearby","family","new","projects","history","fashion","women-stories"].includes(item.id));return [...related,...usefulExtras].filter((item,index,array)=>array.findIndex(other=>other.id===item.id)===index).slice(0,18)},[doorwayPicks]);
  const fashionLed=doorwayPicks.some(id=>["fashion-first","fashion","women-stories","costumes","fashion-week","bergdorfs","bon-marche","runway-save","magazine-photo","designer-not-trend","costume-binge"].includes(id));
  const chosenTopics=topics.filter(topic=>broad.includes(topic.id)).sort((a,b)=>fashionLed?(["style","women","photography","film","books","travel","design"].indexOf(a.id)+1||99)-(["style","women","photography","film","books","travel","design"].indexOf(b.id)+1||99):0);
  const neighborhoodOptions=useMemo(()=>{const perTopic=chosenTopics.length<=3?8:chosenTopics.length<=6?5:3,groups=chosenTopics.map(topic=>topic.children.slice(0,perTopic).map(label=>({label,parent:topic.label,color:topic.color,size:["Space","Jazz","Baseball","Architecture","Hiking","Restaurants","Street photography"].includes(label)?"lg":"md"})));return roundRobin(groups,50).filter((item,index,array)=>array.findIndex(other=>other.label===item.label)===index).slice(0,36)},[broad]);
  const detailOptions=useMemo(()=>{const perNeighborhood=neighborhoods.length<=4?6:neighborhoods.length<=8?4:2,groups=neighborhoods.map((label,index)=>(specifics[label]||defaultSpecifics(label)).slice(0,perNeighborhood).map(value=>({label:value,parent:label,color:topics[(index*3)%topics.length].color,size:index%4===0?"lg":index%5===0?"sm":"md"})));return roundRobin(groups,36).filter((item,index,array)=>array.findIndex(other=>other.label===item.label)===index)},[neighborhoods]);
  const profile=useMemo(()=>({version:2,name:name.trim(),title:name.trim()?`${name.trim()}’s Edition`:"My Edition",openingChoices:doorways.filter(item=>doorwayPicks.includes(item.id)).map(item=>item.label),broadInterests:chosenTopics.map(topic=>topic.label),specificInterests:neighborhoods,details,anythingElse:extra.split(/,|\n/).map(value=>value.trim()).filter(Boolean),readerDefaults}),[name,doorwayPicks,chosenTopics,neighborhoods,details,extra]);
  const progress=["What sounds like you","A little more you","Choose some subjects","Names + specifics","Ready"];
  const reset=()=>{if(confirm("Clear these choices and begin again?")){localStorage.removeItem(STORAGE_KEY);setStep(0);setDoorwayPicks([]);setNeighborhoods([]);setDetails([]);setExtra("");setName("");setReady(false)}};
  const buildEdition=()=>{localStorage.setItem(PROFILE_KEY,JSON.stringify({...profile,updatedAt:new Date().toISOString()}));window.location.href="/?personalized=true"};
  const next=()=>setStep(value=>Math.min(4,value+1));
  const toggleDoorway=item=>{const nextPicks=toggle(doorwayPicks,item.id),nextSignals=new Set(doorways.filter(option=>nextPicks.includes(option.id)).flatMap(option=>option.signals)),allowedTopics=topics.filter(topic=>nextSignals.has(topic.id)),allowedNeighborhoods=new Set(allowedTopics.flatMap(topic=>topic.children)),keptNeighborhoods=neighborhoods.filter(value=>allowedNeighborhoods.has(value)),allowedDetails=new Set(keptNeighborhoods.flatMap(label=>specifics[label]||defaultSpecifics(label)));setDoorwayPicks(nextPicks);setNeighborhoods(keptNeighborhoods);setDetails(details.filter(value=>allowedDetails.has(value)))};
  const toggleNeighborhood=label=>{if(neighborhoods.includes(label)){const removed=new Set(specifics[label]||defaultSpecifics(label));setNeighborhoods(neighborhoods.filter(value=>value!==label));setDetails(details.filter(value=>!removed.has(value)))}else setNeighborhoods([...neighborhoods,label])};
  return <main className="app interviewApp">
    <header><a href="/">Meanwhile</a><div><span>Make it yours</span><button onClick={reset}>Start over</button></div></header>
    <div className="progress"><div>{progress.map((label,index)=><span className={index===step?"active":index<step?"done":""} key={label}><i>{index<step?"✓":index+1}</i>{label}</span>)}</div><em>About 90 seconds</em></div>
    {step===0&&<section className="screen"><StepHeader eyebrow="MAKE IT YOURS" title="Which of these sound like you?" copy="Pick what sounds good. We’ll build your edition."/><div className={`constellation broad openingConstellation ${doorwayPicks.length?"hasSelection":""}`}>{primaryDoorways.map((item,index)=><Bubble key={item.id} label={item.label} size={item.size} color={item.color} depth={0} index={index} selected={doorwayPicks.includes(item.id)} onClick={()=>toggleDoorway(item)}/>)}</div><div className="tip">Choose as many as you like.</div></section>}
    {step===1&&<section className="screen"><StepHeader eyebrow="A LITTLE MORE YOU" title="Anything else sound familiar?" copy="These are based on what you just picked. Skip anything that doesn’t feel like you."/><div className={`constellation broad secondConstellation ${doorwayPicks.length?"hasSelection":""}`}>{secondaryDoorways.map((item,index)=><Bubble key={item.id} label={item.label} size={item.size} color={item.color} depth={0} index={index} selected={doorwayPicks.includes(item.id)} onClick={()=>toggleDoorway(item)}/>)}</div></section>}
    {step===2&&<section className="screen"><StepHeader eyebrow="NOW CHOOSE SOME SUBJECTS" title="What sounds especially good?" copy="Choose as many as you like. We’ll use these to make your first edition more personal."/><div className={`constellation neighborhoods ${neighborhoods.length?"hasSelection":""}`}>{neighborhoodOptions.map((item,index)=><Bubble key={`${item.parent}-${item.label}`} {...item} depth={1} index={index} selected={neighborhoods.includes(item.label)} onClick={()=>toggleNeighborhood(item.label)}/>)}</div></section>}
    {step===3&&<section className="screen"><StepHeader eyebrow="ONE LAST PASS" title="Anything here feel especially you?" copy="Pick any names or ideas you especially like."/><div className={`constellation details ${details.length?"hasSelection":""}`}>{detailOptions.map((item,index)=><Bubble key={`${item.parent}-${item.label}`} {...item} depth={2} index={index} selected={details.includes(item.label)} onClick={()=>setDetails(toggle(details,item.label))}/>)}</div><div className="optional"><label><span>Anything we missed? <i>Optional</i></span><input value={extra} onChange={event=>setExtra(event.target.value)} placeholder="Toss in a person, place, hobby, team, food, website—anything."/></label></div></section>}
    {step===4&&<section className="screen finish"><StepHeader eyebrow="THAT’S PLENTY TO BEGIN" title="Your edition is ready." copy="Meanwhile can learn the rest while you enjoy it."/><div className="profile"><div className="profileName"><span>Name your edition <i>Optional</i></span><input value={name} onChange={event=>setName(event.target.value)} placeholder="Your first name"/><h2>{profile.title}</h2></div><div className="profileCloud">{[...profile.broadInterests,...neighborhoods,...details,...profile.anythingElse].slice(0,22).map((item,index)=><span className={`p-${index%5}`} key={`${item}-${index}`}>{item}</span>)}</div><div className="promise"><b>Already taken care of</b><p>The playful Reader design, mobile layout, ambient radio, rage-free editorial rules, source variety, duplicate protection and seven-day memory are all built in. You can teach it more with <em>More like this</em> and <em>Less</em> while you browse.</p></div></div></section>}
    <nav><button disabled={step===0} onClick={()=>setStep(value=>Math.max(0,value-1))}>← Back</button>{step<3&&<button className="primary" disabled={step===0?!doorwayPicks.length:step===2?!neighborhoods.length:false} onClick={next}>{step===0?"Show me a little more":step===1?"Choose some subjects":"One last pass"}<span>→</span></button>}{step===3&&<button className="primary" onClick={next}>This feels like me <span>→</span></button>}{step===4&&<button className="primary" onClick={buildEdition}>Open my edition <span>→</span></button>}</nav>
    <footer><span>No account connections. No setup homework.</span><span>Personalized V9 · Saved privately in this browser</span></footer>
  </main>
}
