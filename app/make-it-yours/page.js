"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../lib/supabase";

const STORAGE_KEY="betterStartQuickPicksV2";
const PROFILE_KEY="betterStartPersonalProfileV1";
const topics=[
  {id:"music",label:"Music",color:"red",children:["Classical","Jazz","Rock","Country","Electronic","Hip-hop","Reggae","Blues","Metal","Folk","Soul + R&B","Global music"]},
  {id:"film",label:"Movies + TV",color:"blue",children:["New movies","Great television","Classic film","Documentaries","Comedy","International cinema","Animation","Horror + suspense","Science fiction + fantasy","Independent film","Film craft","Cult classics"]},
  {id:"food",label:"Food",color:"orange",size:"lg",children:["Restaurants","Cooking","Bakeries","Regional food","Food history","Coffee + tea","Markets","Small producers"]},
  {id:"science",label:"Science + nature",color:"green",children:["Space","Astronomy","Nature","Engineering","Mathematics","Oceans","Medicine","How things work"]},
  {id:"animals",label:"Animals",color:"yellow",size:"md",children:["Dogs","Cats","Wildlife","Animal rescue","Birds","Ocean life","Animal intelligence","Conservation"]},
  {id:"sports",label:"Sports",color:"rust",children:["Football + fantasy","Baseball","Basketball","Women’s sports","Soccer","Tennis","College sports","Motor racing","Golf","Hockey","Olympic sports","Running + cycling","Great sports stories","Sports history"]},
  {id:"photography",label:"Photography",color:"navy",size:"xl",children:["Documentary","Street photography","Film cameras","Landscape","Photo history","Portraits","Darkrooms","New photographers"]},
  {id:"books",label:"Books + ideas",color:"brown",size:"lg",children:["Fiction, please","History rabbit holes","Essays + big ideas","Lives well lived","Poetry counts","Mysteries + thrillers","Science fiction + fantasy","Graphic novels + comics","Book design","Independent magazines","Archives + museums","Bookshops are destinations"]},
  {id:"outdoors",label:"Nature + outdoors",color:"green",size:"xl",children:["Hiking","National parks","Gardens","Forests","Birding","Camping","Beautiful landscapes","Conservation"]},
  {id:"travel",label:"Travel",color:"orange",size:"md",children:["Day trips","Great cities","Train travel","Small towns","Road trips","Museums","Hotels","Places to eat"]},
  {id:"design",label:"Art + design",color:"blue",size:"lg",children:["Painting","Sculpture","Illustration + comic art","Poster art","Photography as art","Graphic design","Architecture","Furniture + objects","Typography","Museums + exhibitions","Craft","Public art","Digital + new media","Creative studios"]},
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
  {id:"design",label:"Art and design are part of my life",signals:["design","photography"],color:"blue",size:"lg"},
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
const doorwayTopic={"music-on":"music",team:"sports",eat:"food",works:"science",outside:"outdoors",business:"business","fashion-first":"style",movie:"film",read:"books",design:"design",active:"health",animals:"animals",giving:"philanthropy"};
const specifics={
  "Hip-hop all day":["Old school","Golden age","New school","Beat tapes","Independent rap","Southern hip-hop","Live cyphers","Hip-hop history"],
  "Jam bands":["Long strange trips","Live tapes","Improvisation","Festival sets","Cosmic country","Funk jams"],
  "Indie":["Indie rock","Indie pop","College radio","Shoegaze","Post-punk","DIY scenes","New discoveries"],
  "More rock, less talk":["Get the Led Out","Garage rock","Punk","Glam","Heavy metal","Classic albums","Guitar heroes","Live archives"],
  "Country AND western":["Americana","Outlaw country","Honky-tonk","Bluegrass","Western swing","Songwriters","Cosmic country"],
  "Classical":["Amadeus, Amadeus","Philip Glass + minimalism","Solo piano","Baroque","Chamber music","Great orchestras","New music","Opera without homework"],
  "Close enough for jazz":["Hard bop","Ethiopian jazz","Spiritual jazz","Cool jazz","Free jazz","ECM","Blue Note","Jazz-funk","Big bands"],
  "Last night a DJ saved my life":["EDM","House","Techno","Disco","Dub","Drum + bass","Ambient","Turntablism","Synthesizers"],
  "R&B + soul":["Classic soul","New R&B","Motown","Philly soul","Funk","Quiet storm","Great vocalists","Live sessions"],
  "Global sounds":["Afrobeat","Brazilian grooves","Highlife","Cumbia","Reggae + dub","Japanese city pop","Arabic music","Ethiopian jazz"],
  "Live music":["Tiny Desk","Concert films","Festival sets","Small clubs","Live archives","Sessions + soundchecks"],
  "New releases":["New albums","New songs","Debuts","Comebacks","Record labels","Studio stories"],
  "Old movies forever":["Film noir","70mm","Restorations","Pre-Code Hollywood","Screwball comedy","Movie palaces"],
  "How movies get made":["Cinematography","Sound design","Editing","Production design","Casting","Stunt craft"],
  "Practical magic":["Practical effects","Miniatures","Creature design","Stop motion","Matte paintings"],
  "Cult classics":["Midnight movies","Camp","Forgotten gems","Video-store discoveries","Repertory cinemas"],
  "Baseball is a way of life":["MLB","Ballparks","Baseball history","Minor leagues","Great defensive plays","Scorecards + ephemera"],
  "Tennis, anyone?":["Grand Slams","US Open","Tennis history","Rising players","Great rivalries"],
  "The beautiful game":["Premier League","Champions League","Women’s soccer","Supporter culture","Great goals","Historic clubs"],
  "Motor racing":["Formula 1","IndyCar","Le Mans","Rally","Historic racing","Engineering stories"],
  "Golf without the whispering":["Great courses","Golf design","The majors","Amateur golf","Equipment history"],
  "Illustration + comic art":["Editorial illustration","Comics","Graphic memoirs","New illustrators","Sequential art","Ink + paint"],
  "Poster art":["Concert posters","Film posters","Screen printing","Poster archives","Polish poster art"],
  "Fine art":["Painting","Sculpture","Installation","Printmaking","Artist studios","Major rediscoveries"],
  "Photography as art":["Photo books","Portraiture","Conceptual photography","Darkrooms","New photographers"],
  "Public art":["Murals","Sculpture parks","Transit art","Community commissions","Street art"],
  "Fiction, please":["Literary fiction","Short stories","Debut novels","Translated fiction","Funny novels","Big old novels"],
  "History rabbit holes":["Social history","Design history","Archaeology","Local history","Archives","Odd little histories"],
  "Essays + big ideas":["Cultural criticism","Science writing","Nature writing","Personal essays","Philosophy without pain"],
  "Lives well lived":["Biography","Memoir","Oral history","Creative lives","Remarkable eccentrics"],
  "Poetry counts":["New poetry","Poetry in translation","Poet interviews","Performance poetry","Small presses"],
  "Mysteries + thrillers":["Classic mysteries","Literary suspense","Spy novels","Cozy mysteries","Crime fiction"],
  "Science fiction + fantasy":["Space opera","Speculative fiction","Fantasy worlds","Afrofuturism","New wave sci-fi"],
  "Graphic novels + comics":["Graphic memoirs","Independent comics","Comic art","Manga","New releases"],
  "Bookshops are destinations":["Independent bookshops","Beautiful bookstores","Bookseller recommendations","Shop histories","Literary travel"],
  "Pop":["New pop","Live performances","Songwriting","Pop history","Great producers"],
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
const funnelSpecifics={
  "Classical":["Baroque","Romantic era","Modern + contemporary","Minimalism","Opera","Chamber music","Solo piano","Orchestral","Choral","Early music"],
  "Jazz":["Bebop","Hard bop","Cool jazz","Spiritual jazz","Free jazz","Jazz-funk","Big band","Vocal jazz","Ethiopian jazz","ECM + European jazz"],
  "Rock":["Classic rock","Indie rock","Punk","Post-punk","Garage rock","Glam","Psychedelic rock","Progressive rock","Alternative","Live archives"],
  "Country":["Classic country","Outlaw country","Americana","Bluegrass","Honky-tonk","Western swing","Cosmic country","Alt-country","Songwriters"],
  "Electronic":["House","Techno","Ambient","Disco","EDM","Drum + bass","Dubstep","Electro","Experimental electronic","Synth music"],
  "Hip-hop":["Old school hip-hop","Golden age hip-hop","East Coast hip-hop","West Coast hip-hop","Southern hip-hop","Independent rap","Beat-making","New school hip-hop","Live cyphers"],
  "Reggae":["Roots reggae","Dub","Ska","Rocksteady","Dancehall","Lovers rock","Soundsystem culture"],
  "Blues":["Delta blues","Chicago blues","Electric blues","Country blues","Gospel blues","Blues-rock","Great blues guitarists"],
  "Metal":["Heavy metal","Thrash","Doom","Stoner metal","Black metal","Death metal","Progressive metal","Metal history"],
  "Folk":["Traditional folk","Singer-songwriters","Folk revival","British folk","Appalachian music","Story songs","Contemporary folk"],
  "Soul + R&B":["Motown","Stax + Southern soul","Philly soul","Funk","Quiet storm","Neo-soul","New R&B","Great soul vocalists"],
  "Global music":["Afrobeat","Highlife","Cumbia","Brazilian music","Ethiopian jazz","Arabic music","Japanese city pop","South Asian sounds","Caribbean sounds"],
  "New movies":["In theaters","Festival discoveries","Independent releases","International releases","New documentaries","Awards contenders"],
  "Great television":["Prestige drama","Comedy series","Limited series","International television","Documentary series","Television craft"],
  "Classic film":["Film noir","Pre-Code Hollywood","Screwball comedy","Silent film","New Hollywood","Restorations","Movie palaces"],
  "Documentaries":["Art documentaries","Music documentaries","Nature documentaries","Social history","Portrait films","Documentary craft"],
  "Comedy":["Screwball comedy","Deadpan comedy","Satire","Romantic comedy","Physical comedy","Cult comedy"],
  "International cinema":["French cinema","Italian cinema","Japanese cinema","Korean cinema","Indian cinema","African cinema","Latin American cinema"],
  "Animation":["Hand-drawn animation","Stop motion","Anime","Experimental animation","Animation history","Studio craft"],
  "Horror + suspense":["Gothic horror","Psychological thrillers","Creature features","Folk horror","Classic suspense","Practical effects"],
  "Science fiction + fantasy":["Space opera","Speculative film","Fantasy worlds","Retro futurism","Creature design","Science-fiction classics"],
  "Independent film":["Festival films","Microbudget cinema","First features","Independent studios","Regional filmmaking","Director profiles"],
  "Film craft":["Cinematography","Editing","Sound design","Production design","Costume design","Casting","Stunt craft","Practical effects"],
  "Cult classics":["Midnight movies","Camp","Forgotten gems","Repertory cinema","Video-store discoveries","Fan communities"],
  "Football + fantasy":["NFL","Fantasy football","College football","Great plays","Football history","Stadium culture"],
  "Baseball":["MLB","Ballparks","Minor leagues","Baseball history","Negro Leagues","Scorecards + ephemera"],
  "Basketball":["NBA","WNBA","College basketball","Streetball","Basketball history","Great rivalries"],
  "Women’s sports":["WNBA","Women’s soccer","Women’s tennis","Elite runners","Women’s hockey","Athlete profiles"],
  "Soccer":["Premier League","Champions League","Women’s soccer","International football","Supporter culture","Historic clubs"],
  "Tennis":["Grand Slams","ATP","WTA","Tennis history","Rising players","Great rivalries"],
  "College sports":["College football","College basketball","College baseball","Women’s college sports","Traditions","Great programs"],
  "Motor racing":["Formula 1","IndyCar","Le Mans","Rally","NASCAR","Historic racing","Engineering stories"],
  "Golf":["The majors","Course design","Women’s golf","Amateur golf","Golf history","Equipment + craft"],
  "Hockey":["NHL","Women’s hockey","College hockey","International hockey","Original Six","Hockey history"],
  "Olympic sports":["Summer Olympics","Winter Olympics","Paralympic sport","Track + field","Swimming","Gymnastics","Olympic history"],
  "Running + cycling":["Road running","Trail running","Track + field","Road cycling","Mountain biking","Great routes","Endurance stories"],
  "Great sports stories":["Comebacks","Sportsmanship","Amateur athletes","Underdogs","Teamwork","Great coaches"],
  "Sports history":["Legendary teams","Historic venues","Sports archives","Forgotten champions","Equipment history","Great rivalries"],
  "Painting":["Modern painting","Old masters","Abstract painting","Contemporary painters","Watercolor","Murals","Artist studios"],
  "Sculpture":["Modern sculpture","Public sculpture","Ceramics","Installation","Stone + metal","Sculpture parks"],
  "Illustration + comic art":["Editorial illustration","Comics","Graphic memoirs","New illustrators","Sequential art","Ink + paint"],
  "Poster art":["Concert posters","Film posters","Screen printing","Poster archives","Polish poster art","Political-free public posters"],
  "Photography as art":["Photo books","Portraiture","Conceptual photography","Darkrooms","New photographers","Photo archives"],
  "Graphic design":["Identity design","Editorial design","Packaging","Print design","Wayfinding","Design archives"],
  "Architecture":["Modernism","Adaptive reuse","Residential architecture","Public buildings","Architecture history","Sustainable design"],
  "Furniture + objects":["Furniture design","Industrial design","Lighting","Everyday objects","Collectible design","Independent makers"],
  "Typography":["Type design","Lettering","Book typography","Sign painting","Type history","Independent foundries"],
  "Museums + exhibitions":["Major exhibitions","Small museums","Artist retrospectives","Museum architecture","Curatorial ideas","Collection discoveries"],
  "Craft":["Textiles","Ceramics","Glass","Wood","Metalwork","Paper craft","Master makers"],
  "Public art":["Murals","Sculpture parks","Transit art","Community commissions","Street art","Land art"],
  "Digital + new media":["Digital art","Interactive art","Generative art","Video art","Creative coding","Immersive installations"],
  "Creative studios":["Studio visits","Creative process","Design teams","Independent practices","Workspaces","Tools of the trade"]
};
const optionsFor=label=>funnelSpecifics[label]||specifics[label]||defaultSpecifics(label);
const granularSpecifics={
  "Baroque":["Bach","Handel","Vivaldi","Period instruments","Baroque opera","Sacred works"],"Minimalism":["Philip Glass","Steve Reich","Terry Riley","John Adams","New minimalism","Pattern + pulse"],
  "Hard bop":["Art Blakey","Horace Silver","Clifford Brown","Lee Morgan","Blue Note sessions","1950s jazz"],"Bebop":["Charlie Parker","Dizzy Gillespie","Bud Powell","Thelonious Monk","Small groups","Bebop history"],
  "Classic rock":["Album deep cuts","Guitar heroes","Studio stories","Live archives","Classic tours","Record collecting"],"Indie rock":["College radio","DIY scenes","Small labels","New bands","Live rooms","Indie archives"],
  "House":["Chicago house","Deep house","Acid house","French house","Vocal house","Club history"],"Techno":["Detroit techno","Minimal techno","Berlin techno","Dub techno","Live hardware","Club design"],
  "Roots reggae":["Bob Marley + the Wailers","Studio One","Lee Scratch Perry","Jamaican studios","Sound systems","Reggae history"],"Funk":["James Brown","P-Funk","Sly Stone","Rare grooves","Funk guitar","Live funk"],
  "Film noir":["Noir cinematography","Femme fatales","City at night","Noir directors","Forgotten noirs","Restorations"],"Cinematography":["Great cinematographers","Film stocks","Lighting","Camera movement","Lenses","Visual storytelling"],
  "NFL":["Team news","Draft + prospects","Stadiums","Great plays","Football history","Coaching craft"],"MLB":["Team stories","Ballparks","Prospects","Great defense","Baseball history","Statistical curiosities"],
  "Modernism":["Bauhaus","International Style","Midcentury modern","Brazilian modernism","Modernist homes","Preservation"],"Editorial illustration":["Magazine illustration","New illustrators","Ink + collage","Visual essays","Illustration archives","Studio visits"]
};
const granularFor=label=>granularSpecifics[label]||[label,`New in ${label}`,`${label} through the years`,`People shaping ${label}`,`Behind the scenes of ${label}`,`${label} deep cuts`];
const featuredLanes={
  music:[
    {label:"Classical + composed",children:["Classical"]},
    {label:"Jazz in all directions",children:["Jazz"]},
    {label:"Rockin’",children:["Rock","Metal"]},
    {label:"Roots + songs",children:["Country","Folk","Blues"]},
    {label:"Beats + soul",children:["Hip-hop","Electronic","Soul + R&B"]},
    {label:"Sounds around the world",children:["Reggae","Global music"]}
  ],
  film:[
    {label:"What’s new on screen",children:["New movies","Great television","Independent film"]},
    {label:"Classics + cult favorites",children:["Classic film","Cult classics"]},
    {label:"Real life on film",children:["Documentaries","International cinema"]},
    {label:"Big imagined worlds",children:["Animation","Horror + suspense","Science fiction + fantasy"]},
    {label:"How movies get made",children:["Film craft","Comedy"]}
  ],
  sports:[
    {label:"Big team sports",children:["Football + fantasy","Baseball","Basketball","Hockey"]},
    {label:"The world’s games",children:["Soccer","Tennis","Golf"]},
    {label:"Speed + endurance",children:["Motor racing","Running + cycling","Olympic sports"]},
    {label:"College + women’s sports",children:["College sports","Women’s sports"]},
    {label:"Great stories + history",children:["Great sports stories","Sports history"]}
  ],
  design:[
    {label:"Fine art",children:["Painting","Sculpture","Public art"]},
    {label:"Pictures + print",children:["Illustration + comic art","Poster art","Photography as art"]},
    {label:"Graphic + type",children:["Graphic design","Typography"]},
    {label:"Buildings + objects",children:["Architecture","Furniture + objects","Craft"]},
    {label:"Exhibitions + new media",children:["Museums + exhibitions","Digital + new media","Creative studios"]}
  ],
  books:[
    {label:"Stories, please",children:["Fiction, please","Mysteries + thrillers","Science fiction + fantasy","Graphic novels + comics"]},
    {label:"Ideas + real lives",children:["Essays + big ideas","Lives well lived","History rabbit holes"]},
    {label:"Poetry + literary culture",children:["Poetry counts","Independent magazines","Book design"]},
    {label:"Archives + bookish places",children:["Archives + museums","Bookshops are destinations"]}
  ]
};
Object.assign(featuredLanes,{
  animals:[
    {label:"Dogs, cats + home life",children:["Dogs","Cats"]},
    {label:"Wildlife + birds",children:["Wildlife","Birds","Ocean life","Conservation"]},
    {label:"Rescue + clever creatures",children:["Animal rescue","Animal intelligence"]}
  ],
  science:[
    {label:"Space + the night sky",children:["Space","Astronomy"]},
    {label:"Nature, oceans + medicine",children:["Nature","Oceans","Medicine"]},
    {label:"How the world works",children:["Engineering","Mathematics","How things work"]}
  ],
  photography:[
    {label:"People + life through a lens",children:["Documentary","Street photography","Portraits"]},
    {label:"Film cameras + darkrooms",children:["Film cameras","Darkrooms"]},
    {label:"Landscapes, history + new eyes",children:["Landscape","Photo history","New photographers"]}
  ],
  outdoors:[
    {label:"Trails + camping",children:["Hiking","Camping","National parks"]},
    {label:"Gardens, forests + birds",children:["Gardens","Forests","Birding"]},
    {label:"Beautiful places worth saving",children:["Beautiful landscapes","Conservation"]}
  ],
  travel:[
    {label:"Easy escapes",children:["Day trips","Road trips","Small towns"]},
    {label:"Cities, trains + places to stay",children:["Great cities","Train travel","Hotels"]},
    {label:"Museums + places to eat",children:["Museums","Places to eat"]}
  ],
  comedy:[
    {label:"Stand-up + funny people",children:["Stand-up","Funny interviews","Comic actors"]},
    {label:"Sketches + classic comedy",children:["Sketches","Classic comedy","Late-night archives"]},
    {label:"Absurdity + smart silliness",children:["Absurdity","Smart silliness"]}
  ],
  making:[
    {label:"Wood, clay + ink",children:["Woodworking","Ceramics","Printmaking"]},
    {label:"Studios, tools + process",children:["Home studios","Analog tools","Creative process"]},
    {label:"Repair + beautiful objects",children:["Repair","Beautiful objects"]}
  ],
  technology:[
    {label:"Useful new machines",children:["Apple","Robotics","Inventors"]},
    {label:"Cameras, sound + creative tools",children:["Audio gear","Cameras","Creative tools"]},
    {label:"Cleaner, more thoughtful tech",children:["Clean energy","Thoughtful AI"]}
  ]
});
const friendlyLaneLabels={
  food:["I know a good place","Let’s make something delicious","Food has stories"],
  science:["Big ideas + tiny wonders","Earth, sea + sky","How the world works"],
  animals:["Pets are people too","Wild things","Clever creatures + second chances"],
  photography:["Life through a lens","Film cameras forever","Pictures with a past"],
  outdoors:["Take me outside","Gardens, forests + birds","Wild places worth saving"],
  travel:["Let’s go somewhere","Cities, towns + trains","Worth the detour"],
  comedy:["Make me laugh","Old-school funny","Smart silliness"],
  local:["What’s good nearby?","A perfect local day","Neighborhood treasures"],
  making:["I make things","Tools + studios","Fix it, don’t toss it"],
  people:["People doing good things","Lives worth knowing","Small wins, big heart"],
  philanthropy:["Money put to good use","Stronger communities","Giving that actually works"],
  technology:["Useful new toys","Machines with brains","Technology for making things"],
  business:["Follow the money","People building things","Companies with a story"],
  health:["Move a little","Feel better for longer","Everyday wellbeing"],
  home:["Make home nicer","Plants + gardens","Old houses, new ideas"],
  family:["Good things to do together","Growing up curious","Let’s take the family somewhere"],
  style:["Runway dreams","Style in real life","Fashion’s people + pictures"],
  women:["Women making culture","Women changing the game","Stories worth following"],
  gaming:["What’s new to play?","Old games, still great","How games get made"],
  cars:["Things with wheels","Life on the water","Planes, trains + beautiful machines"]
};
const lanesForTopic=topic=>featuredLanes[topic.id]||(()=>{const labels=friendlyLaneLabels[topic.id]||["The good stuff","A little curious","Take me deeper"],count=Math.min(labels.length,Math.ceil(topic.children.length/3)),size=Math.ceil(topic.children.length/count);return Array.from({length:count},(_,index)=>({label:labels[index],children:topic.children.slice(index*size,(index+1)*size)})).filter(item=>item.children.length)})();
const readerDefaults={design:"Established Meanwhile layout on desktop and mobile",safety:"Established rage-free, politics-free and blocked-content policy",radio:"Ambient",feedback:"More like this, Less, Too political and Too depressing",memory:"No duplicate content and no repeats within seven days",connections:"Offer optional service connections only in context, after the person uses the relevant feature"};
const roundRobin=(groups,limit)=>{const result=[];for(let row=0;result.length<limit;row++){let added=false;groups.forEach(group=>{if(result.length<limit&&group[row]){result.push(group[row]);added=true}});if(!added)break}return result};

function Bubble({label,selected,onClick,index,depth,size="md",color="blue"}){return <button type="button" className={`bubble size-${size} color-${color} ${selected?"selected":""} depth-${depth}`} style={{"--delay":`${(index%11)*-0.23}s`,"--tilt":`${(index%5)-2}deg`}} aria-pressed={selected} onClick={onClick}><span>{label}</span><i>{selected?"✓":"+"}</i></button>}
function StepHeader({eyebrow,title,copy}){return <div className="stepHeader"><span>{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>}
const toggle=(list,item)=>list.includes(item)?list.filter(value=>value!==item):[...list,item];

export default function MakeItYours(){
  const [step,setStep]=useState(0),[doorwayPicks,setDoorwayPicks]=useState([]),[details,setDetails]=useState([]),[granular,setGranular]=useState([]),[fine,setFine]=useState([]),[extra,setExtra]=useState(""),[name,setName]=useState(""),[loaded,setLoaded]=useState(false);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(saved){setStep(saved.step||0);setDoorwayPicks(saved.doorwayPicks||[]);setDetails(saved.details||[]);setGranular(saved.granular||[]);setFine(saved.fine||[]);setExtra(saved.extra||"");setName(saved.name||"");}}catch{}setLoaded(true)},[]);
  useEffect(()=>{if(loaded)localStorage.setItem(STORAGE_KEY,JSON.stringify({step,doorwayPicks,details,granular,fine,extra,name,updatedAt:new Date().toISOString()}))},[step,doorwayPicks,details,granular,fine,extra,name,loaded]);
  useEffect(()=>{window.scrollTo({top:0,behavior:"smooth"})},[step]);
  const broad=useMemo(()=>[...new Set(doorways.filter(item=>doorwayPicks.includes(item.id)).flatMap(item=>item.signals))],[doorwayPicks]);
  const fashionLed=doorwayPicks.some(id=>["fashion-first","fashion","women-stories","costumes","fashion-week","bergdorfs","bon-marche","runway-save","magazine-photo","designer-not-trend","costume-binge"].includes(id));
  const chosenTopics=topics.filter(topic=>broad.includes(topic.id)).sort((a,b)=>fashionLed?(["style","women","photography","film","books","travel","design"].indexOf(a.id)+1||99)-(["style","women","photography","film","books","travel","design"].indexOf(b.id)+1||99):0);
  const journeyTopics=useMemo(()=>doorwayPicks.map(id=>topics.find(topic=>topic.id===doorwayTopic[id])).filter((topic,index,array)=>topic&&array.findIndex(other=>other.id===topic.id)===index),[doorwayPicks]);
  const topicCount=journeyTopics.length,deepStep=topicCount+1,fineStep=topicCount+2,readyStep=topicCount+3,currentTopic=step>=1&&step<=topicCount?journeyTopics[step-1]:null;
  const granularOptions=useMemo(()=>roundRobin(details.map((label,index)=>optionsFor(label).map(value=>({label:value,parent:label,color:topics[(index*3)%topics.length].color,size:index%5===0?"lg":"md"}))),24).filter((item,index,array)=>array.findIndex(other=>other.label===item.label)===index),[details]);
  const fineOptions=useMemo(()=>roundRobin(granular.map((label,index)=>granularFor(label).map(value=>({label:value,parent:label,color:topics[(index*5+2)%topics.length].color,size:index%4===0?"lg":"md"}))),18).filter((item,index,array)=>array.findIndex(other=>other.label===item.label)===index),[granular]);
  const profile=useMemo(()=>({version:5,name:name.trim(),title:name.trim()?`${name.trim()}’s Edition`:"My Edition",openingChoices:doorways.filter(item=>doorwayPicks.includes(item.id)).map(item=>item.label),broadInterests:chosenTopics.map(topic=>topic.label),specificInterests:details,details:granular,granularInterests:fine,anythingElse:extra.split(/,|\n/).map(value=>value.trim()).filter(Boolean),readerDefaults}),[name,doorwayPicks,chosenTopics,details,granular,fine,extra]);
  const progress=["Start",...journeyTopics.map(topic=>topic.label),"Go deeper","Fine-tune","Ready"];
  const reset=()=>{if(confirm("Clear these choices and begin again?")){localStorage.removeItem(STORAGE_KEY);setStep(0);setDoorwayPicks([]);setDetails([]);setGranular([]);setFine([]);setExtra("");setName("")}};
  const buildEdition=async()=>{const finished={...profile,updatedAt:new Date().toISOString()};localStorage.setItem(PROFILE_KEY,JSON.stringify(finished));if(supabase){const {data:{user}}=await supabase.auth.getUser();if(user)await supabase.from("profiles").upsert({user_id:user.id,display_name:finished.name||null,edition_name:finished.title,preferences:finished});}window.location.href="/?personalized=true"};
  const next=()=>setStep(value=>Math.min(readyStep,value+1));
  const toggleDoorway=item=>{setDoorwayPicks(toggle(doorwayPicks,item.id));setDetails([]);setGranular([]);setFine([])};
  const toggleDetail=label=>{setDetails(toggle(details,label));setGranular([]);setFine([])};
  const toggleGranular=label=>{setGranular(toggle(granular,label));setFine([])};
  return <main className="app interviewApp">
    <header><a href="/">Meanwhile</a><div><span>Make it yours</span><button onClick={reset}>Start over</button></div></header>
    <div className="progress"><div>{progress.map((label,index)=><span className={index===step?"active":index<step?"done":""} key={label}><i>{index<step?"✓":index+1}</i>{label}</span>)}</div><em>About 90 seconds</em></div>
    {step===0&&<section className="screen"><StepHeader eyebrow="MAKE IT YOURS" title="Which of these sound like you?" copy="Pick what sounds good. We’ll build your edition."/><div className={`constellation broad openingConstellation ${doorwayPicks.length?"hasSelection":""}`}>{primaryDoorways.map((item,index)=><Bubble key={item.id} label={item.label} size={item.size} color={item.color} depth={0} index={index} selected={doorwayPicks.includes(item.id)} onClick={()=>toggleDoorway(item)}/>)}</div><div className="tip">Choose as many as you like.</div></section>}
    {currentTopic&&<section className="screen"><StepHeader eyebrow={`${currentTopic.label.toUpperCase()} · ${step} OF ${topicCount}`} title={currentTopic.id==="music"?"What do you like to hear?":currentTopic.id==="sports"?"What do you follow?":currentTopic.id==="style"?"What’s your kind of style?":currentTopic.id==="film"?"What do you like to watch?":`What sounds good in ${currentTopic.label.toLowerCase()}?`} copy="Choose as many as you like—or none and keep moving."/><div className={`constellation details ${details.some(value=>currentTopic.children.includes(value))?"hasSelection":""}`}>{currentTopic.children.map((label,index)=><Bubble key={`${currentTopic.id}-${label}`} label={label} parent={currentTopic.label} color={currentTopic.color} size={index%5===0?"lg":"md"} depth={1} index={index} selected={details.includes(label)} onClick={()=>toggleDetail(label)}/>)}</div></section>}
    {step===deepStep&&<section className="screen"><StepHeader eyebrow="GO A LITTLE DEEPER" title="Anything feel especially you?" copy="A balanced handful drawn from all your choices. No category gets to take over."/><div className={`constellation details ${granular.length?"hasSelection":""}`}>{granularOptions.map((item,index)=><Bubble key={`${item.parent}-${item.label}`} {...item} depth={3} index={index} selected={granular.includes(item.label)} onClick={()=>toggleGranular(item.label)}/>)}</div></section>}
    {step===fineStep&&<section className="screen"><StepHeader eyebrow="ONE LAST PASS" title="Let’s get wonderfully specific." copy="A short final set of artists, eras, leagues, crafts and deep cuts."/><div className={`constellation details ${fine.length?"hasSelection":""}`}>{fineOptions.map((item,index)=><Bubble key={`${item.parent}-${item.label}`} {...item} depth={4} index={index} selected={fine.includes(item.label)} onClick={()=>setFine(toggle(fine,item.label))}/>)}</div><div className="optional"><label><span>Anything we missed? <i>Optional</i></span><input value={extra} onChange={event=>setExtra(event.target.value)} placeholder="Toss in an artist, director, team, author, style, place—anything."/></label></div></section>}
    {step===readyStep&&<section className="screen finish"><StepHeader eyebrow="THAT’S PLENTY TO BEGIN" title="Your edition is ready." copy="Meanwhile can learn the rest while you enjoy it."/><div className="profile"><div className="profileName"><span>Name your edition <i>Optional</i></span><input value={name} onChange={event=>setName(event.target.value)} placeholder="Your first name"/><h2>{profile.title}</h2></div><div className="profileCloud">{[...profile.broadInterests,...details,...granular,...fine,...profile.anythingElse].slice(0,30).map((item,index)=><span className={`p-${index%5}`} key={`${item}-${index}`}>{item}</span>)}</div><div className="promise"><b>Already taken care of</b><p>The playful Reader design, mobile layout, ambient radio, rage-free editorial rules, source variety, duplicate protection and seven-day memory are all built in. You can teach it more with <em>More like this</em> and <em>Less</em> while you browse.</p></div></div></section>}
    <nav><button disabled={step===0} onClick={()=>setStep(value=>Math.max(0,value-1))}>← Back</button>{step<readyStep&&<button className="primary" disabled={step===0&&!doorwayPicks.length} onClick={next}>{step===0?"Start my mini-sections":step<topicCount?`Next: ${journeyTopics[step]?.label||"section"}`:step===topicCount?"Go a little deeper":step===deepStep?"Fine-tune it":"This feels like me"}<span>→</span></button>}{step===readyStep&&<button className="primary" onClick={buildEdition}>Open my edition <span>→</span></button>}</nav>
    <footer><span>No account connections. No setup homework.</span><span>Personalized V9 · Saved privately in this browser</span></footer>
  </main>
}
