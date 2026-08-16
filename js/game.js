/* =========================================================
   WORLD SIMULATOR
   VERSION 0.1
========================================================= */


/* =========================================================
   GAME STATE
========================================================= */

const game = {

    year: 1,

    population: [],

    events: []

};


/* =========================================================
   PERSON
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
   RANDOM
========================================================= */

function randomInt(min, max) {

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

}


/* =========================================================
   CREATE WORLD
========================================================= */

function createWorld() {

    game.year = 1;

    game.population = [];

    game.events = [];


    // Create 100 humans

    for (let i = 1; i <= 100; i++) {

        game.population.push(
            new Person(i)
        );

    }


    addEvent("World created.");

    addEvent("100 humans spawned.");


    updateUI();

    drawWorld();

}


/* =========================================================
   RUN YEARS
========================================================= */

function runYears(years) {

    for (let i = 0; i < years; i++) {

        simulateYear();

    }

    updateUI();

    drawWorld();

}


/* =========================================================
   SIMULATE ONE YEAR
========================================================= */

function simulateYear() {

    game.year++;


    // Age everybody

    for (const person of game.population) {

        if (!person.alive) {
            continue;
        }

        person.age++;


        // Random death

        if (person.age > 70) {

            const deathChance =
                (person.age - 70) * 0.03;

            if (Math.random() < deathChance) {

                person.alive = false;

            }

        }

    }


    // Random births

    const alivePeople =
        game.population.filter(
            p => p.alive
        );


    const birthChance = 0.15;

    for (const person of alivePeople) {

        if (
            person.age >= 18 &&
            person.age <= 40 &&
            Math.random() < birthChance
        ) {

            const baby = new Person(
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


            game.population.push(baby);

        }

    }


    // Random event

    if (Math.random() < 0.1) {

        addEvent(
            `Year ${game.year}: the world continues to evolve.`
        );

    }

}


/* =========================================================
   EVENT LOG
========================================================= */

function addEvent(text) {

    game.events.unshift(text);

    if (game.events.length > 20) {

        game.events.pop();

    }

}


/* =========================================================
   UI
========================================================= */

function updateUI() {

    const alive =
        game.population.filter(
            p => p.alive
        ).length;


    document.getElementById("year")
        .textContent = game.year;


    document.getElementById("population")
        .textContent =
        game.population.length;


    document.getElementById("alive")
        .textContent =
        alive;


    document.getElementById("countries")
        .textContent = "0";


    document.getElementById("cities")
        .textContent = "0";


    const eventBox =
        document.getElementById("events");


    eventBox.innerHTML = "";


    for (const event of game.events) {

        const div =
            document.createElement("div");

        div.textContent = event;

        eventBox.appendChild(div);

    }

}


/* =========================================================
   DRAW WORLD
========================================================= */

const canvas =
    document.getElementById("worldCanvas");

const ctx =
    canvas.getContext("2d");


function resizeCanvas() {

    canvas.width =
        canvas.clientWidth;

    canvas.height =
        canvas.clientHeight;

    drawWorld();

}


window.addEventListener(
    "resize",
    resizeCanvas
);


/* =========================================================
   DRAW
========================================================= */

function drawWorld() {

    if (!canvas) {
        return;
    }


    const width = canvas.width;
    const height = canvas.height;


    // Background

    ctx.fillStyle = "#243b53";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    // Simple land

    ctx.fillStyle = "#3f6212";

    ctx.beginPath();

    ctx.moveTo(
        width * 0.10,
        height * 0.20
    );

    ctx.lineTo(
        width * 0.35,
        height * 0.10
    );

    ctx.lineTo(
        width * 0.60,
        height * 0.20
    );

    ctx.lineTo(
        width * 0.85,
        height * 0.35
    );

    ctx.lineTo(
        width * 0.75,
        height * 0.70
    );

    ctx.lineTo(
        width * 0.45,
        height * 0.85
    );

    ctx.lineTo(
        width * 0.20,
        height * 0.70
    );

    ctx.closePath();

    ctx.fill();


    // Draw humans

    for (const person of game.population) {

        if (!person.alive) {
            continue;
        }


        const x =
            person.x * width;

        const y =
            person.y * height;


        ctx.fillStyle = "#f8fafc";

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
   START GAME
========================================================= */

createWorld();

resizeCanvas();
