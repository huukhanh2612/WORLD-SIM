/*
 * WORLD-SIM — A living world simulation
 * Copyright © 2026 PHAN HỮU KHÁNH
 * All rights reserved.
 * V12.1 — Đồ họa chi tiết hơn, quân đội di chuyển, nhịp điệu chậm rãi.
 */

const OWNER = "PHAN HỮU KHÁNH";
const VERSION = "V1.0";

const game = {
    year: 1,
    worldName: "THẾ GIỚI",
    population: [],
    settlements: [],
    countries: [],
    wars: [],
    events: [],
    terrain: { land: [], forests: [], mountains: [], lakes: [], rivers: [], animals: [] },
    settings: { population: 100, resources: 1, climate: "temperate" },
    timer: null,
    generation: 1,
    nextPerson: 1,
    nextSettlement: 1,
    nextCountry: 1,
    nextWar: 1,
    weather: { type: "clear", years: 0 },
    selectedSettlement: null,
    dt: 0.04,
    animClock: 0
};

const SETTLEMENT_NAMES = ["An Lạc","Bình Minh","Hòa Sơn","Thanh Hà","Phú An","Tân Lộc","Minh Châu","Vạn Phúc","Nam Sơn","Đông Hải","Trường An","Thiên Phúc","Đại Sơn","Thịnh Vượng","Hải Bình"];
const COUNTRY_NAMES = ["Vương quốc An Lạc","Liên bang Bình Minh","Đế quốc Trường Sơn","Vương quốc Hải Nam","Đại Việt Sơn","Liên minh Minh Châu","Vương quốc Thanh Hà","Đế quốc Vạn Phúc"];
const COLORS = ["#c95b55","#5b82c9","#d29a4c","#6eaa69","#9a68b8","#4f9c9c","#b86f92","#8c8750"];
const LEADER_FAMILY = ["Nguyễn","Trần","Lê","Phạm","Hoàng","Vũ","Đặng","Bùi","Đỗ","Ngô","Dương","Lý","Phan","Đinh"];
const LEADER_GIVEN = ["An","Bình","Chiến","Dũng","Giang","Hải","Khánh","Lâm","Minh","Nam","Phong","Quang","Sơn","Thắng","Tuấn","Bảo","Cường","Đạt","Hùng","Kiên","Linh","Nga","Oanh","Thảo","Trang","Vy"];
const VILLAGE_TITLES = ["Trưởng làng","Già làng","Tộc trưởng"];
const COUNTRY_TITLES = ["Quốc vương","Nữ vương","Đại vương","Minh chủ"];
const TECH_NAMES = ["Công cụ đá","Đồ đồng thô sơ","Rèn đồng tinh xảo","Vũ khí sắt","Kỹ thuật rèn thép"];
const WEATHER_WEIGHTS = {
    dry:{clear:.55,cloudy:.25,rain:.07,storm:.06,fog:.07},
    temperate:{clear:.35,cloudy:.30,rain:.18,storm:.08,fog:.09},
    wet:{clear:.18,cloudy:.24,rain:.35,storm:.13,fog:.10}
};
const WEATHER_LABELS = {clear:"☀️ Quang đãng",cloudy:"⛅ Nhiều mây",rain:"🌧️ Mưa",storm:"⛈️ Bão",fog:"🌫️ Sương mù"};

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
function randomLeaderName(){ return `${pick(LEADER_FAMILY)} ${pick(LEADER_GIVEN)}`; }
function getSettlement(id){ return game.settlements.find(s=>s.id===id); }
function getCountry(id){ return game.countries.find(c=>c.id===id); }
function addEvent(text, important=false){
    game.events.unshift({year:game.year,text,important});
    if(game.events.length>80) game.events.pop();
}
function pickWeighted(weights){
    const r=Math.random(); let acc=0;
    for(const k in weights){ acc+=weights[k]; if(r<=acc) return k; }
    return "clear";
}
function hexAlpha(hex,a){
    const h=(hex||"#e0c66f").replace("#","");
    const r=parseInt(h.substring(0,2),16),g=parseInt(h.substring(2,4),16),b=parseInt(h.substring(4,6),16);
    return `rgba(${r},${g},${b},${a})`;
}

class Person {
    constructor(id,x,y,age=ri(18,35)) {
        this.id=id; this.x=x; this.y=y; this.age=age;
        this.alive=true; this.health=ri(80,100);
        this.settlement=null; this.country=null;
        this.tx=x; this.ty=y; // Tọa độ mục tiêu để di chuyển mượt
    }
}

/* ---------------------------- ĐỊA HÌNH ---------------------------- */

function createTerrain(){
    const W=64,H=40,t=game.terrain;
    t.land=[]; t.forests=[]; t.mountains=[]; t.lakes=[]; t.rivers=[]; t.animals=[];
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
        if(game.isLand(x,y) && !t.mountains.some(m=>dist(m,{x,y})<.05)){
            const trees=ri(9,18), positions=[];
            const r=rnd(.015,.045);
            for(let k=0;k<trees;k++){
                const a=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random())*r;
                positions.push({ox:Math.cos(a)*rr,oy:Math.sin(a)*rr,tone:Math.random()});
            }
            t.forests.push({x,y,r,trees,positions});
        }
    }
    for(let i=0;i<6;i++){
        let x=rnd(.12,.88),y=rnd(.12,.88);
        if(game.isLand(x,y)) t.lakes.push({x,y,r:rnd(.012,.025)});
    }
    for(let i=0;i<5;i++){
        let sx=rnd(.12,.88),sy=rnd(.08,.35),ex=clamp(sx+rnd(-.18,.18),.05,.95),ey=clamp(sy+rnd(.35,.58),.45,.96);
        if(game.isLand(sx,sy)) t.rivers.push({sx,sy,ex,ey});
    }
    // Tạo động vật hoang dã
    for(let i=0;i<35;i++){
        let x=rnd(.1,.9),y=rnd(.1,.9);
        if(game.isLand(x,y)) t.animals.push({x, y, tx:x, ty:y, type: Math.random()>.5?"deer":"bird", speed:rnd(0.003, 0.008)});
    }
}

