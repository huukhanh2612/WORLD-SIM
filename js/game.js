/*
 * WORLD-SIM — A living world simulation
 * Copyright © 2026 PHAN HỮU KHÁNH
 * All rights reserved.
 * V2.0 — Đồ họa chân thực, chặn đường biển, kinh tế và tài nguyên.
 */

const OWNER = "PHAN HỮU KHÁNH";
const VERSION = "V2.0";

const game = {
    year: 1, worldName: "THẾ GIỚI", mapResources: 0,
    population: [], settlements: [], countries: [], wars: [], events: [],
    terrain: { land: [], forests: [], mountains: [], lakes: [], rivers: [], animals: [] },
    settings: { population: 100, resources: 1, climate: "temperate" },
    timer: null, generation: 1, nextPerson: 1, nextSettlement: 1, nextCountry: 1, nextWar: 1,
    weather: { type: "clear", years: 0 }, selectedSettlement: null, dt: 0.04, animClock: 0
};

const SETTLEMENT_NAMES = ["An Lạc","Bình Minh","Hòa Sơn","Thanh Hà","Phú An","Tân Lộc","Minh Châu","Vạn Phúc","Nam Sơn","Đông Hải","Trường An","Thiên Phúc","Đại Sơn","Thịnh Vượng","Hải Bình"];
const COUNTRY_NAMES = ["Vương quốc An Lạc","Liên bang Bình Minh","Đế quốc Trường Sơn","Vương quốc Hải Nam","Đại Việt Sơn","Liên minh Minh Châu","Vương quốc Thanh Hà","Đế quốc Vạn Phúc"];
const COLORS = ["#c95b55","#5b82c9","#d29a4c","#6eaa69","#9a68b8","#4f9c9c","#b86f92","#8c8750"];
const LEADER_FAMILY = ["Nguyễn","Trần","Lê","Phạm","Hoàng","Vũ","Đặng","Bùi","Đỗ","Ngô","Dương","Lý","Phan","Đinh"];
const LEADER_GIVEN = ["An","Bình","Chiến","Dũng","Giang","Hải","Khánh","Lâm","Minh","Nam","Phong","Quang","Sơn","Thắng","Tuấn","Bảo","Cường","Đạt","Hùng","Kiên","Linh","Nga","Oanh","Thảo","Trang","Vy"];
const VILLAGE_TITLES = ["Trưởng làng","Già làng","Tộc trưởng"];
const COUNTRY_TITLES = ["Quốc vương","Nữ vương","Đại vương","Minh chủ"];
const TECH_NAMES = ["Công cụ đá","Đồ đồng thô sơ","Rèn đồng tinh xảo","Vũ khí sắt","Kỹ thuật rèn thép"];
const WEATHER_WEIGHTS = { dry:{clear:.55,cloudy:.25,rain:.07,storm:.06,fog:.07}, temperate:{clear:.35,cloudy:.30,rain:.18,storm:.08,fog:.09}, wet:{clear:.18,cloudy:.24,rain:.35,storm:.13,fog:.10} };
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
function addEvent(text, important=false){ game.events.unshift({year:game.year,text,important}); if(game.events.length>80) game.events.pop(); }
function pickWeighted(weights){ const r=Math.random(); let acc=0; for(const k in weights){ acc+=weights[k]; if(r<=acc) return k; } return "clear"; }
function hexAlpha(hex,a){ const h=(hex||"#e0c66f").replace("#",""); const r=parseInt(h.substring(0,2),16),g=parseInt(h.substring(2,4),16),b=parseInt(h.substring(4,6),16); return `rgba(${r},${g},${b},${a})`; }

class Person {
    constructor(id,x,y,age=ri(18,35)) {
        this.id=id; this.x=x; this.y=y; this.age=age;
        this.alive=true; this.health=ri(80,100);
        this.settlement=null; this.country=null;
        this.tx=x; this.ty=y; 
    }
}

