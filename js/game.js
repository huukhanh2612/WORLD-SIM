const game = {
    year: 1,
    worldName: "THẾ GIỚI",
    population: [],
    settlements: [],
    countries: [],
    events: [],
    settings: { population: 100, resources: 1, climate: "temperate" }
};

class Person {
    constructor(id, x, y) {
        this.id = id;
        this.age = randomInt(16, 40);
        this.x = x;
        this.y = y;
        this.alive = true;
        this.settlementId = null;
        this.family = null;
    }
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function formatNumber(n) { return Math.round(n).toLocaleString("vi-VN"); }

function addEvent(text) {
    game.events.unshift(`Năm ${game.year}: ${text}`);
    if (game.events.length > 40) game.events.pop();
}

function createInitialWorld() {
    game.year = 1;
    game.population = [];
    game.settlements = [];
    game.countries = [];
    game.events = [];

    const count = game.settings.population;
    for (let i = 1; i <= count; i++) {
        const x = 0.18 + Math.random() * 0.64;
        const y = 0.18 + Math.random() * 0.64;
        game.population.push(new Person(i, x, y));
    }

    addEvent(`Thế giới ${game.worldName} được hình thành.`);
    addEvent(`${count} con người đầu tiên xuất hiện.`);
    addEvent("Chưa có quốc gia nào. Lịch sử bắt đầu từ con số không.");
    updateUI();
    resizeCanvas();
}

function simulateYear() {
    game.year++;

    for (const p of game.population) {
        if (!p.alive) continue;
        p.age++;
        if (p.age > 72 && Math.random() < Math.min(0.5, (p.age - 72) * 0.025)) p.alive = false;
    }

    const alive = game.population.filter(p => p.alive);
    const adults = alive.filter(p => p.age >= 18 && p.age <= 40);
    const birthRate = 0.035 * game.settings.resources;

    for (const p of adults) {
        if (Math.random() < birthRate) {
            const baby = new Person(game.population.length + 1, clamp(p.x + (Math.random() - .5) * .035, .05, .95), clamp(p.y + (Math.random() - .5) * .035, .05, .95));
            baby.age = 0;
            game.population.push(baby);
        }
    }

    for (const p of game.population) {
        if (!p.alive) continue;
        if (p.age > 1 && Math.random() < 0.03) {
            p.x = clamp(p.x + (Math.random() - .5) * 0.015, .05, .95);
            p.y = clamp(p.y + (Math.random() - .5) * 0.015, .05, .95);
        }
    }

    formSettlements();
    growSettlements();
    formCountries();

    if (Math.random() < 0.025) {
        const events = [
            "Một nhóm người di cư đến vùng đất mới.",
            "Một mùa thuận lợi giúp dân cư tăng nhanh.",
            "Một cộng đồng bắt đầu tập trung quanh nguồn nước.",
            "Những người trẻ bắt đầu rời quê hương để tìm vùng đất mới.",
            "Một khu vực trở nên đông đúc hơn và bắt đầu hình thành trật tự xã hội."
        ];
        addEvent(events[randomInt(0, events.length - 1)]);
    }
}

function formSettlements() {
    const alive = game.population.filter(p => p.alive);
    const unassigned = alive.filter(p => p.settlementId === null);

    for (const p of unassigned) {
        const nearby = alive.filter(q => q !== p && distance(p, q) < 0.055).length;
        if (nearby >= 7) {
            const existing = game.settlements.find(s => distance(s, p) < 0.07);
            if (existing) {
                p.settlementId = existing.id;
                existing.population++;
            } else if (game.settlements.length < 20) {
                const settlement = {
                    id: game.settlements.length + 1,
                    name: generateSettlementName(),
                    x: p.x,
                    y: p.y,
                    population: nearby + 1,
                    age: 0,
                    countryId: null
                };
                game.settlements.push(settlement);
                p.settlementId = settlement.id;
                for (const q of alive) {
                    if (distance(settlement, q) < 0.07) q.settlementId = settlement.id;
                }
                addEvent(`Một khu định cư mới hình thành: ${settlement.name}.`);
            }
        }
    }
}

function growSettlements() {
    for (const s of game.settlements) {
        s.age++;
        s.population = game.population.filter(p => p.alive && p.settlementId === s.id).length;
    }
}

function formCountries() {
    const mature = game.settlements.filter(s => !s.countryId && s.population >= 25 && s.age >= 10);
    for (const s of mature) {
        if (Math.random() > 0.06) continue;
        const country = {
            id: game.countries.length + 1,
            name: generateCountryName(),
            settlementIds: [s.id],
            population: s.population,
            power: Math.max(1, s.population * 0.15)
        };
        game.countries.push(country);
        s.countryId = country.id;
        addEvent(`${country.name} ra đời từ ${s.name}. Một quốc gia đầu tiên xuất hiện.`);
    }
}

function generateSettlementName() {
    const a = ["An", "Bình", "Minh", "Tân", "Hòa", "Long", "Thanh", "Vĩnh", "Nam", "Phú"];
    const b = ["Thủy", "Sơn", "Lâm", "Giang", "Phong", "Hà", "Nguyên", "Thịnh", "Châu", "Đô"];
    return a[randomInt(0, a.length - 1)] + " " + b[randomInt(0, b.length - 1)];
}

function generateCountryName() {
    const a = ["Vương quốc", "Liên bang", "Đế quốc", "Cộng hòa"];
    const b = ["An", "Minh", "Hòa", "Long", "Nam", "Thanh", "Vĩnh"];
    return a[randomInt(0, a.length - 1)] + " " + b[randomInt(0, b.length - 1)];
}

function runYears(years) {
    for (let i = 0; i < years; i++) simulateYear();
    updateUI();
    drawWorld();
}

function updateUI() {
    const alive = game.population.filter(p => p.alive).length;
    document.getElementById("year").textContent = game.year;
    document.getElementById("worldName").textContent = game.worldName;
    document.getElementById("population").textContent = formatNumber(game.population.length);
    document.getElementById("alive").textContent = formatNumber(alive);
    document.getElementById("settlements").textContent = game.settlements.length;
    document.getElementById("countries").textContent = game.countries.length;

    const box = document.getElementById("events");
    box.innerHTML = game.events.map(e => `<div class="event">${e}</div>`).join("");
}

const canvas = document.getElementById("worldCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorld();
}
window.addEventListener("resize", resizeCanvas);

function drawWorld() {
    if (!canvas) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = "#142b42";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#365b32";
    ctx.beginPath();
    ctx.moveTo(w*.10,h*.20); ctx.lineTo(w*.28,h*.10); ctx.lineTo(w*.48,h*.15); ctx.lineTo(w*.67,h*.27); ctx.lineTo(w*.83,h*.35); ctx.lineTo(w*.75,h*.63); ctx.lineTo(w*.57,h*.78); ctx.lineTo(w*.35,h*.86); ctx.lineTo(w*.18,h*.69); ctx.lineTo(w*.08,h*.44); ctx.closePath(); ctx.fill();

    ctx.strokeStyle = "#3c7892"; ctx.lineWidth = 4; ctx.beginPath();
    ctx.moveTo(w*.48,h*.15); ctx.bezierCurveTo(w*.42,h*.30,w*.58,h*.38,w*.48,h*.52); ctx.bezierCurveTo(w*.40,h*.66,w*.48,h*.73,w*.57,h*.78); ctx.stroke();

    for (const s of game.settlements) {
        const x=s.x*w, y=s.y*h;
        ctx.fillStyle="#d6a94b"; ctx.beginPath(); ctx.arc(x,y,Math.min(8,4+s.population/20),0,Math.PI*2); ctx.fill();
    }

    for (const p of game.population) {
        if (!p.alive) continue;
        const x=p.x*w, y=p.y*h;
        ctx.fillStyle="#e8eef5"; ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill();
    }
}

function chooseButtons(containerId, callback) {
    document.querySelectorAll(`#${containerId} button`).forEach(btn => btn.addEventListener("click", () => {
        document.querySelectorAll(`#${containerId} button`).forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        callback(btn.dataset.value);
    }));
}

document.getElementById("populationInput").addEventListener("input", e => document.getElementById("populationValue").textContent = e.target.value);
chooseButtons("resourceChoices", value => game.settings.resources = Number(value));
chooseButtons("climateChoices", value => game.settings.climate = value);

document.getElementById("startButton").addEventListener("click", () => {
    document.getElementById("introScreen").classList.add("hidden");
    document.getElementById("setupScreen").classList.remove("hidden");
});

document.getElementById("backToIntro").addEventListener("click", () => {
    document.getElementById("setupScreen").classList.add("hidden");
    document.getElementById("introScreen").classList.remove("hidden");
});

document.getElementById("createWorldButton").addEventListener("click", () => {
    const name = document.getElementById("worldNameInput").value.trim();
    game.worldName = name || "THẾ GIỚI #001";
    game.settings.population = Number(document.getElementById("populationInput").value);
    document.getElementById("setupScreen").classList.add("hidden");
    document.getElementById("gameScreen").classList.remove("hidden");
    createInitialWorld();
});

document.getElementById("clearEvents").addEventListener("click", () => {
    game.events = [];
    updateUI();
});

resizeCanvas();
