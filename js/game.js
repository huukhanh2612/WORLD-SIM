/*
 * WORLD-SIM — A living world simulation
 * Copyright © 2026 PHAN HỮU KHÁNH
 * All rights reserved.
 * V0.8 — Stable playable simulation core.
 */

const OWNER = "PHAN HỮU KHÁNH";
const VERSION = "V0.8";

const game = {
    year: 1,
    worldName: "THẾ GIỚI",
    population: [],
    settlements: [],
    countries: [],
    wars: [],
    events: [],
    terrain: { land: [], forests: [], mountains: [], lakes: [], rivers: [] },
    settings: { population: 100, resources: 1, climate: "temperate" },
    paused: true,
    timer: null,
    generation: 1,
    nextPerson: 1,
    nextSettlement: 1,
    nextCountry: 1,
    nextWar: 1
};

const SETTLEMENT_NAMES = ["An Lạc","Bình Minh","Hòa Sơn","Thanh Hà","Phú An","Tân Lộc","Minh Châu","Vạn Phúc","Nam Sơn","Đông Hải","Trường An","Thiên Phúc","Đại Sơn","Thịnh Vượng","Hải Bình"];
const COUNTRY_NAMES = ["Vương quốc An Lạc","Liên bang Bình Minh","Đế quốc Trường Sơn","Vương quốc Hải Nam","Đại Việt Sơn","Liên minh Minh Châu","Vương quốc Thanh Hà","Đế quốc Vạn Phúc"];
const COLORS = ["#c95b55","#5b82c9","#d29a4c","#6eaa69","#9a68b8","#4f9c9c","#b86f92","#8c8750"];