/* ---------------------------- ĐỊA HÌNH ---------------------------- */
function createTerrain(){
    const W=64,H=40,t=game.terrain;
    t.land=[]; t.forests=[]; t.mountains=[]; t.lakes=[]; t.rivers=[]; t.animals=[];
    
    // Hình dáng lục địa
    const blobs=[ {x:.25,y:.42,rx:.22,ry:.29},{x:.62,y:.31,rx:.23,ry:.19}, {x:.61,y:.69,rx:.28,ry:.17},{x:.83,y:.68,rx:.09,ry:.12} ];
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
        const nx=(x+.5)/W, ny=(y+.5)/H; let s=0;
        for(const b of blobs) s=Math.max(s,1-Math.hypot((nx-b.x)/b.rx,(ny-b.y)/b.ry));
        s += Math.sin(nx*21+ny*8)*.035 + Math.sin(nx*43-ny*13)*.025;
        t.land.push(s>.08);
    }
    game.isLand=(x,y)=>{
        const gx=Math.floor(x*W), gy=Math.floor(y*H);
        return gx>=0&&gy>=0&&gx<W&&gy<H&&t.land[gy*W+gx];
    };

    // Tạo núi 3D chân thực (Dãy núi)
    for(let i=0;i<18;i++){
        let x=rnd(.15,.85),y=rnd(.15,.85);
        if(game.isLand(x,y)){
            let peaks = [];
            let numPeaks = ri(3, 6);
            for(let p=0; p<numPeaks; p++) {
                peaks.push({ ox: rnd(-.03, .03), oy: rnd(-.02, .02), r: rnd(.015, .035) });
            }
            t.mountains.push({x, y, peaks});
        }
    }

    // Tạo hồ tự nhiên (Đa giác lồi lõm)
    for(let i=0;i<7;i++){
        let x=rnd(.12,.88),y=rnd(.12,.88);
        if(game.isLand(x,y)){
            let rBase = rnd(.015, .03);
            let points = [];
            for(let a=0; a<Math.PI*2; a+=0.5) {
                let r = rBase * rnd(0.7, 1.3);
                points.push({ dx: Math.cos(a)*r, dy: Math.sin(a)*r });
            }
            t.lakes.push({x, y, points});
        }
    }

    // Tạo sông tự nhiên (Nhiều điểm uốn lượn đổ ra biển)
    for(let i=0;i<6;i++){
        let cx=rnd(.2,.8), cy=rnd(.2,.8);
        if(!game.isLand(cx,cy)) continue;
        let path = [{x:cx, y:cy}];
        let angle = rnd(0, Math.PI*2);
        for(let s=0; s<20; s++){
            angle += rnd(-0.6, 0.6);
            cx += Math.cos(angle)*0.03; cy += Math.sin(angle)*0.03;
            path.push({x:cx, y:cy});
            if(!game.isLand(cx,cy)) break; // Chảy ra biển thì dừng
        }
        t.rivers.push({ path });
    }

    // Rừng
    for(let i=0;i<40;i++){
        let x=rnd(.06,.94),y=rnd(.06,.94);
        if(game.isLand(x,y)){
            const trees=ri(12,25), positions=[];
            for(let k=0;k<trees;k++){
                const a=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random())*rnd(.015,.05);
                positions.push({ox:Math.cos(a)*rr,oy:Math.sin(a)*rr,tone:Math.random()});
            }
            t.forests.push({x,y,positions});
        }
    }

    // Động vật
    for(let i=0;i<40;i++){
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
        ctx.fillRect(px,py,w/W+1.5,h/H+1.5);
    }

    game.animClock=(game.animClock||0)+dt;

    // Sông chân thực
    ctx.lineCap="round"; ctx.lineJoin="round";
    for(const r of game.terrain.rivers){
        ctx.strokeStyle="#1a4f66"; ctx.lineWidth=6; ctx.beginPath();
        ctx.moveTo(r.path[0].x*w, r.path[0].y*h);
        for(let i=1; i<r.path.length; i++) ctx.lineTo(r.path[i].x*w, r.path[i].y*h);
        ctx.stroke();

        ctx.strokeStyle="#2e7c9e"; ctx.lineWidth=3.5; ctx.beginPath();
        ctx.moveTo(r.path[0].x*w, r.path[0].y*h);
        for(let i=1; i<r.path.length; i++) ctx.lineTo(r.path[i].x*w, r.path[i].y*h);
        ctx.stroke();
    }

    // Hồ tự nhiên
    ctx.fillStyle="#276f8c";
    for(const l of game.terrain.lakes){
        ctx.beginPath();
        ctx.moveTo(l.x*w + l.points[0].dx*w, l.y*h + l.points[0].dy*h);
        for(let i=1; i<l.points.length; i++) ctx.lineTo(l.x*w + l.points[i].dx*w, l.y*h + l.points[i].dy*h);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle="rgba(180,225,240,.3)"; ctx.lineWidth=2; ctx.stroke();
    }

    // Động vật (Chặn đi trên nước)
    for(const a of game.terrain.animals) {
        let dx=a.tx-a.x, dy=a.ty-a.y, d=Math.hypot(dx,dy);
        if(d<0.01) {
            a.tx=clamp(a.x+rnd(-.06,.06),.05,.95); 
            a.ty=clamp(a.y+rnd(-.06,.06),.05,.95);
        } else {
            let nx = a.x + (dx/d)*a.speed*dt;
            let ny = a.y + (dy/d)*a.speed*dt;
            if(game.isLand(nx, ny)) { a.x = nx; a.y = ny; }
            else { a.tx = a.x; a.ty = a.y; } // Chạm biển thì dừng, tìm đường khác
        }
        
        const ax=a.x*w, ay=a.y*h;
        if(a.type==="bird") {
            const wing=Math.sin(game.animClock*15)*2;
            ctx.strokeStyle="#1a1a1a"; ctx.lineWidth=1; ctx.beginPath();
            ctx.moveTo(ax-3,ay-wing); ctx.quadraticCurveTo(ax-1.5,ay+2,ax,ay); 
            ctx.quadraticCurveTo(ax+1.5,ay+2,ax+3,ay-wing); ctx.stroke();
        } else {
            ctx.fillStyle="#8c5a35"; ctx.fillRect(ax-1.5,ay-1,3,2);
            ctx.fillRect(ax+0.5,ay-2.5,1.5,1.5);
            ctx.fillStyle="#52321a"; ctx.fillRect(ax-1,ay+1,1,1.5); ctx.fillRect(ax+1,ay+1,1,1.5);
        }
    }

    // Rừng
    for(const f of game.terrain.forests){
        for(const p of f.positions){
            const x=(f.x+p.ox)*w, y=(f.y+p.oy)*h;
            ctx.fillStyle="rgba(5,15,10,.3)"; ctx.beginPath(); ctx.ellipse(x,y+3,3.5,1.5,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle="#382618"; ctx.fillRect(x-0.5, y, 1.2, 3);
            ctx.fillStyle=p.tone>.5?"#1d4a2d":"#173d26"; ctx.beginPath(); ctx.arc(x,y-1.5,3.2,0,Math.PI*2); ctx.fill();
            ctx.fillStyle=p.tone>.5?"#4d8a54":"#3f7548"; ctx.beginPath(); ctx.arc(x-1,y-3,2.2,0,Math.PI*2); ctx.fill();
        }
    }

    // Núi 3D chân thực
    for(const m of game.terrain.mountains){
        for(const p of m.peaks) {
            const px=(m.x+p.ox)*w, py=(m.y+p.oy)*h, s=p.r*Math.min(w,h);
            const grad=ctx.createLinearGradient(px-s,py-s,px+s,py+s*.65);
            grad.addColorStop(0,"#8c928a"); grad.addColorStop(.55,"#5b655f"); grad.addColorStop(1,"#363c38");
            
            ctx.fillStyle=grad; ctx.beginPath(); 
            ctx.moveTo(px,py-s); ctx.lineTo(px-s,py+s*.65); ctx.lineTo(px+s,py+s*.65); ctx.closePath(); ctx.fill();
            
            // Đổ bóng sườn núi
            ctx.fillStyle="rgba(0,0,0,.35)"; ctx.beginPath(); 
            ctx.moveTo(px,py-s); ctx.lineTo(px+s*.15,py-s*.1); ctx.lineTo(px+s,py+s*.65); ctx.lineTo(px+s*.25,py+s*.65); ctx.closePath(); ctx.fill();
            
            // Tuyết đỉnh núi
            ctx.fillStyle="#f0f5f2"; ctx.beginPath(); 
            ctx.moveTo(px,py-s); ctx.lineTo(px-s*.25,py-s*.25); ctx.lineTo(px+s*.18,py-s*.15); ctx.lineTo(px+s*.45,py+s*.25); ctx.lineTo(px-s*.45,py+s*.25); ctx.closePath(); ctx.fill();
        }
    }

    // Vùng lãnh thổ
    for(const c of game.countries){
        ctx.globalAlpha=.16; ctx.fillStyle=c.color;
        for(const s of game.settlements.filter(s=>s.country===c.id)){ ctx.beginPath(); ctx.arc(s.x*w,s.y*h,Math.min(w,h)*(s.territory||.05),0,Math.PI*2); ctx.fill(); }
        ctx.globalAlpha=1;
    }

    // Binh lính
    for(const war of game.wars){
        const a=getCountry(war.a),b=getCountry(war.b); if(!a||!b) continue;
        const sa=game.settlements.filter(s=>s.country===a.id), sb=game.settlements.filter(s=>s.country===b.id); if(!sa.length||!sb.length) continue;
        let A=sa[0],B=sb[0],best=999;
        for(const x of sa) for(const y of sb){ const d=dist(x,y); if(d<best){best=d;A=x;B=y;} }
        
        const dx=B.x-A.x, dy=B.y-A.y;
        const distAB=Math.hypot(dx,dy);
        const steps=Math.max(10, Math.floor(distAB*150));
        
        for(let i=0; i<steps; i++){
            let t = (game.animClock * 0.12 + i/steps) % 1;
            let sx = (A.x + dx*t);
            let sy = (A.y + dy*t);
            if(!game.isLand(sx,sy)) continue; // Lính không đi qua biển
            sx*=w; sy*=h;
            let jitterX = Math.sin(i*452)*4; let jitterY = Math.cos(i*213)*4;
            
            ctx.fillStyle = (i%2===0) ? a.color : b.color;
            ctx.beginPath(); ctx.arc(sx+jitterX, sy+jitterY, 1.3, 0, Math.PI*2); ctx.fill();
            
            if(t>0.4 && t<0.6 && Math.random()<0.08) {
                ctx.fillStyle = "#ff5500"; ctx.beginPath(); ctx.arc(sx+jitterX, sy+jitterY, 2.5, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = "#ffcc00"; ctx.beginPath(); ctx.arc(sx+jitterX, sy+jitterY, 1.5, 0, Math.PI*2); ctx.fill();
            }
        }
    }

    // Làng mạc (Quy mô nhà cửa phụ thuộc tài nguyên và dân số)
    for(const s of game.settlements){
        const c=getCountry(s.country), x=s.x*w, y=s.y*h;
        const R=clamp(3+s.population/16,4,11);
        if(s.population>=12){
            ctx.setLineDash([4,4]); ctx.lineWidth=1;
            ctx.strokeStyle=c?hexAlpha(c.color,.4):"rgba(224,198,111,.35)";
            ctx.beginPath(); ctx.arc(x,y,(s.territory||.045)*Math.min(w,h),0,Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Càng nhiều tài nguyên, làng càng nhiều nhà
        const houses = Math.min(10, Math.max(2, Math.floor(s.population/4) + Math.floor(s.resources/2500)));
        for(let i=0; i<houses; i++) {
            const hx = x + Math.cos(i*(Math.PI*2/houses)) * (R-1.5);
            const hy = y + Math.sin(i*(Math.PI*2/houses)) * (R-1.5);
            ctx.fillStyle = "#e0d0b8"; ctx.fillRect(hx-2.5, hy-1.5, 5, 4);
            ctx.fillStyle = c ? c.color : "#9c5539";
            ctx.beginPath(); ctx.moveTo(hx-3.5, hy-1.5); ctx.lineTo(hx, hy-4.5); ctx.lineTo(hx+3.5, hy-1.5); ctx.closePath(); ctx.fill();
        }

        if(c && c.capital===s.id){
            ctx.strokeStyle="#444"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x,y-R-16); ctx.lineTo(x,y-R-2); ctx.stroke();
            ctx.fillStyle=c.color; ctx.beginPath(); ctx.moveTo(x,y-R-16); ctx.lineTo(x+11,y-R-12); ctx.lineTo(x,y-R-8); ctx.closePath(); ctx.fill();
        }
        if(game.selectedSettlement===s.id){ ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,R+6,0,Math.PI*2); ctx.stroke(); }
    }

    // Người dân (Chặn di chuyển trên biển)
    const people=alive();
    const step=people.length>600?Math.ceil(people.length/600):1;
    for(let i=0;i<people.length;i+=step){
        const p=people[i];
        let dx=p.tx-p.x, dy=p.ty-p.y, d=Math.hypot(dx,dy);
        if(d<0.005) {
            let ntx = clamp(p.x+rnd(-.02,.02),.02,.98);
            let nty = clamp(p.y+rnd(-.02,.02),.02,.98);
            if(game.isLand(ntx, nty)) { p.tx = ntx; p.ty = nty; }
        } else {
            let nx = p.x + (dx/d)*0.01*dt; 
            let ny = p.y + (dy/d)*0.01*dt;
            if(game.isLand(nx, ny)) { p.x = nx; p.y = ny; }
            else { p.tx = p.x; p.ty = p.y; } // Chạm biển dừng lại
        }

        const x=p.x*w, y=p.y*h, c=p.country?getCountry(p.country):null;
        ctx.fillStyle = c?c.color:"#8f7966"; ctx.fillRect(x-1,y,2,3);
        ctx.fillStyle = "#fcd5ba"; ctx.beginPath(); ctx.arc(x,y-1.5,1.5,0,Math.PI*2); ctx.fill();
    }

    ctx.textAlign="center"; ctx.font="11px Arial";
    for(const s of game.settlements.filter(s=>s.population>=18)){
        ctx.fillStyle="#fff"; ctx.shadowColor="#000"; ctx.shadowBlur=5; ctx.fillText(s.name,s.x*w,s.y*h-16); ctx.shadowBlur=0;
        const c=getCountry(s.country); if(c&&c.capital===s.id){ ctx.font="bold 12px Arial"; ctx.fillStyle=c.color; ctx.fillText(c.name,s.x*w,s.y*h+21); ctx.font="11px Arial"; }
    }

    drawClouds(w,h,dt); drawWeatherOverlay(w,h,dt);
}

function drawClouds(w,h,dt){
    const type=game.weather?.type||"clear";
    const density=type==="storm"?1.5:type==="rain"?1.25:type==="cloudy"?1.15:type==="fog"?.9:.55;
    ctx.save();
    for(const c of game.clouds){
        c.x+=c.speed*dt; if(c.x>1.35) c.x=-.35;
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
        ctx.strokeStyle=type==="storm"?"rgba(190,215,235,.55)":"rgba(190,215,235,.4)"; ctx.lineWidth=1.5;
        for(const d of game.rainDrops){
            d.y+=d.speed*dt; if(d.y>1.05) d.y=-.05;
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
        if(game.isLand(x,y)) return {x,y};
    }
    return {x:.5,y:.5};
}

function createWorld(){
    stop();
    game.year=1; game.population=[]; game.settlements=[]; game.countries=[]; game.wars=[]; game.events=[]; game.generation=1;
    game.nextPerson=1; game.nextSettlement=1; game.nextCountry=1; game.nextWar=1;
    game.selectedSettlement=null; game.animClock=0;
    game.weather={type:"clear",years:0}; game.clouds=[]; game.rainDrops=[];
    
    // Khởi tạo tài nguyên Map (1 triệu đơn vị cơ sở nhân với cấu hình)
    game.mapResources = Math.floor(1000000 * game.settings.resources);

    game.settlementTarget=ri(3,7); game.firstCountryYear=ri(55,100); game.secondCountryYear=ri(115,175);
    game.expansionYear=ri(190,260); game.warEligibleYear=ri(130,190); game.majorWarYear=ri(210,275);
    createTerrain(); ensureWeatherAssets();
    for(let i=0;i<game.settings.population;i++){ const p=randomLandPoint(); game.population.push(new Person(game.nextPerson++,p.x,p.y)); }
    addEvent(`Thế giới ${game.worldName} được hình thành với ${fmt(game.mapResources)} tài nguyên thô.`,true);
    closeSettlementModal(); update(); resizeCanvas(); drawWorld(); start();
}

function start(){ stop(); game.timer=setInterval(()=>{ simulateYear(); update(); }, 3000); }
function stop(){ if(game.timer){ clearInterval(game.timer); game.timer=null; } }

function simulateYear(){
    game.year++;
    if(game.year%25===0) game.generation++;
    simulateWeather();
    simulatePeople();
    simulateEconomy(); // Vòng lặp kinh tế khai thác và xây dựng
    simulateSettlements();
    simulateRaids();
    formCountries();
    simulateWars();
    generateHistory();
}

function simulateWeather(){
    game.weather.years=(game.weather.years||0)+1;
    if(game.weather.years>=ri(2,5)){
        game.weather.type=pickWeighted(WEATHER_WEIGHTS[game.settings.climate]||WEATHER_WEIGHTS.temperate);
        game.weather.years=0;
    }
}
function weatherFoodModifier(){
    switch(game.weather?.type){
        case "rain": return .06; case "storm": return -.05;
        case "fog": return -.02; case "cloudy": return .01;
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
            let nx = clamp(p.x+rnd(-.012,.012),.02,.98); let ny = clamp(p.y+rnd(-.012,.012),.02,.98);
            if(game.isLand(nx, ny)) {
                const b=new Person(game.nextPerson++, nx, ny, 0);
                b.settlement=p.settlement; b.country=p.country; game.population.push(b);
            }
        }
    }
    for(const p of alive()){
        if(Math.random()<.01){
            const a=rnd(0,Math.PI*2),step=rnd(.01,.025);
            let nx=clamp(p.x+Math.cos(a)*step,.02,.98), ny=clamp(p.y+Math.sin(a)*step,.02,.98);
            if(game.isLand(nx,ny)) { p.tx=nx; p.ty=ny; }
        }
    }
    if(game.year<600 && alive().length<Math.max(20,game.settings.population*.25)){
        const target=Math.max(30,Math.floor(game.settings.population*.55));
        for(let i=alive().length;i<target;i++){ const q=randomLandPoint(); game.population.push(new Person(game.nextPerson++,q.x,q.y,ri(18,35))); }
        addEvent("Một làn sóng người di cư và tái định cư giúp các cộng đồng tránh sụp đổ dân số.",true);
    }
}

// KHAI THÁC TÀI NGUYÊN & SẢN XUẤT KHÍ TÀI
function simulateEconomy() {
    for(const s of game.settlements){
        // Khai thác: Mỗi người dân khai thác 5-15 đơn vị tài nguyên mỗi năm
        let gatherRate = Math.floor(s.population * rnd(5, 15) * (1 + s.tech*0.1));
        if (game.mapResources >= gatherRate) {
            game.mapResources -= gatherRate;
            s.resources += gatherRate;
        } else if (game.mapResources > 0) {
            s.resources += game.mapResources;
            game.mapResources = 0;
            addEvent("Tài nguyên thiên nhiên trên thế giới đã cạn kiệt!", true);
        }

        // Chế tạo Khí tài quân sự (Mỗi năm tự động chuyển hóa ~10% tài nguyên dư thừa thành vũ khí/đồ phòng thủ)
        if(s.resources > 500) {
            let build = Math.floor(s.resources * 0.1);
            s.resources -= build;
            s.military += build * (s.tech * 0.5); // Tech cao, sản xuất vũ khí hiệu quả hơn
        }
    }
}

function makeSettlement(base){
    return {
        id:game.nextSettlement++, name:uniqueName(SETTLEMENT_NAMES),
        x:base.x, y:base.y, population:0, age:0, country:null,
        leader:{name:randomLeaderName(),title:pick(VILLAGE_TITLES)},
        tech:1, territory:.045, founded:game.year, conquests:0,
        resources: 100, military: 10 // Khởi tạo ban đầu
    };
}

function simulateSettlements(){
    for(const s of game.settlements) s.population=alive().filter(p=>p.settlement===s.id).length;
    if(game.year>=6 && game.settlements.length<(game.settlementTarget||5) && Math.random()<0.1+game.year*0.0012){
        const base=pick(alive());
        if(base){
            const s=makeSettlement(base); game.settlements.push(s);
            let count=0;
            for(const p of alive()) if(dist(p,s)<.075){ p.settlement=s.id; p.tx=s.x; p.ty=s.y; count++; }
            if(count<6){ for(const p of alive().filter(p=>!p.settlement).slice(0,8)) if(dist(p,s)<.16){ p.settlement=s.id; p.tx=s.x; p.ty=s.y; } }
            s.population=alive().filter(p=>p.settlement===s.id).length;
            addEvent(`🏘️ ${s.name} được hình thành, bắt đầu khai thác gỗ và đá xây dựng làng.`,true);
        }
    }
    for(const s of game.settlements){
        s.age++; s.population=alive().filter(p=>p.settlement===s.id).length;
        s.territory=clamp(.032+s.population*.0016+s.age*.00025,.03,.14);
        if(Math.random()<0.012+s.age*0.0003 && s.tech<5){ s.tech=clamp(s.tech+1,1,5); addEvent(`🔧 ${s.name} tiến bộ kỹ thuật: ${TECH_NAMES[s.tech-1]}.`); }
    }
}

function simulateRaids(){
    const independents=game.settlements.filter(s=>!s.country && s.population>=10 && s.age>=5);
    for(const s of independents){
        if(Math.random()>0.05) continue;
        let target=null,best=.22;
        for(const o of independents){
            if(o.id===s.id) continue;
            const d=dist(s,o); if(d<best){ best=d; target=o; }
        }
        if(!target) continue;
        // Tính sức mạnh dựa vào Khí tài và Quân số
        const atkPower= (s.population + s.military*0.2) * rnd(.85,1.15);
        const defPower= (target.population + target.military*0.2) * rnd(.85,1.15);
        if(atkPower>defPower){
            const absorbed=Math.floor(target.population*rnd(.35,.7)); let moved=0;
            for(const p of alive()){ if(p.settlement===target.id && moved<absorbed){ p.settlement=s.id; p.tx=s.x; p.ty=s.y; moved++; } }
            
            // Cướp tài nguyên và khí tài
            s.resources += Math.floor(target.resources * 0.5);
            s.military += Math.floor(target.military * 0.3);
            target.resources = Math.floor(target.resources * 0.5);
            target.military = Math.floor(target.military * 0.7);

            s.conquests=(s.conquests||0)+1;
            addEvent(`⚔️ ${s.name} tập kích ${target.name}, chiếm đoạt tài nguyên và sáp nhập dân cư.`,true);
            target.population=alive().filter(p=>p.settlement===target.id).length;
            if(target.population<4){
                for(const p of alive()) if(p.settlement===target.id) { p.settlement=s.id; p.tx=s.x; p.ty=s.y; }
                s.resources += target.resources; s.military += target.military;
                game.settlements=game.settlements.filter(x=>x.id!==target.id);
                addEvent(`🏚️ ${target.name} bị xóa sổ. Của cải thuộc về ${s.name}.`,true);
            }
            if(s.conquests>=2 && !s.country && Math.random()<.6) createCountry(s);
        } else {
            target.military = Math.max(0, target.military - rnd(5, 15)); // Tiêu hao khí tài sau thủ thành
            addEvent(`🛡️ ${target.name} đẩy lui cuộc tập kích từ ${s.name}.`);
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
        for(const s of eligible){ if(game.countries.length>=6) break; if(Math.random()<.03) createCountry(s); }
    }
    for(const c of game.countries){
        const sList = game.settlements.filter(s=>s.country===c.id);
        c.population=sList.reduce((n,s)=>n+s.population,0);
        c.totalResources = sList.reduce((n,s)=>n+s.resources,0);
        c.totalMilitary = sList.reduce((n,s)=>n+s.military,0);
        c.power= c.population*0.4 + c.totalMilitary*0.6; // Sức mạnh quốc gia phụ thuộc lớn vào Khí tài
    }
    for(const s of game.settlements.filter(s=>!s.country&&s.population>=12)){
        let best=null,bd=.2;
        for(const c of game.countries) for(const sid of c.settlements){ const z=getSettlement(sid),d=dist(s,z); if(d<bd){ bd=d; best=c; } }
        if(best && Math.random()<.08){
            s.country=best.id; best.settlements.push(s.id);
            for(const p of alive()) if(p.settlement===s.id) p.country=best.id;
            addEvent(`🌐 ${best.name} mở rộng ảnh hưởng, thâu tóm ${s.name} và tài nguyên của họ.`);
        }
    }
}

function createCountry(s){
    const leaderName=s.leader?s.leader.name:randomLeaderName();
    const c={ id:game.nextCountry++, name:uniqueName(COUNTRY_NAMES), settlements:[s.id], population:s.population,
        totalResources:s.resources, totalMilitary:s.military, power:s.population*.4+s.military*.6, color:COLORS[(game.nextCountry-2)%COLORS.length],
        leader:{name:leaderName,title:pick(COUNTRY_TITLES)}, founded:game.year, capital:s.id };
    game.countries.push(c); s.country=c.id;
    if(s.leader) s.leader.title=`Thị trưởng ${s.name}`;
    for(const p of alive()) if(p.settlement===s.id) p.country=c.id;
    addEvent(`🏰 ${c.leader.title} ${c.leader.name} lập nên ${c.name} từ ${s.name}.`,true);
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
            addEvent(`⚔️ ${a.name} tuyên chiến với ${b.name} vì tranh giành lãnh thổ.`,true);
        }
    }
    for(const w of [...game.wars]){
        const a=getCountry(w.a),b=getCountry(w.b); if(!a||!b) continue;
        w.age++;
        const result=a.power-b.power+rnd(-50,50); w.score+=result>0?1:-1;
        
        // Tiêu hao khí tài
        const aCap = getSettlement(a.capital); const bCap = getSettlement(b.capital);
        if(aCap) aCap.military = Math.max(0, aCap.military - rnd(10, 30));
        if(bCap) bCap.military = Math.max(0, bCap.military - rnd(10, 30));

        if(Math.random()<.55){
            const winner=result>=0?a:b,loser=winner===a?b:a;
            addEvent(`⚔️ Trận chiến: ${winner.name} dùng khí tài áp đảo ${loser.name}.`);
        }
        if(w.age>=ri(8,16)||Math.abs(w.score)>=6){
            const winner=w.score>=0?a:b,loser=winner===a?b:a;
            const target=loser.settlements.map(getSettlement).find(Boolean);
            if(target&&Math.random()<.7){ 
                target.country=winner.id; winner.settlements.push(target.id); loser.settlements=loser.settlements.filter(id=>id!==target.id); 
                for(const p of alive()) if(p.settlement===target.id) p.country=winner.id; 
                addEvent(`🏳️ ${winner.name} chiếm cứ điểm ${target.name} và thu giữ toàn bộ khí tài.`,true); 
            }
            addEvent(`🕊️ Chiến tranh kết thúc. ${winner.name} giành thắng lợi.`,true);
            game.wars=game.wars.filter(x=>x.id!==w.id);
        }
    }
}

