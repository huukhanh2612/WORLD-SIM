/*
 * WORLD-SIM — A living world simulation
 * Copyright © 2026 PHAN HỮU KHÁNH
 * All rights reserved.
 * V0.7 — WORLD ENGINE: địa hình, sinh thái, dân cư, quốc gia, chiến tranh.
 */

const OWNER = "PHAN HỮU KHÁNH";
const VERSION = "V0.7";

const game = {
    year: 1, worldName: "THẾ GIỚI", population: [], settlements: [], countries: [], wars: [], events: [],
    terrain: { land: [], forests: [], mountains: [], lakes: [], rivers: [] }, settings: { population: 100, resources: 1, climate: "temperate" },
    paused: true, timer: null, generation: 1, nextPerson: 1, nextSettlement: 1, nextCountry: 1, nextWar: 1,
    countryColors: ["#c95b55", "#5b82c9", "#d29a4c", "#6eaa69", "#9a68b8", "#4f9c9c", "#b86f92", "#8c8750"]
};

const SETTLEMENT_NAMES = ["An Lạc","Bình Minh","Hòa Sơn","Thanh Hà","Phú An","Tân Lộc","Minh Châu","Vạn Phúc","Nam Sơn","Đông Hải","Trường An","Thiên Phúc","Đại Sơn","Thịnh Vượng","Hải Bình"];
const COUNTRY_NAMES = ["Vương quốc An Lạc","Liên bang Bình Minh","Đế quốc Trường Sơn","Vương quốc Hải Nam","Đại Việt Sơn","Liên minh Minh Châu","Vương quốc Thanh Hà","Đế quốc Vạn Phúc"];

function rnd(a,b){return Math.random()*(b-a)+a}
function ri(a,b){return Math.floor(rnd(a,b+1))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function alive(){return game.population.filter(p=>p.alive)}
function fmt(n){return Math.round(n).toLocaleString("vi-VN")}
function pick(a){return a[ri(0,a.length-1)]}
function nameFrom(list){return pick(list)+" "+ri(1,99)}
function getSettlement(id){return game.settlements.find(s=>s.id===id)}
function getCountry(id){return game.countries.find(c=>c.id===id)}
function event(text, important=false){game.events.unshift({year:game.year,text,important});if(game.events.length>100)game.events.pop()}

class Person {
    constructor(id,x,y,age=ri(16,34)) { this.id=id;this.x=x;this.y=y;this.age=age;this.alive=true;this.health=ri(80,100);this.settlement=null;this.country=null; }
}

/* ========================= WORLD MAP ========================= */
function createTerrain(){
    const t=game.terrain, W=64,H=40;t.land=[];t.forests=[];t.mountains=[];t.lakes=[];t.rivers=[];
    const continents=[
        {x:.28,y:.43,rx:.25,ry:.31},{x:.63,y:.32,rx:.24,ry:.20},{x:.62,y:.70,rx:.29,ry:.17},{x:.84,y:.66,rx:.09,ry:.13}
    ];
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const nx=(x+.5)/W,ny=(y+.5)/H;
        let score=0;for(const c of continents)score=Math.max(score,1-Math.hypot((nx-c.x)/c.rx,(ny-c.y)/c.ry));
        score+=Math.sin(nx*18+ny*7)*.035+Math.sin(nx*37-ny*12)*.025;
        t.land.push(score>.12);
    }
    const landAt=(x,y)=>{const gx=Math.floor(x*W),gy=Math.floor(y*H);return gx>=0&&gy>=0&&gx<W&&gy<H&&t.land[gy*W+gx]};
    for(let i=0;i<30;i++){let x=rnd(.07,.93),y=rnd(.08,.92);if(landAt(x,y)&&!t.mountains.some(m=>dist(m,{x,y})<.06))t.mountains.push({x,y,r:rnd(.018,.045),h:ri(1,3)})}
    for(let i=0;i<38;i++){let x=rnd(.05,.95),y=rnd(.06,.94);if(landAt(x,y)&&!t.mountains.some(m=>dist(m,{x,y})<m.r*1.8))t.forests.push({x,y,r:rnd(.018,.055),trees:ri(10,20)})}
    for(let i=0;i<8;i++){let x=rnd(.12,.88),y=rnd(.12,.88);if(landAt(x,y))t.lakes.push({x,y,r:rnd(.012,.028)})}
    for(let i=0;i<7;i++){let sx=rnd(.12,.88),sy=rnd(.08,.35),ex=clamp(sx+rnd(-.12,.12),.05,.95),ey=clamp(sy+rnd(.35,.55),.45,.98);if(landAt(sx,sy))t.rivers.push({sx,sy,ex,ey})}
    game.isLand=landAt;
}

