/*
 * WORLD-SIM — A living world simulation
 * Copyright © 2026 PHAN HỮU KHÁNH
 * All rights reserved.
 *
 * V0.5 — simulation engine
 * Dân số, sinh tử, di cư, làng, quốc gia, lãnh thổ,
 * tài nguyên, khí hậu, cây cối, chiến tranh và lịch sử.
 */

const OWNER = "PHAN HỮU KHÁNH";
const VERSION = "V0.5";

const game = {
    year: 1,
    worldName: "THẾ GIỚI",
    population: [],
    settlements: [],
    countries: [],
    wars: [],
    events: [],
    eventKeys: new Set(),
    terrain: { forests: [], mountains: [], lakes: [], rivers: [] },
    settings: { population: 100, resources: 1, climate: "temperate" },
    paused: true,
    timer: null,
    generation: 1,
    lastEventYear: 0,
    nextPopulationId: 1,
    nextSettlementId: 1,
    nextCountryId: 1,
    nextWarId: 1,
    stats: { births: 0, deaths: 0, migrations: 0, disasters: 0, battles: 0 }
};

class Person {
    constructor(id, x, y, age = randomInt(16, 40)) {
        this.id = id;
        this.age = age;
        this.x = x;
        this.y = y;
        this.alive = true;
        this.settlementId = null;
        this.birthYear = game.year - age;
        this.health = randomInt(70, 100);
        this.energy = randomInt(60, 95);
    }
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function random(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function formatNumber(n) { return Math.round(n).toLocaleString("vi-VN"); }
function alivePeople() { return game.population.filter(p => p.alive); }
function getSettlement(id) { return game.settlements.find(s => s.id === id); }
function getCountry(id) { return game.countries.find(c => c.id === id); }

function addEvent(text, key = null, important = false) {
    if (key && game.eventKeys.has(key)) return false;
    if (key) game.eventKeys.add(key);
    game.events.unshift({ year: game.year, text, important });
    if (game.events.length > 80) game.events.pop();
    return true;
}

function createInitialWorld() {
    stopSimulation();
    game.year = 1;
    game.population = [];
    game.settlements = [];
    game.countries = [];
    game.wars = [];
    game.events = [];
    game.eventKeys = new Set();
    game.terrain = { forests: [], mountains: [], lakes: [], rivers: [] };
    game.generation = 1;
    game.lastEventYear = 0;
    game.nextPopulationId = 1;
    game.nextSettlementId = 1;
    game.nextCountryId = 1;
    game.nextWarId = 1;
    game.stats = { births: 0, deaths: 0, migrations: 0, disasters: 0, battles: 0 };

    generateTerrain();

    for (let i = 0; i < game.settings.population; i++) {
        let p;
        do {
            p = new Person(game.nextPopulationId++, random(.14, .86), random(.14, .86));
        } while (isWater(p.x, p.y));
        game.population.push(p);
    }

    addEvent(`Thế giới ${game.worldName} được hình thành.`, "world-created", true);
    addEvent(`${game.settings.population} con người đầu tiên xuất hiện giữa một vùng đất hoang sơ.`, "first-people", true);
    addEvent("Không có quốc gia, không có biên giới và không có vị vua nào. Lịch sử bắt đầu từ con số không.", "zero-countries");

    updateUI();
    resizeCanvas();
    startSimulation();
}

/* ---------------- TIME ENGINE ---------------- */
function startSimulation() {
    stopSimulation();
    game.paused = false;
    updatePauseButtons();
    game.timer = setInterval(() => {
        if (!game.paused) runYears(1, true);
    }, 1200);
}

function stopSimulation() {
    if (game.timer !== null) {
        clearInterval(game.timer);
        game.timer = null;
    }
}

function togglePause() {
    game.paused = !game.paused;
    updatePauseButtons();
    const hint = document.getElementById("mapHint");
    if (hint) hint.textContent = game.paused ? "Thời gian đã tạm dừng." : "Thời gian đang tự trôi...";
}

function updatePauseButtons() {
    const label = game.paused ? "▶ TIẾP TỤC" : "⏸ TẠM DỪNG";
    const desktop = document.getElementById("pauseButton");
    const mobile = document.getElementById("mobilePause");
    if (desktop) desktop.textContent = label;
    if (mobile) mobile.textContent = game.paused ? "▶" : "⏸";
}

function runYears(years) {
    const count = Math.max(1, Math.floor(years));
    for (let i = 0; i < count; i++) simulateYear();
    updateUI();
    drawWorld();
}

/* ---------------- TERRAIN ---------------- */
function generateTerrain() {
    const t = game.terrain;
    for (let i = 0; i < 14; i++) {
        let x = random(.10, .90), y = random(.12, .88);
        if (!t.lakes.some(l => Math.hypot(l.x - x, l.y - y) < .12)) t.lakes.push({ x, y, r: random(.025, .07) });
    }
    for (let i = 0; i < 9; i++) t.mountains.push({ x: random(.12, .88), y: random(.12, .88), r: random(.035, .09), angle: random(-.7, .7) });
    for (let i = 0; i < 20; i++) t.forests.push({ x: random(.08, .92), y: random(.08, .92), r: random(.025, .08), density: randomInt(5, 14) });
    for (let i = 0; i < 3; i++) {
        const x = random(.2, .8), y = random(.15, .35);
        t.rivers.push({ x, y, bend: random(-.3, .3) });
    }
}

function isWater(x, y) {
    return game.terrain.lakes.some(l => Math.hypot(l.x - x, l.y - y) < l.r * .72);
}

function isMountain(x, y) {
    return game.terrain.mountains.some(m => Math.hypot(m.x - x, m.y - y) < m.r * .65);
}

/* ---------------- YEAR SIMULATION ---------------- */
function simulateYear() {
    game.year++;

    simulateClimate();
    simulatePeople();
    simulateSettlements();
    simulateCountries();
    simulateWars();
    simulateRandomHistory();

    if (game.year % 25 === 0) {
        game.generation++;
        addEvent(`Thế hệ thứ ${game.generation} đang trưởng thành. Những con người sinh ra từ thuở đầu đã trở thành ký ức của lịch sử.`, `generation-${game.generation}`, true);
    }
}

function simulateClimate() {
    const climate = game.settings.climate;
    if (game.year % randomInt(18, 35) !== 0) return;

    const settlements = game.settlements.filter(s => s.population > 0);
    if (!settlements.length) return;

    if (climate === "dry" && Math.random() < .55) {
        const s = settlements[randomInt(0, settlements.length - 1)];
        s.prosperity = clamp(s.prosperity - random(8, 22), 0, 100);
        game.stats.disasters++;
        addEvent(`Một đợt hạn hán kéo dài tàn phá mùa màng quanh ${s.name}. Dân cư bắt đầu tìm vùng đất mới.`, `drought-${game.year}`, true);
    } else if (climate === "wet" && Math.random() < .55) {
        const s = settlements[randomInt(0, settlements.length - 1)];
        s.prosperity = clamp(s.prosperity - random(5, 18), 0, 100);
        game.stats.disasters++;
        addEvent(`Mưa lũ bất thường nhấn chìm một phần ${s.name}. Nhiều gia đình phải rời bỏ nhà cửa.`, `flood-${game.year}`, true);
    } else {
        const s = settlements[randomInt(0, settlements.length - 1)];
        s.prosperity = clamp(s.prosperity + random(5, 14), 0, 100);
        addEvent(`${s.name} trải qua một mùa thuận lợi; kho lương thực đầy lên và dân số tăng nhanh.`, `good-season-${game.year}`);
    }
}

function simulatePeople() {
    const resourceFactor = game.settings.resources;
    const climateFactor = game.settings.climate === "temperate" ? 1.05 : game.settings.climate === "wet" ? 1 : .91;
    const food = resourceFactor * climateFactor;

    for (const p of alivePeople()) {
        p.age++;
        p.energy = clamp(p.energy + random(-7, 6), 0, 100);
        p.health = clamp(p.health + random(-3, 3), 0, 100);

        let deathChance = 0;
        if (p.age >= 68) deathChance = .006 + (p.age - 68) * .017;
        if (p.health < 25) deathChance += .02;
        if (food < .75) deathChance += .012;

        if (Math.random() < Math.min(.75, deathChance)) {
            p.alive = false;
            game.stats.deaths++;
        }
    }

    const adults = alivePeople().filter(p => p.age >= 18 && p.age <= 40);
    const birthRate = (.016 + resourceFactor * .012) * climateFactor;
    for (const p of adults) {
        if (Math.random() < birthRate) {
            const baby = new Person(
                game.nextPopulationId++,
                clamp(p.x + random(-.025, .025), .03, .97),
                clamp(p.y + random(-.025, .025), .03, .97),
                0
            );
            baby.health = randomInt(70, 100);
            baby.energy = randomInt(65, 90);
            game.population.push(baby);
            game.stats.births++;
        }
    }

    for (const p of alivePeople()) {
        const s = getSettlement(p.settlementId);
        const migrationChance = s && s.population > 45 ? .035 : .008;
        if (Math.random() < migrationChance) {
            p.x = clamp(p.x + random(-.055, .055), .03, .97);
            p.y = clamp(p.y + random(-.055, .055), .03, .97);
            p.settlementId = null;
            game.stats.migrations++;
        }
    }
}

/* ---------------- SETTLEMENTS ---------------- */
function simulateSettlements() {
    const people = alivePeople();

    for (const p of people.filter(x => x.settlementId === null)) {
        const nearby = people.filter(q => q !== p && q.settlementId === null && distance(p, q) < .055);
        if (nearby.length < 7) continue;

        const existing = game.settlements.find(s => distance(s, p) < .065);
        if (existing) {
            p.settlementId = existing.id;
            continue;
        }

        if (game.settlements.length >= 80) continue;
        const s = {
            id: game.nextSettlementId++,
            name: generateUniqueSettlementName(),
            x: p.x,
            y: p.y,
            population: nearby.length + 1,
            age: 0,
            countryId: null,
            prosperity: random(40, 65),
            walls: 0
        };
        game.settlements.push(s);
        for (const q of people) if (distance(s, q) < .065) q.settlementId = s.id;
        addEvent(`Một khu định cư mang tên ${s.name} ra đời. Những gia đình đầu tiên bắt đầu dựng nhà và khai phá đất.`, `settlement-${s.id}`, true);
    }

    for (const s of game.settlements) {
        const members = alivePeople().filter(p => p.settlementId === s.id);
        s.population = members.length;
        s.age++;
        s.prosperity = clamp(s.prosperity + random(-2.5, 3.5) + (game.settings.resources - 1) * 2, 0, 100);
        if (s.population > 25) s.walls = clamp(s.walls + .04, 0, 1);
        if (s.population === 0) s.abandoned = true;
    }

    for (const s of game.settlements) {
        if (s.population >= 35 && s.age > 8 && Math.random() < .012) {
            s.population += 0;
            addEvent(`${s.name} bắt đầu xây dựng những công trình lớn hơn. Khu định cư đang chuyển mình thành một đô thị sơ khai.`, `city-growth-${s.id}-${Math.floor(game.year / 20)}`);
        }
    }

    game.settlements = game.settlements.filter(s => !s.abandoned || s.age < 4);
}

/* ---------------- COUNTRIES ---------------- */
function simulateCountries() {
    for (const s of game.settlements) {
        if (s.countryId || s.population < 28 || s.age < 12) continue;
        if (Math.random() > .018) continue;

        const c = {
            id: game.nextCountryId++,
            name: generateUniqueCountryName(),
            settlementIds: [s.id],
            population: s.population,
            power: Math.max(8, s.population * .18),
            wealth: s.prosperity,
            age: 0,
            wars: 0,
            colorSeed: Math.random()
        };
        game.countries.push(c);
        s.countryId = c.id;
        addEvent(`${c.name} ra đời từ ${s.name}. Một chính quyền đầu tiên tuyên bố quyền cai quản vùng đất xung quanh.`, `country-${c.id}`, true);
    }

    for (const c of game.countries) {
        c.age++;
        const towns = game.settlements.filter(s => c.settlementIds.includes(s.id));
        c.population = towns.reduce((sum, s) => sum + s.population, 0);
        c.wealth = clamp(c.wealth + random(-1.5, 2.5) + towns.length * .1, 0, 100);
        c.power = Math.max(1, c.population * .16 + c.age * .55 + towns.length * 8 + c.wealth * .12);

        if (c.age > 15 && Math.random() < .018) {
            const base = towns[0];
            const candidate = base && game.settlements.find(s => !s.countryId && s.population >= 10 && distance(s, base) < .15);
            if (candidate) {
                candidate.countryId = c.id;
                c.settlementIds.push(candidate.id);
                addEvent(`${c.name} mở rộng lãnh thổ tới ${candidate.name}. Biên giới của quốc gia bắt đầu xuất hiện trên bản đồ.`, `expand-${c.id}-${candidate.id}-${game.year}`, true);
            }
        }
    }
}

/* ---------------- WAR SYSTEM ---------------- */
function simulateWars() {
    game.wars = game.wars.filter(w => w.active);

    if (game.countries.length < 2) return;

    // Existing wars produce battles every few years.
    for (const war of game.wars) {
        if (!war.active || game.year - war.lastBattle < 2) continue;
        const a = getCountry(war.attacker), d = getCountry(war.defender);
        if (!a || !d) { war.active = false; continue; }
        resolveBattle(war, a, d);
    }

    // New wars are based on power, proximity and accumulated tension.
    if (game.wars.length >= 4 || Math.random() > .035) return;

    const candidates = [];
    for (let i = 0; i < game.countries.length; i++) {
        for (let j = i + 1; j < game.countries.length; j++) {
            const a = game.countries[i], b = game.countries[j];
            if (game.wars.some(w => w.active && ((w.attacker === a.id && w.defender === b.id) || (w.attacker === b.id && w.defender === a.id)))) continue;
            const ta = game.settlements.find(s => a.settlementIds.includes(s.id));
            const tb = game.settlements.find(s => b.settlementIds.includes(s.id));
            if (!ta || !tb) continue;
            const proximity = distance(ta, tb);
            if (proximity < .28) candidates.push({ a, b, proximity });
        }
    }

    if (!candidates.length) return;
    const pair = candidates[randomInt(0, candidates.length - 1)];
    const attacker = pair.a.power >= pair.b.power ? pair.a : pair.b;
    const defender = attacker.id === pair.a.id ? pair.b : pair.a;

    const war = {
        id: game.nextWarId++,
        attacker: attacker.id,
        defender: defender.id,
        startYear: game.year,
        lastBattle: game.year,
        active: true,
        battles: 0,
        attackerScore: 0,
        defenderScore: 0
    };
    game.wars.push(war);
    attacker.wars++;
    defender.wars++;
    addEvent(`CHIẾN TRANH: ${attacker.name} tuyên chiến với ${defender.name}. Quân đội bắt đầu tiến về biên giới.`, `war-${war.id}`, true);
}

function resolveBattle(war, attacker, defender) {
    war.lastBattle = game.year;
    war.battles++;
    game.stats.battles++;

    const aForce = attacker.power * random(.72, 1.28);
    const dForce = defender.power * random(.72, 1.28);
    const total = aForce + dForce;
    const aLoss = Math.max(1, Math.round((dForce / total) * attacker.population * random(.002, .012)));
    const dLoss = Math.max(1, Math.round((aForce / total) * defender.population * random(.002, .014)));

    attacker.population = Math.max(1, attacker.population - aLoss);
    defender.population = Math.max(1, defender.population - dLoss);

    if (aForce > dForce) {
        war.attackerScore += 1;
        addEvent(`Trận chiến năm ${game.year}: ${attacker.name} giành ưu thế trước ${defender.name}. Tổn thất khoảng ${formatNumber(dLoss)} người.`, `battle-${war.id}-${war.battles}`, true);
    } else {
        war.defenderScore += 1;
        addEvent(`Trận chiến năm ${game.year}: ${defender.name} đẩy lùi quân ${attacker.name}. Tổn thất khoảng ${formatNumber(aLoss)} người.`, `battle-${war.id}-${war.battles}`, true);
    }

    if (war.battles >= randomInt(3, 8) || Math.abs(war.attackerScore - war.defenderScore) >= 4) {
        finishWar(war, attacker, defender);
    }
}

function finishWar(war, attacker, defender) {
    const winner = war.attackerScore >= war.defenderScore ? attacker : defender;
    const loser = winner.id === attacker.id ? defender : attacker;
    war.active = false;

    const target = game.settlements.find(s => loser.settlementIds.includes(s.id) && s.id !== game.settlements.find(x => winner.settlementIds.includes(x.id))?.id);
    if (target && Math.random() < .5) {
        target.countryId = winner.id;
        loser.settlementIds = loser.settlementIds.filter(id => id !== target.id);
        if (!winner.settlementIds.includes(target.id)) winner.settlementIds.push(target.id);
        addEvent(`${winner.name} chiến thắng và chiếm ${target.name}. Biên giới của khu vực đã thay đổi.`, `war-end-${war.id}`, true);
    } else {
        addEvent(`Chiến tranh giữa ${attacker.name} và ${defender.name} kết thúc. ${winner.name} được xem là bên thắng cuộc.`, `war-end-${war.id}`, true);
    }
}

/* ---------------- HISTORY EVENTS ---------------- */
function simulateRandomHistory() {
    if (game.year - game.lastEventYear < 3) return;
    const alive = alivePeople();
    const settlements = game.settlements.filter(s => s.population > 0);
    const countries = game.countries;
    const roll = Math.random();
    let happened = false;

    if (roll < .08 && alive.length > 40) {
        happened = addEvent("Một làn sóng di cư lớn làm thay đổi phân bố dân cư. Những nhóm người mới tìm vùng đất thuận lợi để sinh sống.", `migration-${game.year}`);
    } else if (roll < .14 && settlements.length) {
        const s = settlements[randomInt(0, settlements.length - 1)];
        s.prosperity = clamp(s.prosperity + random(6, 16), 0, 100);
        happened = addEvent(`${s.name} trải qua một mùa bội thu. Dân cư tích lũy lương thực và bắt đầu thịnh vượng.`, `harvest-${game.year}`);
    } else if (roll < .19 && settlements.length) {
        const s = settlements[randomInt(0, settlements.length - 1)];
        happened = addEvent(`Một nhóm thợ thủ công tại ${s.name} phát triển kỹ thuật mới, giúp công cụ và nhà cửa bền hơn.`, `craft-${game.year}`);
    } else if (roll < .24 && countries.length) {
        const c = countries[randomInt(0, countries.length - 1)];
        c.wealth = clamp(c.wealth + 10, 0, 100);
        happened = addEvent(`${c.name} mở một tuyến thương mại mới. Hàng hóa bắt đầu lưu thông giữa các vùng đất.`, `trade-${c.id}-${game.year}`);
    } else if (roll < .28 && countries.length >= 2) {
        const c = countries[randomInt(0, countries.length - 1)];
        happened = addEvent(`${c.name} trải qua một cuộc tranh luận quyền lực trong triều đình. Những phe phái mới bắt đầu xuất hiện.`, `politics-${c.id}-${game.year}`);
    }

    if (happened) game.lastEventYear = game.year;
}

/* ---------------- NAMES ---------------- */
const A = ["An", "Bình", "Minh", "Tân", "Hòa", "Long", "Thanh", "Vĩnh", "Nam", "Phú", "Đông", "Thịnh", "Khải", "Lâm", "Quang", "Sơn", "Hải", "Nguyên"];
const B = ["Thủy", "Sơn", "Lâm", "Giang", "Phong", "Hà", "Nguyên", "Thịnh", "Châu", "Đô", "Bình", "Việt", "Khê", "Hải", "Phúc", "Điền"];
const C1 = ["Vương quốc", "Liên bang", "Đế quốc", "Cộng hòa", "Liên minh", "Đại công quốc"];
const C2 = ["An", "Minh", "Hòa", "Long", "Nam", "Thanh", "Vĩnh", "Đông", "Hải", "Phúc", "Thịnh", "Việt"];

function uniqueName(generator, existing) {
    for (let i = 0; i < 100; i++) {
        const n = generator();
        if (!existing.has(n)) return n;
    }
    return `${generator()} ${randomInt(2, 999)}`;
}
function generateUniqueSettlementName() { return uniqueName(() => `${A[randomInt(0, A.length - 1)]} ${B[randomInt(0, B.length - 1)]}`, new Set(game.settlements.map(s => s.name))); }
function generateUniqueCountryName() { return uniqueName(() => `${C1[randomInt(0, C1.length - 1)]} ${C2[randomInt(0, C2.length - 1)]}`, new Set(game.countries.map(c => c.name))); }

/* ---------------- UI ---------------- */
function updateUI() {
    const alive = alivePeople().length;
    document.getElementById("year").textContent = formatNumber(game.year);
    document.getElementById("worldName").textContent = game.worldName;
    document.getElementById("population").textContent = formatNumber(game.population.length);
    document.getElementById("alive").textContent = formatNumber(alive);
    document.getElementById("settlements").textContent = game.settlements.filter(s => s.population > 0).length;
    document.getElementById("countries").textContent = game.countries.length;
    document.getElementById("generation").textContent = game.generation;
    document.getElementById("resourceState").textContent = game.settings.resources < 1 ? "Khan hiếm" : game.settings.resources > 1 ? "Dồi dào" : "Cân bằng";
    document.getElementById("climateState").textContent = game.settings.climate === "dry" ? "Khô" : game.settings.climate === "wet" ? "Ẩm" : "Ôn hòa";
    renderEvents();
    updatePauseButtons();
}

function renderEvents() {
    const box = document.getElementById("events");
    box.innerHTML = game.events.map(e => `<div class="event ${e.important ? "important" : ""}"><strong>Năm ${e.year}</strong> · ${escapeHtml(e.text)}</div>`).join("");
}
function escapeHtml(text) {
    return text.replace(/[&<>\'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[c]));
}

/* ---------------- MAP ---------------- */
const canvas = document.getElementById("worldCanvas");
const ctx = canvas.getContext("2d");
function resizeCanvas() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, r.width * dpr);
    canvas.height = Math.max(1, r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorld();
}
window.addEventListener("resize", resizeCanvas);

function drawWorld() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // Ocean
    ctx.fillStyle = "#102a40";
    ctx.fillRect(0, 0, w, h);

    // Landmass
    const land = [
        [.08,.26],[.18,.12],[.34,.09],[.50,.15],[.63,.11],[.80,.22],[.91,.38],[.84,.58],[.75,.72],[.60,.83],[.40,.88],[.23,.80],[.11,.62],[.06,.43]
    ];
    ctx.beginPath();
    land.forEach((p, i) => i ? ctx.lineTo(p[0]*w,p[1]*h) : ctx.moveTo(p[0]*w,p[1]*h));
    ctx.closePath();
    ctx.fillStyle = game.settings.climate === "dry" ? "#75663d" : game.settings.climate === "wet" ? "#3f6f48" : "#4e7042";
    ctx.fill();

    // Subtle elevation bands
    ctx.globalAlpha = .12;
    for (let i=0;i<6;i++) {
        ctx.beginPath();
        ctx.ellipse(w*(.2+i*.12), h*(.55-i*.025), w*(.28-i*.025), h*(.18+i*.012), i*.25, 0, Math.PI*2);
        ctx.fillStyle = "#d8c58a";
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Lakes
    for (const l of game.terrain.lakes) {
        ctx.beginPath();
        ctx.ellipse(l.x*w,l.y*h,l.r*w,l.r*h*.7,0,0,Math.PI*2);
        ctx.fillStyle="#2d6881";
        ctx.fill();
    }

    // Rivers
    ctx.strokeStyle="#5b9ab1";
    ctx.lineWidth=2.5;
    for (const r of game.terrain.rivers) {
        ctx.beginPath();
        ctx.moveTo(r.x*w,r.y*h);
        ctx.bezierCurveTo(r.x*w-.08*w,(r.y+.15)*h,(r.x+.08)*w,(r.y+.28)*h,(r.x+.01)*w,(r.y+.48)*h);
        ctx.bezierCurveTo(r.x*w-.02*w,(r.y+.62)*h,(r.x+.09)*w,(r.y+.72)*h,(r.x+.15)*w,(r.y+.82)*h);
        ctx.stroke();
    }

    // Forests / trees
    for (const f of game.terrain.forests) {
        for (let i=0;i<f.density;i++) {
            const a = Math.random()*Math.PI*2;
            const rr = Math.sqrt(Math.random())*f.r;
            const x=(f.x+Math.cos(a)*rr)*w, y=(f.y+Math.sin(a)*rr)*h;
            if (isWater(x/w,y/h)) continue;
            drawTree(x,y,Math.max(3,Math.min(7,w/180)));
        }
    }

    // Mountains
    for (const m of game.terrain.mountains) {
        const x=m.x*w,y=m.y*h,s=m.r*Math.min(w,h);
        for(let i=-1;i<=1;i++) drawMountain(x+i*s*.35,y+i*s*.12,s*.65);
    }

    // Country territory halos and borders
    for (const c of game.countries) {
        const towns=game.settlements.filter(s=>c.settlementIds.includes(s.id));
        if (!towns.length) continue;
        const avg=towns.reduce((a,s)=>({x:a.x+s.x,y:a.y+s.y}),{x:0,y:0});
        avg.x/=towns.length; avg.y/=towns.length;
        const radius=Math.min(.24,.075+Math.sqrt(towns.length)*.035+c.age*.0005);
        ctx.beginPath();
        ctx.arc(avg.x*w,avg.y*h,radius*Math.min(w,h),0,Math.PI*2);
        ctx.fillStyle=`hsla(${Math.floor(c.colorSeed*360)},55%,45%,.09)`;
        ctx.fill();
        ctx.strokeStyle=`hsla(${Math.floor(c.colorSeed*360)},65%,65%,.45)`;
        ctx.setLineDash([5,4]); ctx.lineWidth=1.2; ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle="#eef4f8"; ctx.font="bold 10px Arial"; ctx.textAlign="center";
        ctx.fillText(c.name,avg.x*w,avg.y*h-radius*Math.min(w,h)-5);
    }

    // Active wars
    for (const war of game.wars.filter(w=>w.active)) {
        const a=getCountry(war.attacker), d=getCountry(war.defender);
        const ta=a && game.settlements.find(s=>a.settlementIds.includes(s.id));
        const td=d && game.settlements.find(s=>d.settlementIds.includes(s.id));
        if(!ta||!td)continue;
        ctx.strokeStyle="#d65b55"; ctx.lineWidth=3; ctx.setLineDash([7,5]);
        ctx.beginPath();ctx.moveTo(ta.x*w,ta.y*h);ctx.lineTo(td.x*w,td.y*h);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle="#f07a67";ctx.font="bold 9px Arial";ctx.fillText("⚔",((ta.x+td.x)/2)*w,((ta.y+td.y)/2)*h);
    }

    // Settlements
    for (const s of game.settlements) {
        if (s.population<=0)continue;
        const x=s.x*w,y=s.y*h,r=Math.min(12,4+s.population/16);
        ctx.beginPath();ctx.arc(x,y,r+3,0,Math.PI*2);ctx.fillStyle=s.countryId?"rgba(210,145,65,.16)":"rgba(220,188,82,.14)";ctx.fill();
        ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=s.countryId?"#d29a45":"#e2c35f";ctx.fill();
        ctx.fillStyle="#fff";ctx.font="9px Arial";ctx.textAlign="center";ctx.fillText(s.name,x,y-r-5);
    }

    // People
    for (const p of game.population) {
        if(!p.alive)continue;
        ctx.beginPath();ctx.arc(p.x*w,p.y*h,1.6,0,Math.PI*2);ctx.fillStyle="#edf3f7";ctx.fill();
    }
}

function drawTree(x,y,s){
    ctx.fillStyle="#263d29";ctx.fillRect(x-1,y+s*.45,2,s*1.3);
    ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x-s*.65,y+s*.55);ctx.lineTo(x+s*.65,y+s*.55);ctx.closePath();ctx.fillStyle="#2f6337";ctx.fill();
    ctx.beginPath();ctx.moveTo(x,y-s*.45);ctx.lineTo(x-s*.55,y+s*.2);ctx.lineTo(x+s*.55,y+s*.2);ctx.closePath();ctx.fillStyle="#3f7b45";ctx.fill();
}
function drawMountain(x,y,s){ctx.beginPath();ctx.moveTo(x-s,y+s*.55);ctx.lineTo(x,y-s);ctx.lineTo(x+s,y+s*.55);ctx.closePath();ctx.fillStyle="#59645e";ctx.fill();ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.28,y+s*.55);ctx.lineTo(x,y+s*.28);ctx.closePath();ctx.fillStyle="#e0e2dd";ctx.fill();}

/* ---------------- SETUP ---------------- */
let selectedResources=1, selectedClimate="temperate";
function chooseButtons(id,callback){
    document.querySelectorAll(`#${id} button`).forEach(btn=>btn.addEventListener("click",()=>{
        document.querySelectorAll(`#${id} button`).forEach(b=>b.classList.remove("selected"));
        btn.classList.add("selected"); callback(btn.dataset.value);
    }));
}

document.getElementById("startButton").addEventListener("click",()=>{
    document.getElementById("introScreen").classList.add("hidden");
    document.getElementById("setupScreen").classList.remove("hidden");
});

document.getElementById("backToIntro").addEventListener("click",()=>{
    document.getElementById("setupScreen").classList.add("hidden");
    document.getElementById("introScreen").classList.remove("hidden");
});

document.getElementById("populationInput").addEventListener("input",e=>{
    document.getElementById("populationValue").textContent=e.target.value;
});

chooseButtons("resourceChoices",v=>selectedResources=Number(v));
chooseButtons("climateChoices",v=>selectedClimate=v);

document.getElementById("createWorldButton").addEventListener("click",()=>{
    game.worldName=(document.getElementById("worldNameInput").value.trim()||"Thế giới mới").toUpperCase();
    game.settings.population=Number(document.getElementById("populationInput").value);
    game.settings.resources=selectedResources;
    game.settings.climate=selectedClimate;
    document.getElementById("setupScreen").classList.add("hidden");
    document.getElementById("gameScreen").classList.remove("hidden");
    createInitialWorld();
});

document.getElementById("pauseButton").addEventListener("click",togglePause);
document.getElementById("mobilePause").addEventListener("click",togglePause);
document.getElementById("clearEvents").addEventListener("click",()=>{game.events=[];renderEvents();});

window.addEventListener("keydown",e=>{
    if(e.code==="Space" && !e.repeat){e.preventDefault();if(!document.getElementById("gameScreen").classList.contains("hidden"))togglePause();}
});

resizeCanvas();