const canvas = document.getElementById("worldCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

function rnd(a,b){ return Math.random()*(b-a)+a; }
function ri(a,b){ return Math.floor(rnd(a,b+1)); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function alive(){ return game.population.filter(p=>p.alive); }
function pick(a){ return a.length ? a[ri(0,a.length-1)] : null; }
function fmt(n){ return Math.round(n).toLocaleString("vi-VN"); }
function uniqueName(list){ return `${pick(list)} ${ri(1,99)}`; }
function getSettlement(id){ return game.settlements.find(s=>s.id===id); }
function getCountry(id){ return game.countries.find(c=>c.id===id); }
function addEvent(text, important=false){
    game.events.unshift({year:game.year,text,important});
    if(game.events.length>80) game.events.pop();
}

class Person {
    constructor(id,x,y,age=ri(18,35)) {
        this.id=id; this.x=x; this.y=y; this.age=age;
        this.alive=true; this.health=ri(80,100);
        this.settlement=null; this.country=null;
    }
}

function createTerrain(){
    const W=64,H=40,t=game.terrain;
    t.land=[]; t.forests=[]; t.mountains=[]; t.lakes=[]; t.rivers=[];
    const blobs=[
        {x:.25,y:.42,rx:.22,ry:.29},{x:.62,y:.31,rx:.23,ry:.19},
        {x:.61,y:.69,rx:.28,ry:.17},{x:.83,y:.68,rx:.09,ry:.12}
    ];
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
        const nx=(x+.5)/W, ny=(y+.5)/H;
        let s=0;
        for(const b of blobs) s=Math.max(s,1-Math.hypot((nx-b.x)/b.rx,(ny-b.y)/b.ry));
        s += Math.sin(nx*21+ny*8)*.035 + Math.sin(nx*43-ny*13)*.025;
        t.land.push(s>.08);
    }
    game.isLand=(x,y)=>{
        const gx=Math.floor(x*W), gy=Math.floor(y*H);
        return gx>=0&&gy>=0&&gx<W&&gy<H&&t.land[gy*W+gx];
    };
    for(let i=0;i<24;i++){
        let x=rnd(.08,.92),y=rnd(.08,.92);
        if(game.isLand(x,y)) t.mountains.push({x,y,r:rnd(.015,.035)});
    }
    for(let i=0;i<34;i++){
        let x=rnd(.06,.94),y=rnd(.06,.94);
        if(game.isLand(x,y) && !t.mountains.some(m=>dist(m,{x,y})<.05)) t.forests.push({x,y,r:rnd(.015,.045),trees:ri(8,16)});
    }
    for(let i=0;i<6;i++){
        let x=rnd(.12,.88),y=rnd(.12,.88);
        if(game.isLand(x,y)) t.lakes.push({x,y,r:rnd(.012,.025)});
    }
    for(let i=0;i<5;i++){
        let sx=rnd(.12,.88),sy=rnd(.08,.35),ex=clamp(sx+rnd(-.18,.18),.05,.95),ey=clamp(sy+rnd(.35,.58),.45,.96);
        if(game.isLand(sx,sy)) t.rivers.push({sx,sy,ex,ey});
    }
}

function drawWorld(){
    if(!canvas||!ctx||!canvas.clientWidth) return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    ctx.clearRect(0,0,w,h);
    const ocean=ctx.createLinearGradient(0,0,0,h);
    ocean.addColorStop(0,"#164968"); ocean.addColorStop(1,"#082238");
    ctx.fillStyle=ocean; ctx.fillRect(0,0,w,h);
    const W=64,H=40;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(game.terrain.land[y*W+x]){
        const px=x*w/W,py=y*h/H;
        ctx.fillStyle=game.settings.climate==="dry"?"#756f4b":game.settings.climate==="wet"?"#416e48":"#507345";
        ctx.fillRect(px,py,w/W+1,h/H+1);
    }
    for(const f of game.terrain.forests){
        if(!game.isLand(f.x,f.y)) continue;
        for(let i=0;i<f.trees;i++){
            const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*f.r;
            const x=(f.x+Math.cos(a)*r)*w,y=(f.y+Math.sin(a)*r)*h;
            if(!game.isLand(x/w,y/h)) continue;
            ctx.fillStyle="#173d26"; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
            ctx.fillStyle="#3f7548"; ctx.beginPath(); ctx.arc(x-1,y-2,2.3,0,Math.PI*2); ctx.fill();
        }
    }
    for(const m of game.terrain.mountains){
        if(!game.isLand(m.x,m.y)) continue;
        const x=m.x*w,y=m.y*h,s=m.r*Math.min(w,h);
        ctx.fillStyle="#5b655f";ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x-s,y+s*.65);ctx.lineTo(x+s,y+s*.65);ctx.closePath();ctx.fill();
        ctx.fillStyle="#d7ddd8";ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x-s*.25,y-s*.25);ctx.lineTo(x+s*.18,y-s*.15);ctx.lineTo(x+s*.55,y+s*.35);ctx.lineTo(x-s*.55,y+s*.35);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle="#276f8c";
    for(const l of game.terrain.lakes){
        if(!game.isLand(l.x,l.y)) continue;
        ctx.beginPath();ctx.ellipse(l.x*w,l.y*h,l.r*w,l.r*h,0,0,Math.PI*2);ctx.fill();
    }
    ctx.strokeStyle="#6bbbd6";ctx.lineWidth=2;
    for(const r of game.terrain.rivers){
        ctx.beginPath();ctx.moveTo(r.sx*w,r.sy*h);ctx.bezierCurveTo((r.sx+.1)*w,(r.sy+.15)*h,(r.ex-.08)*w,(r.ey-.15)*h,r.ex*w,r.ey*h);ctx.stroke();
    }
    for(const c of game.countries){
        ctx.globalAlpha=.18;ctx.fillStyle=c.color;
        for(const s of game.settlements.filter(s=>s.country===c.id)){ctx.beginPath();ctx.arc(s.x*w,s.y*h,Math.min(w,h)*.07,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=1;
    }
    for(const war of game.wars){
        const a=getCountry(war.a),b=getCountry(war.b);if(!a||!b)continue;
        const sa=game.settlements.filter(s=>s.country===a.id),sb=game.settlements.filter(s=>s.country===b.id);if(!sa.length||!sb.length)continue;
        let A=sa[0],B=sb[0],best=999;
        for(const x of sa)for(const y of sb){const d=dist(x,y);if(d<best){best=d;A=x;B=y;}}
        ctx.strokeStyle="#ff4949";ctx.lineWidth=4;ctx.setLineDash([9,6]);ctx.beginPath();ctx.moveTo(A.x*w,A.y*h);ctx.lineTo(B.x*w,B.y*h);ctx.stroke();ctx.setLineDash([]);
    }
    for(const s of game.settlements){
        const c=getCountry(s.country),x=s.x*w,y=s.y*h;
        ctx.fillStyle=c?c.color:"#e0c66f";ctx.beginPath();ctx.arc(x,y,Math.max(4,Math.min(10,3+s.population/16)),0,Math.PI*2);ctx.fill();
        ctx.strokeStyle="#fff2c8";ctx.lineWidth=1;ctx.stroke();
        if(s.population>=25){ctx.fillStyle="#f0e6c8";ctx.fillRect(x-2,y-12,4,9);ctx.fillRect(x-6,y-8,12,2);}
    }
    for(const p of alive()){
        const x=p.x*w,y=p.y*h,c=p.country?getCountry(p.country):null;
        ctx.fillStyle=c?c.color:"#f4ead0";ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();
    }
    ctx.textAlign="center";ctx.font="11px Arial";
    for(const s of game.settlements.filter(s=>s.population>=18)){
        ctx.fillStyle="#fff";ctx.shadowColor="#000";ctx.shadowBlur=4;ctx.fillText(s.name,s.x*w,s.y*h-14);ctx.shadowBlur=0;
        const c=getCountry(s.country);if(c&&c.settlements[0]===s.id){ctx.font="bold 12px Arial";ctx.fillStyle=c.color;ctx.fillText(c.name,s.x*w,s.y*h+19);ctx.font="11px Arial";}
    }
}

function randomLandPoint(){
    for(let i=0;i<500;i++){
        const x=rnd(.08,.92),y=rnd(.08,.92);
        if(game.isLand(x,y)&&!game.terrain.mountains.some(m=>dist(m,{x,y})<m.r*.8)) return {x,y};
    }
    return {x:.3,y:.4};
}

function createWorld(){
    stop();
    game.year=1;game.population=[];game.settlements=[];game.countries=[];game.wars=[];game.events=[];game.generation=1;
    game.nextPerson=1;game.nextSettlement=1;game.nextCountry=1;game.nextWar=1;
    createTerrain();
    for(let i=0;i<game.settings.population;i++){const p=randomLandPoint();game.population.push(new Person(game.nextPerson++,p.x,p.y));}
    addEvent(`Thế giới ${game.worldName} được hình thành.`,true);
    addEvent(`${game.settings.population} con người đầu tiên xuất hiện. Không có quốc gia nào tồn tại.`,true);
    addEvent("Thiên nhiên đã có trước nền văn minh: biển, đồng bằng, rừng, núi, hồ và sông.");
    update();resizeCanvas();drawWorld();start();
}

function start(){
    stop();game.paused=false;updatePause();
    game.timer=setInterval(()=>{if(!game.paused){simulateYear();update();drawWorld();}},1000);
}
function stop(){if(game.timer){clearInterval(game.timer);game.timer=null;}}
function togglePause(){
    game.paused=!game.paused;updatePause();
    const h=document.getElementById("mapHint");if(h)h.textContent=game.paused?"Thời gian đã tạm dừng.":"Thế giới đang tự vận động...";
}
function updatePause(){
    const text=game.paused?"▶ TIẾP TỤC":"⏸ TẠM DỪNG";
    const a=document.getElementById("pauseButton"),b=document.getElementById("mobilePause");
    if(a)a.textContent=text;if(b)b.textContent=game.paused?"▶":"⏸";
}
function runYears(n){for(let i=0;i<n;i++)simulateYear();update();drawWorld();}

function simulateYear(){
    game.year++;
    if(game.year%25===0)game.generation++;
    simulatePeople();simulateSettlements();formCountries();simulateWars();generateHistory();
}

function simulatePeople(){
    const food=game.settings.resources*(game.settings.climate==="temperate"?1.08:game.settings.climate==="wet"?1.02:.96);
    for(const p of alive()){
        p.age++;p.health=clamp(p.health+rnd(-1,1),0,100);
        let death=0;
        if(p.age>78)death=.005+(p.age-78)*.01;
        if(p.age>95)death=.45;
        if(p.health<15)death+=.004;
        if(food<.7)death+=.003;
        if(Math.random()<death)p.alive=false;
    }
    const adults=alive().filter(p=>p.age>=18&&p.age<=40);
    for(const p of adults){
        if(Math.random()<.022*food){
            const b=new Person(game.nextPerson++,clamp(p.x+rnd(-.012,.012),.02,.98),clamp(p.y+rnd(-.012,.012),.02,.98),0);
            b.settlement=p.settlement;b.country=p.country;game.population.push(b);
        }
    }
    for(const p of alive()){
        if(Math.random()<.005){
            const a=rnd(0,Math.PI*2),step=rnd(.005,.014),nx=clamp(p.x+Math.cos(a)*step,.02,.98),ny=clamp(p.y+Math.sin(a)*step,.02,.98);
            if(game.isLand(nx,ny))p.x=nx,p.y=ny;
        }
    }
    if(game.year<600 && alive().length<Math.max(20,game.settings.population*.25)){
        const target=Math.max(30,Math.floor(game.settings.population*.55));
        for(let i=alive().length;i<target;i++){const q=randomLandPoint();game.population.push(new Person(game.nextPerson++,q.x,q.y,ri(18,35)));}
        addEvent("Một làn sóng người di cư và tái định cư giúp các cộng đồng tránh sụp đổ dân số.",true);
    }
}

function simulateSettlements(){
    for(const s of game.settlements)s.population=alive().filter(p=>p.settlement===s.id).length;
    if(game.year===12||game.year===20||game.year===30){
        const desired=game.year<25?2:4;
        while(game.settlements.length<desired){
            const base=pick(alive());if(!base)break;
            const s={id:game.nextSettlement++,name:uniqueName(SETTLEMENT_NAMES),x:base.x,y:base.y,population:0,age:0,country:null};
            game.settlements.push(s);
            let count=0;
            for(const p of alive())if(dist(p,s)<.075){p.settlement=s.id;count++;}
            if(count<6){for(const p of alive().filter(p=>!p.settlement).slice(0,8))if(dist(p,s)<.16)p.settlement=s.id;}
            s.population=alive().filter(p=>p.settlement===s.id).length;
            addEvent(`🏘️ ${s.name} được hình thành với ${s.population} cư dân.`,true);
        }
    }
    for(const s of game.settlements){
        s.age++;s.population=alive().filter(p=>p.settlement===s.id).length;
        if(s.population>0&&s.population%15===0&&Math.random()<.12)addEvent(`🏘️ ${s.name} đang mở rộng và thu hút thêm cư dân.`);
    }
}

function formCountries(){
    if(game.settlements.length<2)return;
    const eligible=game.settlements.filter(s=>!s.country&&s.population>=15&&s.age>=8);
    if(game.countries.length===0 && game.year>=80 && eligible.length){
        const s=eligible.sort((a,b)=>b.population-a.population)[0];createCountry(s);
    }
    if(game.countries.length===1 && game.year>=140 && eligible.length){
        const farthest=eligible.slice().sort((a,b)=>{const ca=game.countries[0].settlements.map(getSettlement);return Math.min(...ca.map(c=>dist(b,c)))-Math.min(...ca.map(c=>dist(a,c)));})[0];
        createCountry(farthest||eligible[0]);
    }
    if(game.countries.length<6 && game.year>=220){
        for(const s of eligible){
            if(game.countries.length>=6)break;
            if(Math.random()<.035)createCountry(s);
        }
    }
    for(const c of game.countries){
        c.population=game.settlements.filter(s=>s.country===c.id).reduce((n,s)=>n+s.population,0);
        c.power=Math.max(10,c.population*.7+c.wealth*.4);
    }
    for(const s of game.settlements.filter(s=>!s.country&&s.population>=12)){
        let best=null,bd=.2;
        for(const c of game.countries)for(const sid of c.settlements){const z=getSettlement(sid),d=dist(s,z);if(d<bd){bd=d;best=c;}}
        if(best&&Math.random()<.08){s.country=best.id;best.settlements.push(s.id);for(const p of alive())if(p.settlement===s.id)p.country=best.id;addEvent(`🌐 ${best.name} mở rộng ảnh hưởng đến ${s.name}.`);}
    }
}

function createCountry(s){
    const c={id:game.nextCountry++,name:uniqueName(COUNTRY_NAMES),settlements:[s.id],population:s.population,power:s.population*.8,wealth:50,color:COLORS[(game.nextCountry-2)%COLORS.length]};
    game.countries.push(c);s.country=c.id;
    for(const p of alive())if(p.settlement===s.id)p.country=c.id;
    addEvent(`🏰 ${c.name} ra đời từ ${s.name}. Một chính quyền đầu tiên được hình thành.`,true);
}

function simulateWars(){
    if(game.countries.length<2)return;
    for(let i=0;i<game.countries.length;i++)for(let j=i+1;j<game.countries.length;j++){
        const a=game.countries[i],b=game.countries[j];
        if(game.wars.some(w=>(w.a===a.id&&w.b===b.id)||(w.a===b.id&&w.b===a.id)))continue;
        let nearest=999;
        for(const x of a.settlements.map(getSettlement).filter(Boolean))for(const y of b.settlements.map(getSettlement).filter(Boolean))nearest=Math.min(nearest,dist(x,y));
        if(nearest<.20 && game.year>=170 && Math.random()<.06){
            game.wars.push({id:game.nextWar++,a:a.id,b:b.id,age:0,score:0});
            addEvent(`⚔️ ${a.name} tuyên chiến với ${b.name}. Chiến tranh bùng nổ.`,true);
        }
    }
    if(game.year>=240 && game.wars.length===0){
        const a=game.countries[0],b=game.countries[1];
        if(a&&b){game.wars.push({id:game.nextWar++,a:a.id,b:b.id,age:0,score:0});addEvent(`⚔️ ${a.name} và ${b.name} bước vào cuộc chiến lớn đầu tiên của lịch sử.`,true);}
    }
    for(const w of [...game.wars]){
        const a=getCountry(w.a),b=getCountry(w.b);if(!a||!b)continue;
        w.age++;
        const result=a.power-b.power+rnd(-25,25);w.score+=result>0?1:-1;
        if(Math.random()<.55){
            const winner=result>=0?a:b,loser=winner===a?b:a;
            winner.power+=rnd(2,7);loser.power=Math.max(5,loser.power-rnd(1,5));
            addEvent(`⚔️ Trận chiến: ${winner.name} giành ưu thế trước ${loser.name}.`);
        }
        if(w.age>=12||Math.abs(w.score)>=6){
            const winner=w.score>=0?a:b,loser=winner===a?b:a;
            const target=loser.settlements.map(getSettlement).find(Boolean);
            if(target&&Math.random()<.7){target.country=winner.id;winner.settlements.push(target.id);loser.settlements=loser.settlements.filter(id=>id!==target.id);for(const p of alive())if(p.settlement===target.id)p.country=winner.id;addEvent(`🏳️ ${winner.name} chiếm ${target.name} sau chiến tranh.`,true);}
            addEvent(`🕊️ Chiến tranh giữa ${a.name} và ${b.name} kết thúc. ${winner.name} là bên thắng thế.`,true);
            game.wars=game.wars.filter(x=>x.id!==w.id);
        }
    }
}

function generateHistory(){
    if(game.year%25===0)addEvent(`📜 Năm ${game.year}: thế hệ ${game.generation} đang định hình xã hội.`);
    if(game.year%37===0&&game.settlements.length)addEvent(`🌲 Các cộng đồng bắt đầu khai thác rừng và mở rộng vùng cư trú.`);
    if(game.year%53===0&&game.settlements.length)addEvent(`🌾 Một mùa sản xuất thuận lợi giúp nhiều khu định cư phát triển.`);
}

function setText(id,value){const e=document.getElementById(id);if(e)e.textContent=typeof value==="number"?fmt(value):value;}
function update(){
    const a=alive();setText("year",game.year);setText("worldName",game.worldName);setText("population",game.population.length);setText("alive",a.length);setText("settlements",game.settlements.length);setText("countries",game.countries.length);setText("generation",game.generation);
    setText("resourceState",game.settings.resources<1?"Khan hiếm":game.settings.resources>1?"Dồi dào":"Cân bằng");
    setText("climateState",game.settings.climate==="dry"?"Khô":game.settings.climate==="wet"?"Ẩm":"Ôn hòa");
    const box=document.getElementById("events");if(box)box.innerHTML=game.events.slice(0,35).map(e=>`<div class="event ${e.important?"important":""}"><b>Năm ${e.year}</b> · ${e.text}</div>`).join("");
    updatePause();
}

function resizeCanvas(){
    if(!canvas)return;const r=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1;
    canvas.width=Math.max(1,r.width*d);canvas.height=Math.max(1,r.height*d);ctx.setTransform(d,0,0,d,0,0);drawWorld();
}

function showScreen(id){
    ["introScreen","setupScreen","gameScreen"].forEach(x=>document.getElementById(x)?.classList.add("hidden"));
    document.getElementById(id)?.classList.remove("hidden");
}

function setup(){
    document.getElementById("startButton")?.addEventListener("click",()=>showScreen("setupScreen"));
    document.getElementById("backToIntro")?.addEventListener("click",()=>showScreen("introScreen"));
    const pop=document.getElementById("populationInput"),popValue=document.getElementById("populationValue");
    pop?.addEventListener("input",()=>{popValue.textContent=pop.value;});
    document.querySelectorAll("#resourceChoices button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#resourceChoices button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");}));
    document.querySelectorAll("#climateChoices button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#climateChoices button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");}));
    document.getElementById("createWorldButton")?.addEventListener("click",()=>{
        game.worldName=(document.getElementById("worldNameInput")?.value||"THẾ GIỚI").trim()||"THẾ GIỚI";
        game.settings.population=Number(document.getElementById("populationInput")?.value||100);
        game.settings.resources=Number(document.querySelector("#resourceChoices button.selected")?.dataset.value||1);
        game.settings.climate=document.querySelector("#climateChoices button.selected")?.dataset.value||"temperate";
        showScreen("gameScreen");createWorld();
    });
    document.getElementById("pauseButton")?.addEventListener("click",togglePause);
    document.getElementById("mobilePause")?.addEventListener("click",togglePause);
    document.getElementById("clearEvents")?.addEventListener("click",()=>{game.events=[];update();});
    window.addEventListener("resize",resizeCanvas);
    document.addEventListener("keydown",e=>{if(e.code==="Space"&&!e.target.matches("input,button")){e.preventDefault();if(!game.timer)return;togglePause();}});
}

window.runYears=runYears;
window.togglePause=togglePause;
setup();