function ensureWeatherAssets(){
    if(!game.clouds || !game.clouds.length){
        game.clouds=[];
        for(let i=0;i<9;i++) game.clouds.push({x:Math.random()*1.4-.2,y:rnd(.03,.22),s:rnd(.06,.13),speed:rnd(.006,.016),op:rnd(.35,.6)});
    }
    if(!game.rainDrops || !game.rainDrops.length){
        game.rainDrops=[];
        for(let i=0;i<160;i++) game.rainDrops.push({x:Math.random(),y:Math.random(),len:rnd(.012,.022),speed:rnd(.45,.85)});
    }
}

/* ---------------------------- VẼ THẾ GIỚI ---------------------------- */

function drawWorld(){
    if(!canvas||!ctx||!canvas.clientWidth) return;
    ensureWeatherAssets();
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const dt=game.dt||0.04;
    ctx.clearRect(0,0,w,h);

    const ocean=ctx.createLinearGradient(0,0,0,h);
    ocean.addColorStop(0,"#1c5c82"); ocean.addColorStop(.6,"#164968"); ocean.addColorStop(1,"#071b2c");
    ctx.fillStyle=ocean; ctx.fillRect(0,0,w,h);

    const W=64,H=40;
    const base=game.settings.climate==="dry"?[122,113,72]:game.settings.climate==="wet"?[62,107,71]:[79,114,68];
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(game.terrain.land[y*W+x]){
        const px=x*w/W,py=y*h/H;
        const n=Math.sin(x*12.9898+y*78.233)*43758.5453; const noise=(n-Math.floor(n))*14-7;
        ctx.fillStyle=`rgb(${clamp(base[0]+noise,0,255)|0},${clamp(base[1]+noise,0,255)|0},${clamp(base[2]+noise,0,255)|0})`;
        ctx.fillRect(px,py,w/W+1.5,h/H+1.5); // Chỉnh nhẹ để khít hơn
    }

    // Sông uốn lượn có chiều sâu
    game.animClock=(game.animClock||0)+dt;
    for(const r of game.terrain.rivers){
        ctx.lineCap="round"; ctx.lineJoin="round";
        ctx.strokeStyle="#1a4f66"; ctx.lineWidth=5; ctx.beginPath();
        ctx.moveTo(r.sx*w,r.sy*h); ctx.bezierCurveTo((r.sx+.1)*w,(r.sy+.15)*h,(r.ex-.08)*w,(r.ey-.15)*h,r.ex*w,r.ey*h); ctx.stroke();
        
        ctx.strokeStyle="#2e7c9e"; ctx.lineWidth=3; ctx.beginPath();
        ctx.moveTo(r.sx*w,r.sy*h); ctx.bezierCurveTo((r.sx+.1)*w,(r.sy+.15)*h,(r.ex-.08)*w,(r.ey-.15)*h,r.ex*w,r.ey*h); ctx.stroke();

        ctx.strokeStyle="#6bbbd6"; ctx.lineWidth=1.5; ctx.setLineDash([8,12]); ctx.lineDashOffset=-game.animClock*12;
        ctx.beginPath(); ctx.moveTo(r.sx*w,r.sy*h); ctx.bezierCurveTo((r.sx+.1)*w,(r.sy+.15)*h,(r.ex-.08)*w,(r.ey-.15)*h,r.ex*w,r.ey*h); ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.fillStyle="#276f8c";
    for(const l of game.terrain.lakes){
        if(!game.isLand(l.x,l.y)) continue;
        ctx.beginPath(); ctx.ellipse(l.x*w,l.y*h,l.r*w,l.r*h,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="rgba(180,225,240,.25)"; ctx.lineWidth=1.5; ctx.stroke();
    }

    // Động vật hoang dã
    for(const a of game.terrain.animals) {
        let dx=a.tx-a.x, dy=a.ty-a.y, d=Math.hypot(dx,dy);
        if(d<0.01) {
            a.tx=clamp(a.x+rnd(-.06,.06),.05,.95); 
            a.ty=clamp(a.y+rnd(-.06,.06),.05,.95);
        } else {
            a.x += (dx/d)*a.speed*dt; a.y += (dy/d)*a.speed*dt;
        }
        if(!game.isLand(a.x,a.y)) { a.x=a.tx=.5; a.y=a.ty=.5; } // Reset nếu lỡ ra biển
        
        const ax=a.x*w, ay=a.y*h;
        if(a.type==="bird") {
            const wing=Math.sin(game.animClock*15)*2;
            ctx.strokeStyle="#1a1a1a"; ctx.lineWidth=1; ctx.beginPath();
            ctx.moveTo(ax-3,ay-wing); ctx.quadraticCurveTo(ax-1.5,ay+2,ax,ay); 
            ctx.quadraticCurveTo(ax+1.5,ay+2,ax+3,ay-wing); ctx.stroke();
        } else {
            // Hươu / Nai nhỏ
            ctx.fillStyle="#8c5a35"; ctx.fillRect(ax-1.5,ay-1,3,2); // thân
            ctx.fillRect(ax+0.5,ay-2.5,1.5,1.5); // đầu
            ctx.fillStyle="#52321a"; ctx.fillRect(ax-1,ay+1,1,1.5); ctx.fillRect(ax+1,ay+1,1,1.5); // chân
        }
    }

    // Rừng cây chi tiết (có thân cây và tán lá đánh bóng)
    for(const f of game.terrain.forests){
        if(!game.isLand(f.x,f.y)) continue;
        for(const p of f.positions){
            const tx=f.x+p.ox, ty=f.y+p.oy;
            if(!game.isLand(tx,ty)) continue;
            const x=tx*w,y=ty*h;
            ctx.fillStyle="rgba(5,15,10,.25)"; ctx.beginPath(); ctx.ellipse(x,y+3,3.5,1.5,0,0,Math.PI*2); ctx.fill(); // Bóng râm
            ctx.fillStyle="#382618"; ctx.fillRect(x-0.5, y, 1.2, 3); // Thân cây
            ctx.fillStyle=p.tone>.5?"#1d4a2d":"#173d26"; ctx.beginPath(); ctx.arc(x,y-1.5,3.2,0,Math.PI*2); ctx.fill(); // Tán lá nền
            ctx.fillStyle=p.tone>.5?"#4d8a54":"#3f7548"; ctx.beginPath(); ctx.arc(x-1,y-3,2.2,0,Math.PI*2); ctx.fill(); // Tán lá sáng
        }
    }

    // Núi cổ điển
    for(const m of game.terrain.mountains){
        if(!game.isLand(m.x,m.y)) continue;
        const x=m.x*w,y=m.y*h,s=m.r*Math.min(w,h);
        const grad=ctx.createLinearGradient(x-s,y-s,x+s,y+s*.65);
        grad.addColorStop(0,"#7a8479"); grad.addColorStop(.55,"#5b655f"); grad.addColorStop(1,"#3c443f");
        ctx.fillStyle=grad; ctx.beginPath(); ctx.moveTo(x,y-s); ctx.lineTo(x-s,y+s*.65); ctx.lineTo(x+s,y+s*.65); ctx.closePath(); ctx.fill();
        ctx.fillStyle="rgba(0,0,0,.25)"; ctx.beginPath(); ctx.moveTo(x,y-s); ctx.lineTo(x+s*.15,y-s*.1); ctx.lineTo(x+s,y+s*.65); ctx.lineTo(x+s*.25,y+s*.65); ctx.closePath(); ctx.fill();
        ctx.fillStyle="#eef3f0"; ctx.beginPath(); ctx.moveTo(x,y-s); ctx.lineTo(x-s*.25,y-s*.25); ctx.lineTo(x+s*.18,y-s*.15); ctx.lineTo(x+s*.55,y+s*.35); ctx.lineTo(x-s*.55,y+s*.35); ctx.closePath(); ctx.fill();
    }

    // Vùng lãnh thổ
    for(const c of game.countries){
        ctx.globalAlpha=.16; ctx.fillStyle=c.color;
        for(const s of game.settlements.filter(s=>s.country===c.id)){ ctx.beginPath(); ctx.arc(s.x*w,s.y*h,Math.min(w,h)*.07,0,Math.PI*2); ctx.fill(); }
        ctx.globalAlpha=1;
    }

    // Binh lính & Hiệu ứng chiến tranh
    for(const war of game.wars){
        const a=getCountry(war.a),b=getCountry(war.b); if(!a||!b) continue;
        const sa=game.settlements.filter(s=>s.country===a.id), sb=game.settlements.filter(s=>s.country===b.id); if(!sa.length||!sb.length) continue;
        let A=sa[0],B=sb[0],best=999;
        for(const x of sa) for(const y of sb){ const d=dist(x,y); if(d<best){best=d;A=x;B=y;} }
        
        const dx=B.x-A.x, dy=B.y-A.y;
        const distAB=Math.hypot(dx,dy);
        const steps=Math.max(10, Math.floor(distAB*150)); // Số lượng binh lính hành quân
        
        for(let i=0; i<steps; i++){
            // Tính toán vị trí lính
            let t = (game.animClock * 0.12 + i/steps) % 1;
            let sx = (A.x + dx*t)*w;
            let sy = (A.y + dy*t)*h;
            // Tạo đội hình hơi phân tán
            let jitterX = Math.sin(i*452)*4;
            let jitterY = Math.cos(i*213)*4;
            
            ctx.fillStyle = (i%2===0) ? a.color : b.color;
            ctx.beginPath(); ctx.arc(sx+jitterX, sy+jitterY, 1.3, 0, Math.PI*2); ctx.fill();
            
            // Khói lửa giao tranh khi hai đội quân chạm trán ở giữa chiến tuyến
            if(t>0.4 && t<0.6 && Math.random()<0.08) {
                ctx.fillStyle = "#ff5500";
                ctx.beginPath(); ctx.arc(sx+jitterX, sy+jitterY, 2.5, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = "#ffcc00";
                ctx.beginPath(); ctx.arc(sx+jitterX, sy+jitterY, 1.5, 0, Math.PI*2); ctx.fill();
            }
        }
    }

    // Làng mạc có mái ngói
    for(const s of game.settlements){
        const c=getCountry(s.country), x=s.x*w, y=s.y*h;
        const R=clamp(3+s.population/16,4,11);
        if(s.population>=12){
            ctx.setLineDash([4,4]); ctx.lineWidth=1;
            ctx.strokeStyle=c?hexAlpha(c.color,.4):"rgba(224,198,111,.35)";
            ctx.beginPath(); ctx.arc(x,y,(s.territory||.045)*Math.min(w,h),0,Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Vẽ những ngôi nhà nhỏ xung quanh tâm làng
        const houses = Math.min(6, Math.max(2, Math.floor(s.population/5)));
        for(let i=0; i<houses; i++) {
            const hx = x + Math.cos(i*(Math.PI*2/houses)) * (R-1.5);
            const hy = y + Math.sin(i*(Math.PI*2/houses)) * (R-1.5);
            // Thân nhà
            ctx.fillStyle = "#e0d0b8"; ctx.fillRect(hx-2.5, hy-1.5, 5, 4);
            // Mái nhà (màu đỏ ngói hoặc theo quốc gia)
            ctx.fillStyle = c ? c.color : "#9c5539";
            ctx.beginPath(); ctx.moveTo(hx-3.5, hy-1.5); ctx.lineTo(hx, hy-4.5); ctx.lineTo(hx+3.5, hy-1.5); ctx.closePath(); ctx.fill();
        }

        if(c && c.capital===s.id){
            // Cờ thủ đô cao, trang trọng hơn
            ctx.strokeStyle="#444"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x,y-R-16); ctx.lineTo(x,y-R-2); ctx.stroke();
            ctx.fillStyle=c.color; ctx.beginPath(); ctx.moveTo(x,y-R-16); ctx.lineTo(x+11,y-R-12); ctx.lineTo(x,y-R-8); ctx.closePath(); ctx.fill();
        }
        if(game.selectedSettlement===s.id){
            ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,R+6,0,Math.PI*2); ctx.stroke();
        }
    }

    // Người dân di chuyển
    const people=alive();
    const step=people.length>600?Math.ceil(people.length/600):1;
    for(let i=0;i<people.length;i+=step){
        const p=people[i];
        
        // Cập nhật vị trí hiển thị
        let dx=p.tx-p.x, dy=p.ty-p.y, d=Math.hypot(dx,dy);
        if(d<0.005) {
            p.tx=clamp(p.x+rnd(-.02,.02),.02,.98);
            p.ty=clamp(p.y+rnd(-.02,.02),.02,.98);
        } else {
            p.x += (dx/d)*0.01*dt; p.y += (dy/d)*0.01*dt;
        }

        const x=p.x*w, y=p.y*h, c=p.country?getCountry(p.country):null;
        
        // Vẽ thân người
        ctx.fillStyle = c?c.color:"#8f7966"; 
        ctx.fillRect(x-1,y,2,3);
        // Vẽ đầu
        ctx.fillStyle = "#fcd5ba";
        ctx.beginPath(); ctx.arc(x,y-1.5,1.5,0,Math.PI*2); ctx.fill();
    }

    ctx.textAlign="center"; ctx.font="11px Arial";
    for(const s of game.settlements.filter(s=>s.population>=18)){
        ctx.fillStyle="#fff"; ctx.shadowColor="#000"; ctx.shadowBlur=5; ctx.fillText(s.name,s.x*w,s.y*h-16); ctx.shadowBlur=0;
        const c=getCountry(s.country); if(c&&c.capital===s.id){ ctx.font="bold 12px Arial"; ctx.fillStyle=c.color; ctx.fillText(c.name,s.x*w,s.y*h+21); ctx.font="11px Arial"; }
    }

    drawClouds(w,h,dt);
    drawWeatherOverlay(w,h,dt);
}

function drawClouds(w,h,dt){
    const type=game.weather?.type||"clear";
    const density=type==="storm"?1.5:type==="rain"?1.25:type==="cloudy"?1.15:type==="fog"?.9:.55;
    ctx.save();
    for(const c of game.clouds){
        c.x+=c.speed*dt;
        if(c.x>1.35) c.x=-.35;
        const cx=c.x*w, cy=c.y*h, s=c.s*Math.min(w,h)*density;
        const alpha=Math.min(.7,c.op*density);
        const grad=ctx.createRadialGradient(cx,cy,0,cx,cy,s);
        grad.addColorStop(0,`rgba(228,234,240,${alpha})`); grad.addColorStop(1,"rgba(228,234,240,0)");
        ctx.fillStyle=grad;
        ctx.beginPath(); ctx.ellipse(cx,cy,s*1.3,s*.7,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx-s*.6,cy+s*.15,s*.8,s*.5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+s*.7,cy+s*.1,s*.9,s*.55,0,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
}

function drawWeatherOverlay(w,h,dt){
    const type=game.weather?.type||"clear";
    if(type==="rain"||type==="storm"){
        ctx.save();
        ctx.strokeStyle=type==="storm"?"rgba(190,215,235,.55)":"rgba(190,215,235,.4)";
        ctx.lineWidth=1.5;
        for(const d of game.rainDrops){
            d.y+=d.speed*dt;
            if(d.y>1.05) d.y=-.05;
            const x=d.x*w, y=d.y*h;
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-4,y+d.len*h*1.5); ctx.stroke();
        }
        ctx.restore();
    }
    if(type==="fog"){
        const g=ctx.createLinearGradient(0,h*.25,0,h);
        g.addColorStop(0,"rgba(210,220,230,.04)"); g.addColorStop(1,"rgba(210,220,230,.35)");
        ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    }
    if(type==="storm"){
        ctx.fillStyle="rgba(5,10,20,.18)"; ctx.fillRect(0,0,w,h);
        if(Math.random()<.015){ ctx.fillStyle="rgba(255,255,255,.25)"; ctx.fillRect(0,0,w,h); }
    }
}

/* ---------------------------- MÔ PHỎNG ---------------------------- */

function randomLandPoint(){
    for(let i=0;i<500;i++){
        const x=rnd(.08,.92),y=rnd(.08,.92);
        if(game.isLand(x,y)&&!game.terrain.mountains.some(m=>dist(m,{x,y})<m.r*.8)) return {x,y};
    }
    return {x:.3,y:.4};
}

function createWorld(){
    stop();
    game.year=1; game.population=[]; game.settlements=[]; game.countries=[]; game.wars=[]; game.events=[]; game.generation=1;
    game.nextPerson=1; game.nextSettlement=1; game.nextCountry=1; game.nextWar=1;
    game.selectedSettlement=null; game.animClock=0;
    game.weather={type:"clear",years:0}; game.clouds=[]; game.rainDrops=[];
    game.settlementTarget=ri(3,7);
    game.firstCountryYear=ri(55,100);
    game.secondCountryYear=ri(115,175);
    game.expansionYear=ri(190,260);
    game.warEligibleYear=ri(130,190);
    game.majorWarYear=ri(210,275);
    createTerrain();
    ensureWeatherAssets();
    for(let i=0;i<game.settings.population;i++){ const p=randomLandPoint(); game.population.push(new Person(game.nextPerson++,p.x,p.y)); }
    addEvent(`Thế giới ${game.worldName} được hình thành.`,true);
    addEvent(`${game.settings.population} con người đầu tiên xuất hiện. Không có quốc gia nào tồn tại.`,true);
    addEvent("Thiên nhiên đã có trước nền văn minh: biển, đồng bằng, rừng, núi, hồ và sông.");
    closeSettlementModal();
    update(); resizeCanvas(); drawWorld(); start();
}

function start(){
    stop(); 
    // Chu kỳ 3 giây = 1 năm (theo yêu cầu chậm lại)
    game.timer=setInterval(()=>{ simulateYear(); update(); }, 3000); 
}
function stop(){ if(game.timer){ clearInterval(game.timer); game.timer=null; } }

function simulateYear(){
    game.year++;
    if(game.year%25===0) game.generation++;
    simulateWeather();
    simulatePeople();
    simulateSettlements();
    simulateRaids();
    formCountries();
    simulateWars();
    generateHistory();
}

function simulateWeather(){
    if(!game.weather) game.weather={type:"clear",years:0};
    game.weather.years=(game.weather.years||0)+1;
    if(game.weather.years>=ri(2,5)){
        game.weather.type=pickWeighted(WEATHER_WEIGHTS[game.settings.climate]||WEATHER_WEIGHTS.temperate);
        game.weather.years=0;
    }
    if(game.weather.type==="storm" && game.settlements.length && Math.random()<.15){
        const target=pick(game.settlements);
        if(target && target.population>4){
            const loss=Math.max(1,Math.floor(target.population*rnd(.05,.15)));
            let removed=0;
            for(const p of alive()){ if(p.settlement===target.id && removed<loss && Math.random()<.5){ p.alive=false; removed++; } }
            if(removed>0) addEvent(`🌩️ Bão lớn tàn phá ${target.name}, ${removed} người thiệt mạng.`,true);
        }
    }
}
function weatherFoodModifier(){
    switch(game.weather?.type){
        case "rain": return .06;
        case "storm": return -.05;
        case "fog": return -.02;
        case "cloudy": return .01;
        default: return game.settings.climate==="dry"?-.03:.02;
    }
}

function simulatePeople(){
    const food=game.settings.resources*(game.settings.climate==="temperate"?1.08:game.settings.climate==="wet"?1.02:.96)+weatherFoodModifier();
    for(const p of alive()){
        p.age++; p.health=clamp(p.health+rnd(-1,1),0,100);
        let death=0;
        if(p.age>78) death=.005+(p.age-78)*.01;
        if(p.age>95) death=.45;
        if(p.health<15) death+=.004;
        if(food<.7) death+=.003;
        if(Math.random()<death) p.alive=false;
    }
    const adults=alive().filter(p=>p.age>=18&&p.age<=40);
    for(const p of adults){
        if(Math.random()<.022*food){
            const b=new Person(game.nextPerson++,clamp(p.x+rnd(-.012,.012),.02,.98),clamp(p.y+rnd(-.012,.012),.02,.98),0);
            b.settlement=p.settlement; b.country=p.country; game.population.push(b);
        }
    }
    for(const p of alive()){
        if(Math.random()<.01){
            const a=rnd(0,Math.PI*2),step=rnd(.01,.025),nx=clamp(p.x+Math.cos(a)*step,.02,.98),ny=clamp(p.y+Math.sin(a)*step,.02,.98);
            if(game.isLand(nx,ny)) { p.tx=nx; p.ty=ny; } // Gán điểm đén mới thay vì dịch chuyển tức thời
        }
    }
    if(game.year<600 && alive().length<Math.max(20,game.settings.population*.25)){
        const target=Math.max(30,Math.floor(game.settings.population*.55));
        for(let i=alive().length;i<target;i++){ const q=randomLandPoint(); game.population.push(new Person(game.nextPerson++,q.x,q.y,ri(18,35))); }
        addEvent("Một làn sóng người di cư và tái định cư giúp các cộng đồng tránh sụp đổ dân số.",true);
    }
}

function makeSettlement(base){
    return {
        id:game.nextSettlement++, name:uniqueName(SETTLEMENT_NAMES),
        x:base.x, y:base.y, population:0, age:0, country:null,
        leader:{name:randomLeaderName(),title:pick(VILLAGE_TITLES)},
        tech:1, territory:.045, founded:game.year, conquests:0
    };
}

function simulateSettlements(){
    for(const s of game.settlements) s.population=alive().filter(p=>p.settlement===s.id).length;
    if(game.year>=6 && game.settlements.length<(game.settlementTarget||5) && Math.random()<0.1+game.year*0.0012){
        const base=pick(alive());
        if(base){
            const s=makeSettlement(base);
            game.settlements.push(s);
            let count=0;
            for(const p of alive()) if(dist(p,s)<.075){ p.settlement=s.id; p.tx=s.x; p.ty=s.y; count++; }
            if(count<6){ for(const p of alive().filter(p=>!p.settlement).slice(0,8)) if(dist(p,s)<.16){ p.settlement=s.id; p.tx=s.x; p.ty=s.y; } }
            s.population=alive().filter(p=>p.settlement===s.id).length;
            addEvent(`🏘️ ${s.name} được hình thành với ${s.population} cư dân, dưới sự dẫn dắt của ${s.leader.title.toLowerCase()} ${s.leader.name}.`,true);
        }
    }
    for(const s of game.settlements){
        s.age++; s.population=alive().filter(p=>p.settlement===s.id).length;
        s.territory=clamp(.032+s.population*.0016+s.age*.00025,.03,.14);
        if(Math.random()<0.012+s.age*0.0003 && s.tech<5){ s.tech=clamp(s.tech+1,1,5); addEvent(`🔧 ${s.name} tiến bộ kỹ thuật: ${TECH_NAMES[s.tech-1]}.`); }
        if(s.population>0 && s.population%15===0 && Math.random()<.12) addEvent(`🏘️ ${s.name} đang mở rộng và thu hút thêm cư dân.`);
    }
}

function simulateRaids(){
    const independents=game.settlements.filter(s=>!s.country && s.population>=10 && s.age>=5);
    for(const s of independents){
        if(Math.random()>0.05) continue;
        let target=null,best=.22;
        for(const o of independents){
            if(o.id===s.id) continue;
            const d=dist(s,o);
            if(d<best){ best=d; target=o; }
        }
        if(!target) continue;
        const atkPower=s.population*(1+s.tech*.15)*rnd(.85,1.15);
        const defPower=target.population*(1+target.tech*.15)*rnd(.85,1.15);
        if(atkPower>defPower){
            const absorbed=Math.floor(target.population*rnd(.35,.7));
            let moved=0;
            for(const p of alive()){ if(p.settlement===target.id && moved<absorbed){ p.settlement=s.id; p.tx=s.x; p.ty=s.y; moved++; } }
            s.conquests=(s.conquests||0)+1;
            if(s.tech<5 && Math.random()<.4) s.tech++;
            addEvent(`⚔️ ${s.leader.title} ${s.leader.name} dẫn dân làng ${s.name} tập kích ${target.name}, sáp nhập một phần dân cư.`,true);
            target.population=alive().filter(p=>p.settlement===target.id).length;
            if(target.population<4){
                for(const p of alive()) if(p.settlement===target.id) { p.settlement=s.id; p.tx=s.x; p.ty=s.y; }
                game.settlements=game.settlements.filter(x=>x.id!==target.id);
                addEvent(`🏚️ ${target.name} bị xóa sổ, toàn bộ dân cư sáp nhập vào ${s.name}.`,true);
            }
            if(s.conquests>=2 && !s.country && Math.random()<.6) createCountry(s);
        } else {
            addEvent(`🛡️ ${target.name} đẩy lui cuộc tập kích từ ${s.name}.`);
            if(target.tech<5 && Math.random()<.3) target.tech++;
        }
    }
}

function formCountries(){
    if(game.settlements.length<2) return;
    const eligible=game.settlements.filter(s=>!s.country&&s.population>=15&&s.age>=8);
    if(game.countries.length===0 && game.year>=game.firstCountryYear && eligible.length){
        const s=eligible.sort((a,b)=>b.population-a.population)[0]; createCountry(s);
    }
    if(game.countries.length===1 && game.year>=game.secondCountryYear && eligible.length){
        const farthest=eligible.slice().sort((a,b)=>{ const ca=game.countries[0].settlements.map(getSettlement); return Math.min(...ca.map(c=>dist(b,c)))-Math.min(...ca.map(c=>dist(a,c))); })[0];
        createCountry(farthest||eligible[0]);
    }
    if(game.countries.length<6 && game.year>=game.expansionYear){
        for(const s of eligible){
            if(game.countries.length>=6) break;
            if(Math.random()<.03+Math.random()*.02) createCountry(s);
        }
    }
    for(const c of game.countries){
        c.population=game.settlements.filter(s=>s.country===c.id).reduce((n,s)=>n+s.population,0);
        c.power=Math.max(10,c.population*.7+c.wealth*.4);
    }
    for(const s of game.settlements.filter(s=>!s.country&&s.population>=12)){
        let best=null,bd=.2;
        for(const c of game.countries) for(const sid of c.settlements){ const z=getSettlement(sid),d=dist(s,z); if(d<bd){ bd=d; best=c; } }
        if(best && Math.random()<.08){
            s.country=best.id; best.settlements.push(s.id);
            for(const p of alive()) if(p.settlement===s.id) p.country=best.id;
            addEvent(`🌐 ${best.name} mở rộng ảnh hưởng đến ${s.name}.`);
        }
    }
}

function createCountry(s){
    const leaderName=s.leader?s.leader.name:randomLeaderName();
    const c={ id:game.nextCountry++, name:uniqueName(COUNTRY_NAMES), settlements:[s.id], population:s.population,
        power:s.population*.8, wealth:50, color:COLORS[(game.nextCountry-2)%COLORS.length],
        leader:{name:leaderName,title:pick(COUNTRY_TITLES)}, founded:game.year, capital:s.id };
    game.countries.push(c); s.country=c.id;
    if(s.leader) s.leader.title=`Thị trưởng ${s.name}`;
    for(const p of alive()) if(p.settlement===s.id) p.country=c.id;
    addEvent(`🏰 ${c.leader.title} ${c.leader.name} lập nên ${c.name} từ ${s.name}. Một triều đại mới bắt đầu.`,true);
}

function simulateWars(){
    if(game.countries.length<2) return;
    for(let i=0;i<game.countries.length;i++) for(let j=i+1;j<game.countries.length;j++){
        const a=game.countries[i],b=game.countries[j];
        if(game.wars.some(w=>(w.a===a.id&&w.b===b.id)||(w.a===b.id&&w.b===a.id))) continue;
        let nearest=999;
        for(const x of a.settlements.map(getSettlement).filter(Boolean)) for(const y of b.settlements.map(getSettlement).filter(Boolean)) nearest=Math.min(nearest,dist(x,y));
        if(nearest<.20 && game.year>=game.warEligibleYear && Math.random()<0.045+Math.random()*.03){
            game.wars.push({id:game.nextWar++,a:a.id,b:b.id,age:0,score:0});
            addEvent(`⚔️ ${a.name} tuyên chiến với ${b.name}. Chiến tranh bùng nổ.`,true);
        }
    }
    if(game.year>=game.majorWarYear && game.wars.length===0){
        const a=game.countries[0],b=game.countries[1];
        if(a&&b){ game.wars.push({id:game.nextWar++,a:a.id,b:b.id,age:0,score:0}); addEvent(`⚔️ ${a.name} và ${b.name} bước vào cuộc chiến lớn đầu tiên của lịch sử.`,true); }
    }
    for(const w of [...game.wars]){
        const a=getCountry(w.a),b=getCountry(w.b); if(!a||!b) continue;
        w.age++;
        const result=a.power-b.power+rnd(-25,25); w.score+=result>0?1:-1;
        if(Math.random()<.55){
            const winner=result>=0?a:b,loser=winner===a?b:a;
            winner.power+=rnd(2,7); loser.power=Math.max(5,loser.power-rnd(1,5));
            addEvent(`⚔️ Trận chiến: ${winner.name} giành ưu thế trước ${loser.name}.`);
        }
        const warLimit=ri(8,16);
        if(w.age>=warLimit||Math.abs(w.score)>=6){
            const winner=w.score>=0?a:b,loser=winner===a?b:a;
            const target=loser.settlements.map(getSettlement).find(Boolean);
            if(target&&Math.random()<.7){ target.country=winner.id; winner.settlements.push(target.id); loser.settlements=loser.settlements.filter(id=>id!==target.id); for(const p of alive()) if(p.settlement===target.id) p.country=winner.id; addEvent(`🏳️ ${winner.name} chiếm ${target.name} sau chiến tranh.`,true); }
            addEvent(`🕊️ Chiến tranh giữa ${a.name} và ${b.name} kết thúc. ${winner.name} là bên thắng thế.`,true);
            game.wars=game.wars.filter(x=>x.id!==w.id);
        }
    }
}

function generateHistory(){
    if(game.year%25===0) addEvent(`📜 Năm ${game.year}: thế hệ ${game.generation} đang định hình xã hội.`);
    if(game.year%37===0&&game.settlements.length) addEvent("🌲 Các cộng đồng bắt đầu khai thác rừng và mở rộng vùng cư trú.");
    if(game.year%53===0&&game.settlements.length) addEvent("🌾 Một mùa sản xuất thuận lợi giúp nhiều khu định cư phát triển.");
}

/* ---------------------------- GIAO DIỆN ---------------------------- */

function setText(id,value){ const e=document.getElementById(id); if(e) e.textContent=typeof value==="number"?fmt(value):value; }
function update(){
    const a=alive();
    setText("year",game.year); setText("worldName",game.worldName); setText("population",game.population.length);
    setText("alive",a.length); setText("settlements",game.settlements.length); setText("countries",game.countries.length); setText("generation",game.generation);
    setText("resourceState",game.settings.resources<1?"Khan hiếm":game.settings.resources>1?"Dồi dào":"Cân bằng");
    setText("climateState",game.settings.climate==="dry"?"Khô":game.settings.climate==="wet"?"Ẩm":"Ôn hòa");
    setText("weatherState",WEATHER_LABELS[game.weather?.type]||WEATHER_LABELS.clear);
    const box=document.getElementById("events"); if(box) box.innerHTML=game.events.slice(0,35).map(e=>`<div class="event ${e.important?"important":""}"><b>Năm ${e.year}</b> · ${e.text}</div>`).join("");
    if(game.selectedSettlement){ const s=getSettlement(game.selectedSettlement); if(s) openSettlementModal(s,false); else closeSettlementModal(); }
}

function resizeCanvas(){
    if(!canvas) return; const r=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1;
    canvas.width=Math.max(1,r.width*d); canvas.height=Math.max(1,r.height*d); ctx.setTransform(d,0,0,d,0,0); drawWorld();
}

function showScreen(id){
    ["introScreen","setupScreen","gameScreen"].forEach(x=>document.getElementById(x)?.classList.add("hidden"));
    document.getElementById(id)?.classList.remove("hidden");
}

function setModalText(id,v){ const e=document.getElementById(id); if(e) e.textContent=v; }
function openSettlementModal(s, select=true){
    if(select) game.selectedSettlement=s.id;
    const c=s.country?getCountry(s.country):null;
    setModalText("modalName",s.name);
    setModalText("modalCountry", c?`Thuộc ${c.name}`:"Độc lập — chưa thuộc quốc gia nào");
    setModalText("modalLeader", s.leader?`${s.leader.title} ${s.leader.name}`:"Chưa rõ");
    setModalText("modalPop", fmt(s.population));
    setModalText("modalFounded", `Năm ${s.founded}`);
    setModalText("modalTerritory", `Bán kính kiểm soát ~${Math.round((s.territory||.045)*1000)} dặm quanh làng`);
    setModalText("modalTech", TECH_NAMES[clamp((s.tech||1)-1,0,4)]);
    setModalText("modalConquests", s.conquests?`${s.conquests} lần chinh phục làng khác`:"Chưa từng chinh chiến");
    setModalText("modalCountryLeader", c&&c.leader?`${c.leader.title} ${c.leader.name}`:"—");
    document.getElementById("settlementModal")?.classList.remove("hidden");
}
function closeSettlementModal(){
    game.selectedSettlement=null;
    document.getElementById("settlementModal")?.classList.add("hidden");
}

function handleCanvasClick(e){
    if(!canvas || !canvas.clientWidth) return;
    const rect=canvas.getBoundingClientRect();
    const w=rect.width,h=rect.height;
    const mx=(e.clientX-rect.left)/w, my=(e.clientY-rect.top)/h;
    let bestS=null, bd=Math.max(.028,14/Math.min(w,h));
    for(const s of game.settlements){ const d=dist(s,{x:mx,y:my}); if(d<bd){ bd=d; bestS=s; } }
    if(bestS) openSettlementModal(bestS);
}

function setup(){
    document.getElementById("startButton")?.addEventListener("click",()=>showScreen("setupScreen"));
    document.getElementById("backToIntro")?.addEventListener("click",()=>showScreen("introScreen"));
    const pop=document.getElementById("populationInput"),popValue=document.getElementById("populationValue");
    pop?.addEventListener("input",()=>{ popValue.textContent=pop.value; });
    document.querySelectorAll("#resourceChoices button").forEach(b=>b.addEventListener("click",()=>{ document.querySelectorAll("#resourceChoices button").forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); }));
    document.querySelectorAll("#climateChoices button").forEach(b=>b.addEventListener("click",()=>{ document.querySelectorAll("#climateChoices button").forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); }));
    document.getElementById("createWorldButton")?.addEventListener("click",()=>{
        game.worldName=(document.getElementById("worldNameInput")?.value||"THẾ GIỚI").trim()||"THẾ GIỚI";
        game.settings.population=Number(document.getElementById("populationInput")?.value||100);
        game.settings.resources=Number(document.querySelector("#resourceChoices button.selected")?.dataset.value||1);
        game.settings.climate=document.querySelector("#climateChoices button.selected")?.dataset.value||"temperate";
        showScreen("gameScreen"); createWorld();
    });
    
    document.getElementById("clearEvents")?.addEventListener("click",()=>{ game.events=[]; update(); });
    document.getElementById("closeSettlementModal")?.addEventListener("click",closeSettlementModal);
    document.getElementById("settlementModal")?.addEventListener("click",(e)=>{ if(e.target.id==="settlementModal") closeSettlementModal(); });
    canvas?.addEventListener("click",handleCanvasClick);
    window.addEventListener("resize",resizeCanvas);
    document.addEventListener("keydown",e=>{ if(e.code==="Escape") closeSettlementModal(); });
}

/* ---------------------------- VÒNG LẶP RENDER ---------------------------- */
let lastFrame=0;
function frameLoop(ts){
    requestAnimationFrame(frameLoop);
    if(ts-lastFrame<66) return; // ~15fps — đủ mượt cho mây/mưa/di chuyển
    game.dt=lastFrame?Math.min(.2,(ts-lastFrame)/1000):0.05;
    lastFrame=ts;
    drawWorld();
}
requestAnimationFrame(frameLoop);

setup();