function drawWorld(){
    if(!canvas)return;const w=canvas.clientWidth,h=canvas.clientHeight,ctx=window._worldCtx||canvas.getContext("2d");
    ctx.clearRect(0,0,w,h);
    const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#123c59");g.addColorStop(1,"#081f34");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    const W=64,H=40;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(game.terrain.land[y*W+x]){
        const px=x*w/W,py=y*h/H,c=game.settings.climate==="dry"?"#77714b":game.settings.climate==="wet"?"#416f48":"#4d7143";
        ctx.fillStyle=c;ctx.fillRect(px,py,w/W+1,h/H+1);
    }
    /* soft terrain texture */
    ctx.globalAlpha=.13;for(let i=0;i<260;i++){const x=rnd(0,w),y=rnd(0,h);if(game.isLand(x/w,y/h)){ctx.fillStyle="#d5c38a";ctx.beginPath();ctx.arc(x,y,rnd(.5,2),0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1;
    /* forests */
    for(const f of game.terrain.forests)if(game.isLand(f.x,f.y)){for(let i=0;i<f.trees;i++){const a=Math.random()*6.28,r=Math.sqrt(Math.random())*f.r,x=(f.x+Math.cos(a)*r)*w,y=(f.y+Math.sin(a)*r)*h;if(!game.isLand(x/w,y/h))continue;ctx.fillStyle="#214c2c";ctx.beginPath();ctx.arc(x,y,3.5,0,6.28);ctx.fill();ctx.fillStyle="#397447";ctx.beginPath();ctx.arc(x-1,y-2,2.7,0,6.28);ctx.fill()}}}
    /* mountains */
    for(const m of game.terrain.mountains)if(game.isLand(m.x,m.y)){const x=m.x*w,y=m.y*h,s=m.r*Math.min(w,h);for(let k=0;k<m.h;k++){const ox=(k-1)*s*.55;ctx.fillStyle=k===0?"#4d554f":"#68736a";ctx.beginPath();ctx.moveTo(x+ox,y-s*(1-k*.16));ctx.lineTo(x+ox-s*.9,y+s*.55);ctx.lineTo(x+ox+s*.9,y+s*.55);ctx.closePath();ctx.fill();ctx.fillStyle="#d8ddd8";ctx.beginPath();ctx.moveTo(x+ox,y-s*(1-k*.16));ctx.lineTo(x+ox-s*.22,y-s*.28);ctx.lineTo(x+ox+s*.18,y-s*.20);ctx.lineTo(x+ox+s*.5,y+s*.15);ctx.closePath();ctx.fill()}}
    /* lakes */
    for(const l of game.terrain.lakes)if(game.isLand(l.x,l.y)){ctx.fillStyle="#276c88";ctx.beginPath();ctx.ellipse(l.x*w,l.y*h,l.r*w,l.r*h,0,0,6.28);ctx.fill();ctx.strokeStyle="#67a9bd";ctx.stroke()}
    /* rivers */
    ctx.strokeStyle="#65b7d4";ctx.lineWidth=2;for(const r of game.terrain.rivers){ctx.beginPath();ctx.moveTo(r.sx*w,r.sy*h);ctx.bezierCurveTo((r.sx+.08)*w,(r.sy+.14)*h,(r.ex-.08)*w,(r.ey-.15)*h,r.ex*w,r.ey*h);ctx.stroke()}
    /* country territories: soft circles around settlements */
    for(const c of game.countries){ctx.globalAlpha=.18;ctx.fillStyle=c.color;for(const s of game.settlements.filter(s=>s.country===c.id)){ctx.beginPath();ctx.arc(s.x*w,s.y*h,.075*Math.min(w,h),0,6.28);ctx.fill()}ctx.globalAlpha=1}
    /* war front */
    for(const war of game.wars){const a=getCountry(war.a),b=getCountry(war.b);if(!a||!b)continue;const sa=game.settlements.filter(s=>s.country===a.id),sb=game.settlements.filter(s=>s.country===b.id);if(!sa.length||!sb.length)continue;let A=sa[0],B=sb[0],md=999;for(const x of sa)for(const y of sb){const d=dist(x,y);if(d<md){md=d;A=x;B=y}}ctx.strokeStyle="#ff4e4e";ctx.lineWidth=4;ctx.setLineDash([8,6]);ctx.beginPath();ctx.moveTo(A.x*w,A.y*h);ctx.lineTo(B.x*w,B.y*h);ctx.stroke();ctx.setLineDash([])}
    /* settlements */
    for(const s of game.settlements){const c=getCountry(s.country),x=s.x*w,y=s.y*h;ctx.fillStyle=c?c.color:"#d9c27b";ctx.beginPath();ctx.arc(x,y,Math.max(4,Math.min(9,3+s.population/18)),0,6.28);ctx.fill();ctx.strokeStyle="#f4e8c5";ctx.lineWidth=1;ctx.stroke();if(s.population>=25){ctx.fillStyle="#eee6c9";ctx.fillRect(x-2,y-11,4,8);ctx.fillRect(x-5,y-7,10,2)}}
    /* people */
    for(const p of alive()){const x=p.x*w,y=p.y*h;ctx.fillStyle=p.country?getCountry(p.country)?.color||"#f0eee3":"#f3ead1";ctx.beginPath();ctx.arc(x,y,1.6,0,6.28);ctx.fill()}
    /* labels */
    ctx.font="11px Arial";ctx.textAlign="center";for(const s of game.settlements.filter(s=>s.population>=18)){const c=getCountry(s.country);ctx.fillStyle="#fff";ctx.shadowColor="#000";ctx.shadowBlur=4;ctx.fillText(s.name,s.x*w,s.y*h-13);ctx.shadowBlur=0;if(c&&c.settlements[0]===s.id){ctx.font="bold 12px Arial";ctx.fillStyle=c.color;ctx.fillText(c.name,s.x*w,s.y*h+19);ctx.font="11px Arial"}}}
}

