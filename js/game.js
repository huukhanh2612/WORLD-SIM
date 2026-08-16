/*
 * WORLD-SIM — A living world simulation
 * Copyright © 2026 PHAN HỮU KHÁNH
 * All rights reserved.
 * V0.6 — địa hình có quy tắc, sinh thái, văn minh và chiến tranh.
 */

const OWNER = "PHAN HỮU KHÁNH";
const VERSION = "V0.6";
const game = {
  year:1, worldName:"THẾ GIỚI", population:[], settlements:[], countries:[], wars:[], events:[],
  terrain:{land:[], forests:[], mountains:[], rivers:[], lakes:[]},
  settings:{population:100,resources:1,climate:"temperate"}, paused:true,timer:null,generation:1,
  nextId:1,nextSettlement:1,nextCountry:1,nextWar:1
};

const names={
  settlement:["An Lạc","Bình Minh","Hòa Sơn","Thanh Hà","Phú An","Tân Lộc","Minh Châu","Vạn Phúc","Nam Sơn","Đông Hải","Trường An","Thiên Phúc"],
  country:["Vương quốc An Lạc","Liên bang Bình Minh","Đế quốc Trường Sơn","Vương quốc Hải Nam","Đại Việt Sơn","Liên minh Minh Châu","Vương quốc Thanh Hà","Đế quốc Vạn Phúc"]
};
function rnd(a,b){return Math.random()*(b-a)+a} function ri(a,b){return Math.floor(rnd(a,b+1))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))} function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function alive(){return game.population.filter(p=>p.alive)} function fmt(n){return Math.round(n).toLocaleString("vi-VN")}
function event(text,important=false){game.events.unshift({year:game.year,text,important});if(game.events.length>100)game.events.pop()}
function unique(arr){return arr[ri(0,arr.length-1)]+" "+ri(1,99)}

class Person{constructor(id,x,y,age=ri(16,38)){this.id=id;this.x=x;this.y=y;this.age=age;this.alive=true;this.health=ri(70,100);this.settlement=null;this.country=null}}