function generateHistory(){
    if(game.year%25===0) addEvent(`📜 Năm ${game.year}: thế hệ ${game.generation} đang mở rộng cơ sở hạ tầng.`);
}

/* ---------------------------- GIAO DIỆN ---------------------------- */

function setText(id,value){ const e=document.getElementById(id); if(e) e.textContent=typeof value==="number"?fmt(value):value; }
function update(){
    const a=alive();
    setText("year",game.year); setText("worldName",game.worldName); setText("population",game.population.length);
    setText("alive",a.length); setText("settlements",game.settlements.length); setText("countries",game.countries.length); setText("generation",game.generation);
    setText("mapTotalResources", fmt(game.mapResources));
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
    setModalText("modalCountry", c?`Thuộc ${c.name} (Tổng tài nguyên QG: ${fmt(c.totalResources)})`:"Độc lập — chưa thuộc quốc gia nào");
    setModalText("modalLeader", s.leader?`${s.leader.title} ${s.leader.name}`:"Chưa rõ");
    setModalText("modalPop", fmt(s.population));
    setModalText("modalResources", fmt(Math.floor(s.resources)));
    setModalText("modalMilitary", fmt(Math.floor(s.military)));
    setModalText("modalTech", TECH_NAMES[clamp((s.tech||1)-1,0,4)]);
    setModalText("modalConquests", s.conquests?`${s.conquests} lần chinh phục làng khác`:"Chưa từng chinh chiến");
    setModalText("modalCountryLeader", c&&c.leader?`${c.leader.title} ${c.leader.name}`:"—");
    document.getElementById("settlementModal")?.classList.remove("hidden");
}
function closeSettlementModal(){ game.selectedSettlement=null; document.getElementById("settlementModal")?.classList.add("hidden"); }

function handleCanvasClick(e){
    if(!canvas || !canvas.clientWidth) return;
    const rect=canvas.getBoundingClientRect(), w=rect.width, h=rect.height;
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
    if(ts-lastFrame<66) return;
    game.dt=lastFrame?Math.min(.2,(ts-lastFrame)/1000):0.05;
    lastFrame=ts; drawWorld();
}
requestAnimationFrame(frameLoop);

setup();
