```javascript
/* =========================================================
   WORLD-SIM
   V0.2
   MÔ PHỎNG THẾ GIỚI
========================================================= */


/* =========================================================
   TRẠNG THÁI GAME
========================================================= */

const game = {

    year: 1,

    worldName: "THẾ GIỚI #001",

    population: [],

    events: []

};


/* =========================================================
   NHÂN VẬT
========================================================= */

class Person {

    constructor(id) {

        this.id = id;

        this.age = randomInt(18, 40);

        this.x = Math.random();

        this.y = Math.random();

        this.alive = true;

    }

}


/* =========================================================
   HÀM NGẪU NHIÊN
========================================================= */

function randomInt(min, max) {

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

}


/* =========================================================
   TẠO THẾ GIỚI
========================================================= */

function createWorld() {

    game.year = 1;

    game.population = [];

    game.events = [];


    for (let i = 1; i <= 100; i++) {

        game.population.push(
            new Person(i)
        );

    }


    addEvent(
        "Thế giới được hình thành."
    );


    addEvent(
        "100 con người đầu tiên xuất hiện."
    );


    updateUI();

    drawWorld();

}


/* =========================================================
   CHẠY THỜI GIAN
========================================================= */

function runYears(years) {

    for (let i = 0; i < years; i++) {

        simulateYear();

    }


    updateUI();

    drawWorld();

}


/* =========================================================
   MÔ PHỎNG MỘT NĂM
========================================================= */

function simulateYear() {

    game.year++;


    /* =========================
       TUỔI & CÁI CHẾT
    ========================== */

    for (const person of game.population) {

        if (!person.alive) {

            continue;

        }


        person.age++;


        if (person.age > 70) {

            const deathChance =
                (person.age - 70) * 0.03;


            if (Math.random() < deathChance) {

                person.alive = false;

            }

        }

    }


    /* =========================
       SINH SẢN
    ========================== */

    const alivePeople =
        game.population.filter(
            person => person.alive
        );


    const birthChance = 0.15;


    for (const person of alivePeople) {

        if (
            person.age >= 18 &&
            person.age <= 40 &&
            Math.random() < birthChance
        ) {

            const baby =
                new Person(
                    game.population.length + 1
                );


            baby.age = 0;


            baby.x =
                Math.max(
                    0,
                    Math.min(
                        1,
                        person.x +
                        (Math.random() - 0.5) * 0.05
                    )
                );


            baby.y =
                Math.max(
                    0,
                    Math.min(
                        1,
                        person.y +
                        (Math.random() - 0.5) * 0.05
                    )
                );


            game.population.push(
                baby
            );

        }

    }


    /* =========================
       SỰ KIỆN THẾ GIỚI
    ========================== */

    if (Math.random() < 0.08) {

        const events = [

            "Một nhóm người bắt đầu di chuyển về phía Đông.",

            "Một khu định cư nhỏ bắt đầu hình thành.",

            "Những người sống gần dòng sông phát triển nhanh hơn.",

            "Một vùng đất mới được con người khám phá.",

            "Một thế hệ mới bắt đầu trưởng thành.",

            "Các cộng đồng đầu tiên bắt đầu hình thành.",

            "Một mùa đông khắc nghiệt ảnh hưởng đến dân cư.",

            "Một khu vực màu mỡ thu hút thêm người di cư."

        ];


        addEvent(
            `Năm ${game.year}: ${
                events[
                    randomInt(
                        0,
                        events.length - 1
                    )
                ]
            }`
        );

    }

}


/* =========================================================
   LỊCH SỬ
========================================================= */

function addEvent(text) {

    game.events.unshift(text);


    if (game.events.length > 30) {

        game.events.pop();

    }

}


/* =========================================================
   CẬP NHẬT GIAO DIỆN
========================================================= */

function updateUI() {

    const alive =
        game.population.filter(
            person => person.alive
        ).length;


    document.getElementById(
        "year"
    ).textContent =
        game.year;


    document.getElementById(
        "worldName"
    ).textContent =
        game.worldName;


    document.getElementById(
        "population"
    ).textContent =
        formatNumber(
            game.population.length
        );


    document.getElementById(
        "alive"
    ).textContent =
        formatNumber(alive);


    /*
       CHƯA CÓ HỆ THỐNG
       QUỐC GIA / THÀNH PHỐ

       Sẽ được xây ở phiên bản sau.
    */

    document.getElementById(
        "countries"
    ).textContent = "0";


    document.getElementById(
        "cities"
    ).textContent = "0";


    renderEvents();

}


/* =========================================================
   ĐỊNH DẠNG SỐ
========================================================= */

function formatNumber(number) {

    return number.toLocaleString(
        "vi-VN"
    );

}


/* =========================================================
   HIỂN THỊ LỊCH SỬ
========================================================= */

function renderEvents() {

    const eventBox =
        document.getElementById(
            "events"
        );


    eventBox.innerHTML = "";


    if (game.events.length === 0) {

        const empty =
            document.createElement("div");


        empty.className = "event";


        empty.textContent =
            "Chưa có sự kiện nào.";


        eventBox.appendChild(
            empty
        );


        return;

    }


    for (const event of game.events) {

        const div =
            document.createElement(
                "div"
            );


        div.className = "event";


        div.textContent = event;


        eventBox.appendChild(
            div
        );

    }

}


/* =========================================================
   CANVAS
========================================================= */

const canvas =
    document.getElementById(
        "worldCanvas"
    );


const ctx =
    canvas.getContext("2d");


/* =========================================================
   THAY ĐỔI KÍCH THƯỚC
========================================================= */

function resizeCanvas() {

    const rect =
        canvas.getBoundingClientRect();


    const dpr =
        window.devicePixelRatio || 1;


    canvas.width =
        rect.width * dpr;


    canvas.height =
        rect.height * dpr;


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    drawWorld();

}


window.addEventListener(
    "resize",
    resizeCanvas
);


/* =========================================================
   VẼ THẾ GIỚI
========================================================= */

function drawWorld() {

    if (!canvas) {

        return;

    }


    const width =
        canvas.clientWidth;


    const height =
        canvas.clientHeight;


    /* =========================
       BIỂN
    ========================== */

    ctx.fillStyle =
        "#142b42";


    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    /* =========================
       LƯỚI BẢN ĐỒ
    ========================== */

    ctx.strokeStyle =
        "rgba(255,255,255,0.035)";


    ctx.lineWidth = 1;


    const gridSize = 50;


    for (
        let x = 0;
        x < width;
        x += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            height
        );

        ctx.stroke();

    }


    for (
        let y = 0;
        y < height;
        y += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            width,
            y
        );

        ctx.stroke();

    }


    /* =========================
       LỤC ĐỊA
    ========================== */

    ctx.fillStyle =
        "#365b32";


    ctx.beginPath();


    ctx.moveTo(
        width * 0.10,
        height * 0.20
    );


    ctx.lineTo(
        width * 0.28,
        height * 0.10
    );


    ctx.lineTo(
        width * 0.48,
        height * 0.15
    );


    ctx.lineTo(
        width * 0.67,
        height * 0.27
    );


    ctx.lineTo(
        width * 0.83,
        height * 0.35
    );


    ctx.lineTo(
        width * 0.75,
        height * 0.63
    );


    ctx.lineTo(
        width * 0.57,
        height * 0.78
    );


    ctx.lineTo(
        width * 0.35,
        height * 0.86
    );


    ctx.lineTo(
        width * 0.18,
        height * 0.69
    );


    ctx.lineTo(
        width * 0.08,
        height * 0.44
    );


    ctx.closePath();


    ctx.fill();


    /* =========================
       SÔNG
    ========================== */

    ctx.strokeStyle =
        "#3c7892";


    ctx.lineWidth = 4;


    ctx.beginPath();


    ctx.moveTo(
        width * 0.48,
        height * 0.15
    );


    ctx.bezierCurveTo(
        width * 0.42,
        height * 0.30,
        width * 0.58,
        height * 0.38,
        width * 0.48,
        height * 0.52
    );


    ctx.bezierCurveTo(
        width * 0.40,
        height * 0.66,
        width * 0.48,
        height * 0.73,
        width * 0.57,
        height * 0.78
    );


    ctx.stroke();


    /* =========================
       CON NGƯỜI
    ========================== */

    for (
        const person of game.population
    ) {

        if (!person.alive) {

            continue;

        }


        const x =
            person.x * width;


        const y =
            person.y * height;


        ctx.fillStyle =
            "#e8eef5";


        ctx.beginPath();


        ctx.arc(
            x,
            y,
            3,
            0,
            Math.PI * 2
        );


        ctx.fill();

    }

}


/* =========================================================
   NÚT BẮT ĐẦU
========================================================= */

document
    .getElementById("startButton")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "introScreen"
                )
                .classList.add(
                    "hidden"
                );


            document
                .getElementById(
                    "gameScreen"
                )
                .classList.remove(
                    "hidden"
                );


            createWorld();


            setTimeout(
                resizeCanvas,
                50
            );

        }
    );


/* =========================================================
   XÓA LỊCH SỬ HIỂN THỊ
========================================================= */

document
    .getElementById("clearEvents")
    .addEventListener(
        "click",
        () => {

            game.events = [];

            renderEvents();

        }
    );
```