/* ========================= SIMULATION ========================= */
function createWorld(){
    stop();game.year=1;game.population=[];game.settlements=[];game.countries=[];game.wars=[];game.events=[];game.generation=1;game.nextPerson=1;game.nextSettlement=1;game.nextCountry=1;game.nextWar=1;createTerrain();
    for(let i=0;i<game.settings.population;i++){let x,y;do{x=rnd(.08,.92);y=rnd(.08,.92)}while(!game.isLand(x,y)||game.terrain.mountains.some(m=>dist(m,{x,y})<m.r));game.population.push(new Person(game.nextPerson++,x,y))}
    event(`Thế giới ${game.worldName} được hình thành.`,true);event(`${game.settings.population} con người đầu tiên xuất hiện. Không có quốc gia nào tồn tại.`,true);event("Thiên nhiên đã có trước nền văn minh: biển, đồng bằng, rừng, núi, hồ và sông.");update();resizeCanvas();start();
}
function start(){stop();game.paused=false;updatePause();game.timer=setInterval(()=>{if(!game.paused){simulateYear();update();drawWorld()}},900)}
function stop(){if(game.timer){clearInterval(game.timer);game.timer=null}}
function togglePause(){game.paused=!game.paused;updatePause();const h=document.getElementById("mapHint");if(h)h.textContent=game.paused?"Thời gian đã tạm dừng.":"Thế giới đang tự vận động..."}
function updatePause(){const t=game.paused?"▶ TIẾP TỤC":"⏸ TẠM DỪNG";const a=document.getElementById("pauseButton"),b=document.getElementById("mobilePause");if(a)a.textContent=t;if(b)b.textContent=game.paused?"▶":"⏸"}
function runYears(n){for(let i=0;i<n;i++)simulateYear();update();drawWorld()}

