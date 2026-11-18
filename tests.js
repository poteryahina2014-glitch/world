// Автотесты «Живого мира». Запуск: index.html?test
// Сохранение мира в тестах пишется в отдельный ключ livingWorld.test, настоящий мир не трогается.
(function(){
const out=[];let fails=0,warns=0;
const panel=document.createElement('div');panel.id='tests';panel.className='panel';document.body.append(panel);
const show=()=>{panel.textContent=out.join('\n');};
const line=s=>{out.push(s);show();};
const STEP=0.25,STEPS_PER_DAY=1440/STEP;
const VALID_STATES=['idle','move','talk','sleep','shelter','eat','pick','chop','build','farm','fishing','plant','craft'];

function invariants(){
  const e=[];
  for(const v of villages){const c=v.chief===null?null:alive(v.chief);if(v.chief!==null&&(!c||c.village!==v.id))e.push(`староста деревни ${v.name} не живёт в ней`);}
  const vids=new Set(villages.map(v=>v.id));
  for(const p of people)if(!vids.has(p.village))e.push(`${p.name}: нет деревни ${p.village}`);
  for(const h of houses)if(!vids.has(h.village))e.push(`дом ${h.id}: нет деревни`);
  for(const p of people)if(p.state!=='move'&&!p.inHouse&&inWater(p.x,p.y,0)&&!nearCrossing(p))e.push(`${p.name}: стоит в воде (${p.state})`);
  if(people.filter(p=>p.repSt==='fav').length>3)e.push('любимцев больше трёх');
  if(people.length>MAX_POP+5)e.push(`жителей ${people.length} > ${MAX_POP}`);
  for(const p of people){
    if(!isFinite(p.x)||!isFinite(p.y))e.push(`${p.name}: координаты не число`);
    else if(p.x<0||p.x>W||p.y<0||p.y>H)e.push(`${p.name}: вышел за край (${Math.round(p.x)},${Math.round(p.y)})`);
    for(const k of ['hunger','energy','social'])if(!(p[k]>=0&&p[k]<=100))e.push(`${p.name}: ${k}=${p[k]}`);
    for(const k in p.sk)if(!(p.sk[k]>=0&&p.sk[k]<=1))e.push(`${p.name}: навык ${k}=${p.sk[k]}`);
    if(!VALID_STATES.includes(p.state))e.push(`${p.name}: странное состояние ${p.state}`);
    if(p.inHouse&&!['sleep','shelter'].includes(p.state))e.push(`${p.name}: в доме, но ${p.state}`);
    if(p.state==='move'&&!p.goal)e.push(`${p.name}: идёт без цели`);
    for(const id in p.heard)if(!(Math.abs(p.heard[id])<=40))e.push(`${p.name}: слух ${p.heard[id]}`);
    if(!Array.isArray(p.news)||p.news.length>NEWS_MAX)e.push(`${p.name}: новостей ${p.news&&p.news.length}`);
    if(!['','out','fav'].includes(p.repSt)||!isFinite(p.rep))e.push(`${p.name}: репутация ${p.repSt} ${p.rep}`);
    for(const id in p.rel){
      const v=p.rel[id];if(!(v>=-100&&v<=100))e.push(`${p.name}: отношение ${v}`);
      const o=alive(+id);if(o&&Math.abs((o.rel[p.id]||0)-v)>1e-6)e.push(`${p.name}/${o.name}: отношения несимметричны`);
    }
    if(p.partner!==null){
      const q=alive(p.partner);
      if(!q)e.push(`${p.name}: пара умерла, но записана`);
      else{if(q.partner!==p.id)e.push(`${p.name}: пара не взаимна`);if(q.fem===p.fem)e.push(`${p.name}: пара одного пола`);
        if(p.parents.includes(q.id)||q.parents.includes(p.id))e.push(`${p.name}: пара с родителем`);}
    }
    if(p.home!==null&&!houses.some(h=>h.id===p.home))e.push(`${p.name}: дом не существует`);
    if(p.carryFood<0||p.carryFood>20)e.push(`${p.name}: несёт ${p.carryFood} еды`);
  }
  for(const h of houses){
    const need=NEED[h.type||'home'],cap=CAP[h.type==='store'?'store':'home'];
    if(h.progress>need)e.push(`дом ${h.id}: прогресс ${h.progress}>${need}`);
    if(h.built!==(h.progress>=need))e.push(`дом ${h.id}: built не совпадает с прогрессом`);
    if(!(h.food>=0&&h.food<=cap))e.push(`дом ${h.id}: запас ${h.food}`);
    for(const o of houses)if(o.id<h.id&&Math.hypot(o.x-h.x,o.y-h.y)<90)e.push(`постройки ${o.id} и ${h.id} налезают`);
  }
  for(const pl of plots){
    if(!houses.some(h=>h.id===pl.house))e.push(`грядка ${pl.id}: нет дома`);
    if(!(pl.growth>=0&&pl.growth<=1&&pl.water>=0&&pl.water<=100&&pl.weeds>=0&&pl.weeds<=100&&pl.health>=0&&pl.health<=1))e.push(`грядка ${pl.id}: странные числа`);
    if(!['site','empty','growing','ripe','dead'].includes(pl.stage))e.push(`грядка ${pl.id}: стадия ${pl.stage}`);
    for(const h of houses)if(Math.abs(h.x-pl.x)<50&&Math.abs(h.y-pl.y)<42)e.push(`грядка ${pl.id} налезает на постройку ${h.id}`);
    for(const o of plots)if(o.id<pl.id&&Math.abs(o.x-pl.x)<PLOT_W&&Math.abs(o.y-pl.y)<PLOT_H)e.push(`грядки ${o.id} и ${pl.id} налезают`);
  }
  for(const t of trees){
    if(!(t.wood>=0&&t.wood<=TREE_WOOD))e.push(`дерево: брёвен ${t.wood}`);
    if(!(t.sap>=0&&t.sap<=1))e.push(`дерево: рост саженца ${t.sap}`);
    if(t.sap<1&&t.wood>0)e.push('у саженца есть брёвна');
    if(t.stump&&t.wood>0)e.push('у пенька есть брёвна');
  }
  if(hares.length>HARE_MAX+2)e.push(`зайцев ${hares.length}`);
  for(const h of hares)if(!isFinite(h.x)||h.x<0||h.x>W||h.y<0||h.y>H)e.push(`заяц ${h.id} за краем`);
  for(const p of people)for(const k in p.tools){if(!TOOLS[k]||!(p.tools[k]>0&&p.tools[k]<=TOOL_USES))e.push(`${p.name}: инструмент ${k}=${p.tools[k]}`);}
  for(const h of houses)if(goodsCount(h)>GOODS_MAX||Object.values(h.goods||{}).some(n=>n<0))e.push(`дом ${h.id}: изделий ${goodsCount(h)}`);
  for(const b of bushes)if(!(b.b>=0&&b.b<=8))e.push(`куст: ягод ${b.b}`);
  const crowd=new Map();for(const p of people)if(p.goal&&p.goal.tree)crowd.set(p.goal.tree,(crowd.get(p.goal.tree)||0)+1);
  for(const n of crowd.values())if(n>2)e.push(`у одного дерева ${n} жителей`);
  return e;
}

function runWorld(days,opt){
  newWorld();
  settings.wanderers=!!opt.wanderers;settings.events=opt.events!==false;
  const st={births:0,old:0,hunger:0,sick:0,quarrel:0,friend:0,theft:0,share:0,skilled:0,houses:0,fire:0,store:0,pop:[],errors:[],stuck:[],extinct:0,peak:0,firstHouse:0,
    harvests:0,veg:0,dried:0,frozen:0,plotTheft:0,bites:0,fences:0,crafted:0,cut:0,firstHarvest:0,atCap:0,gossip:0,defend:0,out:0,fav:0,elect:0,reelect:0,found:0,moved:0,fishN:0,tradeN:0,piers:0,peace:0,dole:0,greed:0,firstChief:0};
  const origFinish=finishFarm;
  finishFarm=(p,pl,task)=>{const was=pl.stage;origFinish(p,pl,task);if(task==='harvest'&&was==='ripe'){st.harvests++;st.veg+=p.carryFood/VEG_VALUE;if(!st.firstHarvest)st.firstHarvest=day();}};
  const orig=addLog;
  addLog=(ps,t)=>{
    if(t.includes('родил'))st.births++;
    if(t.includes('от старости'))st.old++;
    if(t.includes('от голода'))st.hunger++;
    if(t.includes('от болезни'))st.sick++;
    if(t.includes('поссорились'))st.quarrel++;
    if(t.includes('подружились'))st.friend++;
    if(t.includes('украл')||t.includes('тайком'))st.theft++;
    if(t.includes('угостил'))st.share++;
    if(t.includes('стал умел')||t.includes('стала умел'))st.skilled++;
    if(t.includes('достроили дом')){st.houses++;if(!st.firstHouse)st.firstHouse=day();}
    if(t.includes('костёр готов'))st.fire=day();
    if(t.includes('кладовка готова'))st.store=day();
    if(t.includes('засох'))st.dried++;
    if(t.includes('замёрз'))st.frozen++;
    if(t.includes('репку с чужого'))st.plotTheft++;
    if(t.includes('Зайцы погрызли'))st.bites++;
    if(t.includes('вырубили'))st.cut++;
    if(t.includes('судачат'))st.gossip++;
    if(t.includes('основали деревню'))st.found++;
    if(t.includes('перебрались в деревню'))st.moved++;
    if(t.includes('ед. еды из деревни'))st.tradeN++;
    if(t.includes('Пристань с лодкой готова'))st.piers++;
    if(/выбрала старосту|Новый староста/.test(t)){st.elect++;if(!st.firstChief)st.firstChief=day();}
    if(t.includes('снова староста'))st.reelect++;
    if(/Староста .* помирил(а)?:/.test(t))st.peace++;
    if(t.includes('самым голодным'))st.dole++;
    if(t.includes('себе и друзьям'))st.greed++;
    if(t.includes('заступил'))st.defend++;
    if(/теперь изго/.test(t))st.out++;
    if(/теперь любим/.test(t))st.fav++;
    orig(ps,t);
  };
  const since=new Map();
  try{
    for(let d=0;d<days;d++){
      for(let i=0;i<STEPS_PER_DAY;i++){
        step(STEP);
        if(i%120===0){
          const e=invariants();if(e.length&&st.errors.length<8)st.errors.push(`день ${day()}: ${e.slice(0,3).join('; ')}`);
          for(const p of people){
            const key=p.state+(p.goal?p.goal.kind:'')+'#'+(p.nd||0),s=since.get(p.id);
            if(!s||s.key!==key)since.set(p.id,{key,t:minutes});
            else{
              const lim=p.state==='sleep'?1100:p.state==='shelter'?500:p.state==='idle'?400:700;
              if(minutes-s.t>lim&&st.stuck.length<5){st.stuck.push(`${p.name}: ${key.split('#')[0]} без нового решения ${Math.round(minutes-s.t)} мин`);s.t=minutes;}
            }
          }
        }
      }
      st.pop.push(people.length);st.peak=Math.max(st.peak,people.length);if(people.length>=MAX_POP-2)st.atCap++;
      if(!people.length){st.extinct=day();break;}
    }
  }catch(err){st.crash=err.stack;}
  st.fishN=dayStats.reduce((a,r)=>a+(r.fish||0),0);
  const sum=k=>dayStats.reduce((a,r)=>a+(r[k]||0),0);
  st.plantN=sum('plant');st.huntN=sum('hunt');st.barterN=sum('barter');
  st.forest=dayStats.filter((_,i)=>i%30===29).map(r=>r.trees+'+'+r.saps).join(' ');
  st.fences=plots.filter(pl=>pl.fence).length;st.haresEnd=hares.length;
  st.tools=people.filter(p=>Object.keys(p.tools).length).length;st.craftsmen=people.filter(p=>p.sk.craft>=0.3).length;
  addLog=orig;finishFarm=origFinish;
  return st;
}

function report(name,st,days,opt){
  line(`\n== ${name} ==`);
  if(st.crash){fails++;line('✗ ОШИБКА В КОДЕ:\n'+st.crash);return;}
  const deaths=st.old+st.hunger+st.sick;
  line(`население по 10 дням: ${st.pop.filter((_,i)=>i%10===9).join(' ')} | пик ${st.peak}${st.extinct?` | вымерли на ${st.extinct}-й день`:''}`);
  line(`рождений ${st.births}; смертей ${deaths} (старость ${st.old}, голод ${st.hunger}, болезнь ${st.sick})`);
  line(`дружб ${st.friend}, ссор ${st.quarrel}; угощений ${st.share}, краж ${st.theft}; умелых ${st.skilled}`);
  line(`домов ${st.houses} (первый на ${st.firstHouse||'—'}-й день), костёр ${st.fire||'—'}, кладовка ${st.store||'—'}`);
  line(`урожаев ${st.harvests} (${Math.round(st.veg)} репок, первый на ${st.firstHarvest||'—'}-й день); засохло ${st.dried}, замёрзло ${st.frozen}; краж с огородов ${st.plotTheft}; дней у потолка ${st.atCap} из ${st.pop.length}`);
  line(`деревень основано ${st.found}, переездов ${st.moved}, пристаней ${st.piers}, обозов ${st.tradeN}; рыбы ${st.fishN}`);
  line(`старост ${st.elect} (первый на ${st.firstChief||'—'}-й день, переизбраний ${st.reelect}); помирил ${st.peace}; раздач кладовки ${st.dole}, себе ${st.greed}`);
  line(`слухов ${st.gossip}, заступились ${st.defend}; изгоев ${st.out}, любимцев ${st.fav}`);
  line(`лес (деревья+саженцы каждые 30 дней): ${st.forest}; посажено ${st.plantN}; «вырубили» ${st.cut}`);
  line(`зайцы: погрызли огородов ${st.bites}, заборов ${st.fences}, поймано ${st.huntN}, осталось ${st.haresEnd}`);
  line(`ремёсла: обменов ${st.barterN}, с инструментами ${st.tools} жителей, мастеров (≥30) ${st.craftsmen}`);
  if(st.errors.length){fails++;line('✗ нарушены правила мира:\n  '+st.errors.join('\n  '));}else line('✓ правила мира не нарушались');
  if(st.stuck.length){warns++;line('⚠ застревания:\n  '+st.stuck.join('\n  '));}else line('✓ никто не застревал');
  const w=(c,msg)=>{if(!c){warns++;line('⚠ '+msg);}};
  w(st.extinct||st.elect>0,'за всё время не выбрали старосту');
  w(st.extinct||st.gossip>0,'за всё время никто не посплетничал');
  if(!opt.wanderers)w(!st.extinct||st.extinct>=40,'вымерли слишком рано (раньше 40-го дня)');
  if(opt.wanderers)w(!st.extinct,'вымерли, хотя странники включены');
  w(deaths<4||st.hunger/deaths<=0.4,'больше 40% смертей от голода — зима слишком жестокая');
  w(st.hunger>0||days<60,'за всё время никто не умер от голода — зима, похоже, слишком мягкая');
  w(st.quarrel<=Math.max(10,st.friend*4),'ссор больше чем вчетверо против дружб');
  w(st.firstHouse&&st.firstHouse<=15,'первый дом не достроен к 15-му дню');
  w(st.houses<2||st.fire,'костёр так и не построили');
  w(st.houses<1||(st.firstHarvest&&st.firstHarvest<=25),'первого урожая нет к 25-му дню');
  w(st.atCap===0,`население дошло до страховочного предела ${MAX_POP}`);
  w(st.extinct||st.plantN>0,'за всё время никто не посадил дерево');
  w(st.extinct||st.huntN>0,'за всё время не поймали ни одного зайца');
  w(st.extinct||st.barterN>0,'за всё время не было ни одного обмена');
  w(st.extinct||st.bites===0||st.fences>0,'зайцы грызут огороды, а заборов нет');
}

function perfTest(){
  line('\n== Скорость ==');
  for(const n of [40,150,250]){
    try{
      newWorld();
      while(people.length<n){const w=spawnWanderer();w.x=W/2+rnd(-900,900);w.y=H/2+rnd(-600,600);}
      for(let i=0;i<2000;i++)step(STEP);
      const t0=performance.now(),N=4000;
      for(let i=0;i<N;i++)step(STEP);
      const ms=(performance.now()-t0)/N;
      const t1=performance.now();for(let i=0;i<20;i++)draw();const dms=(performance.now()-t1)/20;
      const frame=ms*10+dms;
      const verdict=frame<16?'✓':frame<33?'⚠':'✗';
      if(verdict==='⚠')warns++;if(verdict==='✗')fails++;
      line(`${verdict} ${people.length} жителей: шаг ${ms.toFixed(2)} мс, рисование ${dms.toFixed(1)} мс → кадр на 10× ≈ ${frame.toFixed(1)} мс (плавно — до 16)`);
    }catch(err){fails++;line('✗ ОШИБКА: '+err.stack);}
  }
  // анимации: зима со следами и дымом, осень с листопадом — рисование при 250 жителях
  try{
    const z0=cam.z;houses.forEach(h=>{h.progress=NEED[h.type];h.built=true;});
    for(const [name,s] of [['осень (листопад, дым)',2],['зима (следы, дым)',3]]){
      minutes=SEASON_LEN*s+12*60;lastSeason=s;for(let i=0;i<2400;i++)step(STEP*2);
      cam.x=W/2;cam.y=H/2;cam.z=0.6;draw();
      const t1=performance.now();for(let i=0;i<20;i++)draw();const dms=(performance.now()-t1)/20;
      const verdict=dms<12?'✓':dms<25?'⚠':'✗';if(verdict==='⚠')warns++;if(verdict==='✗')fails++;
      line(`${verdict} ${name}, ${people.length} жителей: рисование ${dms.toFixed(1)} мс${s===3?`, следов ${tracks.length}`:''} (норма до 12)`);
    }
    cam.z=z0;
  }catch(err){fails++;line('✗ анимации: ОШИБКА '+err.stack);}
}

function farmUnitTest(){
  line('\n== Огород без ухода ==');
  try{
    newWorld();
    const pl={id:nextPlot++,house:-1,x:200,y:200,stage:'growing',growth:0,water:70,weeds:0,health:1};
    houses.push({id:-1,type:'home',x:120,y:120,progress:NEED.home,built:true,owners:[],helpers:[],contrib:{},roof:'#000',food:0});
    plots.push(pl);people=[];
    minutes=SEASON_LEN*1+10;lastSeason=1;
    for(let i=0;i<3000/STEP;i++)updatePlots(STEP);
    const ok=pl.stage==='dead'||pl.health<0.5;
    if(!ok){fails++;line(`✗ огород без ухода остался здоровым: стадия ${pl.stage}, здоровье ${pl.health.toFixed(2)}`);}
    else line(`✓ огород без ухода засыхает (стадия ${pl.stage}, здоровье ${pl.health.toFixed(2)})`);
    const pl2={id:nextPlot++,house:-1,x:300,y:200,stage:'growing',growth:0,water:100,weeds:0,health:1};plots.push(pl2);
    for(let i=0;i<GROW_TIME*1.3/STEP;i++){updatePlots(STEP);if(i%200===0){pl2.water=100;pl2.weeds=0;}}
    if(pl2.stage!=='ripe'){fails++;line(`✗ ухоженный огород не созрел: ${pl2.stage} ${Math.round(pl2.growth*100)}%`);}
    else line('✓ ухоженный огород созревает');
    minutes=SEASON_LEN*3+5;onSeason(3);
    if(pl2.stage!=='dead'){fails++;line('✗ зимой несобранный урожай не замёрз');}else line('✓ зимой несобранный урожай замерзает');
  }catch(err){fails++;line('✗ ОШИБКА: '+err.stack);}
}

function saveLoadTest(){
  line('\n== Сохранение и загрузка ==');
  try{
    newWorld();for(let i=0;i<20*STEPS_PER_DAY;i++)step(STEP);
    const before={n:people.length,h:houses.length,m:minutes,names:people.map(p=>p.name).join(),food:houses.reduce((s,h)=>s+h.food,0)};
    save();
    people=[];houses=[];minutes=0;
    if(!load()){fails++;line('✗ load() вернул false');return;}
    const after={n:people.length,h:houses.length,m:minutes,names:people.map(p=>p.name).join(),food:houses.reduce((s,h)=>s+h.food,0)};
    const same=JSON.stringify(before)===JSON.stringify(after);
    if(!same){fails++;line('✗ после загрузки мир другой: '+JSON.stringify(before)+' → '+JSON.stringify(after));}
    else line('✓ после загрузки тот же мир');
    for(let i=0;i<5*STEPS_PER_DAY;i++)step(STEP);
    const e=invariants();
    if(e.length){fails++;line('✗ после загрузки нарушения: '+e.slice(0,3).join('; '));}else line('✓ после загрузки мир живёт дальше без ошибок');
    localStorage.removeItem(SAVE_KEY);
  }catch(err){fails++;line('✗ ОШИБКА: '+err.stack);}
}

function eventsTest(){
  line('\n== События и вмешательства ==');
  for(const ev of ['storm','blizzard','drought','harvest','sick']){
    try{
      newWorld();for(let i=0;i<10*STEPS_PER_DAY;i++)step(STEP);
      startEvent(ev,true);
      const sheltered=ev==='storm'||ev==='blizzard'?()=>people.filter(p=>p.state==='shelter'||(p.goal&&p.goal.kind==='shelter')).length:null;
      for(let i=0;i<60;i++)step(STEP);
      const sh=sheltered?sheltered():null;
      for(let i=0;i<STEPS_PER_DAY;i++)step(STEP);
      const e=invariants();
      if(e.length){fails++;line(`✗ ${ev}: ${e.slice(0,3).join('; ')}`);}
      else line(`✓ ${ev}${sh!==null?` (прячутся: ${sh} из ${people.length}, домов ${houses.filter(h=>isHome(h)&&h.built).length})`:''}`);
      if(weather&&minutes>weather.until+5){fails++;line(`✗ ${ev}: непогода не закончилась`);}
    }catch(err){fails++;line(`✗ ${ev}: ОШИБКА ${err.stack}`);}
  }
  try{
    newWorld();
    for(let i=0;i<10;i++)document.getElementById('addWanderer').click();
    document.getElementById('harvest').click();document.getElementById('addBush').click();
    for(let i=0;i<2*STEPS_PER_DAY;i++)step(STEP);
    const e=invariants();
    if(e.length){fails++;line('✗ кнопки вмешательства: '+e.slice(0,3).join('; '));}else line(`✓ кнопки вмешательства (жителей ${people.length}, кустов ${bushes.length})`);
  }catch(err){fails++;line('✗ кнопки: '+err.stack);}
  try{
    newWorld();for(let i=0;i<40*STEPS_PER_DAY;i++)step(STEP);
    const p=people.find(x=>x.parents.length)||people[0];
    openTree(p);document.getElementById('tree').style.display='none';
    if(dayStats.length<38)throw new Error(`графикам записано ${dayStats.length} дней из 40`);
    const sumB=dayStats.reduce((s,r)=>s+r.births,0);
    toggleCharts(true);chartHover=10;renderCharts('pop');chartRange='50';renderCharts();chartHover=null;toggleCharts(false);
    line(`✓ графики: записано ${dayStats.length} дней, рождений ${sumB}, рисуются без ошибок`);
    if(annals.length!==5)throw new Error(`за 40 дней в летописи ${annals.length} лет вместо 5`);
    if(annals.some(a=>!a.title||a.d2-a.d1!==DAYS_PER_YEAR-1))throw new Error('у года нет названия или неверные дни');
    const bornAnnals=annals.reduce((s,a)=>s+a.births,0);
    if(bornAnnals!==sumB)throw new Error(`рождений в летописи ${bornAnnals}, а в графиках ${sumB}`);
    document.getElementById('annalsBtn').click();annalsEl.style.display='none';
    line(`✓ летопись: ${annals.map(a=>a.title.toLowerCase()).join(' → ')}`);
    const fd=fameData();document.getElementById('fameBtn').click();fameEl.style.display='none';
    const fsum=k=>people.reduce((s,x)=>s+x.fame[k],0);
    if(people.some(x=>!x.fame||Object.values(x.fame).some(v=>!(v>=0))))throw new Error('у жителя нет счётчиков знаменитостей');
    if(people.some(x=>x.fame.caught>x.fame.theft))throw new Error('попался чаще, чем крал');
    if(people.length&&!fd[0].top.length)throw new Error('нет самого старого');
    const fam=fd[1].top[0];if(fam){const k=fam.p.kids.map(id=>byId.get(id)).filter(x=>x&&!x.dead).length;if(fam.v<k)throw new Error('потомков меньше, чем живых детей');}
    line(`✓ знаменитости: старейший ${fd[0].top[0]?.p.name||'—'}, ссор ${fsum('q')}, угощений ${fsum('treat')}, помощи ${fsum('help')}, краж ${fsum('theft')}`);
    const cats={};for(const e of logArr)cats[e.cat]=(cats[e.cat]||0)+1;
    const samples={'Маша родилась, родители: А и Б':'life','А и Б стали парой':'family','А и Б поссорились из-за ягод':'social','А тайком взяла ягоды из чужого дома (Б)':'social',
      'А и Б достроили дом':'build','А и Б судачат: В, говорят, тащит чужое':'minor','Б заступился за друга: А говорит, что В вздорный':'social','В теперь изгой: в деревне его сторонятся':'social','В теперь любимица деревни':'social','Деревня выбрала старосту: В (5 голосов из 9)':'world','Староста В помирил: А и Б':'world','Б умер от старости, 72 года':'life','Б снова староста (5 голосов из 9)':'world','Наступила зима':'world','Наступил день 5':'minor','А очень голодна':'minor','Итоги 3-го года: урожайный год':'world','богатый урожай: кусты ломятся от ягод':'world','А собрала богатый урожай: 5 репок':'build',
      'А посадила деревце':'minor','А смастерила корзину':'minor','А: сломалась удочка':'minor','А выменял мотыгу за 3 ед. еды: Б и В':'build',
      'Зайцы погрызли огород: Б и В':'build','А поставил забор вокруг огорода':'build','А поймала зайца':'build','Вокруг деревни вырубили почти весь лес':'build'};
    const wrong=Object.entries(samples).filter(([t,c])=>logCat(t)!==c).map(([t,c])=>`«${t}» → ${logCat(t)}, ждали ${c}`);
    if(wrong.length)throw new Error('фильтр хроники путает виды: '+wrong.join('; '));
    const saved={...settings.logCats};for(const k in settings.logCats)settings.logCats[k]=k==='life';rerenderLog();
    const shown=document.getElementById('log').children.length;settings.logCats=saved;rerenderLog();
    if(shown!==(cats.life||0))throw new Error(`фильтр «Жизнь и смерть» показал ${shown}, а таких записей ${cats.life||0}`);
    logSearch=makeSearch('Аня');
    const hit=logPasses({text:'Аня и Петя подружились',cat:'social'}),miss=logPasses({text:'Таня и Петя подружились',cat:'social'});
    logSearch='';
    if(!hit||miss)throw new Error(`поиск «Аня»: нашёл «Аня…» = ${hit}, нашёл «Таня…» = ${miss}`);
    line(`✓ фильтр хроники: ${Object.entries(cats).map(([k,v])=>k+' '+v).join(', ')}`);
    selected=p;updateCard();hideCard();selected=null;
    line(`✓ карточка и родословная открываются (${p.name})`);
  }catch(err){fails++;line('✗ карточка/родословная: '+err.stack);}
}

line('Тесты идут, страница может подвиснуть на минуту…');
setTimeout(()=>{
  const t0=performance.now();
  out.length=0;
  for(let i=1;i<=3;i++)report(`Мир ${i}: 150 дней, без странников`,runWorld(150,{wanderers:false}),150,{wanderers:false});
  report('Мир 4: 150 дней, со странниками',runWorld(150,{wanderers:true}),150,{wanderers:true});
  perfTest();
  farmUnitTest();
  saveLoadTest();
  eventsTest();
  line(`\nИТОГ: ошибок ${fails}, предупреждений ${warns}. Время ${Math.round((performance.now()-t0)/1000)} с.`);
  window.TEST_RESULT={fails,warns,text:out.join('\n')};
  settings.wanderers=false;settings.events=true;
},50);
})();
