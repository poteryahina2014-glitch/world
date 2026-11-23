const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const TEST=location.search.includes('test');
const W=3600,H=2400,R=14,MIN_Z=0.25,MIN_PER_SEC=4,WALK=16,YEAR=1440,MAX_POP=300,SAVE_KEY=TEST?'livingWorld.test':'livingWorld.v1';
let DPR=1;
let cameraNeedsFit=false;
function resize(){DPR=window.devicePixelRatio||1;cv.width=innerWidth*DPR;cv.height=innerHeight*DPR;const top=document.getElementById('top');if(top)document.documentElement.style.setProperty('--top-height',top.offsetHeight+'px');if(cameraNeedsFit&&innerWidth&&innerHeight){fitCamera();centerCameraOnResidents();cameraNeedsFit=false;}}
addEventListener('resize',resize);resize();
if(window.ResizeObserver)new ResizeObserver(()=>document.documentElement.style.setProperty('--top-height',document.getElementById('top').offsetHeight+'px')).observe(document.getElementById('top'));

const rnd=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const g=(p,m,f)=>p.fem?f:m;
const years=n=>{const a=n%10,b=n%100;return n+' '+(a===1&&b!==11?'год':a>=2&&a<=4&&(b<12||b>14)?'года':'лет');};

const FEM=['Аня','Маша','Оля','Катя','Лена','Вера','Нина','Таня','Света','Даша','Зоя','Лиза','Ира','Соня','Алиса','Поля','Варя','Галя','Мила','Ксюша','Надя','Люба','Ева','Тома','Рита','Уля','Фая','Майя'];
const MAL=['Петя','Олег','Миша','Саша','Ваня','Гриша','Костя','Дима','Федя','Лёва','Тимур','Егор','Артём','Боря','Слава','Гоша','Паша','Рома','Стёпа','Макар','Яша','Сева','Тихон','Глеб','Кеша','Сёма','Юра','Влад'];
const SKIN=['#f8dcc2','#f1c9a5','#e3b08a','#c98c66','#9a6443','#6e4530'];
const HAIR=['#1e1611','#3a2617','#5a3a22','#8b5a2b','#a8692f','#c0803a','#d9a441','#ead08f','#a33a1f'];
const HAIR_RARE=['#6a5acd','#d4537e','#2e8b57','#3a7bd5'];
const TRAITS=[['soc','Общительность'],['kind','Доброта'],['temper','Вспыльчивость'],['curio','Любопытство'],['lazy','Лень']];
const SKILLS=[['build','Строительство'],['gather','Собирательство'],['farm','Земледелие'],['fish','Рыболовство'],['hunt','Охота'],['craft','Ремесло']];
const STYLES_F=['long','long','bun','curly','short','pony'],STYLES_M=['short','short','curly','bald','long','spiky'];

const NEED={home:8,fire:4,store:12,pier:6},CAP={home:40,store:100},TREE_WOOD=6;
const VEG_VALUE=2,GROW_TIME=2800,PLOT_W=44,PLOT_H=32;
const ROOFS=['#a33a1f','#8b4a2b','#5a6e8a','#6b4f3a','#9c5a3c','#7a5a8a'];
const SEASON_LEN=2880,SEASON_NAMES=['весна','лето','осень','зима'];
const GRASS=['#cfe5b4','#c5e09e','#e3d6a0','#eef3f6'],OUTER=['#8fb46a','#86ad57','#c2ad66','#c3ced6'];
const CANOPY=[['#3f7a2e','#4e8f3a','#468534'],['#3a7529','#4a8a34','#41802f'],['#b5552a','#e0a03a','#c9772e'],['#5f7360','#e9eef2','#d3dce1']];

const SETTINGS_KEY='livingWorld.settings';
let settings={wanderers:false,events:true};
try{Object.assign(settings,JSON.parse(localStorage.getItem(SETTINGS_KEY))||{});}catch(e){}
const saveSettings=()=>{if(TEST)return;try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch(e){}};

let people,byId,bushes,trees,flowers,minutes,lastDay,lastSeason,nextId,pairLog,logArr,houses,nextHouse,plots=[],nextPlot=0;
let river={x:2700,ph:0,fords:[]},fishStock=24,hares=[],nextHare=0;
let weather=null,drought=0,pendingEvent=null,flashAt=-99,villages=[],nextVillage=0,tradeDay=0;
const newToday=()=>({plant:0,hunt:0,barter:0,trade:0,fish:0,births:0,old:0,hunger:0,sick:0,quarrel:0,friend:0,theft:0,harvest:0,chief:0,peace:0});
let dayStats=[],today=newToday(),annals=[],yearNotes=[];
const YEAR_LEN=SEASON_LEN*4,DAYS_PER_YEAR=YEAR_LEN/1440;
const NOTE_RE=/основали деревню|вырубили|перебрались в деревню|пристань|опустела|староста|старосту|без старосты|изго|любимец деревни|любимица деревни|достроили дом|готов[ао]?\.|стали парой|расстались| умер|Молния|засух|метель|гроза|богатый урожай|странни|заселились|опустел|попал|засох|замёрз|Последний житель|Жители решили|Жители задумали/;
const tally=k=>{today[k]++;};
function snapshotDay(d){
  const food=houses.reduce((s,h)=>s+(h.food||0),0);
  dayStats.push({d,season:Math.floor((minutes-1)/SEASON_LEN)%4,pop:people.length,kids:people.filter(isChild).length,
    homes:houses.filter(h=>isHome(h)&&h.built).length,food,trees:trees.filter(isTree).length,saps:trees.filter(t=>!t.stump&&t.sap<1).length,hares:hares.length,...today});
  if(dayStats.length>3000)dayStats.shift();
  today=newToday();
}
let speed=1,selected=null,follow=false,hover=null;
const cam={x:W/2,y:H/2,z:0.6};

function fitCamera(){cam.z=clamp(Math.min(innerWidth/W,innerHeight/H)*1.6,MIN_Z,3.5);}
function residentCenter(){
  const outdoors=people.filter(p=>!p.inHouse),targets=outdoors.length?outdoors:villages.filter(v=>!v.empty);
  if(!targets.length)return null;
  return {x:targets.reduce((n,p)=>n+p.x,0)/targets.length,y:targets.reduce((n,p)=>n+p.y,0)/targets.length};
}
function centerCameraOnResidents(){const c=residentCenter();if(c){cam.x=c.x;cam.y=c.y;}}
function cameraShowsResident(){return people.some(p=>Math.abs(p.x-cam.x)<=innerWidth/(2*cam.z)&&Math.abs(p.y-cam.y)<=innerHeight/(2*cam.z));}
function showResidentsIfNeeded(){if(!people.length)return;if(!innerWidth||!innerHeight){cameraNeedsFit=true;return;}if(!cameraShowsResident())centerCameraOnResidents();}

const day=()=>Math.floor(minutes/1440)+1;
const hour=()=>(minutes/60)%24;
const season=()=>Math.floor(minutes/SEASON_LEN)%4;
const isNight=()=>{const h=hour();return h>=22||h<6;};
const fmtTime=m=>{const h=Math.floor((m/60)%24),mm=Math.floor(m%60);return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;};
const age=p=>(minutes-p.born)/YEAR;
const isChild=p=>age(p)<18;
const alive=id=>{const p=byId.get(id);return p&&!p.dead?p:null;};
const isHome=h=>!h.type||h.type==='home';
const building=(type,v)=>houses.find(h=>h.type===type&&h.village===v)||null;

function hexMix(a,b,t){
  const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);
  const ch=s=>Math.round(((pa>>s)&255)*(1-t)+((pb>>s)&255)*t);
  return '#'+((1<<24)+(ch(16)<<16)+(ch(8)<<8)+ch(0)).toString(16).slice(1);
}
function freeName(fem){
  const used=new Set(people.filter(p=>!p.dead).map(p=>p.name));
  const pool=(fem?FEM:MAL).filter(n=>!used.has(n));
  return pool.length?pick(pool):pick(fem?FEM:MAL);
}
function makeDots(){const d=[];for(let k=0;k<8;k++){const a=k/8*Math.PI*2+rnd(0.4);d.push([Math.cos(a)*rnd(5,14),Math.sin(a)*rnd(5,14)]);}return d;}

function makePerson(name,fem,o={}){
  const rare=Math.random()<0.08;
  const p={id:nextId++,name,fem,x:o.x??rnd(200,W-200),y:o.y??rnd(200,H-200),tx:0,ty:0,
    born:o.born??(minutes-rnd(17,36)*YEAR),origin:o.origin||'first',
    look:o.look??{skin:pick(SKIN),hair:rare?pick(HAIR_RARE):pick(HAIR),style:pick(fem?STYLES_F:STYLES_M),
      shirt:`hsl(${Math.floor(rnd(360))},${Math.floor(rnd(40,72))}%,${Math.floor(rnd(40,62))}%)`},
    tr:o.tr??{soc:rnd(),kind:rnd(),temper:rnd(),curio:rnd(),lazy:rnd()},
    sk:o.sk??{build:rnd(0,0.25),gather:rnd(0,0.25),farm:rnd(0,0.25),fish:rnd(0,0.15),hunt:rnd(0,0.15),craft:rnd(0,0.15)},skLog:{},carryKind:'berry',tools:{},
    hunger:rnd(10,50),energy:rnd(60,100),social:rnd(10,60),
    state:'idle',timer:rnd(2,15),goal:null,talk:null,rel:{},bubble:null,hist:[],walk:rnd(100),
    partner:null,parents:o.parents??[],kids:[],starve:0,home:o.home??null,carry:false,carryFood:0,inHouse:false,
    sick:0,communal:0,fame:{q:0,treat:0,help:0,theft:0,caught:0},news:[],heard:{},rep:0,known:0,repSt:'',dead:false,lonelyDay:-1,hungryDay:-1,grown:!o.parents};
  p.village=o.village??nearestVillage(p);
  people.push(p);byId.set(p.id,p);
  return p;
}

function newWorld(){
  people=[];byId=new Map();nextId=0;minutes=8*60;lastDay=1;lastSeason=0;pairLog={};logArr=[];houses=[];nextHouse=0;plots=[];nextPlot=0;
  weather=null;drought=0;pendingEvent=null;villages=[];nextVillage=0;tradeDay=0;dayStats=[];today=newToday();annals=[];yearNotes=[];
  document.getElementById('log').innerHTML='';
  trees=[];for(let i=0;i<76;i++)trees.push({x:rnd(40,W-40),y:rnd(40,H-40),r:rnd(26,46),wood:TREE_WOOD,grow:0,sap:1,stump:0});
  hares=[];nextHare=0;tracks=[];trackI=0;
  flowers=[];for(let i=0;i<1100;i++)flowers.push({x:rnd(W),y:rnd(H),c:pick(['#ffffff','#f4d03f','#e58aa8','#b5d4f4','#b7d699','#b7d699','#b7d699']),s:rnd(1.5,3.5)});
  bushes=[];
  for(let i=0;i<30;i++){
    let b,tries=0;
    do{b={x:rnd(150,W-150),y:rnd(150,H-150),b:5,max:5,grow:rnd(60),dots:makeDots()};tries++;}
    while(tries<30&&bushes.some(o=>dist(o,b)<220));
    bushes.push(b);
  }
  const names=[...shuffle(FEM).slice(0,8).map(n=>[n,true]),...shuffle(MAL).slice(0,8).map(n=>[n,false])];
  makeRiver();fishStock=FISH_MAX;foundVillage(W/2-125,H/2);
  for(let i=0;i<4;i++)spawnHare();
  for(const [n,f] of shuffle(names))makePerson(n,f,{x:W/2+rnd(-600,350),y:H/2+rnd(-400,400)});
  selected=null;follow=false;hideCard();
  addLog(null,'На поляне поселились 16 жителей. Сейчас весна');
  cam.x=W/2;cam.y=H/2;
  if(innerWidth&&innerHeight){fitCamera();centerCameraOnResidents();}else{cam.z=MIN_Z;cameraNeedsFit=true;}
}