function simulateYear(){game.year++;if(game.year%25===0)game.generation++;people();settlements();formCountries();wars();history()}
function people(){
    const food=game.settings.resources*(game.settings.climate==="temperate"?1.08:game.settings.climate==="wet"?1:.95);
    const living=alive();for(const p of living){p.age++;p.health=clamp(p.health+rnd(-1.5,1.5),0,100);let death=0;if(p.age>78)death=.006+(p.age-78)*.012;if(p.age>90)death=.35;if(p.health<15)death+=.006;if(food<.65)death+=.004;if(Math.random()<death)p.alive=false}
    const adults=alive().filter(p=>p.age>=18&&p.age<=38);const birth=.018*food;
    for(const p of adults){if(Math.random()<birth){const b=new Person(game.nextPerson++,clamp(p.x+rnd(-.014,.014),.03,.97),clamp(p.y+rnd(-.014,.014),.03,.97),0);b.settlement=p.settlement;b.country=p.country;game.population.push(b)}}
    for(const p of alive()){if(Math.random()<.006){const a=rnd(0,6.28),step=rnd(.006,.018),nx=clamp(p.x+Math.cos(a)*step,.02,.98),ny=clamp(p.y+Math.sin(a)*step,.02,.98);if(game.isLand(nx,ny)&&!game.terrain.mountains.some(m=>dist(m,{x:nx,y:ny})<m.r))p.x=nx,p.y=ny}}
    /* population rescue: the world cannot naturally collapse from ordinary randomness */
    const count=alive().length;if(count<Math.max(18,game.settings.population*.18)&&game.year<600){const target=Math.max(18,Math.floor(game.settings.population*.45));for(let i=count;i<target;i++){let x,y;do{x=rnd(.08,.92);y=rnd(.08,.92)}while(!game.isLand(x,y));game.population.push(new Person(game.nextPerson++,x,y,ri(16,35)))}event("Một làn sóng di cư cứu các cộng đồng khỏi nguy cơ tuyệt chủng.",true)}
}
function settlements(){
    for(const s of game.settlements)s.population=alive().filter(p=>p.settlement===s.id).length;
    const unassigned=alive().filter(p=>!p.settlement);
    /* seed settlements early and reliably */
    if(game.settlements.length<3&&game.year>=12){for(let k=0;k<3-game.settlements.length;k++){const p=pick(unassigned.length?unassigned:alive());if(!p)continue;const s={id:game.nextSettlement++,name:nameFrom(SETTLEMENT_NAMES),x:p.x,y:p.y,population:0,age:0,country:null};game.settlements.push(s);for(const q of alive())if(dist(q,s)<.075)q.settlement=s.id;s.population=alive().filter(q=>q.settlement===s.id).length;event(`🏘️ ${s.name} được thành lập.`,true)}}
    for(const p of unassigned){const near=game.settlements.find(s=>dist(s,p)<.065);if(near&&Math.random()<.18)p.settlement=near.id}
    for(const s of game.settlements){s.age++;s.population=alive().filter(p=>p.settlement===s.id).length;if(s.population===0)s.dead=true}
    game.settlements=game.settlements.filter(s=>!s.dead);
    if(game.year%35===0&&game.settlements.length<8){const p=pick(alive());if(p){p.settlement=null;const s={id:game.nextSettlement++,name:nameFrom(SETTLEMENT_NAMES),x:p.x,y:p.y,population:1,age:0,country:null};game.settlements.push(s);for(const q of alive())if(dist(q,s)<.055)q.settlement=s.id;event(`🏕️ Những người di cư lập nên ${s.name}.`)}}
}
function formCountries(){
    /* deterministic civilization milestones */
    for(const s of game.settlements){
        if(s.country||s.population<18||s.age<8)continue;
        const countryCount=game.countries.length;
        const shouldCreate=(countryCount===0&&game.year>=80)||(countryCount===1&&game.year>=145)||(countryCount<6&&game.year>=220&&Math.random()<.035);
        if(shouldCreate){const c={id:game.nextCountry++,name:nameFrom(COUNTRY_NAMES),settlements:[s.id],population:s.population,power:s.population*1.4+35,wealth:60,warCooldown:0,color:game.countryColors[(game.countries.length)%game.countryColors.length]};game.countries.push(c);s.country=c.id;for(const p of alive())if(p.settlement===s.id)p.country=c.id;event(`🏰 ${c.name} ra đời từ ${s.name}. Một nhà nước đầu tiên được thành lập.`,true)}}
    for(const c of game.countries){c.population=0;for(const s of game.settlements)if(s.country===c.id)c.population+=s.population;c.power=Math.max(25,c.population*1.35+c.wealth*.35);c.wealth=clamp(c.wealth+rnd(-1,2),10,100);if(c.warCooldown>0)c.warCooldown--}
    /* expansion toward nearby neutral settlements */
    for(const s of game.settlements.filter(s=>!s.country&&s.population>=12)){let best=null,bd=.16;for(const c of game.countries)for(const cs of game.settlements.filter(x=>x.country===c.id)){const d=dist(s,cs);if(d<bd){bd=d;best=c}}if(best&&Math.random()<.10){s.country=best.id;best.settlements.push(s.id);for(const p of alive())if(p.settlement===s.id)p.country=best.id;event(`🌐 ${best.name} mở rộng ảnh hưởng đến ${s.name}.`)}}
}
function wars(){
    if(game.countries.length<2)return;
    for(let i=0;i<game.countries.length;i++)for(let j=i+1;j<game.countries.length;j++){
        const a=game.countries[i],b=game.countries[j];if(a.warCooldown>0||b.warCooldown>0)continue;if(game.wars.some(w=>(w.a===a.id&&w.b===b.id)||(w.a===b.id&&w.b===a.id)))continue;
        let near=false;for(const s of game.settlements.filter(x=>x.country===a.id))for(const t of game.settlements.filter(x=>x.country===b.id))if(dist(s,t)<.25)near=true;
        /* guaranteed first wars once two powers mature */
        const trigger=(game.year>=170&&near)||(game.year>=230&&game.wars.length===0)||(game.year>=320&&near);
        if(trigger){game.wars.push({id:game.nextWar++,a:a.id,b:b.id,age:0,score:0});event(`⚔️ CHIẾN TRANH: ${a.name} tuyên chiến với ${b.name}.`,true);a.warCooldown=35;b.warCooldown=35;return}
    }
    for(const w of [...game.wars]){
        const a=getCountry(w.a),b=getCountry(w.b);if(!a||!b)continue;w.age++;const advantage=a.power-b.power+rnd(-18,18);const winner=advantage>=0?a:b,loser=winner===a?b:a;
        if(Math.random()<.65){w.score+=winner===a?1:-1;winner.power+=rnd(3,8);loser.power=Math.max(15,loser.power-rnd(2,6));const target=pick(game.settlements.filter(s=>s.country===loser.id));if(target&&Math.random()<.25){target.country=winner.id;winner.settlements.push(target.id);loser.settlements=loser.settlements.filter(id=>id!==target.id);for(const p of alive())if(p.settlement===target.id)p.country=winner.id;event(`⚔️ ${winner.name} chiếm ${target.name} từ ${loser.name}.`,true)}event(`⚔️ Một trận chiến giữa ${a.name} và ${b.name}: ${winner.name} giành ưu thế.`)}
        if(w.age>=12||Math.abs(w.score)>=6){const finalWinner=w.score>=0?a:b;event(`🕊️ HÒA ƯỚC: chiến tranh giữa ${a.name} và ${b.name} kết thúc. ${finalWinner.name} có lợi thế.`,true);a.warCooldown=25;b.warCooldown=25;game.wars=game.wars.filter(x=>x.id!==w.id)}
    }
}
function history(){if(game.year%20===0&&game.settlements.length)event(`🌾 ${pick(game.settlements).name} bước vào một mùa sản xuất thuận lợi.`);if(game.year%45===0)event(`🌲 Những khu rừng trở thành nguồn tài nguyên quan trọng của các cộng đồng.`);if(game.year%60===0)event(`📜 Thế hệ ${game.generation} đang thay đổi phong tục và quyền lực trong xã hội.`)}