function createTerrain(){
  const t=game.terrain;t.land=[];t.forests=[];t.mountains=[];t.rivers=[];t.lakes=[];
  // Land is a coherent archipelago generated from smooth elliptical continents.
  const continents=[
    {x:.30,y:.45,rx:.24,ry:.30},{x:.67,y:.38,rx:.25,ry:.22},{x:.58,y:.72,rx:.30,ry:.16},{x:.82,y:.72,rx:.10,ry:.12}
  ];
  for(let y=0;y<28;y++)for(let x=0;x<42;x++){
    const nx=(x+.5)/42,ny=(y+.5)/28;
    let score=continents.reduce((s,c)=>s+Math.max(0,1-Math.hypot((nx-c.x)/c.rx,(ny-c.y)/c.ry)),0);
    t.land.push(score>.22);
  }
  const landAt=(x,y)=>{let gx=Math.floor(x*42),gy=Math.floor(y*28);if(gx<0||gy<0||gx>=42||gy>=28)return false;return t.land[gy*42+gx]};
  for(let i=0;i<18;i++){let x=rnd(.08,.92),y=rnd(.08,.9);if(landAt(x,y))t.mountains.push({x,y,r:rnd(.018,.045)})}
  for(let i=0;i<26;i++){let x=rnd(.08,.92),y=rnd(.08,.9);if(landAt(x,y)&&!t.mountains.some(m=>dist(m,{x,y})<m.r*2))t.forests.push({x,y,r:rnd(.018,.055),trees:ri(6,15)})}
  for(let i=0;i<5;i++){let x=rnd(.15,.82),y=rnd(.2,.75);if(landAt(x,y))t.lakes.push({x,y,r:rnd(.012,.028)})}
  for(let i=0;i<5;i++){let sx=rnd(.15,.85),sy=rnd(.12,.45);if(landAt(sx,sy))t.rivers.push({sx,sy,ex:sx+rnd(-.12,.12),ey:Math.min(.95,sy+rnd(.28,.55))})}
  game.isLand=landAt;
}
function drawLand(ctx,w,h){
  const t=game.terrain;
  ctx.fillStyle="#12324a";ctx.fillRect(0,0,w,h);
  // land cells with subtle elevation shading
  for(let y=0;y<28;y++)for(let x=0;x<42;x++)if(t.land[y*42+x]){
    const nx=(x+.5)/42,ny=(y+.5)/28;let edge=0;
    if(x>0&&!t.land[y*42+x-1])edge++;if(x<41&&!t.land[y*42+x+1])edge++;if(y>0&&!t.land[(y-1)*42+x])edge++;if(y<27&&!t.land[(y+1)*42+x])edge++;
    ctx.fillStyle=edge?"#476b3c":"#3f6739";ctx.fillRect(x*w/42,y*h/28,w/42+1,h/28+1);
  }
  // forests only on land
  for(const f of t.forests)if(game.isLand(f.x,f.y)){for(let i=0;i<f.trees;i++){const a=Math.random()*Math.PI*2,r=Math.random()*f.r;const x=(f.x+Math.cos(a)*r)*w,y=(f.y+Math.sin(a)*r)*h;ctx.fillStyle="#183f28";ctx.beginPath();ctx.arc(x,y,2.8,0,Math.PI*2);ctx.fill();ctx.fillStyle="#2e6337";ctx.beginPath();ctx.arc(x-1,y-2,3.5,0,Math.PI*2);ctx.fill()}}
  // mountains only on land
  for(const m of t.mountains)if(game.isLand(m.x,m.y)){const x=m.x*w,y=m.y*h,s=m.r*Math.min(w,h);ctx.fillStyle="#59675c";ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x-s*.9,y+s*.65);ctx.lineTo(x+s*.9,y+s*.65);ctx.closePath();ctx.fill();ctx.fillStyle="#aab5ae";ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x-s*.25,y-s*.25);ctx.lineTo(x+s*.12,y-s*.18);ctx.lineTo(x+s*.9,y+s*.65);ctx.lineTo(x-s*.9,y+s*.65);ctx.closePath();ctx.fill()}
  // lakes
  ctx.fillStyle="#1b5872";for(const l of t.lakes)if(game.isLand(l.x,l.y)){ctx.beginPath();ctx.ellipse(l.x*w,l.y*h,l.r*w,l.r*h,0,0,Math.PI*2);ctx.fill()}
  // rivers flow on land
  ctx.strokeStyle="#5aa6c7";ctx.lineWidth=2;for(const r of t.rivers){ctx.beginPath();ctx.moveTo(r.sx*w,r.sy*h);ctx.bezierCurveTo((r.sx+.08)*w,(r.sy+.12)*h,(r.ex-.06)*w,(r.ey-.12)*h,r.ex*w,r.ey*h);ctx.stroke()}
}

function createWorld(){
  stop();game.year=1;game.population=[];game.settlements=[];game.countries=[];game.wars=[];game.events=[];game.generation=1;game.nextId=1;game.nextSettlement=1;game.nextCountry=1;game.nextWar=1;createTerrain();
  for(let i=0;i<game.settings.population;i++){let x,y;do{x=rnd(.08,.92);y=rnd(.08,.92)}while(!game.isLand(x,y));game.population.push(new Person(game.nextId++,x,y))}
  event(`Thế giới ${game.worldName} được hình thành.`,true);event(`${game.settings.population} con người đầu tiên xuất hiện trên các vùng đất có thể sinh sống.`,true);event("Rừng, sông, núi và nguồn nước đã hình thành trước khi nền văn minh xuất hiện.");
  update();resizeCanvas();start();
}
function start(){stop();game.paused=false;updatePause();game.timer=setInterval(()=>{if(!game.paused){simulateYear();update();draw()}},1000)}
function stop(){if(game.timer){clearInterval(game.timer);game.timer=null}}
function togglePause(){game.paused=!game.paused;updatePause();const h=document.getElementById("mapHint");if(h)h.textContent=game.paused?"Thời gian đã tạm dừng.":"Thế giới đang tự vận động..."}
function updatePause(){const text=game.paused?"▶ TIẾP TỤC":"⏸ TẠM DỪNG";const a=document.getElementById("pauseButton"),b=document.getElementById("mobilePause");if(a)a.textContent=text;if(b)b.textContent=game.paused?"▶":"⏸"}
function runYears(n){for(let i=0;i<n;i++)simulateYear();update();draw()}