/* ---------- хроника ---------- */
const LOG_CATS=[['life','Жизнь и смерть'],['family','Пары'],['social','Отношения'],['build','Хозяйство'],['world','Мир'],['minor','Мелочи']];
function logCat(t){
  if(/Наступил день|заскучал|голоден|голодна|умел|по стопам|судачат|деревце|смастерил|сломал/.test(t))return 'minor';
  if(/родил|умер|вырос|Последний житель|заболел|заразил|поправил/.test(t))return 'life';
  if(/староста|старосту|без старосты/i.test(t))return 'world';
  if(/изго|любим|заступил|подружились|поссорились|неразлучны|не друзья|терпеть|угостил|украл|тайком|стащил|вырвал|помог/.test(t))return 'social';
  if(/стали парой|расстались|заселились/.test(t))return 'family';
  if(/Наступил|Итоги|гроза|метель|засух|Молния|кусты|Вмешательство|странни|поселились/.test(t))return 'world';
  if(/деревн|пристан|ед\. еды из|выменял|[Зз]айц|забор|лес|дом|костёр|кладовк|огород|урожай|репок|рыб|Жители решили|Жители задумали/.test(t))return 'build';
  return 'world';
}
settings.logCats??=Object.fromEntries(LOG_CATS.map(([k])=>[k,k!=='minor']));
let logSearch='';
function logPasses(e){
  e.cat??=logCat(e.text);
  if(!settings.logCats[e.cat])return false;
  return !logSearch||logSearch.test(e.text);
}
const makeSearch=s=>s?new RegExp('(^|[^а-яёa-z])'+s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'):'';
function renderLogEntry(e,append){
  if(!logPasses(e))return;
  const div=document.createElement('div');
  div.innerHTML=`<span class="t">День ${Math.floor(e.t/1440)+1}, ${fmtTime(e.t)}</span>${e.text}`;
  const log=document.getElementById('log');
  const empty=log.querySelector('.log-empty');if(empty)empty.remove();
  if(append)log.append(div);else{log.prepend(div);while(log.children.length>400)log.lastChild.remove();}
}
function rerenderLog(){
  const log=document.getElementById('log');log.innerHTML='';
  for(const e of logArr)renderLogEntry(e,true);
  if(logSearch&&!log.children.length)log.innerHTML='<div class="log-empty">Ничего не найдено</div>';
}
function addLog(ps,text){
  const e={t:minutes,text,cat:logCat(text)};
  logArr.unshift(e);if(logArr.length>800)logArr.pop();
  if(NOTE_RE.test(text)&&yearNotes.length<60)yearNotes.push(text.replace(/<[^>]+>/g,''));
  renderLogEntry(e,false);
  if(ps)for(const p of ps){p.hist.unshift(e);if(p.hist.length>40)p.hist.pop();}
}

/* ---------- отношения ---------- */
function setBubble(p,type,dur){p.bubble={type,until:minutes+dur};}
const rel=(a,b)=>a.rel[b.id]||0;
const pairKey=(a,b)=>a.id<b.id?a.id+'-'+b.id:b.id+'-'+a.id;
const canPair=(a,b)=>a.fem!==b.fem&&!isChild(a)&&!isChild(b)&&a.partner===null&&b.partner===null&&!a.parents.includes(b.id)&&!b.parents.includes(a.id)&&!(a.parents.length&&a.parents.some(x=>b.parents.includes(x)));

function changeRel(a,b,d){
  const before=rel(a,b),after=clamp(before+d,-100,100);
  a.rel[b.id]=after;b.rel[a.id]=after;
  const n=`${a.name} и ${b.name}`;
  if(before<40&&after>=40){addLog([a,b],`${n} подружились`);tally('friend');}
  if(before<75&&after>=75)addLog([a,b],`${n} стали неразлучны`);
  if(before>=40&&after<40)addLog([a,b],`${n} больше не друзья`);
  if(before>-35&&after<=-35)addLog([a,b],`${n} теперь терпеть друг друга не могут`);
  if(after>=45&&canPair(a,b)){a.partner=b.id;b.partner=a.id;addLog([a,b],`${n} стали парой`);setBubble(a,'heart',40);setBubble(b,'heart',40);}
  if(a.partner===b.id&&after<20){a.partner=null;b.partner=null;addLog([a,b],`${n} расстались`);setBubble(a,'sad',40);setBubble(b,'sad',40);}
}
function quarrel(a,b,reason){
  changeRel(a,b,-rnd(10,22));tally('quarrel');a.fame.q++;b.fame.q++;hear(a,b,-10,'quarrel');hear(b,a,-10,'quarrel');
  setBubble(a,'angry',35);setBubble(b,'angry',35);
  const k=pairKey(a,b);
  if(!(pairLog[k]>minutes-240)){pairLog[k]=minutes;addLog([a,b],`${a.name} и ${b.name} поссорились${reason?' '+reason:''}`);}
}

/* ---------- слухи и репутация ---------- */
const NEWS_MAX=8,NEWS_LIFE=2*1440;
const opinion=(p,o)=>rel(p,o)+(p.heard[o.id]||0);
function hear(p,who,d,k){
  if(!p||p.dead||!who||p===who)return;
  p.news=p.news.filter(n=>minutes-n.at<NEWS_LIFE&&!(n.who===who.id&&n.k===k));
  p.news.unshift({who:who.id,d,k,at:minutes});if(p.news.length>NEWS_MAX)p.news.length=NEWS_MAX;
}
const GOSSIP={gift:c=>'выручает соседние деревни',greed:c=>'тащит из кладовки себе',theft:c=>'тащит чужое',quarrel:c=>g(c,'вздорный','вздорная'),treat:c=>g(c,'щедрый','щедрая'),help:c=>'всегда поможет'};
function gossip(a,b){
  if(Math.random()>0.2+a.tr.soc*0.5)return;
  const opts=a.news.filter(n=>n.who!==b.id&&minutes-n.at<NEWS_LIFE&&alive(n.who)&&!b.news.some(m=>m.who===n.who&&m.k===n.k));
  if(!opts.length)return;
  const n=pick(opts),c=alive(n.who);
  if(n.d<0&&rel(b,c)>=40){
    changeRel(a,b,-3);
    const k='def'+b.id+'-'+c.id;
    if(!(pairLog[k]>minutes-1440)){pairLog[k]=minutes;addLog([b,c],`${b.name} ${g(b,'заступился','заступилась')} за друга: ${a.name} говорит, что ${c.name} ${GOSSIP[n.k](c)}`);}
    return;
  }
  const trust=clamp((rel(b,a)+30)/90,0.1,1);
  b.heard[c.id]=clamp((b.heard[c.id]||0)+n.d*trust,-40,40);
  if(Math.abs(n.d)*0.6>=3)hear(b,c,n.d*0.6,n.k);
  const k='gs'+c.id+n.k;
  if(!(pairLog[k]>minutes-720)){pairLog[k]=minutes;addLog([c],`${a.name} и ${b.name} судачат: ${c.name}, говорят, ${GOSSIP[n.k](c)}`);}
}
const repWord=p=>p.repSt==='fav'?g(p,'любимец деревни','любимица деревни'):p.repSt==='out'?g(p,'изгой','изгойка'):'обычная';
function updateReputation(){
  const sum=new Map(),cnt=new Map();
  for(const o of people){
    const ids=new Set([...Object.keys(o.rel),...Object.keys(o.heard)]);
    for(const k of ids){const id=+k;if(id===o.id)continue;sum.set(id,(sum.get(id)||0)+(o.rel[k]||0)+(o.heard[k]||0));cnt.set(id,(cnt.get(id)||0)+1);}
    for(const k in o.heard){o.heard[k]*=0.85;if(Math.abs(o.heard[k])<1||!alive(+k))delete o.heard[k];}
    o.news=o.news.filter(n=>minutes-n.at<NEWS_LIFE&&alive(n.who));
  }
  const need=Math.max(4,people.length*0.15);
  for(const p of people){p.known=cnt.get(p.id)||0;p.rep=p.known?Math.round(sum.get(p.id)/p.known):0;}
  const wideOf=p=>p.known>=need&&!isChild(p);
  const rs=people.filter(wideOf).map(p=>p.rep).sort((a,b)=>a-b);
  if(rs.length<5){for(const p of people)p.repSt='';return;}
  const med=rs[rs.length>>1],REP_OUT=Math.min(10,med-35),REP_FAV=Math.max(40,med+20),famous=Math.max(6,people.length*0.2);
  const prev=new Map(people.map(p=>[p,p.repSt]));
  for(const p of people){
    const wide=wideOf(p);
    if(p.repSt==='out'&&(p.rep>REP_OUT+8||!wide))p.repSt='';
    else if(p.repSt!=='out'&&wide&&p.rep<=REP_OUT)p.repSt='out';
    if(p.repSt==='fav'&&(p.rep<REP_FAV-8||p.known<famous*0.8||isChild(p)))p.repSt='';
  }
  let favs=people.filter(p=>p.repSt==='fav').length;
  for(const p of people.filter(p=>!p.repSt&&p.known>=famous&&!isChild(p)&&p.rep>=REP_FAV).sort((a,b)=>b.rep-a.rep)){if(favs>=3)break;p.repSt='fav';favs++;}
  for(const p of people){
    const was=prev.get(p);
    if(was===p.repSt)continue;
    if(p.repSt==='out')addLog([p],`${p.name} теперь ${g(p,'изгой','изгойка')}: в деревне ${g(p,'его','её')} сторонятся`);
    else if(p.repSt==='fav')addLog([p],`${p.name} теперь ${g(p,'любимец','любимица')} деревни`);
    else if(was==='out')addLog([p],`${p.name} больше не ${g(p,'изгой','изгойка')}`);
  }
}

/* ---------- река и рыбалка ---------- */
const RIVER_W=84,FISH_MAX=24,FISH_VALUE=2;
const riverX=y=>river.x+150*Math.sin(y/430+river.ph)+50*Math.sin(y/170+river.ph*2);
const sideOf=(x,y)=>x<riverX(y)?0:1;
const inWater=(x,y,m=0)=>Math.abs(x-riverX(y))<RIVER_W/2+m;
const bankPoint=(x,y,side)=>{const rx=riverX(y);return {x:side?rx+RIVER_W/2+16:rx-RIVER_W/2-16,y};};
const nearRiver=o=>Math.abs(o.x-riverX(o.y))<380;
function crossings(){const c=river.fords.map(y=>({x:riverX(y),y}));for(const h of houses)if(h.type==='pier'&&h.built)c.push({x:riverX(h.y),y:h.y});return c;}
const nearCrossing=p=>crossings().some(c=>Math.abs(c.y-p.y)<40&&Math.abs(c.x-p.x)<RIVER_W);
function bestCrossing(p,t){let best=null,bs=1e9;for(const c of crossings()){const d=dist(p,c)+dist(c,t);if(d<bs){bs=d;best=c;}}return best?{x:best.x,y:best.y}:{x:p.x,y:p.y};}
function makeRiver(){
  river.ph=rnd(Math.PI*2);
  let best=2700,bs=1e9;
  for(let x=2500;x<=3300;x+=50){
    river.x=x;let sc=Math.abs(x-2750)*0.5;
    for(const h of houses)if(inWater(h.x,h.y,90))sc+=1000;
    for(const pl of plots)if(inWater(pl.x,pl.y,60))sc+=1000;
    for(const p of people)if(inWater(p.x,p.y,30))sc+=50;
    if(sc<bs){bs=sc;best=x;}
  }
  river.x=best;river.fords=[rnd(H*0.38,H*0.62),pick([rnd(H*0.1,H*0.22),rnd(H*0.78,H*0.9)])];
  trees=trees.filter(t=>!inWater(t.x,t.y,t.r+12));
  flowers=flowers.filter(f=>!inWater(f.x,f.y,6));
  for(const b of bushes)while(inWater(b.x,b.y,40)){b.x=rnd(150,W-150);b.y=rnd(150,H-150);}
  for(const p of people)if(inWater(p.x,p.y,10))p.x=bankPoint(p.x,p.y,0).x;
}
function fishSpot(p){
  const pr=building('pier',p.village);
  if(pr&&pr.built&&Math.random()<0.6){const d=dist(p,pr);if(d<1200)return {x:pr.x,y:pr.y,d,pier:true};}
  const side=sideOf(p.x,p.y),y=clamp(p.y+rnd(-150,150),60,H-60),b=bankPoint(0,y,side),d=dist(p,b);
  return d<1400?{...b,d}:null;
}
function finishFish(p){
  const ch=(0.3+0.5*p.sk.fish)*(season()===3?0.5:1)*(p.goal&&p.goal.pier?1.3:1)*(p.tools.rod?1.25:1)*clamp(fishStock/FISH_MAX*1.5,0,1);
  if(fishStock>=1&&Math.random()<ch){
    fishStock--;useTool(p,'rod');addSkill(p,'fish',0.03);tally('fish');
    let n=FISH_VALUE;
    if(Math.random()<0.03*p.sk.fish){n*=3;addLog([p],`${p.name} ${g(p,'поймал','поймала')} огромную рыбу`);}
    if(p.hunger>60){p.state='eat';p.timer=rnd(8,12);p.goal={kind:'eathouse'};return;}
    const h=gatherTarget(p)||household(p);
    if(h&&h.food<CAP[h.type||'home']){p.carryFood=n;p.carryKind='fish';const d=door(h);goTo(p,d.x,d.y,{kind:'stash',house:h});return;}
    p.state='eat';p.timer=rnd(8,12);p.goal={kind:'eathouse'};return;
  }
  addSkill(p,'fish',0.008);decide(p);
}
function drawRiver(s){
  const ys=[];for(let y=-40;y<=H+40;y+=24)ys.push(y);
  const band=(m,c)=>{ctx.fillStyle=c;ctx.beginPath();ys.forEach((y,i)=>{const x=riverX(y)-RIVER_W/2-m;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});for(let i=ys.length-1;i>=0;i--)ctx.lineTo(riverX(ys[i])+RIVER_W/2+m,ys[i]);ctx.closePath();ctx.fill();};
  band(16,s===3?'#e6ebee':'#d8c896');
  band(0,s===3?'#cfe1ec':'#5d9fd2');
  band(-RIVER_W*0.28,s===3?'#dceaf2':'#73b0de');
  for(const c of crossings())for(let i=-2;i<=2;i++)ellipse(c.x+i*RIVER_W/5,c.y+(i%2)*4,8,6,s===3?'#b8c2c8':'#9a9a8e');
}

/* ---------- староста ---------- */
const canLead=p=>!p.dead&&age(p)>=20&&p.repSt!=='out';

/* ---------- деревни ---------- */
const VILLAGE_NAMES=['Ольховка','Заречье','Берёзовка','Ключи','Сосновка','Липки','Озерки','Дубки','Малиновка','Ивняки'];
const VILLAGE_HOMES=10,MAX_VILLAGES=4,VILLAGE_GAP=1100;
function foundVillage(x,y){
  const used=new Set(villages.map(v=>v.name));
  const v={id:nextVillage++,name:shuffle(VILLAGE_NAMES).find(n=>!used.has(n))||'Деревня '+nextVillage,x,y,chief:null,chiefSince:0,founded:day(),empty:false};
  villages.push(v);return v;
}
function nearestVillage(o){let best=null,bd=1e9;for(const v of villages){const d=dist(o,v);if(d<bd){bd=d;best=v;}}return best?best.id:null;}
const villageOf=o=>villages.find(v=>v.id===o.village)||villages[0];
const isChief=p=>villages.some(v=>v.chief===p.id);
const chiefVillage=p=>villages.find(v=>v.chief===p.id);
const homesIn=v=>houses.filter(h=>isHome(h)&&h.village===v.id&&h.owners.some(id=>alive(id))).length;
const vin=v=>villages.length>1?` (${v.name})`:'';

function createCommunal(type,homes,text,v,spot){
  const cx=homes.reduce((s,h)=>s+h.x,0)/homes.length,cy=homes.reduce((s,h)=>s+h.y,0)/homes.length;
  const sp=spot||findSpot({x:cx,y:cy},0,260);
  newHouse(type,sp.x,sp.y,[],v);
  addLog(null,text);
}
function villageSite(cur){
  let best=null,bs=-1e9;
  for(let i=0;i<150;i++){
    const x=rnd(200,W-200),y=rnd(200,H-200);
    if(inWater(x,y,140))continue;
    const gap=Math.min(...villages.filter(v=>!v.empty).map(v=>dist({x,y},v)));
    if(gap<VILLAGE_GAP)continue;
    let sc=gap*0.1+(sideOf(x,y)!==sideOf(cur.x,cur.y)?400:0)-Math.abs(Math.abs(x-riverX(y))-350)*0.4;
    for(const b of bushes)if(Math.hypot(b.x-x,b.y-y)<450)sc+=30;
    if(sc>bs){bs=sc;best={x,y};}
  }
  return best;
}
function moveVillage(list,v){
  for(const x of list){
    if(x.village===v.id)continue;
    const old=villageOf(x);
    if(old.chief===x.id){old.chief=null;addLog([x],`${x.name} ${g(x,'ушёл','ушла')}, и деревня ${old.name} осталась без старосты`);}
    x.village=v.id;
  }
}
function chooseVillage(p,part){
  const cur=villageOf(p);
  const crowded=homesIn(cur)>=VILLAGE_HOMES,out=p.repSt==='out'||part.repSt==='out';
  let foes=0;for(const x of [p,part])for(const o of people)if(o.village===cur.id&&o!==x&&!isChild(o)&&opinion(x,o)<=-10)foes++;
  const want=(crowded?0.45:0)+(out?0.6:0)+Math.min(0.3,foes*0.05)+(p.tr.curio+part.tr.curio)*0.04;
  if(Math.random()>=want)return {v:cur,moved:false};
  const others=villages.filter(v=>v!==cur&&homesIn(v)<VILLAGE_HOMES);
  let dest=null,fresh=false;
  if(others.length&&(villages.filter(v=>!v.empty).length>=MAX_VILLAGES||Math.random()<0.5))dest=others.sort((a,b)=>dist(p,a)-dist(p,b))[0];
  if(!dest&&villages.filter(v=>!v.empty).length<MAX_VILLAGES){const site=villageSite(cur);if(site){dest=foundVillage(site.x,site.y);fresh=true;}}
  if(!dest)return {v:cur,moved:false};
  const why=out?'там их не любят':crowded?'там стало тесно':foes>=3?'надоели ссоры с соседями':'захотелось перемен';
  addLog([p,part],fresh?`${p.name} и ${part.name} ушли из деревни ${cur.name} (${why}) и основали деревню ${dest.name}`:`${p.name} и ${part.name} перебрались в деревню ${dest.name} из деревни ${cur.name} (${why})`);
  dest.empty=false;
  return {v:dest,moved:true};
}
function ensureHome(p){
  const part=alive(p.partner);if(!part)return null;
  const ph=houseOf(part);
  if(ph&&ph.owners.includes(part.id)){p.home=ph.id;if(!ph.owners.includes(p.id))ph.owners.push(p.id);moveVillage([p],villageOf(ph));return ph;}
  const {v,moved}=chooseVillage(p,part);
  const kids=[...new Set([...p.kids,...part.kids])].map(id=>alive(id)).filter(k=>k&&isChild(k));
  moveVillage([p,part,...kids],v);
  const empty=houses.filter(h=>isHome(h)&&h.built&&h.village===v.id&&!h.owners.some(id=>alive(id))).sort((a,b)=>dist(p,a)-dist(p,b))[0];
  if(empty&&(moved||dist(p,empty)<900)){
    empty.owners=[p.id,part.id];p.home=part.home=empty.id;for(const k of kids)k.home=empty.id;
    addLog([p,part],`${p.name} и ${part.name} заселились в пустой дом`);return empty;
  }
  const s=moved?findSpot(v,0,320):findSpot(p),h=newHouse('home',s.x,s.y,[p.id,part.id],v.id);
  p.home=part.home=h.id;for(const k of kids)k.home=h.id;
  addLog([p,part],`${p.name} и ${part.name} начали строить дом`);
  return h;
}

function elect(v){
  const adults=people.filter(p=>!isChild(p)&&p.village===v.id),old=v.chief===null?null:alive(v.chief),votes=new Map();
  const merit=c=>c.rep+c.known*2+Math.min(age(c)-18,40)*0.5+(c===old?15:0);
  const cands=adults.filter(canLead).sort((a,b)=>merit(b)-merit(a)).slice(0,3);
  if(adults.length<6||!cands.length)return;
  for(const x of adults){
    let best=null,bs=-1e9;
    for(const c of cands){
      if(c===x)continue;
      const sc=opinion(x,c)+c.rep*0.5+(c===old?10:0)+(c.partner===x.id?15:0)+rnd(15);
      if(sc>bs){bs=sc;best=c;}
    }
    if(best)votes.set(best,(votes.get(best)||0)+1);
  }
  const [win,n]=[...votes.entries()].sort((a,b)=>b[1]-a[1])[0]||[];
  if(!win)return;
  const of=`${n} ${n%10===1&&n%100!==11?'голос':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'голоса':'голосов'} из ${adults.length}`;
  if(win===old)addLog([win],`${win.name} снова староста${vin(v)}, ${of}`);
  else{
    v.chief=win.id;v.chiefSince=day();tally('chief');
    addLog(old?[win,old]:[win],old?`Новый староста${vin(v)} — ${win.name}, ${of}; прежний — ${old.name}`:`Деревня ${v.name} выбрала старосту: ${win.name}, ${of}`);
    setBubble(win,'heart',60);
  }
}
function chiefDay(v){
  let ch=v.chief===null?null:alive(v.chief);
  if(ch&&ch.village!==v.id){v.chief=null;ch=null;}
  if(ch&&ch.repSt==='out'){addLog([ch],`Старосту ${ch.name} сместили${vin(v)}: ${g(ch,'его','её')} больше не уважают`);v.chief=null;ch=null;}
  if(!ch){elect(v);ch=v.chief===null?null:alive(v.chief);}
  if(!ch)return;
  const busy=1-ch.tr.lazy*0.7;
  if(Math.random()<busy*(0.3+ch.tr.kind*0.6)){
    let pa=null,worst=-10;
    for(const p of people){
      if(isChild(p)||p.village!==v.id||p===ch)continue;
      for(const k in p.rel){const r=p.rel[k];if(r<=worst&&+k>p.id){const o=alive(+k);if(o&&o!==ch&&o.village===v.id){worst=r;pa=[p,o];}}}
    }
    if(pa){
      const [a,b]=pa,ok=Math.random()<0.35+ch.tr.kind*0.4+(ch.rep>40?0.1:0)-ch.tr.temper*0.2;
      if(ok){changeRel(a,b,rnd(25,40));changeRel(ch,a,3);changeRel(ch,b,3);ch.fame.peace=(ch.fame.peace||0)+1;tally('peace');
        addLog([ch,a,b],`Староста ${ch.name} ${g(ch,'помирил','помирила')}: ${a.name} и ${b.name}`);}
      else if(ch.tr.temper>0.6){changeRel(ch,a,-8);changeRel(ch,b,-8);
        addLog([ch,a,b],`Староста ${ch.name} ${g(ch,'пытался','пыталась')} помирить: ${a.name} и ${b.name}, но только всех рассердил${ch.fem?'а':''}`);}
    }
  }
  const st=building('store',v.id);
  if(season()===3&&st&&st.built&&st.food>=6&&Math.random()<busy){
    const homes=houses.filter(h=>isHome(h)&&h.built&&h.village===v.id&&h.owners.some(id=>alive(id)));
    const mouths=h=>Math.max(1,people.filter(o=>o.home===h.id).length);
    const own=houseOf(ch),fair=ch.tr.kind>=0.35;
    const pickH=fair?homes.filter(h=>h.food/mouths(h)<3).sort((a,b)=>a.food/mouths(a)-b.food/mouths(b)).slice(0,4)
      :homes.filter(h=>h===own||h.owners.some(id=>{const o=alive(id);return o&&opinion(ch,o)>=40;})).slice(0,3);
    if(pickH.length){
      let give=Math.floor(st.food*0.25),total=0;const per=Math.max(1,Math.floor(give/pickH.length));
      for(const h of pickH){const n=Math.min(per,st.food,CAP.home-h.food);if(n>0){h.food+=n;st.food-=n;total+=n;}}
      if(total>0){
        const k='dole'+v.id+'-'+day();
        if(!(pairLog[k]>0)){pairLog[k]=minutes;
          addLog([ch],fair?`Староста ${ch.name} ${g(ch,'раздал','раздала')} из кладовки ${total} ед. еды самым голодным семьям`:`Староста ${ch.name} ${g(ch,'взял','взяла')} из кладовки ${total} ед. еды себе и друзьям`);}
        if(!fair)for(const o of people)if(o!==ch&&o.village===v.id&&!isChild(o)&&Math.random()<0.3)hear(o,ch,-8,'greed');
      }
    }
  }
}
function updateVillages(){
  for(const v of villages){
    const homes=houses.filter(h=>isHome(h)&&h.built&&h.village===v.id&&h.owners.some(id=>alive(id)));
    if(homes.length){v.x=homes.reduce((s,h)=>s+h.x,0)/homes.length;v.y=homes.reduce((s,h)=>s+h.y,0)/homes.length;}
    const pop=people.filter(p=>p.village===v.id).length;
    if(!pop&&!v.empty&&day()>v.founded+1){v.empty=true;v.chief=null;if(villages.length>1)addLog(null,`Деревня ${v.name} опустела`);}
    if(pop)v.empty=false;
    chiefDay(v);
    if(homes.length>=2&&!building('fire',v.id))createCommunal('fire',homes,'Жители решили сложить общий костёр'+vin(v),v.id);
    const ch=v.chief===null?null:alive(v.chief);
    if(!building('store',v.id)&&(homes.length>=4||ch&&homes.length>=3&&ch.tr.curio>0.5))createCommunal('store',homes,(ch?`Староста ${ch.name} предложил${ch.fem?'а':''} построить общую кладовку, жители согласились`:'Жители задумали построить общую кладовку')+vin(v),v.id);
    if(homes.length>=3&&!building('pier',v.id)&&Math.abs(v.x-riverX(v.y))<900){
      let y=clamp(v.y,150,H-150);
      for(const c of crossings())if(Math.abs(c.y-y)<160)y=clamp(c.y+(y>c.y?160:-160),150,H-150);
      let b=bankPoint(0,y,sideOf(v.x,v.y));
      const busy=b=>houses.some(o=>dist(o,b)<100)||plots.some(o=>Math.abs(o.x-b.x)<60&&Math.abs(o.y-b.y)<52);
      for(let k=1;k<12&&busy(b);k++)b=bankPoint(0,clamp(y+(k%2?1:-1)*Math.ceil(k/2)*110,150,H-150),sideOf(v.x,v.y));
      createCommunal('pier',homes,(ch?`Староста ${ch.name} предложил${ch.fem?'а':''} построить пристань с лодкой`:'Жители решили построить пристань с лодкой')+vin(v),v.id,b);
    }
  }
}
function villageTrade(){
  for(const a of villages){
    const sa=building('store',a.id);if(!sa||!sa.built||sa.food<50)continue;
    for(const b of villages){
      if(b===a||b.empty)continue;
      const sb=building('store',b.id);if(!sb||!sb.built||sb.food>=12)continue;
      const k='trade'+a.id+'-'+b.id;if(pairLog[k]>minutes-1440*2)continue;
      const c=people.filter(p=>p.village===a.id&&!isChild(p)&&!p.inHouse&&!BUSY.includes(p.state)&&!p.carryFood&&!p.carry&&p.tr.kind>0.4&&p.hunger<50).sort((x,y)=>y.tr.kind-x.tr.kind)[0];
      if(!c)continue;
      const n=Math.min(15,sa.food-30);sa.food-=n;c.carryFood=n;c.carryKind='berry';
      const d=door(sb);goTo(c,d.x,d.y,{kind:'stash',house:sb,gift:true});
      pairLog[k]=minutes;tally('trade');c.fame.help++;
      addLog([c],`${c.name} ${g(c,'понёс','понесла')} ${n} ед. еды из деревни ${a.name} в деревню ${b.name}: там пустеет кладовка`);
      for(const o of people)if(o.village===b.id&&!isChild(o)&&Math.random()<0.5)hear(o,c,8,'gift');
      return;
    }
  }
}
function drawPier(h){
  const d=riverX(h.y)>h.x?1:-1,k=h.built?1:Math.max(0.15,h.progress/NEED.pier);
  ctx.globalAlpha=h.built?1:0.6;
  ctx.fillStyle='#9c7a4f';ctx.fillRect(Math.min(h.x,h.x+d*52*k),h.y-9,52*k,18);
  ctx.strokeStyle='#7a5a36';ctx.lineWidth=1;for(let i=6;i<52*k;i+=8){ctx.beginPath();ctx.moveTo(h.x+d*i,h.y-9);ctx.lineTo(h.x+d*i,h.y+9);ctx.stroke();}
  if(h.built){ctx.fillStyle='#7a5432';ctx.beginPath();ctx.ellipse(h.x+d*40,h.y+20,19,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a07a4a';ctx.beginPath();ctx.ellipse(h.x+d*40,h.y+19,14,4,0,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  if(!h.built)progressBar(h.x,h.y-22,h.progress/NEED.pier);
}
function drawVillageNames(){
  if(villages.length<2)return;
  const k=clamp(1/cam.z,1,3);
  ctx.font=`700 ${20*k}px Segoe UI,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  for(const v of villages){
    if(v.empty)continue;
    ctx.lineWidth=4*k;ctx.strokeStyle='rgba(255,255,255,.8)';ctx.strokeText(v.name,v.x,v.y-170);
    ctx.fillStyle='rgba(60,50,30,.85)';ctx.fillText(v.name,v.x,v.y-170);
  }
}

/* ---------- навыки ---------- */
function addSkill(p,k,amt){
  const before=p.sk[k];
  p.sk[k]=Math.min(1,before+amt*(1-before)*(age(p)<25?1.5:1));
  if(before<0.6&&p.sk[k]>=0.6&&!p.skLog[k]){
    p.skLog[k]=true;
    const T={fish:['умелым рыбаком','умелой рыбачкой'],build:['умелым строителем','умелой строительницей'],farm:['умелым огородником','умелой огородницей'],
      gather:['умелым собирателем','умелой собирательницей'],hunt:['умелым охотником','умелой охотницей'],craft:['умелым мастером','умелой мастерицей']}[k];
    const title=g(p,T[0],T[1]);
    const famTrade=p.parents.some(id=>{const o=byId.get(id);return o&&o.skLog&&o.skLog[k];});
    addLog([p],famTrade?`${p.name} ${g(p,'пошёл','пошла')} по стопам родителей и ${g(p,'стал','стала')} ${title}`:`${p.name} ${g(p,'стал','стала')} ${title}`);
  }
}
const skillWord=(p,v)=>v>=0.85?'мастер':v>=0.6?g(p,'умелый','умелая'):v>=0.3?g(p,'опытный','опытная'):'новичок';
const woodWords=n=>{const a=n%10,b=n%100;return n+' '+(a===1&&b!==11?'бревно':a>=2&&a<=4&&(b<12||b>14)?'бревна':'брёвен');};

/* ---------- рождение и смерть ---------- */
function birth(mom,dad){
  const fem=Math.random()<0.5;
  const tr={};for(const [k] of TRAITS)tr[k]=clamp((mom.tr[k]+dad.tr[k])/2+rnd(-0.25,0.25),0,1);
  const sk={};for(const [k] of SKILLS)sk[k]=Math.max(mom.sk[k],dad.sk[k])*0.35;
  const from=()=>Math.random()<0.5?mom:dad;
  const skin=Math.random()<0.35?hexMix(mom.look.skin,dad.look.skin,0.5):from().look.skin;
  const hp=from();
  const hair=Math.random()<0.04?pick(HAIR_RARE):hp.look.hair;
  const look={skin,hair,style:pick(fem?STYLES_F:STYLES_M),shirt:`hsl(${Math.floor(rnd(360))},${Math.floor(rnd(40,72))}%,${Math.floor(rnd(40,62))}%)`};
  const c=makePerson(freeName(fem),fem,{x:mom.x+rnd(-10,10),y:mom.y+rnd(-10,10),born:minutes,look,tr,sk,parents:[mom.id,dad.id],origin:'born',village:mom.village});
  c.hunger=10;c.energy=80;c.social=10;c.home=mom.home;c.inHouse=false;
  mom.kids.push(c.id);dad.kids.push(c.id);
  for(const par of [mom,dad]){c.rel[par.id]=60;par.rel[c.id]=60;setBubble(par,'heart',40);}
  for(const sid of mom.kids){const s=alive(sid);if(s&&s!==c&&dad.kids.includes(sid)){c.rel[s.id]=30;s.rel[c.id]=30;}}
  addLog([mom,dad,c],`${c.name} ${g(c,'родился','родилась')}, родители: ${mom.name} и ${dad.name}`);tally('births');
}
function spawnWanderer(intervention=false){
  const fem=Math.random()<0.5,w=makePerson(freeName(fem),fem,{born:minutes-rnd(18,30)*YEAR,x:pick([30,W-30]),y:rnd(100,H-100),origin:'wanderer'});
  addLog([w],`${intervention?'Вмешательство: на':'На'} поляну ${g(w,'пришёл странник','пришла странница')} ${w.name}`);setBubble(w,'curious',60);
  return w;
}
function die(p,cause){
  p.dead=true;p.diedAt=minutes;
  tally(cause.includes('голод')?'hunger':cause.includes('болезн')?'sick':'old');
  addLog([p],`${p.name} ${g(p,'умер','умерла')} ${cause}, ${years(Math.floor(age(p)))}`);
  if(p.talk)p.talk.done=true;
  const part=alive(p.partner);if(part)part.partner=null;
  for(const v of villages)if(v.chief===p.id){v.chief=null;addLog(null,`Деревня ${v.name} осталась без старосты`);}
  for(const o of people){
    if(o.dead||o===p)continue;
    if(o.goal&&o.goal.who===p)decide(o);
    if(rel(o,p)>=40)setBubble(o,'sad',90);
  }
  people=people.filter(x=>x!==p);
  if(!people.length)addLog(null,'<b>Последний житель умер. Поляна опустела</b>');
  const h=houseOf(p);
  if(h&&h.owners.includes(p.id)&&!h.owners.some(id=>alive(id))&&h.built)addLog(null,`Дом, где ${g(p,'жил','жила')} ${p.name}, опустел`);
  if(selected===p){selected=null;follow=false;hideCard();}
  if(hover===p)hover=null;
}
function dailyEvents(){
  for(const p of people.slice()){
    if(p.dead)continue;
    const a=age(p);
    if(a>68&&Math.random()<(a-68)*0.03)die(p,'от старости');
  }
  for(const mom of people.slice()){
    if(mom.dead||!mom.fem)continue;
    const dad=alive(mom.partner);
    if(!dad||age(mom)>=45||mom.kids.length>=5||people.length>=MAX_POP)continue;
    const h=houseOf(mom),mouths=h?people.filter(o=>o.home===h.id).length:2;
    const fed=h&&h.built?clamp(0.15+h.food/(mouths*6),0.15,1):0.4;
    if(Math.random()<0.35*fed*(mom.hunger>70?0.4:1))birth(mom,dad);
  }
  updateReputation();
  for(const v of villages)chiefDay(v);
  if(settings.wanderers&&people.length<12&&Math.random()<0.5)spawnWanderer();
  for(const p of people)if(!p.grown&&age(p)>=18){p.grown=true;addLog([p],`${p.name} ${g(p,'вырос','выросла')}`);}
  updateVillages();
  forestDay();hareDay();
  if(settings.events&&!pendingEvent&&Math.random()<0.3){
    const opts=[['storm','sick'],['storm','drought','storm'],['harvest','storm','sick'],['blizzard','sick','blizzard']][season()];
    pendingEvent={type:pick(opts),at:minutes+rnd(7*60,17*60)};
  }
}

/* ---------- времена года и события ---------- */
function onSeason(s){
  addLog(null,`<b>${s===1?'Наступило':'Наступила'} ${SEASON_NAMES[s]}</b>`);
  for(const b of bushes){b.max=s===2?7:5;if(s===0)b.b=Math.min(b.b,5);}
  if(s===3){
    const lost=plots.filter(pl=>pl.stage==='growing'||pl.stage==='ripe');
    for(const pl of lost){pl.stage='dead';}
    const hs=[...new Set(lost.map(pl=>pl.house))].map(id=>houses.find(h=>h.id===id)).filter(Boolean);
    for(const h of hs){const ow=h.owners.map(id=>alive(id)).filter(Boolean);if(ow.length)addLog(ow,`Урожай не успели собрать, он замёрз: ${ownerNames(h)}`);}
  }
  if(s===0)for(const pl of plots)if(pl.stage==='dead'){pl.stage='empty';pl.weeds=0;}
}

/* ---------- огороды ---------- */
const plotsOf=h=>plots.filter(pl=>pl.house===h.id);
const household=p=>{const h=houseOf(p);return h&&h.built?h:null;};
function plotSpot(h){
  const offs=[[-78,8],[78,8],[-78,52],[78,52],[0,82],[-56,92],[56,92]];
  for(const [dx,dy] of shuffle(offs)){
    const x=h.x+dx,y=h.y+dy;
    if(x<40||x>W-40||y<40||y>H-40)continue;
    if(houses.some(o=>Math.abs(o.x-x)<(o.type==='store'?66:56)&&Math.abs(o.y-y)<(o.type==='store'?52:46)))continue;
    if(plots.some(o=>Math.abs(o.x-x)<PLOT_W+6&&Math.abs(o.y-y)<PLOT_H+6))continue;
    if(trees.some(t=>Math.hypot(t.x-x,t.y-y)<t.r+22))continue;
    if(inWater(x,y,50))continue;
    if(bushes.some(b=>Math.hypot(b.x-x,b.y-y)<45))continue;
    return {x,y};
  }
  return null;
}
const untilWinter=()=>{const yearLen=SEASON_LEN*4,pos=minutes%yearLen;return SEASON_LEN*3-pos;};
const plotBusy=(pl,p)=>targetCount(pl,p)>0;
function farmTask(p){
  const h=household(p),s=season();
  if(s===3||age(p)<10)return null;
  let best=null;
  const consider=(pl,task,urg)=>{if(!plotBusy(pl,p)&&(!best||urg>best.urg))best={pl,task,urg};};
  if(h){
    for(const pl of plotsOf(h)){
      if(pl.stage==='site')consider(pl,'dig',40);
      else if(pl.stage==='empty'&&s<=1&&(p.sk.farm<0.4||untilWinter()>=GROW_TIME*0.85))consider(pl,'sow',38);
      else if(pl.stage==='growing'){
        if(pl.water<35)consider(pl,'water',22+(35-pl.water));
        if(pl.weeds>45)consider(pl,'weed',14+(pl.weeds-45)/2);
      }else if(pl.stage==='ripe')consider(pl,'harvest',55+(s===2?25:0));
      if(h.hareHit&&!pl.fence&&pl.stage!=='site'&&!isChild(p))consider(pl,'fence',30+(pl.bit===day()?15:0));
    }
    const maxPlots=1+Math.floor(p.sk.farm*2.2);
    if(!best&&s<=1&&!isChild(p)&&h.owners.includes(p.id)&&plotsOf(h).length<Math.min(3,maxPlots)){
      const sp=plotSpot(h);
      if(sp)best={pl:null,task:'newplot',urg:22,spot:sp,house:h};
    }
  }
  if(p.tr.kind>0.55){
    for(const pl of plots){
      if(pl.stage!=='growing'||pl.weeds<60||(h&&pl.house===h.id))continue;
      const oh=houses.find(x=>x.id===pl.house);
      if(oh&&oh.owners.some(id=>{const o=alive(id);return o&&rel(p,o)>=40;})&&dist(p,pl)<700)consider(pl,'weed',10+p.tr.kind*15);
    }
  }
  return best;
}
const FARM_TIME={dig:30,sow:20,water:10,weed:15,harvest:20,fence:40};
function finishFarm(p,pl,task){
  if(!plots.includes(pl))return;
  addSkill(p,'farm',task==='harvest'?0.04:0.015);
  switch(task){
    case 'dig':pl.stage='empty';break;
    case 'fence':{
      if(pl.fence)break;
      pl.fence=true;addSkill(p,'build',0.02);
      const k='fence'+p.id;
      if(!(pairLog[k]>minutes-1440)){pairLog[k]=minutes;addLog([p],`${p.name} ${g(p,'поставил','поставила')} забор вокруг огорода`);}
      break;}
    case 'sow':if(pl.stage==='empty'){pl.stage='growing';pl.growth=0;pl.water=70;pl.weeds=0;pl.health=1;}break;
    case 'water':pl.water=100;break;
    case 'weed':{
      pl.weeds=0;
      const oh=houses.find(x=>x.id===pl.house);
      if(oh&&!oh.owners.includes(p.id)&&houseOf(p)!==oh){
        p.fame.help++;const k='weed'+p.id+'-'+oh.id;
        if(!(pairLog[k]>minutes-1440)){pairLog[k]=minutes;addLog([p],`${p.name} ${g(p,'помог','помогла')} прополоть огород: ${ownerNames(oh)}`);}
        for(const id of oh.owners){const o=alive(id);if(o){changeRel(p,o,4);hear(o,p,8,'help');}}
      }
      break;}
    case 'harvest':{
      if(pl.stage!=='ripe')break;
      const n=Math.max(1,Math.round((2+4*p.sk.farm)*pl.health));
      pl.stage='empty';pl.growth=0;pl.weeds=0;tally('harvest');
      p.carryFood=n*VEG_VALUE;p.carryKind='veg';
      if(n>=5)addLog([p],`${p.name} ${g(p,'собрал','собрала')} богатый урожай: ${n} репок`);
      pl.bit=0;
      break;}
  }
}
function updatePlots(dm){
  const s=season(),dry=drought>minutes,rain=weather&&weather.type==='storm';
  for(const pl of plots){
    if(pl.stage!=='growing'&&pl.stage!=='ripe')continue;
    if(rain)pl.water=100;else pl.water=Math.max(0,pl.water-dm*0.045*(dry?2.2:1)*(s===1?1.3:1)*(nearRiver(pl)?0.6:1));
    pl.weeds=Math.min(100,pl.weeds+dm*0.03);
    if(pl.stage!=='growing')continue;
    const bad=pl.water<15||pl.weeds>75;
    if(bad)pl.health=Math.max(0,pl.health-dm*0.0006);
    pl.growth=Math.min(1,pl.growth+dm/GROW_TIME*(pl.water<15?0.25:1)*(1-pl.weeds/200));
    if(pl.health<=0){
      pl.stage='dead';
      const h=houses.find(x=>x.id===pl.house),ow=h?h.owners.map(id=>alive(id)).filter(Boolean):[];
      if(ow.length)addLog(ow,`Огород засох — за ним не ухаживали: ${ownerNames(h)}`);
    }else if(pl.growth>=1)pl.stage='ripe';
  }
}
/* ---------- лес ---------- */
// Брёвна в дереве не отрастают: срублено до конца → пенёк (исчезает через STUMP_LIFE). Новые деревья: самосев у взрослых деревьев и посадки жителей.
const SAP_TIME=4*1440,STUMP_LIFE=6*1440,FOREST_MAX=130,FOREST_NEAR=800,FOREST_LOW=12;
const isTree=t=>!t.stump&&t.sap>=1;
function treeSpotFree(x,y,ignore){
  if(x<40||x>W-40||y<40||y>H-40||inWater(x,y,40))return false;
  if(houses.some(h=>Math.hypot(h.x-x,h.y-y)<110))return false;
  if(plots.some(pl=>Math.hypot(pl.x-x,pl.y-y)<70))return false;
  if(trees.some(t=>t!==ignore&&!t.stump&&Math.hypot(t.x-x,t.y-y)<55))return false;
  return !bushes.some(b=>Math.hypot(b.x-x,b.y-y)<50);
}
const newSapling=(x,y)=>{const t={x,y,r:rnd(26,46),wood:0,grow:0,sap:0.05,stump:0};trees.push(t);return t;};
function updateTrees(dm,s){
  for(const t of trees){
    if(t.stump||s===3)continue;
    if(t.sap<1){t.sap=Math.min(1,t.sap+dm/SAP_TIME);if(t.sap>=1)t.wood=TREE_WOOD;continue;}
  }
}
function forestDay(){
  trees=trees.filter(t=>!(t.stump&&minutes-t.stump>STUMP_LIFE));
  if(season()<2){
    const grown=trees.filter(isTree);
    for(const t of grown){
      if(trees.length>=FOREST_MAX||Math.random()>0.008)continue;
      const a=rnd(Math.PI*2),r=rnd(60,150),x=t.x+Math.cos(a)*r,y=t.y+Math.sin(a)*r;
      if(treeSpotFree(x,y))newSapling(x,y);
    }
  }
  for(const v of villages){
    v.forest=trees.filter(t=>!t.stump&&dist(t,v)<FOREST_NEAR).length;
    if(!v.empty&&v.forest<5&&!v.cutLog){v.cutLog=true;addLog(null,`Вокруг деревни вырубили почти весь лес${vin(v)}`);}
    if(v.forest>=FOREST_LOW)v.cutLog=false;
  }
}
function plantSpot(p){
  const v=villageOf(p);
  const st=shuffle(trees.filter(t=>t.stump&&dist(t,v)<FOREST_NEAR&&targetCount(t,p)===0));
  for(const t of st.slice(0,6))if(treeSpotFree(t.x,t.y,t))return {x:t.x,y:t.y,stump:t};
  for(let i=0;i<25;i++){
    const a=rnd(Math.PI*2),r=rnd(250,FOREST_NEAR-50),x=v.x+Math.cos(a)*r,y=v.y+Math.sin(a)*r;
    if(sideOf(x,y)===sideOf(p.x,p.y)&&treeSpotFree(x,y))return {x,y,stump:null};
  }
  return null;
}
function finishPlant(p,sp){
  if(sp.stump){const i=trees.indexOf(sp.stump);if(i>=0)trees.splice(i,1);}
  if(!treeSpotFree(sp.x,sp.y))return;
  newSapling(sp.x,sp.y);tally('plant');addSkill(p,'gather',0.005);
  const v=villageOf(p);v.forest=(v.forest||0)+1;
  const k='plant'+p.id;
  if(!(pairLog[k]>minutes-1440)){pairLog[k]=minutes;addLog([p],`${p.name} ${g(p,'посадил','посадила')} деревце`);}
}
function drawTree(t,cn){
  if(t.stump){circle(t.x,t.y,9,'#7a5a3a');circle(t.x,t.y,6,'#b08a5e');circle(t.x,t.y,2.5,'#8b6a44');return;}
  if(t.sap<1){
    const r=5+t.sap*14;
    ctx.fillStyle='#7a5a3a';ctx.fillRect(t.x-1.2,t.y,2.4,r*0.7);
    circle(t.x,t.y,r,cn[0]);circle(t.x-r*0.3,t.y-r*0.3,r*0.55,cn[1]);return;
  }
  const r=t.r*(0.55+0.45*Math.max(t.wood,1)/TREE_WOOD);
  ellipse(t.x+6,t.y+r*0.6,r*0.9,r*0.4,'rgba(0,0,0,.13)');
  circle(t.x,t.y,r,cn[0]);circle(t.x-r*0.3,t.y-r*0.3,r*0.6,cn[1]);circle(t.x+r*0.35,t.y-r*0.1,r*0.45,cn[2]);
}

/* ---------- зайцы, заборы, охота ---------- */
const HARE_MAX=10,HARE_VALUE=3,HARE_FLEE=70,HARE_CATCH=80;
function spawnHare(near){
  let x,y,tries=0;
  do{
    if(near){x=near.x+rnd(-80,80);y=near.y+rnd(-80,80);}
    else{const t=pick(trees.filter(isTree).length?trees.filter(isTree):trees);x=t?t.x+rnd(-60,60):rnd(W);y=t?t.y+rnd(-60,60):rnd(H);}
    x=clamp(x,30,W-30);y=clamp(y,30,H-30);tries++;
  }while(tries<20&&inWater(x,y,20));
  const h={id:nextHare++,x,y,tx:x,ty:y,st:'wander',plot:null,timer:0};
  hares.push(h);return h;
}
function hareTarget(h){
  if(season()!==3&&Math.random()<0.5){
    let best=null,bd=700;
    for(const pl of plots){
      if(pl.fence||(pl.stage!=='growing'&&pl.stage!=='ripe'))continue;
      const d=Math.hypot(pl.x-h.x,pl.y-h.y);
      if(d<bd&&sideOf(pl.x,pl.y)===sideOf(h.x,h.y)&&!people.some(p=>!p.inHouse&&Math.abs(p.x-pl.x)<150&&Math.abs(p.y-pl.y)<150)){bd=d;best=pl;}
    }
    if(best){h.st='go';h.plot=best;h.tx=best.x+rnd(-12,12);h.ty=best.y+rnd(-8,8);return;}
  }
  h.st='wander';h.plot=null;
  for(let i=0;i<6;i++){
    const a=rnd(Math.PI*2),r=rnd(60,220),x=clamp(h.x+Math.cos(a)*r,30,W-30),y=clamp(h.y+Math.sin(a)*r,30,H-30);
    if(!inWater(x,y,20)&&sideOf(x,y)===sideOf(h.x,h.y)){h.tx=x;h.ty=y;return;}
  }
  h.tx=h.x;h.ty=h.y;h.timer=rnd(20,60);
}
function hareBite(h,dm){
  const pl=h.plot;
  if(!plots.includes(pl)||pl.fence||(pl.stage!=='growing'&&pl.stage!=='ripe')){hareTarget(h);return;}
  pl.health=Math.max(0,pl.health-dm*0.004);
  if(pl.stage==='ripe'){pl.stage='growing';pl.growth=0.85;}
  else pl.growth=Math.max(0,pl.growth-dm*0.002);
  const ho=houses.find(x=>x.id===pl.house);
  if(pl.bit!==day()){
    pl.bit=day();
    if(ho){ho.hareHit=true;const ow=ho.owners.map(id=>alive(id)).filter(Boolean);if(ow.length)addLog(ow,`Зайцы погрызли огород: ${ownerNames(ho)}`);}
  }
  h.timer-=dm;if(h.timer<=0)hareTarget(h);
}
function updateHares(dm){
  for(const h of hares){
    let near=null,nd=1e9;
    for(const p of people){if(p.inHouse)continue;const dx=p.x-h.x,dy=p.y-h.y;if(Math.abs(dx)>HARE_FLEE||Math.abs(dy)>HARE_FLEE)continue;const d=Math.hypot(dx,dy);if(d<nd){nd=d;near=p;}}
    if(near&&nd<HARE_FLEE&&h.st!=='flee'){
      const a=Math.atan2(h.y-near.y,h.x-near.x)+rnd(-0.5,0.5);
      h.st='flee';h.plot=null;h.timer=0;h.tx=clamp(h.x+Math.cos(a)*240,30,W-30);h.ty=clamp(h.y+Math.sin(a)*240,30,H-30);
      if(inWater(h.tx,h.ty,10)||sideOf(h.tx,h.ty)!==sideOf(h.x,h.y)){h.tx=h.x;h.ty=clamp(h.y+(Math.sin(a)>=0?240:-240),30,H-30);if(inWater(h.tx,h.ty,10)){h.tx=h.x;h.ty=h.y;}}
    }
    if(h.st==='eat'){hareBite(h,dm);continue;}
    if(h.timer>0){h.timer-=dm;continue;}
    const dx=h.tx-h.x,dy=h.ty-h.y,L=Math.hypot(dx,dy),sp=(h.st==='flee'?30:14)*dm;
    if(L<=sp){
      h.x=h.tx;h.y=h.ty;
      if(h.st==='go'){h.st='eat';h.timer=60;}
      else{h.st='wander';h.timer=rnd(5,40);hareTarget(h);if(h.st==='wander')h.timer=rnd(5,40);}
    }else{const w0=h.walk||0;h.x+=dx/L*sp;h.y+=dy/L*sp;h.walk=w0+sp;if(season()===3&&Math.floor(h.walk/16)!==Math.floor(w0/16))addTrack(h.x,h.y,dx/L,dy/L,2,0.6);}
  }
}
function hareDay(){
  const s=season();
  if(s===3)hares=hares.filter(()=>Math.random()>0.08);
  else if(s<2&&hares.length>=2){
    const n=Math.min(HARE_MAX-hares.length,Math.floor(hares.length*0.3+Math.random()));
    for(let i=0;i<n;i++)spawnHare(pick(hares));
  }
  if(hares.length<2&&s<3&&Math.random()<0.25)for(let i=0;i<2;i++)spawnHare();
}
function nearestHare(p){
  let best=null,bd=700;
  for(const h of hares){if(sideOf(h.x,h.y)!==sideOf(p.x,p.y))continue;const d=dist(p,h);if(d<bd&&!people.some(o=>o!==p&&o.goal&&o.goal.hare===h)){bd=d;best=h;}}
  return best?{h:best,d:bd}:null;
}
function tryCatch(p,h){
  const i=hares.indexOf(h);
  if(i<0){decide(p);return;}
  if(Math.random()<0.3+0.5*p.sk.hunt){
    hares.splice(i,1);addSkill(p,'hunt',0.06);tally('hunt');
    addLog([p],`${p.name} ${g(p,'поймал','поймала')} зайца`);
    if(p.hunger>60){p.state='eat';p.timer=rnd(8,12);p.goal={kind:'eathouse'};return;}
    const t=gatherTarget(p)||household(p);
    if(t&&t.food<CAP[t.type||'home']){p.carryFood=HARE_VALUE;p.carryKind='meat';const d=door(t);goTo(p,d.x,d.y,{kind:'stash',house:t});return;}
    p.state='eat';p.timer=rnd(8,12);p.goal={kind:'eathouse'};return;
  }
  addSkill(p,'hunt',0.015);
  const a=Math.atan2(h.y-p.y,h.x-p.x);h.st='flee';h.plot=null;h.timer=0;
  h.tx=clamp(h.x+Math.cos(a)*240,30,W-30);h.ty=clamp(h.y+Math.sin(a)*240,30,H-30);if(inWater(h.tx,h.ty,10)){h.tx=h.x;h.ty=h.y;}
  decide(p);
}
function drawHare(h,s){
  const c=s===3?'#f1f3f5':'#9b8466',e=s===3?'#d5dbe0':'#7d6a50';
  ellipse(h.x,h.y+5,8,3,'rgba(0,0,0,.12)');
  ellipse(h.x,h.y,8,5.5,c);circle(h.x+6,h.y-3,4,c);
  ellipse(h.x+5,h.y-9,1.6,4.5,e);ellipse(h.x+8,h.y-9,1.6,4.5,e);
  circle(h.x-7,h.y-1,2.2,'#fff');circle(h.x+7.5,h.y-3.5,0.9,'#222');
}

/* ---------- ремёсла и обмен ---------- */
const TOOLS={basket:['корзина','корзину'],rod:['удочка','удочку'],hoe:['мотыга','мотыгу']};
const TOOL_USES=25,TOOL_PRICE=3,GOODS_MAX=3;
const goodsCount=h=>h.goods?Object.values(h.goods).reduce((a,b)=>a+b,0):0;
function wantTool(p){
  if(age(p)<12)return null;
  const w=[];
  if(!p.tools.basket)w.push('basket');
  if(!p.tools.rod&&p.sk.fish>=0.25)w.push('rod');
  if(!p.tools.hoe){const h=household(p);if(h&&plotsOf(h).length)w.push('hoe');}
  return w.length?pick(w):null;
}
function useTool(p,k){
  if(!p.tools[k])return false;
  p.tools[k]--;
  if(p.tools[k]<=0){delete p.tools[k];addLog([p],`${p.name}: сломалась ${TOOLS[k][0]}`);}
  return true;
}
function craftKind(h){
  const ks=Object.keys(TOOLS),min=Math.min(...ks.map(k=>h.goods[k]||0));
  return pick(ks.filter(k=>(h.goods[k]||0)===min));
}
function finishCraft(p,h){
  if(!houses.includes(h)||goodsCount(h)>=GOODS_MAX)return;
  const k=craftKind(h);h.goods[k]=(h.goods[k]||0)+1;addSkill(p,'craft',0.03);
  const key='craft'+p.id;
  if(!(pairLog[key]>minutes-1440)){pairLog[key]=minutes;addLog([p],`${p.name} ${g(p,'смастерил','смастерила')} ${TOOLS[k][1]}`);}
}
function sellerFor(p,k){
  const own=houseOf(p);let best=null,bd=1500;
  for(const h of houses){
    if(!isHome(h)||!h.built||h===own||h.village!==p.village||!(h.goods&&h.goods[k]>0))continue;
    if(h.owners.some(id=>{const o=alive(id);return o&&opinion(p,o)<-20;}))continue;
    const d=dist(p,h);if(d<bd){bd=d;best=h;}
  }
  return best;
}
function barter(p,h,k){
  const own=houseOf(p);
  if(p.tools[k]||!own||!own.built||own.food<TOOL_PRICE+2||!(h.goods&&h.goods[k]>0))return;
  h.goods[k]--;own.food-=TOOL_PRICE;h.food=Math.min(CAP.home,h.food+TOOL_PRICE);p.tools[k]=TOOL_USES;tally('barter');
  const ow=h.owners.map(id=>alive(id)).filter(Boolean);
  for(const o of ow)changeRel(p,o,3);
  addLog([p,...ow],`${p.name} ${g(p,'выменял','выменяла')} ${TOOLS[k][1]} за ${TOOL_PRICE} ед. еды: ${ownerNames(h)}`);
}

function shelterAll(){for(const p of people)if(!p.inHouse&&!['talk','eat','sleep'].includes(p.state))decide(p);}
function startEvent(type,manual){
  const pre=manual?'Вмешательство: ':'';
  switch(type){
    case 'storm':{
      weather={type:'storm',until:minutes+rnd(120,240)};flashAt=minutes;
      addLog(null,pre+'началась гроза');
      const t=pick(trees.filter(t=>t.wood>0));
      if(t&&Math.random()<0.6){t.wood=0;t.grow=0;t.stump=minutes;addLog(null,'Молния ударила в дерево');}
      shelterAll();break;}
    case 'blizzard':weather={type:'blizzard',until:minutes+rnd(180,360)};tracks.length=0;trackI=0;addLog(null,pre+'началась метель');shelterAll();break;
    case 'drought':drought=minutes+1440;addLog(null,pre+'засуха: сутки ягоды почти не растут');break;
    case 'harvest':for(const b of bushes){b.max=8;b.b=8;}addLog(null,pre+'богатый урожай: кусты ломятся от ягод');break;
    case 'sick':{
      const v=pick(people.filter(p=>!p.sick&&age(p)>=5));
      if(v){v.sick=minutes+rnd(600,1200);addLog([v],`${pre}${v.name} ${g(v,'заболел','заболела')}`);}
      break;}
  }
}
function updateSick(p,dm){
  if(!p.sick)return false;
  p.energy=clamp(p.energy-dm*0.05,0,100);
  if(minutes>=p.sick){
    p.sick=0;
    const risk=(age(p)>60?0.35:0.04)+(p.hunger>80?0.2:0)+(age(p)<5?0.1:0);
    if(Math.random()<risk){die(p,'от болезни');return true;}
    addLog([p],`${p.name} ${g(p,'поправился','поправилась')}`);
  }
  return false;
}

/* ---------- дома и постройки ---------- */
const houseOf=p=>p.home===null||p.home===undefined?null:houses.find(h=>h.id===p.home)||null;
const ownerNames=h=>h.owners.map(id=>byId.get(id)).filter(Boolean).map(o=>o.name).join(' и ');
function nearestTree(p){
  let best=null,bs=1e9;
  for(const t of trees){
    if(t.wood<=0)continue;
    const claimed=targetCount(t,p);
    const s=dist(p,t)+rnd(150)+claimed*300+(claimed>=t.wood?2000:0)+(TREE_WOOD-t.wood)*25;
    if(s<bs){bs=s;best=t;}
  }
  return best;
}
function findSpot(p,rmin=60,rmax=420){
  // тесно — ищем дальше, чтобы постройки не налезали друг на друга
  let s=null;
  for(let k=0;k<5;k++){s=spotTry(p,rmin,rmax*1.6**k);if(s.ok)break;}
  return s;
}
function spotTry(p,rmin,rmax){
  let best=null,bs=-1e9;
  for(let i=0;i<60;i++){
    const a=rnd(Math.PI*2),r=rnd(rmin,rmax),x=clamp(p.x+Math.cos(a)*r,90,W-90),y=clamp(p.y+Math.sin(a)*r,90,H-90);
    let s=-r*0.2+rnd(30);
    for(const h of houses){const d=Math.hypot(h.x-x,h.y-y);if(d<115)s-=1000;else if(d<260)s+=40;}
    for(const t of trees)if(Math.hypot(t.x-x,t.y-y)<t.r+45)s-=300;
    for(const b of bushes)if(Math.hypot(b.x-x,b.y-y)<75)s-=300;
    for(const pl of plots)if(Math.hypot(pl.x-x,pl.y-y)<85)s-=1000;
    if(inWater(x,y,75))s-=2000;
    if(s>bs){bs=s;best={x,y};}
  }
  best.ok=bs>-500;
  return best;
}
function newHouse(type,x,y,owners,v){
  const h={id:nextHouse++,type,x,y,village:v??(owners.length?byId.get(owners[0]).village:nearestVillage({x,y})),progress:0,built:false,owners,helpers:[],contrib:{},roof:pick(ROOFS),food:0,goods:{}};
  houses.push(h);return h;
}
function friendHouse(p){
  const c=houses.filter(h=>isHome(h)&&!h.built&&!h.owners.includes(p.id)&&dist(p,h)<900&&h.owners.some(id=>{const o=alive(id);return o&&rel(p,o)>=40;}));
  return c.length?pick(c):null;
}
const door=h=>({x:h.x+rnd(-15,15),y:h.y+(h.type==='fire'?28:34)});
function workOn(p,h){
  if(p.carry){p.carry=h.id;const d=door(h);goTo(p,d.x,d.y,{kind:'deliver',house:h});return;}
  const t=nearestTree(p);
  if(!t){p.state='idle';p.timer=rnd(5,15);return;}
  goTo(p,t.x+rnd(-10,10),t.y+t.r*0.7,{kind:'chop',tree:t,house:h});
}
function enterHouse(p,h,state='sleep'){p.state=state;p.inHouse=true;p.goal=null;p.x=h.x;p.y=h.y;}
function finishBuild(p,h){
  p.carry=false;
  if(h.built)return;
  h.progress++;
  addSkill(p,'build',0.04);
  if(!isHome(h)){h.contrib[p.id]=(h.contrib[p.id]||0)+1;p.communal=(p.communal||0)+1;}
  else if(!h.owners.includes(p.id)&&!h.helpers.includes(p.id)){
    h.helpers.push(p.id);p.fame.help++;
    addLog([p],`${p.name} ${g(p,'помог','помогла')} строить дом: ${ownerNames(h)}`);
    for(const id of h.owners){const o=alive(id);if(o){changeRel(p,o,6);hear(o,p,10,'help');}}
  }
  if(h.progress>=NEED[h.type||'home']){
    h.built=true;
    if(isHome(h)){
      const ow=h.owners.map(id=>alive(id)).filter(Boolean);
      addLog(ow,`${ownerNames(h)} достроили дом`);
      for(const o of ow)setBubble(o,'heart',40);
    }else{
      const top=Object.entries(h.contrib).sort((a,b)=>b[1]-a[1])[0];
      const tp=top&&byId.get(+top[0]);
      const what=(h.type==='fire'?'Общий костёр готов':h.type==='pier'?'Пристань с лодкой готова':'Общая кладовка готова')+(villages.length>1?` (${villageOf(h).name})`:'');
      addLog(tp?[tp]:null,`${what}. Больше всех ${tp?g(tp,'потрудился','потрудилась')+' '+tp.name+' ('+woodWords(top[1])+')':'трудились все'}`);
    }
  }
}

/* ---------- еда ---------- */
function claimsOn(b,p){return targetCount(b,p);}
function nearestBush(p,mustHave){
  let best=null,bs=1e9;
  for(const b of bushes){
    const free=b.b-claimsOn(b,p);
    if(mustHave&&free<=0)continue;
    const s=dist(p,b)+(free>0?0:rnd(600,1400))+rnd(80);
    if(s<bs){bs=s;best=b;}
  }
  return best;
}
function chooseFood(p){
  const c=[],s=season(),own=houseOf(p);
  const b=nearestBush(p,true);
  if(b)c.push({kind:'bush',t:b,cost:dist(p,b)});
  if(own&&own.built&&own.food>0)c.push({kind:'home',t:own,cost:dist(p,own)+(s<3?350:0)});
  const st=building('store',p.village);
  if(st&&st.built&&st.food>0)c.push({kind:'store',t:st,cost:dist(p,st)+(s<3?500:80)});
  if(p.hunger>80&&p.tr.kind<0.35&&p.tr.temper>0.45&&Math.random()<0.4){
    const v=houses.filter(h=>isHome(h)&&h.built&&h.food>0&&h!==own).sort((a,b)=>dist(p,a)-dist(p,b))[0];
    if(v)c.push({kind:'steal',t:v,cost:dist(p,v)-150});
    const rp=plots.filter(pl=>pl.stage==='ripe'&&(!own||pl.house!==own.id)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
    if(rp)c.push({kind:'stealplot',t:rp,cost:dist(p,rp)-150});
  }
  c.sort((a,b)=>a.cost-b.cost);
  if(!c.length&&s<3){const any=nearestBush(p,false);if(any)c.push({kind:'bush',t:any,cost:0});}
  return c[0]||null;
}
function gatherTarget(p){
  const own=houseOf(p);if(!own||!own.built)return null;
  if(own.food<CAP.home-2)return own;
  const st=building('store',p.village);
  if(st&&st.built&&st.food<CAP.store&&p.tr.kind>0.35)return st;
  return null;
}
function takeFood(p,h,steal){
  h.food--;p.state='eat';p.timer=rnd(8,12);p.goal={kind:'eathouse'};
  if(!steal)return;
  tally('theft');p.fame.theft++;
  const owners=h.owners.map(id=>alive(id)).filter(Boolean);
  if(Math.random()<0.5&&owners.length){
    p.fame.caught++;
    addLog([p,...owners],`${p.name} ${g(p,'украл','украла')} ягоды из дома (${ownerNames(h)}) и ${g(p,'попался','попалась')}`);
    for(const o of owners){changeRel(p,o,-25);setBubble(o,'angry',40);hear(o,p,-20,'theft');}
  }else addLog([p],`${p.name} тайком ${g(p,'взял','взяла')} ягоды из чужого дома (${ownerNames(h)})`);
}

/* ---------- решения ---------- */
function chooseFriend(p){
  let best=null,bs=-1e9;
  for(const o of people){
    if(o===p||o.state==='sleep'||o.inHouse)continue;
    const r=opinion(p,o);if(r<=-35)continue;
    const d=dist(p,o);if(d>1000)continue;
    const kin=p.parents.includes(o.id)||o.parents.includes(p.id)||p.parents.some(x=>o.parents.includes(x));
    const s=r*(kin&&!isChild(p)?0.6:1.5)-d*0.04+rnd(35)+(p.rel[o.id]===undefined?p.tr.curio*25:0)+(o.id===p.partner?25:0)+(canPair(p,o)&&r>-10?30:0);
    if(s>bs){bs=s;best=o;}
  }
  return best;
}
function goTo(p,x,y,goal){
  if(goal){const gc=goalCounts();for(const t of [goal.bush,goal.tree,goal.plot])if(t)gc.set(t,(gc.get(t)||0)+1);}
  x=clamp(x,40,W-40);y=clamp(y,40,H-40);
  if(inWater(x,y,14)){const b=bankPoint(x,y,sideOf(p.x,p.y));x=b.x;y=b.y;}
  p.via=null;p.crossed=false;
  p.state='move';p.tx=x;p.ty=y;p.goal=goal;p.timer=Math.hypot(p.tx-p.x,p.ty-p.y)/WALK*2+30;}

function decide(p){
  p.goal=null;p.talk=null;p.nd=(p.nd||0)+1;
  if(p.inHouse){p.inHouse=false;const hh=houseOf(p);if(hh){p.x=hh.x+rnd(-10,10);p.y=hh.y+34;}}
  const night=isNight(),opts=[],child=age(p)<10,s=season(),hr=hour();
  const own=houseOf(p),ownsIt=own&&own.owners.includes(p.id);
  if(weather){
    if(own&&own.built){goTo(p,own.x,own.y+34,{kind:'shelter',house:own});return;}
  }
  if(p.carry){const ch=houses.find(h=>h.id===p.carry);if(ch&&!ch.built)opts.push(['build',80,ch]);else p.carry=false;}
  if(p.carryFood){const t=gatherTarget(p)||own;if(t&&t.built){const d=door(t);goTo(p,d.x,d.y,{kind:'stash',house:t});return;}p.carryFood=0;}
  if(!child&&!night&&!weather){
    if(ownsIt&&!own.built)opts.push(['build',25+(1-p.tr.lazy)*45,own]);
    else if(p.partner!==null&&!ownsIt&&!isChild(p))opts.push(['newhome',35+(1-p.tr.lazy)*30]);
    if(p.tr.kind>0.4){const fh=friendHouse(p);if(fh)opts.push(['build',p.tr.kind*35+(1-p.tr.lazy)*10,fh]);}
    const cb=houses.find(h=>!isHome(h)&&!h.built);
    if(cb&&age(p)>=12)opts.push(['build',8+p.tr.kind*20+p.tr.soc*12+(1-p.tr.lazy)*15,cb]);
    if(s<3){const gt=gatherTarget(p);if(gt)opts.push(['gather',8+[12,25,50][s]+(1-p.tr.lazy)*15+(gt.food<5?15:0)+p.sk.gather*10,gt]);}
  }
  if(!child&&!night&&!weather){const fs=fishSpot(p);if(fs)opts.push(['fish',4+[8,14,14,3][s]+p.sk.fish*30+(1-p.tr.lazy)*8+p.tr.curio*6-fs.d/110,fs]);}
  if(!night&&!weather){const ft=farmTask(p);if(ft)opts.push(['farm',ft.urg+(1-p.tr.lazy)*25+p.sk.farm*10,ft]);}
  if(!child&&!night&&!weather&&age(p)>=14){
    const v=villageOf(p);
    if(s<3&&v&&(v.forest??99)<FOREST_LOW)opts.push(['plant',4+(FOREST_LOW-v.forest)*2+p.tr.kind*10+p.tr.curio*6+(1-p.tr.lazy)*8]);
    const hr2=nearestHare(p);
    if(hr2){const guard=own&&hr2.h.plot&&hr2.h.plot.house===own.id;opts.push(['hunt',10+p.sk.hunt*30+p.tr.temper*6+p.tr.curio*6+(guard?25:0)-hr2.d/120,hr2.h]);}
    const k=wantTool(p);
    if(k){
      if(own&&own.goods&&own.goods[k]>0){own.goods[k]--;p.tools[k]=TOOL_USES;}
      else if(own&&own.built&&own.food>=TOOL_PRICE+2){const sh=sellerFor(p,k);if(sh)opts.push(['barter',12+(1-p.tr.lazy)*8+p.tr.soc*5-dist(p,sh)/120,{h:sh,k}]);}
    }
    if(ownsIt&&own.built&&age(p)>=16&&goodsCount(own)<GOODS_MAX)opts.push(['craft',6+p.sk.craft*30+p.tr.curio*6+(1-p.tr.lazy)*6+(hr>=17?8:0),own]);
  }
  const fire=building('fire',p.village);
  if(fire&&fire.built&&hr>=18&&hr<22&&!weather)opts.push(['fire',10+p.tr.soc*35+(s===3?15:0),fire]);
  opts.push(['sleep',(100-p.energy)*(night?1.6:0.4)+p.tr.lazy*15+(p.energy<12?300:0)+(child&&night?40:0)+(p.sick?40:0)]);
  const food=chooseFood(p);
  if(food)opts.push(['eat',p.hunger*1.1+(p.hunger>80?200:0),food]);
  const fr=chooseFriend(p);
  if(fr&&!night&&!weather)opts.push(['social',p.social*(0.4+p.tr.soc)+rel(p,fr)*0.2-(p.sick?20:0),fr]);
  opts.push(['explore',12+p.tr.curio*45-(night?20:0)-(weather?40:0)-(s===3?10:0)]);
  opts.push(['idle',10+p.tr.lazy*35]);
  let best=null,bs=-1e9;
  for(const o of opts){const sc=o[1]+rnd(25);if(sc>bs){bs=sc;best=o;}}
  switch(best[0]){
    case 'sleep':{
      if(own&&own.built){if(dist(p,{x:own.x,y:own.y+34})>20)goTo(p,own.x,own.y+34,{kind:'sleephome',house:own});else enterHouse(p,own);}
      else if(s===3&&fire&&fire.built&&dist(p,fire)>120){const a=rnd(Math.PI*2);goTo(p,fire.x+Math.cos(a)*60,fire.y+Math.sin(a)*50,{kind:'sleepfire'});}
      else p.state='sleep';
      break;}
    case 'build':workOn(p,best[2]);break;
    case 'fish':goTo(p,best[2].x,best[2].y+rnd(-20,20),{kind:'fish',pier:best[2].pier||null});break;
    case 'farm':{
      const ft=best[2];
      if(ft.task==='newplot'){ft.pl={id:nextPlot++,house:ft.house.id,x:ft.spot.x,y:ft.spot.y,stage:'site',growth:0,water:0,weeds:0,health:1};plots.push(ft.pl);ft.task='dig';}
      goTo(p,ft.pl.x+rnd(-12,12),ft.pl.y+rnd(-6,6),{kind:'farm',plot:ft.pl,task:ft.task});
      break;}
    case 'plant':{
      const sp=plantSpot(p);
      if(sp)goTo(p,sp.x,sp.y+10,{kind:'plant',spot:sp,tree:sp.stump||undefined});else{p.state='idle';p.timer=rnd(5,12);}
      break;}
    case 'hunt':{const h=best[2];p.state='move';p.tx=h.x;p.ty=h.y;p.via=null;p.crossed=false;p.goal={kind:'hunt',hare:h};p.timer=150;break;}
    case 'barter':{const d=door(best[2].h);goTo(p,d.x,d.y,{kind:'barter',house:best[2].h,tool:best[2].k});break;}
    case 'craft':{const d=door(best[2]);goTo(p,d.x,d.y,{kind:'craft',house:best[2]});break;}
    case 'newhome':{const h=ensureHome(p);if(h&&!h.built)workOn(p,h);else{p.state='idle';p.timer=rnd(5,10);}break;}
    case 'gather':{
      const b=nearestBush(p,true);
      if(b)goTo(p,b.x+rnd(-14,14),b.y+rnd(-14,14),{kind:'pick',bush:b,house:best[2]});
      else{p.state='idle';p.timer=rnd(5,12);}
      break;}
    case 'fire':{const a=rnd(Math.PI*2),r=rnd(40,80);goTo(p,best[2].x+Math.cos(a)*r,best[2].y+Math.sin(a)*r*0.8,{kind:'fireside'});break;}
    case 'eat':{
      const f=best[2];
      if(f.kind==='bush')goTo(p,f.t.x+rnd(-14,14),f.t.y+rnd(-14,14),{kind:'eat',bush:f.t});
      else if(f.kind==='stealplot')goTo(p,f.t.x+rnd(-10,10),f.t.y,{kind:'stealplot',plot:f.t});
      else{const d=door(f.t);goTo(p,d.x,d.y,{kind:'eatfrom',house:f.t,steal:f.kind==='steal'});}
      break;}
    case 'social':p.state='move';p.goal={kind:'social',who:best[2]};p.timer=120;break;
    case 'explore':{
      const par=child?alive(pick(p.parents)):null;
      if(par&&Math.random()<0.7){goTo(p,par.x+rnd(-60,60),par.y+rnd(-60,60),{kind:'explore'});break;}
      const far=!child&&Math.random()<p.tr.curio*0.6,a=rnd(Math.PI*2),r=far?rnd(500,1000):rnd(80,320);
      goTo(p,p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,{kind:'explore',far});
      if(far)setBubble(p,'curious',25);
      break;}
    default:p.state='idle';p.timer=rnd(8,25)*(0.5+p.tr.lazy);
  }
}

const BUSY=['sleep','talk','eat','chop','build','pick','shelter','farm','fishing','plant','craft'];
function startTalk(a,b){
  if(BUSY.includes(b.state)||b.inHouse){a.state='idle';a.timer=rnd(3,8);a.goal=null;return;}
  const t={a,b,end:minutes+rnd(10,25)*(0.6+(a.tr.soc+b.tr.soc)/2),done:false};
  for(const x of [a,b]){x.state='talk';x.talk=t;x.goal=null;}
}
function walkAway(p,from){
  const a=Math.atan2(p.y-from.y,p.x-from.x)+rnd(-0.6,0.6),r=rnd(150,280);
  goTo(p,p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,{kind:'explore'});
}
function share(a,b){
  const h=houseOf(a);
  if(a.tr.kind>0.5&&b.hunger>55&&!((a.heard[b.id]||0)<-15)&&h&&h.built&&h.food>=3&&houseOf(b)!==h){
    h.food--;b.hunger=Math.max(0,b.hunger-40);changeRel(a,b,8);a.fame.treat++;hear(b,a,12,'treat');setBubble(b,'heart',30);
    addLog([a,b],`${a.name} ${g(a,'угостил','угостила')} ягодами из своих запасов: ${b.name}`);
  }
}
function endTalk(t){
  t.done=true;const {a,b}=t;
  if(a.dead||b.dead)return;
  const diff=TRAITS.reduce((s,[k])=>s+Math.abs(a.tr[k]-b.tr[k]),0)/5;
  const grumpy=x=>(x.hunger>70?5:0)+(x.energy<25?5:0);
  const fire=building('fire',a.village),cozy=fire&&fire.built&&dist(a,fire)<160?3:0;
  const prej=((a.heard[b.id]||0)+(b.heard[a.id]||0))*0.1;
  for(const [x,y] of [[a,b],[b,a]])if(x.heard[y.id])x.heard[y.id]*=0.5;
  let delta=prej+(0.5-diff)*24+(a.tr.kind+b.tr.kind-1)*9+rnd(-8,8)-grumpy(a)-grumpy(b)+(canPair(a,b)?4:0)+(a.partner===b.id?4:0)+cozy;
  a.social=Math.max(0,a.social-20);b.social=Math.max(0,b.social-20);
  for(const [x,y] of [[a,b],[b,a]])if(x.sick&&!y.sick&&Math.random()<0.25){y.sick=minutes+rnd(600,1200);addLog([y],`${y.name} ${g(y,'заразился','заразилась')}: ${x.name}`);}
  if(delta<-5&&Math.random()<(a.tr.temper+b.tr.temper)/2*0.6){
    quarrel(a,b,'');walkAway(a,b);walkAway(b,a);return;
  }
  changeRel(a,b,delta);
  if(delta>7&&rel(a,b)>25){setBubble(a,'heart',25);setBubble(b,'heart',25);}
  if(delta>3){share(a,b);share(b,a);}
  if(delta>-2){gossip(a,b);gossip(b,a);}
  decide(a);decide(b);
}

function arrive(p){
  const goal=p.goal,k=goal&&goal.kind;
  if(k==='eat'){
    const bush=goal.bush;
    if(bush.b>0){bush.b--;p.state='eat';p.timer=rnd(10,18);addSkill(p,'gather',0.004);return;}
    const rival=people.find(o=>o!==p&&o.state==='eat'&&o.goal&&o.goal.bush===bush);
    if(rival&&Math.random()<p.tr.temper*0.6){quarrel(p,rival,'из-за ягод');decide(p);setBubble(p,'angry',30);return;}
    decide(p);setBubble(p,'sad',20);return;
  }
  if(k==='eatfrom'){
    if(goal.house.food>0){takeFood(p,goal.house,goal.steal);return;}
    decide(p);setBubble(p,'sad',20);return;
  }
  if(k==='farm'){
    const pl=goal.plot;
    if(!plots.includes(pl)){decide(p);return;}
    p.state='farm';p.timer=FARM_TIME[goal.task]*(1-0.4*p.sk.farm)*(goal.task!=='fence'&&useTool(p,'hoe')?0.7:1);return;
  }
  if(k==='plant'){p.state='plant';p.timer=rnd(18,28);return;}
  if(k==='craft'){p.state='craft';p.timer=rnd(35,50)*(1-0.4*p.sk.craft);return;}
  if(k==='barter'){barter(p,goal.house,goal.tool);decide(p);return;}
  if(k==='stealplot'){
    const pl=goal.plot;
    if(pl.stage!=='ripe'){decide(p);return;}
    pl.health=Math.max(0.1,pl.health-0.25);tally('theft');p.fame.theft++;
    p.state='eat';p.timer=rnd(8,12);p.goal={kind:'eathouse'};
    const h=houses.find(x=>x.id===pl.house),ow=h?h.owners.map(id=>alive(id)).filter(Boolean):[];
    if(ow.length&&Math.random()<0.4){
      p.fame.caught++;
      addLog([p,...ow],`${p.name} ${g(p,'стащил','стащила')} репку с чужого огорода (${ownerNames(h)}) и ${g(p,'попался','попалась')}`);
      for(const o of ow){changeRel(p,o,-20);setBubble(o,'angry',40);hear(o,p,-20,'theft');}
    }else addLog([p],`${p.name} тайком ${g(p,'вырвал','вырвала')} репку с чужого огорода`);
    return;
  }
  if(k==='pick'){
    const b=goal.bush;
    if(b.b>0){
      const n=Math.min(b.b,1+(Math.random()<p.sk.gather?1:0)+(Math.random()<p.sk.gather*0.5?1:0)+(b.b>=3&&useTool(p,'basket')?1:0));
      b.b-=n;p.carryFood=n;p.carryKind='berry';p.state='pick';p.timer=rnd(10,16)*(1-0.4*p.sk.gather);return;
    }
    decide(p);return;
  }
  if(k==='stash'){
    const h=goal.house;h.food=Math.min(CAP[h.type||'home'],h.food+p.carryFood);
    if(p.carryKind==='berry')addSkill(p,'gather',0.02);
    p.carryFood=0;p.carryKind='berry';decide(p);return;
  }
  if(k==='chop'){
    const t=goal.tree;
    if(t.wood>0){t.wood--;if(t.wood<=0)t.stump=minutes;p.state='chop';p.timer=rnd(15,25)*(1-0.5*p.sk.build);return;}
    const rival=people.find(o=>o!==p&&o.state==='chop'&&o.goal&&o.goal.tree===t);
    if(rival&&Math.random()<p.tr.temper*0.6){quarrel(p,rival,'из-за брёвен');decide(p);setBubble(p,'angry',30);return;}
    decide(p);return;
  }
  if(k==='deliver'){
    if(goal.house.built){p.carry=false;decide(p);return;}
    p.state='build';p.timer=rnd(10,18)*(1-0.5*p.sk.build);return;
  }
  if(k==='fish'){p.state='fishing';p.timer=rnd(35,60)*(1-0.3*p.sk.fish);return;}
  if(k==='sleephome'){enterHouse(p,goal.house);return;}
  if(k==='shelter'){if(weather)enterHouse(p,goal.house,'shelter');else decide(p);return;}
  if(k==='sleepfire'){p.state='sleep';p.goal=null;return;}
  if(k==='fireside'){p.state='idle';p.timer=rnd(30,60);p.goal=null;return;}
  p.state='idle';p.timer=rnd(5,20)*(0.5+p.tr.lazy);p.goal=null;
}

function updatePerson(p,dm){
  const sleeping=p.state==='sleep',s=season();
  const fire=building('fire',p.village),nearFire=fire&&fire.built&&dist(p,fire)<150;
  p.hunger=clamp(p.hunger+dm*(sleeping?0.05:0.11)*(s===3?1.1:1),0,100);
  const outdoorSleep=s===3?(nearFire?0.22:0.12):0.22;
  p.energy=clamp(p.energy+dm*(sleeping?(p.inHouse?0.3:outdoorSleep):-(p.state==='move'?0.1:0.06)-(weather&&!p.inHouse?0.05:0)),0,100);
  if(p.state!=='talk')p.social=clamp(p.social+dm*0.09*(0.4+p.tr.soc),0,100);
  if(p.bubble&&minutes>p.bubble.until)p.bubble=null;
  if(p.hunger>=100){p.starve+=dm;if(p.starve>900){die(p,'от голода');return;}}else p.starve=0;
  if(updateSick(p,dm))return;
  const d=day();
  if(p.hunger>92&&p.hungryDay!==d){p.hungryDay=d;addLog([p],`${p.name} ${g(p,'очень голоден','очень голодна')}`);}
  if(p.social>97&&p.lonelyDay!==d){p.lonelyDay=d;addLog([p],`${p.name} ${g(p,'заскучал','заскучала')} в одиночестве`);setBubble(p,'sad',30);}
  switch(p.state){
    case 'move':{
      if(p.goal&&p.goal.kind==='social'){
        const t=p.goal.who;
        if(t.dead||t.state==='sleep'||t.state==='talk'||t.inHouse){decide(p);return;}
        p.tx=t.x;p.ty=t.y;
        if(dist(p,t)<R*2.4){startTalk(p,t);return;}
      }
      if(p.goal&&p.goal.kind==='hunt'){
        const h=p.goal.hare;
        if(!hares.includes(h)||sideOf(h.x,h.y)!==sideOf(p.x,p.y)){decide(p);return;}
        p.tx=h.x;p.ty=h.y;
        if(dist(p,h)<HARE_CATCH){tryCatch(p,h);return;}
      }
      if(!p.via&&!p.crossed&&season()!==3&&sideOf(p.x,p.y)!==sideOf(p.tx,p.ty)){p.via=bestCrossing(p,{x:p.tx,y:p.ty});p.timer+=(dist(p,p.via)+dist(p.via,{x:p.tx,y:p.ty})-dist(p,{x:p.tx,y:p.ty}))/WALK*2;}
      const gx=p.via?p.via.x:p.tx,gy=p.via?p.via.y:p.ty;
      const dx=gx-p.x,dy=gy-p.y,L=Math.hypot(dx,dy);
      const sp=WALK*dm*(p.hunger>85||p.energy<10||p.sick?0.6:1)*(weather&&weather.type==='blizzard'?0.6:1);
      if(L<=sp){p.x=gx;p.y=gy;if(p.via){p.via=null;p.crossed=true;}else{p.crossed=false;arrive(p);}}
      else{const w0=p.walk;p.x+=dx/L*sp;p.y+=dy/L*sp;p.walk+=sp;if(s===3&&Math.floor(p.walk/11)!==Math.floor(w0/11))addTrack(p.x,p.y,dx/L,dy/L,Math.floor(p.walk/11)%2,isChild(p)?0.7:1);}
      p.timer-=dm;if(p.state==='move'&&p.timer<0)decide(p);
      break;}
    case 'talk':
      if(!p.talk||p.talk.done){decide(p);break;}
      p.social=clamp(p.social-dm*3,0,100);
      if(minutes>=p.talk.end)endTalk(p.talk);
      break;
    case 'sleep':
      if(p.energy>=98||(!isNight()&&p.energy>75&&Math.random()<dm*0.05)||(p.hunger>90&&!isNight()))decide(p);
      break;
    case 'shelter':
      if(!weather||p.hunger>90)decide(p);
      break;
    case 'eat':
      p.timer-=dm;if(p.timer<=0){p.hunger=Math.max(0,p.hunger-50);decide(p);}
      break;
    case 'pick':
      p.timer-=dm;if(p.timer<=0){const h=p.goal.house,d=door(h);goTo(p,d.x,d.y,{kind:'stash',house:h});}
      break;
    case 'farm':
      p.timer-=dm;if(p.timer<=0){finishFarm(p,p.goal.plot,p.goal.task);decide(p);}
      break;
    case 'fishing':
      p.timer-=dm;if(p.timer<=0)finishFish(p);
      break;
    case 'plant':
      p.timer-=dm;if(p.timer<=0){finishPlant(p,p.goal.spot);decide(p);}
      break;
    case 'craft':
      p.timer-=dm;if(p.timer<=0){finishCraft(p,p.goal.house);decide(p);}
      break;
    case 'chop':
      p.timer-=dm;
      if(p.timer<=0){const h=p.goal.house;addSkill(p,'build',0.015);p.carry=h.id;if(h.built){p.carry=false;decide(p);}else{const d=door(h);goTo(p,d.x,d.y,{kind:'deliver',house:h});}}
      break;
    case 'build':
      p.timer-=dm;if(p.timer<=0){finishBuild(p,p.goal.house);decide(p);}
      break;
    default:
      p.timer-=dm;if(p.timer<=0)decide(p);
  }
}

/* Расталкивание по клеткам: каждый сравнивается только с соседями из своей и соседних клеток. */
const CELL=32;
function separate(){
  const grid=new Map(),m=R*1.8;
  for(const p of people){
    if(p.inHouse)continue;
    const k=Math.floor(p.x/CELL)*4096+Math.floor(p.y/CELL);
    let c=grid.get(k);if(!c){c=[];grid.set(k,c);}c.push(p);
  }
  for(const [k,cell] of grid){
    const cx=Math.floor(k/4096),cy=k%4096;
    for(let ox=0;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){
      if(ox===0&&oy<0)continue;
      const other=ox===0&&oy===0?cell:grid.get((cx+ox)*4096+cy+oy);
      if(!other)continue;
      for(let i=0;i<cell.length;i++){
        const a=cell[i];
        for(let j=other===cell?i+1:0;j<other.length;j++){
          const b=other[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
          if(d>0&&d<m){const f=(m-d)/d*0.25;a.x-=dx*f;a.y-=dy*f;b.x+=dx*f;b.y+=dy*f;}
        }
      }
    }
  }
  for(const p of people){
    p.x=clamp(p.x,20,W-20);p.y=clamp(p.y,20,H-20);
    if(p.state!=='move'&&!p.inHouse&&inWater(p.x,p.y,4)&&!nearCrossing(p)){const b=bankPoint(p.x,p.y,p.x<riverX(p.y)?0:1);p.x=b.x;}
  }
}

/* Общий подсчёт целей: сколько жителей идёт к каждому кусту, дереву, грядке. Пересчитывается раз в шаг. */
let goalCnt=new Map(),goalCntT=-1;
function goalCounts(){
  if(goalCntT!==minutes){
    goalCnt=new Map();goalCntT=minutes;
    for(const p of people){const gl=p.goal;if(!gl)continue;for(const t of [gl.bush,gl.tree,gl.plot])if(t)goalCnt.set(t,(goalCnt.get(t)||0)+1);}
  }
  return goalCnt;
}
const targetCount=(t,p)=>(goalCounts().get(t)||0)-(p&&p.goal&&(p.goal.bush===t||p.goal.tree===t||p.goal.plot===t)?1:0);

function step(dm){
  minutes+=dm;
  const s=season();
  if(hour()>=9&&hour()<17&&tradeDay!==day()){tradeDay=day();villageTrade();}
  if(day()!==lastDay){
    snapshotDay(lastDay);
    if((lastDay)%DAYS_PER_YEAR===0)closeYear(lastDay/DAYS_PER_YEAR);
    lastDay=day();addLog(null,`<b>Наступил день ${lastDay}</b>`);dailyEvents();
  }
  if(s!==lastSeason){lastSeason=s;onSeason(s);}
  if(pendingEvent&&minutes>=pendingEvent.at){const t=pendingEvent.type;pendingEvent=null;startEvent(t,false);}
  if(weather){
    if(minutes>=weather.until){weather=null;for(const p of people)if(p.state==='shelter')decide(p);}
    else if(weather.type==='storm'&&Math.random()<dm*0.02)flashAt=minutes;
  }
  const dry=drought>minutes;
  for(const b of bushes){
    if(b.b<b.max&&s!==3){b.grow+=dm;if(b.grow>=[110,90,100][s]*(dry?3:1)){b.grow=0;b.b++;}}
  }
  updatePlots(dm);
  fishStock=Math.min(FISH_MAX,fishStock+dm*FISH_MAX/1440*(s===3?0.5:1));
  updateTrees(dm,s);
  updateHares(dm);
  for(const p of people.slice())if(!p.dead)updatePerson(p,dm);
  separate();
}

/* ---------- сохранение ---------- */
function save(){
  try{
    const ps=people.map(p=>{const busy=['sleep','shelter'].includes(p.state);return {...p,goal:null,talk:null,via:null,crossed:false,state:busy?p.state:'idle',timer:rnd(1,5)};});
    const ghosts=[...byId.values()].filter(p=>p.dead).map(({id,name,fem,parents,kids,born,diedAt,origin})=>({id,name,fem,parents,kids,born,diedAt,origin,dead:true}));
    localStorage.setItem(SAVE_KEY,JSON.stringify({v:1,W,H,minutes,lastDay,lastSeason,nextId,pairLog,logArr,trees,flowers,bushes,people:ps,houses,nextHouse,ghosts,plots,nextPlot,dayStats,today,annals,yearNotes,
      weather,drought,pendingEvent,villages,nextVillage,river,fishStock,hares:hares.map(h=>({...h,plot:null,st:'wander',timer:0,tx:h.x,ty:h.y})),nextHare,cam:{x:cam.x,y:cam.y,z:cam.z},speed}));
  }catch(e){}
}
function load(){
  try{
    const s=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(!s||s.v!==1)return false;
    ({minutes,lastDay,nextId,pairLog,logArr,trees,flowers,bushes}=s);
    lastSeason=s.lastSeason??season();
    people=s.people;byId=new Map(people.map(p=>[p.id,p]));
    for(const gh of s.ghosts||[])byId.set(gh.id,{parents:[],kids:[],...gh});
    houses=s.houses||[];nextHouse=s.nextHouse||0;plots=s.plots||[];nextPlot=s.nextPlot||0;
    annals=s.annals||[];yearNotes=s.yearNotes||[];
    dayStats=s.dayStats||[];today={...newToday(),...(s.today||{})};
    weather=s.weather||null;drought=s.drought||0;pendingEvent=s.pendingEvent||null;villages=s.villages||null;nextVillage=s.nextVillage||0;
    for(const h of houses){h.type??='home';h.food??=0;h.contrib??={};h.helpers??=[];h.goods??={};}
    for(const t of trees){t.wood??=TREE_WOOD;t.grow??=0;t.sap??=1;t.stump??=0;}
    hares=s.hares||[];nextHare=s.nextHare||hares.length;
    for(const pl of plots)pl.fence??=false;
    for(const b of bushes)if(!b.dots||b.dots.length<8)b.dots=makeDots();
    const sW=s.W||2400,sH=s.H||1600;
    if(sW<W||sH<H){
      const out=()=>{let x,y;do{x=rnd(40,W-40);y=rnd(40,H-40);}while(x<sW&&y<sH);return {x,y};};
      const k=1-(sW*sH)/(W*H);
      for(let i=0;i<76*k;i++)trees.push({...out(),r:rnd(26,46),wood:TREE_WOOD,grow:0,sap:1,stump:0});
      for(let i=0;i<30*k;i++)bushes.push({...out(),b:5,max:5,grow:0,dots:makeDots()});
      for(let i=0;i<1100*k;i++)flowers.push({...out(),c:pick(['#ffffff','#f4d03f','#e58aa8','#b5d4f4','#b7d699','#b7d699','#b7d699']),s:rnd(1.5,3.5)});
    }
    fishStock=s.fishStock??FISH_MAX;
    if(s.river)river=s.river;else makeRiver();
    for(const p of people){
      p.home??=null;p.carry??=false;p.inHouse??=false;p.carryFood??=0;p.sick??=0;p.communal??=0;p.fame??={q:0,treat:0,help:0,theft:0,caught:0};p.news??=[];p.heard??={};p.rep??=0;p.known??=0;p.repSt??='';
      p.sk??={build:rnd(0,0.25),gather:rnd(0,0.25)};p.sk.farm??=rnd(0,0.25);p.sk.fish??=rnd(0,0.15);p.sk.hunt??=rnd(0,0.15);p.sk.craft??=rnd(0,0.15);p.tools??={};p.skLog??={};p.origin??='first';p.carryKind??='berry';
      if(p.inHouse&&!['sleep','shelter'].includes(p.state))p.inHouse=false;
    }
    if(!villages){
      villages=[];const hs=houses.filter(h=>isHome(h));
      const v=foundVillage(hs.length?hs.reduce((a,h)=>a+h.x,0)/hs.length:W/2,hs.length?hs.reduce((a,h)=>a+h.y,0)/hs.length:H/2);
      v.chief=s.chief??null;v.chiefSince=s.chiefSince||0;
    }
    for(const h of houses)h.village??=nearestVillage(h);
    for(const p of people){const h=houseOf(p);p.village??=h?h.village:nearestVillage(p);}
    const log=document.getElementById('log');log.innerHTML='';
    for(const e of logArr)renderLogEntry(e,true);
    if(s.cam&&Number.isFinite(s.cam.x)&&Number.isFinite(s.cam.y)&&Number.isFinite(s.cam.z)){
      cam.x=clamp(s.cam.x,0,W);cam.y=clamp(s.cam.y,0,H);cam.z=clamp(s.cam.z,MIN_Z,3.5);
    }else{cam.x=W/2;cam.y=H/2;fitCamera();}
    showResidentsIfNeeded();speed=s.speed??1;
    return true;
  }catch(e){console.error(e);return false;}
}
setInterval(save,20000);
addEventListener('beforeunload',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});

/* ---------- анимации: дым, листопад, следы ---------- */
// Только для красоты: в сохранение не попадают. Дым и листья считаются от часов анимации animT (без хранения частиц),
// следы — кольцевой буфер TRACK_MAX, тают за TRACK_LIFE минут мира, метель и весна их стирают.
const TRACK_MAX=8000,TRACK_LIFE=360;
let tracks=[],trackI=0,animT=0;
function addTrack(x,y,ux,uy,side,s){
  const t={x,y,ux,uy,side,s,t:minutes};
  if(tracks.length<TRACK_MAX)tracks.push(t);else{tracks[trackI]=t;trackI=(trackI+1)%TRACK_MAX;}
}
const seed=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v);};
function viewBox(){const hw=innerWidth/2/cam.z+80,hh=innerHeight/2/cam.z+80;return {x0:cam.x-hw,x1:cam.x+hw,y0:cam.y-hh,y1:cam.y+hh};}
const inView=(o,vb)=>o.x>vb.x0&&o.x<vb.x1&&o.y>vb.y0&&o.y<vb.y1;
function drawTracks(vb){
  if(season()!==3){if(tracks.length){tracks.length=0;trackI=0;}return;}
  if(cam.z<0.5)return;// издалека следы меньше пикселя
  // Простые прямоугольники, сгруппированные по 4 ступеням прозрачности: фигуры (ellipse/Path2D) на тысячах наложенных следов тормозят
  const B=4;
  for(let i=0;i<B;i++){
    ctx.fillStyle=`rgba(120,140,160,${0.4*(1-(i+0.5)/B)})`;
    for(const t of tracks){
      const age=minutes-t.t;if(age>TRACK_LIFE||Math.min(B-1,Math.floor(age/TRACK_LIFE*B))!==i||!inView(t,vb))continue;
      const px=-t.uy,py=t.ux,hor=Math.abs(t.ux)>Math.abs(t.uy);
      if(t.side===2){// заячьи: две длинных лапы впереди, две маленьких сзади
        const lw=hor?5:2.4,lh=hor?2.4:5;
        for(const k of [-1,1])ctx.fillRect(t.x+px*2.5*k-lw/2,t.y+py*2.5*k-lh/2,lw,lh);
        for(const d of [6,9])ctx.fillRect(t.x-t.ux*d-1.2,t.y-t.uy*d-1.2,2.4,2.4);
        continue;
      }
      const k=t.side?1:-1,s=t.s,w=(hor?6:3.6)*s,h=(hor?3.6:6)*s;
      ctx.fillRect(t.x+px*3.5*k*s-w/2,t.y+8*s+py*3.5*k*s-h/2,w,h);
    }
  }
}
function drawSmoke(vb){
  const s=season(),hr=hour(),wind=weather&&weather.type==='blizzard'?3:1;
  const cold=s>=2||hr>=17||hr<9;
  for(const h of houses){
    if(!isHome(h)||!h.built||!inView(h,vb))continue;
    const home=people.some(p=>p.inHouse&&p.home===h.id);
    if(!cold&&!home)continue;
    const cx=h.x+30-12,cy=h.y-24+7;
    for(let i=0;i<5;i++){
      const ph=(animT*0.32+i/5+seed(h.id))%1,r=3+ph*8;
      const x=cx+Math.sin(ph*3+h.id)*4+ph*14*wind,y=cy-ph*48;
      ctx.fillStyle=`rgba(190,190,196,${0.55*(1-ph)*(ph<0.1?ph*10:1)})`;
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
  }
}
function drawLeaves(vb,below){
  if(season()!==2)return;
  const cn=CANOPY[2];
  for(let n=0;n<trees.length;n++){
    const t=trees[n];if(!isTree(t)||!inView(t,vb))continue;
    const r=t.r*(0.55+0.45*Math.max(t.wood,1)/TREE_WOOD),sd=Math.floor(t.x*7+t.y*3);
    if(below){// опавшие листья на земле
      for(let i=0;i<9;i++){const a=seed(sd+i)*6.28,d=r*(1.05+seed(sd+i*3)*0.6);circle(t.x+Math.cos(a)*d,t.y+Math.sin(a)*d*0.7+4,1.8,cn[i%3]);}
      continue;
    }
    for(let i=0;i<3;i++){
      const ph=(animT*0.22+seed(sd+i*11))%1,sx=(seed(sd+i*5)-0.5)*r*1.5;
      const x=t.x+sx+Math.sin(ph*9+i)*6,y=t.y-r*0.2+ph*r*1.3;
      ctx.globalAlpha=ph>0.8?(1-ph)*5:1;
      ctx.fillStyle=cn[(i+n)%3];ctx.beginPath();ctx.ellipse(x,y,2.6,1.5,ph*8,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
}

/* ---------- рисование ---------- */
function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function ellipse(x,y,rx,ry,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function hairCap(hy,hr,c,fr){
  ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,hy,hr,Math.PI,0);
  ctx.quadraticCurveTo(hr*0.5,hy-hr*fr,0,hy-hr*(fr-0.1));
  ctx.quadraticCurveTo(-hr*0.5,hy-hr*fr,-hr,hy);ctx.fill();
}
const sizeOf=p=>{if(p.age0)return 1;const a=age(p);return a<18?0.5+0.5*a/18:1;};
function progressBar(x,y,p){ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(x-22,y,44,5);ctx.fillStyle='#ba7517';ctx.fillRect(x-22,y,44*p,5);}

function drawHome(h){
  const w=60,hh=48,x=h.x-w/2,y=h.y-hh/2,p=h.progress,winter=season()===3;
  ellipse(h.x+5,h.y+hh*0.5,w*0.6,9,'rgba(0,0,0,.12)');
  if(p<1){ctx.setLineDash([5,4]);ctx.strokeStyle='#8a7a66';ctx.lineWidth=2;ctx.strokeRect(x,y,w,hh);ctx.setLineDash([]);}
  else{ctx.fillStyle='#d8c6a5';ctx.fillRect(x,y,w,hh);ctx.strokeStyle='#9a8a70';ctx.lineWidth=2;ctx.strokeRect(x,y,w,hh);}
  if(p>=3&&p<6){
    ctx.strokeStyle='#8b5a2b';ctx.lineWidth=7;ctx.strokeRect(x+3.5,y+3.5,w-7,hh-7);
    ctx.strokeStyle='#6b4423';ctx.lineWidth=1;ctx.strokeRect(x+3.5,y+3.5,w-7,hh-7);
  }
  if(p>=6){
    ctx.fillStyle=winter?hexMix(h.roof,'#f4f7f9',0.7):h.roof;ctx.fillRect(x-5,y-5,w+10,hh+10);
    ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(x-5,h.y,w+10,hh/2+5);
    ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-5,h.y);ctx.lineTo(x+w+5,h.y);ctx.stroke();
    ctx.strokeStyle='rgba(0,0,0,.1)';ctx.lineWidth=1;ctx.beginPath();
    for(let i=1;i<6;i++){ctx.moveTo(x-5,y-5+i*(hh+10)/6);ctx.lineTo(x+w+5,y-5+i*(hh+10)/6);}ctx.stroke();
  }
  if(h.built){
    ctx.fillStyle='#5a3a22';ctx.fillRect(h.x-7,y+hh+4,14,5);
    ctx.fillStyle='#8a8580';ctx.fillRect(x+w-17,y+2,10,10);ctx.fillStyle='#5f5e5a';ctx.fillRect(x+w-15,y+4,6,6);
    if(h.food>0){const n=Math.min(6,Math.ceil(h.food/3));for(let i=0;i<n;i++)circle(x-9,y+8+i*6,2.6,'#c0392b');}
  }else progressBar(h.x,y+hh+9,p/NEED.home);
}
function drawStore(h){
  const w=80,hh=56,x=h.x-w/2,y=h.y-hh/2,p=h.progress/NEED.store;
  ellipse(h.x+5,h.y+hh*0.5,w*0.6,10,'rgba(0,0,0,.12)');
  if(h.progress<1){ctx.setLineDash([5,4]);ctx.strokeStyle='#8a7a66';ctx.lineWidth=2;ctx.strokeRect(x,y,w,hh);ctx.setLineDash([]);}
  else{
    ctx.fillStyle='#cdb48c';ctx.fillRect(x,y,w,hh*Math.min(1,p*1.4));
    ctx.strokeStyle='#7a5a3a';ctx.lineWidth=2;ctx.strokeRect(x,y,w,hh);
  }
  if(h.built){
    ctx.fillStyle=season()===3?'#e6ebee':'#7a5a3a';ctx.fillRect(x-4,y-4,w+8,hh+8);
    ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=1.5;ctx.beginPath();
    for(let i=1;i<8;i++){ctx.moveTo(x-4+i*(w+8)/8,y-4);ctx.lineTo(x-4+i*(w+8)/8,y+hh+4);}ctx.stroke();
    ctx.fillStyle='#5a3a22';ctx.fillRect(h.x-9,y+hh+4,18,6);
    for(const [dx,dy] of [[-w/2-10,8],[-w/2-10,24],[w/2+10,14]]){circle(h.x+dx,h.y+dy-10,7,'#8b5a2b');circle(h.x+dx,h.y+dy-10,4.5,'#a8743c');}
    ctx.font='600 12px Segoe UI,sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
    const t=`🍓 ${h.food}`;ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.strokeText(t,h.x,y+hh+12);ctx.fillStyle='#222';ctx.fillText(t,h.x,y+hh+12);
  }else progressBar(h.x,y+hh+10,p);
}
function drawFire(h){
  const n=h.built?10:Math.round(h.progress/NEED.fire*10);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;circle(h.x+Math.cos(a)*18,h.y+Math.sin(a)*14,5,i<n?'#8a8580':'rgba(138,133,128,.25)');}
  if(h.progress>=2){ctx.strokeStyle='#6b4423';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(h.x-10,h.y-6);ctx.lineTo(h.x+10,h.y+6);ctx.moveTo(h.x-10,h.y+6);ctx.lineTo(h.x+10,h.y-6);ctx.stroke();}
  if(h.built){
    const f=Math.sin(minutes*3+h.id)*1.5;
    circle(h.x,h.y-2,9+f,'#e8742c');circle(h.x,h.y-3,5.5+f*0.6,'#f8c64a');
  }else progressBar(h.x,h.y+24,h.progress/NEED.fire);
}

function drawPlot(pl){
  const x=pl.x-PLOT_W/2,y=pl.y-PLOT_H/2,winter=season()===3;
  if(pl.stage==='site'){ctx.setLineDash([4,3]);ctx.strokeStyle='#8a6a44';ctx.lineWidth=1.5;ctx.strokeRect(x,y,PLOT_W,PLOT_H);ctx.setLineDash([]);return;}
  const dry=(pl.stage==='growing'||pl.stage==='ripe')&&pl.water<15;
  ctx.fillStyle=winter?'#e9eef1':dry?'#b89a72':'#8a6440';ctx.fillRect(x,y,PLOT_W,PLOT_H);
  ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=1;ctx.strokeRect(x,y,PLOT_W,PLOT_H);
  if(winter){drawFence(pl);return;}
  ctx.strokeStyle='rgba(60,35,15,.35)';ctx.beginPath();
  for(let r=1;r<4;r++){ctx.moveTo(x+3,y+r*PLOT_H/4);ctx.lineTo(x+PLOT_W-3,y+r*PLOT_H/4);}ctx.stroke();
  for(let r=1;r<4;r++)for(let c=0;c<5;c++){
    const cx=x+6+c*(PLOT_W-12)/4,cy=y+r*PLOT_H/4;
    if(pl.stage==='growing'){const s=1+pl.growth*3.5;circle(cx,cy-1,s,'#5f9a3f');}
    else if(pl.stage==='ripe'){circle(cx,cy,3.3,'#e8a0b8');circle(cx,cy,2.2,'#f4f0e8');ctx.fillStyle='#4f8a33';ctx.fillRect(cx-0.8,cy-6,1.6,4);}
    else if(pl.stage==='dead'){ctx.strokeStyle='#7a5a3a';ctx.beginPath();ctx.moveTo(cx-2,cy);ctx.lineTo(cx+2,cy-4);ctx.stroke();}
  }
  if(pl.weeds>30&&(pl.stage==='growing'||pl.stage==='ripe'||pl.stage==='empty')){
    const n=Math.round(pl.weeds/12);
    for(let i=0;i<n;i++){const wx=x+((i*37+pl.id*13)%PLOT_W),wy=y+((i*23+pl.id*7)%PLOT_H);circle(wx,wy,2.3,'#7fb24a');}
  }
  drawFence(pl);
}
function drawFence(pl){
  if(!pl.fence)return;
  const x=pl.x-PLOT_W/2-4,y=pl.y-PLOT_H/2-4,w=PLOT_W+8,h=PLOT_H+8;
  ctx.strokeStyle='#8a6440';ctx.lineWidth=1.6;ctx.strokeRect(x,y,w,h);
  ctx.fillStyle='#6b4a2b';
  for(let i=0;i<=4;i++){ctx.fillRect(x+i*w/4-1.5,y-2,3,4);ctx.fillRect(x+i*w/4-1.5,y+h-2,3,4);}
  for(let i=1;i<3;i++){ctx.fillRect(x-2,y+i*h/3-1.5,4,3);ctx.fillRect(x+w-2,y+i*h/3-1.5,4,3);}
}

function drawPerson(p){
  const L=p.look,sleeping=p.state==='sleep',a=age(p);
  const hair=a>55&&L.hair.startsWith('#')?hexMix(L.hair,'#d0d0cc',clamp((a-55)/20,0,0.9)):L.hair;
  const bob=p.state==='move'?Math.sin(p.walk*0.3)*1.5:0;
  ctx.save();ctx.translate(p.x,p.y+bob);
  const s=sizeOf(p);ctx.scale(s,s);
  ellipse(0,R*1.05,R*1.1,R*0.38,'rgba(0,0,0,.15)');
  if(p===selected){ctx.strokeStyle='#f4d03f';ctx.lineWidth=3/s;ctx.beginPath();ctx.ellipse(0,R*1.05,R*1.5,R*0.6,0,0,Math.PI*2);ctx.stroke();}
  if(sleeping)ctx.rotate(-0.4);
  const hr=R*0.78,hy=-R*0.3;
  if(L.style==='long')ellipse(0,hy+hr*0.35,hr*1.22,hr*1.25,hair);
  if(L.style==='pony')ellipse(hr*0.95,hy+hr*0.2,hr*0.38,hr*0.7,hair);
  ellipse(0,R*0.65,R*1.12,R*0.68,L.shirt);
  if(season()!==3&&inWater(p.x,p.y,-6)&&!river.fords.some(fy=>Math.abs(fy-p.y)<30))ellipse(0,R*0.75,R*1.7,R*0.75,'#7a5432');
  if(isChief(p)){ctx.strokeStyle='#d4a017';ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(-R*0.8,R*0.25);ctx.lineTo(R*0.75,R*1.05);ctx.stroke();circle(R*0.05,R*0.68,2.8,'#f4d03f');}
  circle(0,hy,hr,p.sick?hexMix(L.skin,'#a8c98a',0.35):L.skin);
  switch(L.style){
    case 'short':hairCap(hy,hr,hair,0.45);break;
    case 'long':hairCap(hy,hr,hair,0.55);break;
    case 'pony':hairCap(hy,hr,hair,0.5);break;
    case 'bun':hairCap(hy,hr,hair,0.5);circle(0,hy-hr*1.05,hr*0.42,hair);break;
    case 'curly':hairCap(hy,hr,hair,0.35);for(let i=0;i<=6;i++){const an=Math.PI+i/6*Math.PI;circle(Math.cos(an)*hr*0.92,hy+Math.sin(an)*hr*0.92,hr*0.36,hair);}break;
    case 'spiky':hairCap(hy,hr,hair,0.45);ctx.fillStyle=hair;ctx.beginPath();
      for(let i=0;i<5;i++){const an=Math.PI*1.15+i/4*Math.PI*0.7;ctx.moveTo(Math.cos(an-0.25)*hr,hy+Math.sin(an-0.25)*hr);ctx.lineTo(Math.cos(an)*hr*1.45,hy+Math.sin(an)*hr*1.45);ctx.lineTo(Math.cos(an+0.25)*hr,hy+Math.sin(an+0.25)*hr);}
      ctx.fill();break;
    case 'bald':ellipse(-hr*0.3,hy-hr*0.5,hr*0.25,hr*0.14,'rgba(255,255,255,.35)');break;
  }
  const ey=hy+hr*0.18,ex=hr*0.38;
  ctx.strokeStyle='#222';ctx.lineWidth=1.3;
  if(sleeping){ctx.beginPath();ctx.arc(-ex,ey-1,2,0.2,Math.PI-0.2);ctx.moveTo(ex+2,ey-1);ctx.arc(ex,ey-1,2,0.2,Math.PI-0.2);ctx.stroke();}
  else{circle(-ex,ey,1.7,'#222');circle(ex,ey,1.7,'#222');}
  const happy=p.hunger<65&&p.energy>30&&!p.sick&&!(p.bubble&&(p.bubble.type==='angry'||p.bubble.type==='sad'));
  ctx.strokeStyle='#7a4a3a';ctx.lineWidth=1.2;ctx.beginPath();
  if(sleeping){}
  else if(happy){ctx.arc(0,ey+2.5,3,0.25*Math.PI,0.75*Math.PI);}
  else{ctx.moveTo(-2.5,ey+5.5);ctx.lineTo(2.5,ey+5.5);}
  ctx.stroke();
  if(p.state==='fishing'){
    const d=riverX(p.y)>p.x?1:-1;ctx.strokeStyle='#6b4f3a';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(R*0.7*d,R*0.4);ctx.lineTo(R*2.8*d,-R*0.9);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=0.8;ctx.beginPath();ctx.moveTo(R*2.8*d,-R*0.9);ctx.lineTo(R*3.1*d,R*1.1);ctx.stroke();
  }
  if(p.carry){
    ctx.save();ctx.translate(R*0.95,R*0.35);ctx.rotate(0.5);
    ctx.fillStyle='#8b5a2b';ctx.beginPath();ctx.roundRect(-4,-R*0.8,8,R*1.6,3);ctx.fill();
    circle(0,-R*0.8+2,3,'#c9a06a');
    ctx.restore();
  }
  if(p.carryFood){
    ctx.fillStyle='#b08a4e';ctx.beginPath();ctx.roundRect(R*0.6,R*0.2,R*0.9,R*0.6,3);ctx.fill();
    if(p.carryKind==='veg')for(let i=0;i<3;i++){circle(R*0.75+i*4,R*0.2,2.8,'#e8a0b8');}
    else if(p.carryKind==='fish')for(let i=0;i<2;i++)ellipse(R*0.85+i*5,R*0.2,4,1.8,'#8fa3b0');
    else for(let i=0;i<Math.min(3,p.carryFood);i++)circle(R*0.8+i*4,R*0.22,2.4,'#c0392b');
  }
  ctx.restore();
}

function bubbleType(p){
  if(p.bubble)return p.bubble.type;
  if(p.state==='sleep'||p.state==='shelter')return p.state==='shelter'?'home':'sleep';
  if(p.state==='talk')return 'talk';
  if(p.state==='eat')return 'eat';
  if(p.state==='pick')return 'eat';
  if(p.state==='chop'||p.state==='build')return 'work';
  if(p.state==='farm')return 'farm';
  if(p.sick)return 'sick';
  return null;
}
function heart(x,y,s,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x,y+5*s);
  ctx.bezierCurveTo(x-6*s,y,x-8*s,y-5*s,x-4*s,y-7*s);ctx.bezierCurveTo(x-1*s,y-8*s,x,y-6*s,x,y-5*s);
  ctx.bezierCurveTo(x,y-6*s,x+1*s,y-8*s,x+4*s,y-7*s);ctx.bezierCurveTo(x+8*s,y-5*s,x+6*s,y,x,y+5*s);ctx.fill();}
function drawBubble(p,k){
  const t=bubbleType(p);if(!t)return;
  const s=sizeOf(p),bw=24*k,bh=19*k,bx=p.x+R*0.5*s,by=p.y-R*1.6*s-bh;
  ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=1*k;
  ctx.beginPath();ctx.roundRect(bx,by,bw,bh,8*k);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(bx+5*k,by+bh-1);ctx.lineTo(bx+2*k,by+bh+5*k);ctx.lineTo(bx+11*k,by+bh-1);ctx.fill();
  const cx=bx+bw/2,cy=by+bh/2;
  ctx.textAlign='center';ctx.textBaseline='middle';
  const txt=(str,c,size,w)=>{ctx.fillStyle=c;ctx.font=`${w||600} ${size*k}px Segoe UI,sans-serif`;ctx.fillText(str,cx,cy+0.5*k);};
  switch(t){
    case 'sleep':txt('zZ','#5f5e5a',11);break;
    case 'home':txt('⌂','#5f5e5a',14);break;
    case 'talk':txt('…','#5f5e5a',14);break;
    case 'angry':txt('!','#e24b4a',15,800);break;
    case 'curious':txt('?','#185fa5',14,800);break;
    case 'sick':txt('✚','#3b6d11',12,800);break;
    case 'heart':heart(cx,cy+0.5*k,1*k,'#e24b4a');break;
    case 'eat':circle(cx-3.5*k,cy+1*k,3.3*k,'#c0392b');circle(cx+3.5*k,cy+1*k,3.3*k,'#8e44ad');ctx.fillStyle='#3b6d11';ctx.fillRect(cx-0.6*k,cy-6*k,1.2*k,4*k);break;
    case 'work':
      ctx.save();ctx.translate(cx,cy);ctx.rotate(-0.6);
      ctx.fillStyle='#8b5a2b';ctx.fillRect(-1.2*k,-3*k,2.4*k,10*k);
      ctx.fillStyle='#6f6e6a';ctx.fillRect(-5*k,-6*k,10*k,4*k);
      ctx.restore();break;
    case 'farm':
      ctx.fillStyle='#8a6440';ctx.fillRect(cx-6*k,cy+3*k,12*k,3*k);
      ctx.strokeStyle='#4f8a33';ctx.lineWidth=1.6*k;ctx.beginPath();ctx.moveTo(cx,cy+3*k);ctx.lineTo(cx,cy-3*k);ctx.stroke();
      ellipse(cx-3*k,cy-3*k,3*k,1.6*k,'#5f9a3f');ellipse(cx+3*k,cy-4*k,3*k,1.6*k,'#5f9a3f');break;
    case 'sad':ctx.fillStyle='#378add';ctx.beginPath();ctx.moveTo(cx,cy-6*k);ctx.quadraticCurveTo(cx+5*k,cy+1*k,cx,cy+5*k);ctx.quadraticCurveTo(cx-5*k,cy+1*k,cx,cy-6*k);ctx.fill();break;
  }
}

function drawWeather(w,h){
  const s=season(),t=performance.now()/1000;
  ctx.setTransform(1,0,0,1,0,0);
  if(weather&&weather.type==='storm'){
    ctx.fillStyle='rgba(30,40,60,.25)';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(170,190,220,.55)';ctx.lineWidth=1.2*DPR;ctx.beginPath();
    for(let i=0;i<220;i++){const x=((i*137.5+t*120)%w),y=((i*91.3+t*700)%h);ctx.moveTo(x,y);ctx.lineTo(x-4*DPR,y+14*DPR);}
    ctx.stroke();
    if(minutes-flashAt<0.6){ctx.fillStyle='rgba(255,255,255,.45)';ctx.fillRect(0,0,w,h);}
  }else if(s===3||(weather&&weather.type==='blizzard')){
    const bl=weather&&weather.type==='blizzard',n=bl?400:90;
    if(bl){ctx.fillStyle='rgba(230,236,242,.35)';ctx.fillRect(0,0,w,h);}
    ctx.fillStyle='rgba(255,255,255,.85)';
    for(let i=0;i<n;i++){const x=((i*173.3+t*(bl?160:20))%w),y=((i*97.7+t*(bl?120:30))%h);ctx.fillRect(x,y,2.5*DPR,2.5*DPR);}
  }
}

function draw(){
  const w=cv.width,h=cv.height,z=cam.z*DPR,s=season();
  const world=()=>ctx.setTransform(z,0,0,z,w/2-cam.x*z,h/2-cam.y*z);
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=OUTER[s];ctx.fillRect(0,0,w,h);
  world();
  ctx.fillStyle=GRASS[s];ctx.fillRect(0,0,W,H);
  if(s<3)for(const f of flowers){if(s===2&&f.c!=='#b7d699')continue;circle(f.x,f.y,f.s,f.c);}
  drawRiver(s);
  const bc=s===3?['#6a7f62','#7d917a','#728a6c']:['#4f8a33','#5f9a3f','#5a9439'];
  for(const b of bushes){
    ellipse(b.x,b.y+14,24,8,'rgba(0,0,0,.12)');
    circle(b.x,b.y,20,bc[0]);circle(b.x-7,b.y-5,12,bc[1]);circle(b.x+8,b.y+3,11,bc[2]);
    if(s===3)circle(b.x-4,b.y-8,8,'#f2f5f7');
    for(let i=0;i<Math.min(b.b,8);i++)circle(b.x+b.dots[i][0],b.y+b.dots[i][1],3.2,'#c0392b');
  }
  const vb=viewBox();
  drawTracks(vb);drawLeaves(vb,true);
  for(const pl of plots)drawPlot(pl);
  for(const hs of houses){if(hs.type==='fire')drawFire(hs);else if(hs.type==='store')drawStore(hs);else if(hs.type==='pier')drawPier(hs);else drawHome(hs);}
  const cn=CANOPY[s];
  for(const h of hares)drawHare(h,s);
  for(const t of trees)drawTree(t,cn);
  drawLeaves(vb,false);drawSmoke(vb);
  const sorted=people.filter(p=>!p.inHouse).sort((a,b)=>a.y-b.y);
  for(const p of sorted)drawPerson(p);
  drawVillageNames();
  const hr=hour();
  let dark=0;
  if(hr>=19&&hr<22)dark=(hr-19)/3;else if(hr>=22||hr<5)dark=1;else if(hr>=5&&hr<7)dark=1-(hr-5)/2;
  if(dark>0){
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=`rgba(18,28,70,${dark*0.5})`;ctx.fillRect(0,0,w,h);world();
    for(const fire of houses)if(fire.type==='fire'&&fire.built){const gr=ctx.createRadialGradient(fire.x,fire.y,5,fire.x,fire.y,170);gr.addColorStop(0,`rgba(255,180,80,${0.35*dark})`);gr.addColorStop(1,'rgba(255,180,80,0)');ctx.fillStyle=gr;ctx.fillRect(fire.x-170,fire.y-170,340,340);}
  }
  drawWeather(w,h);world();
  const k=clamp(1/cam.z,0.9,2.2);
  for(const p of sorted)drawBubble(p,k);
  const inside=new Map();
  for(const p of people)if(p.inHouse){const v=inside.get(p.home);if(v!=='sleep')inside.set(p.home,p.state==='sleep'?'sleep':'shelter');}
  for(const hs of houses)if(isHome(hs)&&inside.has(hs.id))drawBubble({x:hs.x+4,y:hs.y-10,bubble:null,state:inside.get(hs.id),age0:true},k);
  for(const p of sorted){
    if(!(cam.z>1.3||p===selected||p===hover))continue;
    const ny=p.y+R*1.5*sizeOf(p);
    ctx.font=`600 ${12*k}px Segoe UI,sans-serif`;ctx.textAlign='center';ctx.textBaseline='top';
    ctx.lineWidth=3*k;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.strokeText(p.name,p.x,ny);
    ctx.fillStyle='#222';ctx.fillText(p.name,p.x,ny);
  }
}

/* ---------- карточка ---------- */
const card=document.getElementById('card');
let cardHeld=false,cardHtml='';
function hideCard(){card.style.display='none';cardHtml='';}
function bar(label,v,c,right){v=clamp(v,0,100);return `<div class="row"><span>${label}</span><span>${right??Math.round(v)}</span></div><div class="bar"><i style="width:${v}%;background:${c}"></i></div>`;}
function relWord(r){return r>=75?'неразлучны':r>=40?'друзья':r>10?'приятели':r<=-35?'враги':r<-10?'не ладят':'знакомы';}
function nameLink(id){const p=byId.get(id);if(!p)return '';return p.dead?`<span class="dead">${p.name} ✝</span>`:`<span class="who" data-id="${id}">${p.name}</span>`;}
function activity(p){
  const sick=p.sick?' · болеет':'';
  switch(p.state){
    case 'sleep':return (p.inHouse?'спит дома':'спит')+sick;
    case 'shelter':return 'прячется дома от непогоды'+sick;
    case 'eat':return 'ест ягоды'+sick;
    case 'pick':return 'собирает ягоды в запас'+sick;
    case 'fishing':return (season()===3?'рыбачит в проруби':'рыбачит')+sick;
    case 'chop':return 'рубит дерево'+sick;
    case 'farm':return ({dig:'копает грядку',sow:'сажает репу',water:'поливает огород',weed:'полет огород',harvest:'собирает урожай',fence:'ставит забор'})[p.goal&&p.goal.task]||'работает на огороде';
    case 'plant':return 'сажает дерево'+sick;
    case 'craft':return 'мастерит'+sick;
    case 'build':return 'строит'+sick;
    case 'talk':{const o=p.talk&&(p.talk.a===p?p.talk.b:p.talk.a);return (o?`болтает: ${o.name}`:'болтает')+sick;}
    case 'move':{
      const k=p.goal&&p.goal.kind;
      const m={farm:'идёт на огород',stealplot:'крадётся к чужому огороду',eat:'идёт за ягодами',eatfrom:p.goal&&p.goal.steal?'крадётся к чужому дому':'идёт поесть из запасов',pick:'идёт собирать ягоды',stash:p.carryKind==='veg'?'несёт урожай домой':p.carryKind==='fish'?'несёт рыбу домой':p.carryKind==='meat'?'несёт зайца домой':'несёт ягоды в запас',fish:'идёт на реку',
        plant:'идёт сажать дерево',hunt:'охотится на зайца',craft:'идёт домой мастерить',barter:'идёт меняться',
        chop:'идёт за брёвнами',deliver:'несёт бревно',sleephome:'идёт домой спать',shelter:'спешит домой от непогоды',sleepfire:'идёт спать к костру',fireside:'идёт к костру'};
      if(m[k])return m[k]+sick;
      if(k==='social')return `идёт к жителю: ${p.goal.who.name}`+sick;
      return (p.goal&&p.goal.far?g(p,'отправился','отправилась')+' исследовать':'гуляет')+sick;}
    default:return 'отдыхает'+sick;
  }
}
function plotWords(list){
  const n={site:'размечена',empty:'пустая',growing:'растёт',ripe:'созрела',dead:'засохла'};
  return list.map(pl=>n[pl.stage]+(pl.stage==='growing'?` ${Math.round(pl.growth*100)}%`+(pl.water<15?', сухо':'')+(pl.weeds>60?', сорняки':''):'')).join('; ');
}
function updateCard(){
  if(!selected){hideCard();return;}
  const p=selected;
  const fam=new Set([p.partner,...p.parents,...p.kids]);
  const rels=Object.entries(p.rel).map(([id,v])=>[+id,v]).filter(([id])=>alive(id)&&!fam.has(id)).sort((a,b)=>b[1]-a[1]);
  const friends=rels.filter(r=>r[1]>10).slice(0,4),foes=rels.filter(r=>r[1]<-10).slice(-3).reverse();
  const relLine=([id,v])=>`<div class="row">${nameLink(id)}<span>${relWord(v)} (${Math.round(v)})</span></div>`;
  const famName=id=>{const o=alive(id);return nameLink(id)+(o?` <span class="dead" title="Отношения: от −100 до +100">(${Math.round(rel(p,o))})</span>`:'');};
  const famRow=(label,ids)=>ids.length?`<div class="row"><span>${label}</span><span>${ids.map(famName).join(', ')}</span></div>`:'';
  const h=houseOf(p);
  const homeTxt=!h?'нет':h.owners.includes(p.id)?(h.built?`свой, запас ${h.food}`:`строится ${h.progress} из ${NEED.home}`):(h.built?`у родителей, запас ${h.food}`:'родители строят');
  const famHtml=(p.partner!==null?famRow('Пара',[p.partner]):'')+famRow('Родители',p.parents)+famRow('Дети',p.kids)+`<div class="row"><span>Дом</span><span>${homeTxt}</span></div>`+(h&&h.built&&plotsOf(h).length?`<div class="row"><span>Огород</span><span>${plotWords(plotsOf(h))}</span></div>`:'');
  const html=`<h2><span>${p.name}</span><button id="cardClose" title="Закрыть">✕</button></h2>
    <div class="act">${years(Math.floor(age(p)))} · ${activity(p)}</div>
    ${bar('Сытость',100-p.hunger,'#639922')}${bar('Бодрость',p.energy,'#378add')}${bar('Общение',100-p.social,'#7f77dd')}
    <h4 class="h4row"><span>Семья</span><button id="treeBtn">Родословная</button></h4>${famHtml}
    <h4>Навыки</h4>${SKILLS.map(([k,l])=>bar(l,p.sk[k]*100,'#1d9e75',`${skillWord(p,p.sk[k])} (${Math.round(p.sk[k]*100)})`)).join('')}
    ${Object.keys(p.tools).length?`<div class="row"><span>Инструменты</span><span>${Object.entries(p.tools).map(([k,n])=>`${TOOLS[k][0]} (${n})`).join(', ')}</span></div>`:''}
    ${h&&h.built&&goodsCount(h)?`<div class="row"><span>Изделия дома</span><span>${Object.entries(h.goods).filter(([,n])=>n>0).map(([k,n])=>`${TOOLS[k][0]} ×${n}`).join(', ')}</span></div>`:''}
    ${p.communal?`<div class="row"><span>Вклад в общие постройки</span><span>${woodWords(p.communal)}</span></div>`:''}
    <h4>Характер</h4>${TRAITS.map(([k,l])=>bar(l,p.tr[k]*100,'#ba7517')).join('')}
    <div class="row"><span>Репутация</span><span>${repWord(p)}${p.known?` (${p.rep>0?'+':''}${p.rep}, знают ${p.known})`:''}</span></div>
    ${villages.length>1?`<div class="row"><span>Деревня</span><span>${villageOf(p).name}</span></div>`:''}
    ${isChief(p)?`<div class="row"><span>Должность</span><span>староста с ${chiefVillage(p).chiefSince}-го дня</span></div>`:''}
    <h4>Отношения</h4>${friends.length||foes.length?friends.map(relLine).join('')+foes.map(relLine).join(''):'<div class="hist">пока ни с кем</div>'}
    <h4>История</h4>${p.hist.length?p.hist.slice(0,8).map(e=>`<div class="hist">День ${Math.floor(e.t/1440)+1}, ${fmtTime(e.t)}: ${e.text}</div>`).join(''):'<div class="hist">пока ничего</div>'}`;
  if(cardHeld)return;
  if(html!==cardHtml){const scroll=card.scrollTop;card.innerHTML=html;cardHtml=html;card.scrollTop=scroll;}
  card.style.display='block';
}
function selectPerson(id){const p=alive(+id);if(p){selected=p;follow=true;updateCard();}}
card.addEventListener('click',e=>{
  if(e.target.id==='cardClose'){selected=null;follow=false;hideCard();return;}
  if(e.target.id==='treeBtn'){openTree(selected);return;}
  const id=e.target.dataset&&e.target.dataset.id;
  if(id!==undefined)selectPerson(id);
});
card.addEventListener('pointerdown',()=>{cardHeld=true;});
document.addEventListener('pointerup',()=>{cardHeld=false;});
document.addEventListener('pointercancel',()=>{cardHeld=false;});

/* ---------- родословная ---------- */
const treeEl=document.getElementById('tree');
function openTree(p){
  const get=id=>byId.get(id);
  const uniq=a=>[...new Set(a)];
  const up=ids=>uniq(ids.flatMap(id=>(get(id)||{}).parents||[]));
  const down=ids=>uniq(ids.flatMap(id=>(get(id)||{}).kids||[]));
  const g1=p.parents,g2=up(g1),g3=up(g2);
  const d1=p.kids,d2=down(d1),d3=down(d2);
  const sibs=uniq(g1.flatMap(id=>(get(id)||{}).kids||[])).filter(id=>id!==p.id);
  let total=0;const seen=new Set();const walk=ids=>{for(const id of ids){if(seen.has(id))continue;seen.add(id);total++;walk((get(id)||{}).kids||[]);}};walk(p.kids);
  const life=x=>x.dead&&x.born!==undefined&&x.diedAt!==undefined?` <span class="dead">(${years(Math.floor((x.diedAt-x.born)/YEAR))})</span>`:'';
  const nm=id=>{const x=get(id);if(!x)return '';return (x.dead?`<span class="dead">${x.name} ✝</span>`:`<span class="who" data-id="${id}">${x.name}</span>`)+life(x);};
  const row=(label,ids)=>ids.length?`<div class="gen"><div class="gl">${label}</div><div>${ids.map(nm).join(', ')}</div></div>`:'';
  const origin=p.origin==='wanderer'?g(p,'пришёл странником','пришла странницей'):p.origin==='first'?g(p,'из первых жителей поляны','из первых жительниц поляны'):'';
  treeEl.querySelector('.content').innerHTML=`<h2>Родословная: ${p.name} <button id="treeClose" title="Закрыть">✕</button></h2>
    ${origin&&!g1.length?`<p class="dead">${p.name} ${origin}</p>`:''}
    ${row('Прабабушки и прадедушки',g3)}${row('Бабушки и дедушки',g2)}${row('Родители',g1)}
    <div class="gen me"><div class="gl">Сам${g(p,'','а')}</div><div><b>${p.name}</b>${p.partner!==null?' + '+nm(p.partner):''}</div></div>
    ${row('Братья и сёстры',sibs)}${row('Дети',d1)}${row('Внуки',d2)}${row('Правнуки',d3)}
    <p class="dead">Всего потомков: ${total}</p>`;
  treeEl.style.display='flex';
}
treeEl.addEventListener('click',e=>{
  if(e.target===treeEl||e.target.id==='treeClose'){treeEl.style.display='none';return;}
  const id=e.target.dataset&&e.target.dataset.id;
  if(id!==undefined){treeEl.style.display='none';selectPerson(id);}
});

/* ---------- управление ---------- */
const toWorld=(sx,sy)=>({x:cam.x+(sx-innerWidth/2)/cam.z,y:cam.y+(sy-innerHeight/2)/cam.z});
function personAt(sx,sy){
  const w=toWorld(sx,sy);let best=null,bd=Math.max(R*1.6,16/cam.z);
  for(const p of people){if(p.inHouse)continue;const d=Math.hypot(p.x-w.x,p.y-(w.y+R*0.1));if(d<bd){bd=d;best=p;}}
  return best;
}
let drag=null;
cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y,moved:false};cv.setPointerCapture(e.pointerId);});
cv.addEventListener('pointermove',e=>{
  if(drag){
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)>4){drag.moved=true;follow=false;cv.style.cursor='grabbing';}
    if(drag.moved){cam.x=drag.cx-dx/cam.z;cam.y=drag.cy-dy/cam.z;}
  }else{hover=personAt(e.clientX,e.clientY);cv.style.cursor=hover?'pointer':'grab';}
});
cv.addEventListener('pointerup',e=>{
  if(drag&&!drag.moved){const p=personAt(e.clientX,e.clientY);selected=p;follow=!!p;updateCard();}
  drag=null;cv.style.cursor='grab';
});
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  const before=toWorld(e.clientX,e.clientY);
  cam.z=clamp(cam.z*Math.exp(-e.deltaY*0.0015),MIN_Z,3.5);
  const after=toWorld(e.clientX,e.clientY);
  if(!follow){cam.x+=before.x-after.x;cam.y+=before.y-after.y;}
},{passive:false});

function setSpeed(s){speed=s;document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',+b.dataset.sp===s));}
let prevSpeed=1;
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.sp));
const help=document.getElementById('help');
function toggleHelp(on){help.style.display=on?'flex':'none';}
addEventListener('keydown',e=>{
  if(e.code==='Escape'){
    if(welcomeEl.style.display==='flex')toggleWelcome(false);
    else if(help.style.display==='flex')toggleHelp(false);
    else if(treeEl.style.display==='flex')treeEl.style.display='none';
    else if(chartsEl.style.display==='flex')toggleCharts(false);
    else if(annalsEl.style.display==='flex')annalsEl.style.display='none';
    else if(setPanel.style.display==='block')setPanel.style.display='none';
    else{selected=null;follow=false;hideCard();}
  }
  if(e.code==='Space'){e.preventDefault();if(speed){prevSpeed=speed;setSpeed(0);}else setSpeed(prevSpeed);}
});
document.getElementById('newWorld').onclick=()=>{if(confirm('Стереть текущий мир и создать новый?')){newWorld();save();}};
const setPanel=document.getElementById('settings');
for(const [id,key] of [['optWanderers','wanderers'],['optEvents','events']]){
  const el=document.getElementById(id);el.checked=settings[key];
  el.onchange=()=>{settings[key]=el.checked;saveSettings();};
}
setPanel.addEventListener('click',e=>{const t=e.target.dataset&&e.target.dataset.ev;if(t)startEvent(t,true);});
const settingsBtn=document.getElementById('settingsBtn');
settingsBtn.onclick=()=>{
  const opening=setPanel.style.display!=='block';setPanel.style.display=opening?'block':'none';
  if(opening&&card.style.display==='block'){const a=setPanel.getBoundingClientRect(),b=card.getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top){selected=null;follow=false;hideCard();}}
};
document.addEventListener('pointerdown',e=>{if(setPanel.style.display==='block'&&e.target!==settingsBtn&&!setPanel.contains(e.target))setPanel.style.display='none';});
document.getElementById('addWanderer').onclick=()=>{const w=spawnWanderer(true);w.x=clamp(cam.x+rnd(-80,80),40,W-40);w.y=clamp(cam.y+rnd(-80,80),40,H-40);};
document.getElementById('harvest').onclick=()=>{for(const b of bushes){b.b=Math.max(b.b,b.max);b.grow=0;}addLog(null,'Вмешательство: все кусты покрылись ягодами');};
document.getElementById('addBush').onclick=()=>{
  let b,tries=0;
  do{b={x:rnd(120,W-120),y:rnd(120,H-120),b:5,max:season()===2?7:5,grow:0,dots:makeDots()};tries++;}
  while(tries<40&&(bushes.some(o=>dist(o,b)<160)||houses.some(o=>dist(o,b)<90)||inWater(b.x,b.y,40)));
  bushes.push(b);addLog(null,`Вмешательство: на поляне вырос новый куст, всего кустов ${bushes.length}`);
};
document.getElementById('helpBtn').onclick=()=>toggleHelp(true);
document.getElementById('helpClose').onclick=()=>toggleHelp(false);
help.onclick=e=>{if(e.target===help)toggleHelp(false);};
// приветствие: само показывается один раз (флаг в настройках), потом — из справки
const welcomeEl=document.getElementById('welcome');
function toggleWelcome(on){welcomeEl.style.display=on?'flex':'none';if(!on&&!settings.welcomed){settings.welcomed=true;saveSettings();}}
document.getElementById('welcomeGo').onclick=()=>toggleWelcome(false);
welcomeEl.onclick=e=>{if(e.target===welcomeEl)toggleWelcome(false);};
document.getElementById('welcomeAgain').onclick=()=>{toggleHelp(false);toggleWelcome(true);};
if(!TEST&&!settings.welcomed)toggleWelcome(true);
const logFilters=document.getElementById('logFilters');
logFilters.innerHTML=LOG_CATS.map(([k,l])=>`<button data-cat="${k}" class="${settings.logCats[k]?'on':''}">${l}</button>`).join('');
logFilters.addEventListener('click',e=>{
  const k=e.target.dataset&&e.target.dataset.cat;if(!k)return;
  settings.logCats[k]=!settings.logCats[k];e.target.classList.toggle('on',settings.logCats[k]);
  saveSettings();rerenderLog();
});
document.getElementById('logSearch').addEventListener('input',e=>{logSearch=makeSearch(e.target.value.trim());rerenderLog();});
const chron=document.getElementById('chron');
function setChronClosed(closed,remember){chron.classList.toggle('closed',closed);document.getElementById('chronArrow').textContent=closed?'▸':'▾';if(remember){settings.chronClosed=closed;saveSettings();}}
setChronClosed(settings.chronClosed===undefined?innerWidth<=600:settings.chronClosed,settings.chronClosed===undefined);
document.getElementById('chronHead').onclick=()=>setChronClosed(!chron.classList.contains('closed'),true);

/* ---------- графики ---------- */
const C1='#2a78d6',C2='#eb6834',C3='#1baf7a';
const CHARTS=[
  {id:'pop',title:'Население',type:'line',series:[{k:'pop',l:'Все жители',c:C1},{k:'kids',l:'Дети',c:C2}]},
  {id:'bd',title:'Рождения и смерти за день',type:'bars',series:[{k:'births',l:'Рождения',c:C1},{k:'deaths',l:'Смерти',c:C2,neg:true}]},
  {id:'food',title:'Запасы еды в домах и кладовке',type:'line',series:[{k:'food',l:'Запасы',c:C1}]},
  {id:'rel',title:'Дружбы, ссоры и кражи за день',type:'line',series:[{k:'friend',l:'Новые дружбы',c:C1},{k:'quarrel',l:'Ссоры',c:C2},{k:'theft',l:'Кражи',c:C3}]},
  {id:'homes',title:'Готовые дома',type:'line',series:[{k:'homes',l:'Дома',c:C1}]},
  {id:'forest',title:'Лес',type:'line',series:[{k:'trees',l:'Деревья',c:C1},{k:'saps',l:'Саженцы',c:C3}]},
  {id:'craft',title:'Посадки, охота и обмен за день',type:'line',series:[{k:'plant',l:'Посажено деревьев',c:C1},{k:'hunt',l:'Поймано зайцев',c:C2},{k:'barter',l:'Обменов',c:C3}]},
];
const chartsEl=document.getElementById('charts');
let chartRange='all',chartHover=null;
const chartVal=(row,k)=>k==='deaths'?row.old+row.hunger+row.sick:row[k]||0;
const niceMax=v=>{if(v<=4)return 4;const p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p;return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p;};
function chartData(){return chartRange==='all'?dayStats:dayStats.slice(-50);}
function buildCharts(){
  const box=chartsEl.querySelector('.list');
  box.innerHTML=CHARTS.map(c=>`<div class="chart" data-id="${c.id}"><div class="ct">${c.title}</div>
    ${c.series.length>1?`<div class="lg">${c.series.map(s=>`<span><i style="background:${s.c}"></i>${s.l}</span>`).join('')}</div>`:''}
    <canvas></canvas><div class="tip"></div></div>`).join('');
  for(const el of box.querySelectorAll('.chart')){
    const cvs=el.querySelector('canvas');
    cvs.addEventListener('mousemove',e=>{
      const data=chartData();if(data.length<2)return;
      const r=cvs.getBoundingClientRect(),pw=r.width-42;
      chartHover=clamp(Math.round((e.clientX-r.left-34)/pw*(data.length-1)),0,data.length-1);
      renderCharts(el.dataset.id);
    });
    cvs.addEventListener('mouseleave',()=>{chartHover=null;renderCharts();});
  }
}
function renderCharts(tipId){
  const data=chartData();
  for(const el of chartsEl.querySelectorAll('.chart')){
    const cfg=CHARTS.find(c=>c.id===el.dataset.id);
    renderChart(el.querySelector('canvas'),cfg,data);
    const tip=el.querySelector('.tip');
    if(chartHover!==null&&el.dataset.id===tipId&&data[chartHover]){
      const row=data[chartHover];
      let html=`<b>День ${row.d}</b> · ${SEASON_NAMES[row.season]}<br>`+cfg.series.map(s=>`<i style="background:${s.c}"></i>${s.l}: ${chartVal(row,s.k)}`).join('<br>');
      if(cfg.id==='bd'&&chartVal(row,'deaths'))html+=`<br><span class="dead">старость ${row.old}, голод ${row.hunger}, болезнь ${row.sick}</span>`;
      tip.innerHTML=html;tip.style.display='block';
      const cw=el.clientWidth,x=34+chartHover/(Math.max(1,data.length-1))*(cw-42);
      tip.style.left=(x>cw/2?x-tip.offsetWidth-10:x+10)+'px';
    }else tip.style.display='none';
  }
}
function renderChart(cvs,cfg,data){
  const dpr=window.devicePixelRatio||1,w=cvs.clientWidth,h=cvs.clientHeight;
  cvs.width=w*dpr;cvs.height=h*dpr;const c=cvs.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const L=34,RR=8,T=6,B=18,pw=w-L-RR,ph=h-T-B,n=data.length;
  c.font='11px Segoe UI,sans-serif';
  if(n<2){c.fillStyle='#6a6a62';c.fillText('Пока нет данных',L,T+ph/2);return;}
  const X=i=>L+i/(n-1)*pw,step=pw/(n-1);
  let top=0,bot=0;
  for(const row of data)for(const s of cfg.series){const v=chartVal(row,s.k);if(s.neg)bot=Math.max(bot,v);else top=Math.max(top,v);}
  top=niceMax(top);if(bot)bot=niceMax(bot);
  const Y=v=>T+ph*(top-v)/(top+bot);
  for(let i=0;i<n;i++)if(data[i].season===3){c.fillStyle='#eef2f6';c.fillRect(X(i)-step/2,T,step+0.5,ph);}
  c.strokeStyle='#e6e8e0';c.lineWidth=1;c.fillStyle='#6a6a62';c.textAlign='right';c.textBaseline='middle';
  const ticks=bot?[top,0,-bot]:[top,top/2,0];
  for(const v of ticks){const y=Y(v);c.beginPath();c.moveTo(L,y);c.lineTo(L+pw,y);c.stroke();c.fillText(String(Math.abs(Math.round(v))),L-5,y);}
  c.textAlign='left';c.textBaseline='top';c.fillText(`день ${data[0].d}`,L,T+ph+4);
  c.textAlign='center';
  const every=Math.max(1,Math.ceil(n/6));
  for(let i=every;i<n;i+=every)c.fillText(String(data[i].d),X(i),T+ph+4);
  if(cfg.type==='bars'){
    const bw=Math.max(1,step-2);
    for(const s of cfg.series){
      c.fillStyle=s.c;
      for(let i=0;i<n;i++){const v=chartVal(data[i],s.k);if(!v)continue;const y0=Y(0),y1=Y(s.neg?-v:v);c.fillRect(X(i)-bw/2,Math.min(y0,y1),bw,Math.max(1,Math.abs(y1-y0)));}
    }
  }else{
    for(const s of cfg.series){
      c.strokeStyle=s.c;c.lineWidth=2;c.lineJoin='round';c.beginPath();
      for(let i=0;i<n;i++){const y=Y(chartVal(data[i],s.k));if(i)c.lineTo(X(i),y);else c.moveTo(X(i),y);}
      c.stroke();
    }
  }
  if(chartHover!==null&&chartHover<n){
    const x=X(chartHover);c.strokeStyle='#9a9a92';c.lineWidth=1;c.beginPath();c.moveTo(x,T);c.lineTo(x,T+ph);c.stroke();
    if(cfg.type==='line')for(const s of cfg.series){const y=Y(chartVal(data[chartHover],s.k));c.fillStyle='#fff';c.beginPath();c.arc(x,y,5.5,0,7);c.fill();c.fillStyle=s.c;c.beginPath();c.arc(x,y,4,0,7);c.fill();}
  }
}
function toggleCharts(on){
  chartsEl.style.display=on?'flex':'none';
  if(on){buildCharts();renderCharts();}
}
document.getElementById('chartsBtn').onclick=()=>toggleCharts(true);
chartsEl.addEventListener('click',e=>{
  if(e.target===chartsEl||e.target.id==='chartsClose'){toggleCharts(false);return;}
  const r=e.target.dataset&&e.target.dataset.range;
  if(r){chartRange=r;for(const b of chartsEl.querySelectorAll('[data-range]'))b.classList.toggle('on',b.dataset.range===r);renderCharts();}
});
setInterval(()=>{if(chartsEl.style.display==='flex'&&chartHover===null)renderCharts();},1000);

/* ---------- летопись ---------- */
function yearSummary(y,rows,notes){
  const sum=k=>rows.reduce((s,r)=>s+(r[k]||0),0);
  const a={y,d1:(y-1)*DAYS_PER_YEAR+1,d2:y*DAYS_PER_YEAR,
    popStart:rows.length?rows[0].pop:people.length,popEnd:rows.length?rows[rows.length-1].pop:people.length,
    births:sum('births'),old:sum('old'),hunger:sum('hunger'),sick:sum('sick'),harvest:sum('harvest'),
    friend:sum('friend'),quarrel:sum('quarrel'),theft:sum('theft'),
    homes:rows.length?rows[rows.length-1].homes-(dayStats.find(r=>r.d===(y-1)*DAYS_PER_YEAR)||{homes:0}).homes:0,
    notes:notes.slice()};
  a.title=yearTitle(a);
  return a;
}
function yearTitle(a){
  const deaths=a.old+a.hunger+a.sick,has=re=>a.notes.some(n=>re.test(n));
  if(a.popEnd===0)return 'Год, когда поляна опустела';
  if(a.hunger>=Math.max(3,a.births*0.5))return 'Голодный год';
  if(a.sick>=3)return 'Год болезни';
  if(a.popEnd<a.popStart*0.75&&deaths>=4)return 'Тяжёлый год';
  if(a.theft>=10&&a.theft>a.friend)return 'Год воров';
  if(a.quarrel>=10&&a.quarrel>a.friend*2)return 'Год раздоров';
  if(has(/готов[ао]?\./))return 'Год общей стройки';
  if(a.homes>=3)return 'Год новоселий';
  if(a.births>=Math.max(6,a.popStart*0.25))return 'Год рождений';
  if(has(/засух/))return 'Год засухи';
  if(a.friend>=8&&a.friend>=a.quarrel*2)return 'Год дружбы';
  if(has(/богатый урожай/))return 'Урожайный год';
  return 'Спокойный год';
}
function closeYear(y){
  const rows=dayStats.filter(r=>r.d>(y-1)*DAYS_PER_YEAR&&r.d<=y*DAYS_PER_YEAR);
  const a=yearSummary(y,rows,yearNotes);
  annals.push(a);if(annals.length>500)annals.shift();
  yearNotes=[];
  addLog(null,`<b>Итоги ${y}-го года: ${a.title.toLowerCase()}</b>`);
  for(const v of villages)if(v.chief!==null)elect(v);
}
const annalsEl=document.getElementById('annals');
function annalHtml(a,current){
  const deaths=a.old+a.hunger+a.sick;
  const causes=deaths?` (${[a.old&&`старость ${a.old}`,a.hunger&&`голод ${a.hunger}`,a.sick&&`болезнь ${a.sick}`].filter(Boolean).join(', ')})`:'';
  const nums=`Жителей ${a.popStart} → ${a.popEnd} · рождений ${a.births} · смертей ${deaths}${causes} · новых домов ${Math.max(0,a.homes)} · урожаев ${a.harvest} · дружб ${a.friend} · ссор ${a.quarrel} · краж ${a.theft}`;
  const notes=a.notes.length?`<ul>${a.notes.slice(0,25).map(n=>`<li>${n}</li>`).join('')}${a.notes.length>25?`<li class="dead">и ещё ${a.notes.length-25}</li>`:''}</ul>`:'';
  return `<details ${current?'open':''}><summary><b>${current?'Идёт':''} ${a.y}-й год</b> · ${current?'пока ':''}${a.title.toLowerCase()} <span class="dead">· дни ${a.d1}–${a.d2}</span></summary><div class="nums">${nums}</div>${notes}</details>`;
}
function renderAnnals(){
  const y=Math.floor(minutes/YEAR_LEN)+1;
  const rows=dayStats.filter(r=>r.d>(y-1)*DAYS_PER_YEAR);
  const cur=yearSummary(y,rows,yearNotes);
  annalsEl.querySelector('.list').innerHTML=annalHtml(cur,true)+annals.slice().reverse().map(a=>annalHtml(a,false)).join('');
}
document.getElementById('annalsBtn').onclick=()=>{annalsEl.style.display='flex';renderAnnals();};
annalsEl.addEventListener('click',e=>{if(e.target===annalsEl||e.target.id==='annalsClose')annalsEl.style.display='none';});

/* ---------- знаменитости ---------- */
const fameEl=document.getElementById('fame');
function descendants(p){
  let all=0,live=0;const seen=new Set(),st=[...(p.kids||[])];
  while(st.length){const id=st.pop();if(seen.has(id))continue;seen.add(id);const k=byId.get(id);if(!k)continue;all++;if(!k.dead)live++;st.push(...(k.kids||[]));}
  return {all,live};
}
const SKILL_TITLE={build:'Лучший строитель',gather:'Лучший собиратель',farm:'Лучший огородник',fish:'Лучший рыбак',hunt:'Лучший охотник',craft:'Лучший мастер'};
function fameTop(list,val,n=3){return list.map(p=>({p,v:val(p)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,n);}
function fameData(){
  const cats=[];
  cats.push({t:villages.length>1?'Старосты':'Староста',top:villages.map(v=>alive(v.chief)).filter(Boolean).map(p=>({p,v:1})),fmt:x=>{const v=chiefVillage(x.p);return `${villages.length>1?v.name+', ':''}с ${v.chiefSince}-го дня${x.p.fame.peace?`, помирил${x.p.fem?'а':''} ${x.p.fame.peace}`:''}`;}});
  cats.push({t:'Самый старый',top:fameTop(people,p=>age(p)),fmt:x=>years(Math.floor(x.v))});
  const fam=[...byId.values()].map(p=>({p,d:descendants(p)})).filter(x=>x.d.live>0).sort((a,b)=>b.d.live-a.d.live||b.d.all-a.d.all).slice(0,3);
  cats.push({t:'Самая большая семья',top:fam.map(x=>({p:x.p,v:x.d.live,all:x.d.all})),fmt:x=>`потомков ${x.v}${x.all>x.v?` (всего было ${x.all})`:''}`});
  for(const [k] of SKILLS)cats.push({t:SKILL_TITLE[k],top:fameTop(people,p=>p.sk[k]>=0.3?p.sk[k]:0),fmt:x=>`${skillWord(x.p,x.v)}, ${Math.round(x.v*100)}`});
  cats.push({t:'Главный задира',top:fameTop(people,p=>p.fame.q),fmt:x=>`ссор ${x.v}`});
  cats.push({t:'Самый добрый',top:fameTop(people,p=>p.fame.treat+p.fame.help),fmt:x=>`угощений ${x.p.fame.treat}, помощи ${x.p.fame.help}`});
  cats.push({t:'Любимец деревни',top:fameTop(people.filter(p=>p.known>=3&&!isChild(p)),p=>p.rep),fmt:x=>`репутация +${x.v}`});
  cats.push({t:'Изгой',top:fameTop(people.filter(p=>p.known>=3&&!isChild(p)),p=>-p.rep),fmt:x=>`репутация ${x.p.rep}`});
  cats.push({t:'Главный вор',top:fameTop(people,p=>p.fame.theft),fmt:x=>`краж ${x.v}, попался ${x.p.fame.caught}`});
  return cats;
}
function renderFame(){
  fameEl.querySelector('.list').innerHTML=fameData().map(c=>`<div class="fc"><div class="ft">${c.t}</div>${c.top.length?c.top.map((x,i)=>`<div class="${i?'fr2':'fr1'}">${nameLink(x.p.id)} <span class="dead">${c.fmt(x)}</span></div>`).join(''):'<div class="dead">пока никого</div>'}</div>`).join('');
}
document.getElementById('fameBtn').onclick=()=>{fameEl.style.display='flex';renderFame();};
fameEl.addEventListener('click',e=>{
  if(e.target===fameEl||e.target.id==='fameClose'){fameEl.style.display='none';return;}
  const id=e.target.dataset&&e.target.dataset.id;
  if(id!==undefined){fameEl.style.display='none';selectPerson(id);}
});

/* ---------- цикл ---------- */
let last=performance.now(),cardT=0;
const WEATHER_NAMES={storm:'гроза',blizzard:'метель'};
function loop(now){
  const dt=Math.min(0.1,(now-last)/1000);last=now;
  for(let i=0;i<speed;i++)step(dt*MIN_PER_SEC);
  if(speed)animT+=dt;
  if(follow&&selected){cam.x+=(selected.x-cam.x)*0.08;cam.y+=(selected.y-cam.y)*0.08;}
  draw();
  document.getElementById('clock').textContent=`День ${day()}, ${fmtTime(minutes)} · ${SEASON_NAMES[season()]}`;
  document.getElementById('wx').textContent=[weather&&WEATHER_NAMES[weather.type],drought>minutes&&'засуха'].filter(Boolean).join(' · ');
  document.getElementById('pop').textContent=`👥 ${people.length}`;
  cardT+=dt;if(cardT>0.3){cardT=0;if(selected)updateCard();}
  requestAnimationFrame(loop);
}
if(TEST||!load())newWorld();
if(TEST)speed=0;
setSpeed(speed);requestAnimationFrame(loop);