/* ========================= UI ========================= */
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=typeof v==="number"?fmt(v):v}
function update(){const a=alive();setText("year",game.year);setText("worldName",game.worldName);setText("population",game.population.length);setText("alive",a.length);setText("settlements",game.settlements.length);setText("countries",game.countries.length);setText("generation",game.generation);setText("resourceState",game.settings.resources<1?"Khan hiếm":game.settings.resources>1?"Dồi dào":"Cân bằng");setText("climateState",game.settings.climate==="dry"?"Khô":game.settings.climate==="wet"?"Ẩm":"Ôn hòa");const box=document.getElementById("events");if(box)box.innerHTML=game.events.slice(0,35).map(e=>`<div class="event ${e.important?"important":""}"><b>Năm ${e.year}</b> · ${e.text}</div>`).join("");updatePause()}

const canvas=document.getElementById("worldCanvas");window._worldCtx=canvas?canvas.getContext("2d"):null;
function resizeCanvas(){if(!canvas)return;const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;window._worldCtx.setTransform(d,0,0,d,0,0);drawWorld()}
window.addEventListener("resize",resizeCanvas);

/* ========================= CONTROLS ========================= */
document.getElementById("startButton")?.addEventListener("click",()=>{document.getElementById("introScreen").classList.add("hidden");document.getElementById("setupScreen").classList.remove("hidden")});
document.getElementById("backToIntro")?.addEventListener("click",()=>{document.getElementById("setupScreen").classList.add("hidden");document.getElementById("introScreen").classList.remove("hidden")});
document.getElementById("populationInput")?.addEventListener("input",e=>{document.getElementById("populationValue").textContent=e.target.value});
function setupChoices(id,cb){document.querySelectorAll(`#${id} button`).forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(`#${id} button`).forEach(x=>x.classList.remove("selected"));b.classList.add("selected");cb(b.dataset.value)}))}
setupChoices("resourceChoices",v=>game.settings.resources=Number(v));setupChoices("climateChoices",v=>game.settings.climate=v);
document.getElementById("createWorldButton")?.addEventListener("click",()=>{game.worldName=(document.getElementById("worldNameInput").value.trim()||"THẾ GIỚI").toUpperCase();game.settings.population=Number(document.getElementById("populationInput").value);document.getElementById("setupScreen").classList.add("hidden");document.getElementById("gameScreen").classList.remove("hidden");createWorld()});
document.getElementById("pauseButton")?.addEventListener("click",togglePause);document.getElementById("mobilePause")?.addEventListener("click",togglePause);document.getElementById("clearEvents")?.addEventListener("click",()=>{game.events=[];update()});
document.addEventListener("keydown",e=>{if(e.code==="Space"&&document.getElementById("gameScreen")&&!document.getElementById("gameScreen").classList.contains("hidden")){e.preventDefault();togglePause()}});
resizeCanvas();