function simulateYear(){game.year++;if(game.year%25===0)game.generation++;people();settlements();countries();wars();history()}
function people(){
  const food=game.settings.resources*(game.settings.climate==="temperate"?1.08:game.settings.climate==="wet"?1:.9);
  for(const p of alive()){p.age++;p.health=clamp(p.health+rnd(-3,3),0,100);let d=p.age>70?.01+(p.age-70)*.02:0;if(p.health<25)d+=.015;if(food<.7)d+=.01;if(Math.random()<d)p.alive=false}
  const adults=alive().filter(p=>p.age>=18&&p.age<=40);for(const p of adults)if(Math.random()<.018*food){const b=new Person(game.nextId++,clamp(p.x+rnd(-.018,.018),.02,.98),clamp(p.y+rnd(-.018,.018),.02,.98),0);b.settlement=p.settlement;b.country=p.country;game.population.push(b)}
  for(const p of alive()){if(Math.random()<.008){let a=Math.random()*Math.PI*2;p.x=clamp(p.x+Math.cos(a)*.025,.02,.98);p.y=clamp(p.y+Math.sin(a)*.025,.02,.98);if(!game.isLand(p.x,p.y)){p.x=clamp(p.x-Math.cos(a)*.03,.02,.98);p.y=clamp(p.y-Math.sin(a)*.03,.02,.98)}}}
}
function settlements(){
  const free=alive().filter(p=>!p.settlement);for(const p of free){const near=free.filter(q=>dist(p,q)<.045);if(near.length>=6&&!game.settlements.some(s=>dist(s,p)<.06)){const s={id:game.nextSettlement++,name:unique(names.settlement),x:p.x,y:p.y,population:0,age:0,country:null};game.settlements.push(s);for(const q of free)if(dist(s,q)<.06)q.settlement=s.id;event(`🏘️ ${s.name} được hình thành. Những gia đình đầu tiên bắt đầu định cư.`,true)}}
  for(const s of game.settlements){s.population=alive().filter(p=>p.settlement===s.id).length;s.age++;if(s.population===0)s.dead=true}
  game.settlements=game.settlements.filter(s=>!s.dead);
}
function countries(){
  for(const s of game.settlements){if(s.country||s.population<22||s.age<10)continue;if(Math.random()<.03){const c={id:game.nextCountry++,name:unique(names.country),settlements:[s.id],population:s.population,power:s.population*.8,wealth:50,atWar:[]};game.countries.push(c);s.country=c.id;for(const p of alive())if(p.settlement===s.id)p.country=c.id;event(`🏰 ${c.name} ra đời từ ${s.name}. Một chính quyền đầu tiên được hình thành.`,true)}}
  for(const c of game.countries){c.population=0;for(const s of game.settlements.filter(s=>c.settlements.includes(s.id)))c.population+=s.population;c.power=Math.max(5,c.population*.65+c.wealth*.25);c.wealth=clamp(c.wealth+rnd(-1,2),5,100)}
  // absorb nearby independent settlements
  for(const s of game.settlements.filter(s=>!s.country&&s.population>10)){const c=game.countries.find(c=>c.settlements.some(id=>dist(s,game.settlements.find(x=>x.id===id))<.13));if(c&&Math.random()<.04){s.country=c.id;c.settlements.push(s.id);for(const p of alive())if(p.settlement===s.id)p.country=c.id;event(`🌐 ${c.name} mở rộng ảnh hưởng đến ${s.name}.`)}}
}
function wars(){
  // At least two neighbouring states create a real chance of war; no waiting forever.
  if(game.countries.length<2)return;
  for(let i=0;i<game.countries.length;i++)for(let j=i+1;j<game.countries.length;j++){
    const a=game.countries[i],b=game.countries[j];if(a.atWar.includes(b.id))continue;
    const sa=game.settlements.filter(s=>a.settlements.includes(s.id)),sb=game.settlements.filter(s=>b.settlements.includes(s.id));let near=false;for(const x of sa)for(const y of sb)if(dist(x,y)<.18)near=true;
    if(!near)continue;let chance=.025;if(Math.abs(a.power-b.power)>30)chance+=.02;if(Math.random()<chance){a.atWar.push(b.id);b.atWar.push(a.id);const w={id:game.nextWar++,a:a.id,b:b.id,age:0,score:0};game.wars.push(w);event(`⚔️ ${a.name} tuyên chiến với ${b.name}. Hai nền văn minh bước vào chiến tranh.`,true);}}
  for(const w of [...game.wars]){
    const a=game.countries.find(c=>c.id===w.a),b=game.countries.find(c=>c.id===w.b);if(!a||!b)continue;w.age++;const outcome=(a.power-b.power)+rnd(-20,20);w.score+=outcome>0?1:-1;
    if(Math.random()<.35){const winner=outcome>=0?a:b,loser=winner===a?b:a;winner.power+=rnd(2,8);loser.power=Math.max(3,loser.power-rnd(2,7));event(`⚔️ Trận chiến giữa ${a.name} và ${b.name}: ${winner.name} giành ưu thế.`);}
    if(w.age>8||Math.abs(w.score)>=5){const winner=w.score>=0?a:b,loser=winner===a?b:a;winner.wealth=clamp(winner.wealth+8,0,100);loser.wealth=clamp(loser.wealth-5,0,100);a.atWar=a.atWar.filter(id=>id!==b.id);b.atWar=b.atWar.filter(id=>id!==a.id);event(`🕊️ Chiến tranh giữa ${a.name} và ${b.name} kết thúc. ${winner.name} là bên có lợi thế lớn hơn.`,true);game.wars=game.wars.filter(x=>x.id!==w.id)}}
}
function history(){
  if(game.year%17===0&&game.settlements.length){const s=game.settlements[ri(0,game.settlements.length-1)];event(`🌾 ${s.name} trải qua một mùa sản xuất thuận lợi, dân cư tăng lên.`)}
  if(game.year%31===0&&game.terrain.forests.length){const f=game.terrain.forests[ri(0,game.terrain.forests.length-1)];if(game.settings.resources<1)event("🌲 Một vùng rừng trở thành nguồn tài nguyên quan trọng đối với các cộng đồng lân cận.")}
  if(game.year%40===0)event(`📜 Năm ${game.year}: thế hệ ${game.generation} đang định hình lại xã hội.`)
}

function update(){
  const a=alive();set("year",game.year);set("worldName",game.worldName);set("population",game.population.length);set("alive",a.length);set("settlements",game.settlements.length);set("countries",game.countries.length);set("generation",game.generation);set("resourceState",game.settings.resources<1?"Khan hiếm":game.settings.resources>1?"Dồi dào":"Cân bằng");set("climateState",game.settings.climate==="dry"?"Khô":game.settings.climate==="wet"?"Ẩm":"Ôn hòa");
  const box=document.getElementById("events");if(box){box.innerHTML=game.events.slice(0,35).map(e=>`<div class="event ${e.important?"important":""}"><b>Năm ${e.year}</b> · ${e.text}</div>`).join("")}
  updatePause()
}
function set(id,v){const e=document.getElementById(id);if(e)e.textContent=fmt(v)}

const canvas=document.getElementById("worldCanvas"),ctx=canvas.getContext("2d");
function resizeCanvas(){if(!canvas)return;const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);draw()}
function draw(){if(!canvas||!game.terrain.land.length)return;const w=canvas.clientWidth,h=canvas.clientHeight;drawLand(ctx,w,h);
  // country territories as translucent influence circles, then settlements and people
  for(const c of game.countries){const ss=game.settlements.filter(s=>c.settlements.includes(s.id));if(!ss.length)continue;ctx.fillStyle=`hsla(${(c.id*67)%360},55%,55%,.13)`;for(const s of ss){ctx.beginPath();ctx.arc(s.x*w,s.y*h,Math.max(18,Math.min(w,h)*.09),0,Math.PI*2);ctx.fill()}}
  for(const s of game.settlements){const c=game.countries.find(c=>c.id===s.country);ctx.fillStyle=c?`hsl(${(c.id*67)%360},60%,58%)`:"#e6c76a";ctx.beginPath();ctx.arc(s.x*w,s.y*h,Math.min(8,3+s.population/30),0,Math.PI*2);ctx.fill();if(s.population>15){ctx.fillStyle="#fff";ctx.font="9px Arial";ctx.fillText(s.name,s.x*w+7,s.y*h-7)}}
  for(const p of alive()){ctx.fillStyle=p.country?"#f4d36b":"#dbe7ee";ctx.beginPath();ctx.arc(p.x*w,p.y*h,1.7,0,Math.PI*2);ctx.fill()}
  for(const war of game.wars){const a=game.countries.find(c=>c.id===war.a),b=game.countries.find(c=>c.id===war.b);if(!a||!b)continue;const sa=game.settlements.find(s=>a.settlements.includes(s.id)),sb=game.settlements.find(s=>b.settlements.includes(s.id));if(sa&&sb){ctx.strokeStyle="#d95858";ctx.lineWidth=3;ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(sa.x*w,sa.y*h);ctx.lineTo(sb.x*w,sb.y*h);ctx.stroke();ctx.setLineDash([])}}
}
window.addEventListener("resize",resizeCanvas);
document.getElementById("pauseButton")?.addEventListener("click",togglePause);document.getElementById("mobilePause")?.addEventListener("click",togglePause);document.getElementById("clearEvents")?.addEventListener("click",()=>{game.events=[];update()});
document.getElementById("startButton")?.addEventListener("click",()=>{document.getElementById("introScreen").classList.add("hidden");document.getElementById("setupScreen").classList.remove("hidden")});
document.getElementById("backToIntro")?.addEventListener("click",()=>{document.getElementById("setupScreen").classList.add("hidden");document.getElementById("introScreen").classList.remove("hidden")});
document.getElementById("populationInput")?.addEventListener("input",e=>document.getElementById("populationValue").textContent=e.target.value);
function choices(id,cb){document.querySelectorAll(`#${id} button`).forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(`#${id} button`).forEach(x=>x.classList.remove("selected"));b.classList.add("selected");cb(b.dataset.value)}))}
choices("resourceChoices",v=>game.settings.resources=+v);choices("climateChoices",v=>game.settings.climate=v);
document.getElementById("createWorldButton")?.addEventListener("click",()=>{game.worldName=document.getElementById("worldNameInput").value.trim()||"THẾ GIỚI";game.settings.population=+document.getElementById("populationInput").value;document.getElementById("setupScreen").classList.add("hidden");document.getElementById("gameScreen").classList.remove("hidden");createWorld()});
window.addEventListener("keydown",e=>{if(e.code==="Space"&&!e.target.matches("input")){e.preventDefault();if(!document.getElementById("gameScreen").classList.contains("hidden"))togglePause()}});
