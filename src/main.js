const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();


// ============================================================
// OLIFLIGHT
// M001 — FIRST FLIGHT
// Simple 2D spaceflight sandbox presentation
// ============================================================


// ============================================================
// INPUT
// ============================================================

const keys = {};

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    keys[key] = true;

    if (
        key === "arrowup" ||
        key === "arrowdown" ||
        key === "arrowleft" ||
        key === "arrowright" ||
        key === " "
    ) {
        event.preventDefault();
    }

    if (key === "r") {
        resetRocket();
    }
});

window.addEventListener("keyup", (event) => {
    keys[event.key.toLowerCase()] = false;
});


// ============================================================
// WORLD
// ============================================================

const world = {
    planetRadius: 6_371_000,
    surfaceGravity: 9.81,

    atmosphereHeight: 100_000,

    terrainAmplitude: 4,
    terrainWave: 700
};


// ============================================================
// ROCKET
// ============================================================

const rocket = {
    x: 0,
    y: 0,

    velocityX: 0,
    velocityY: 0,

    angle: 0,
    angularVelocity: 0,

    throttle: 0,

    dryMass: 700,
    fuelMass: 300,
    fuel: 300,

    maxThrust: 13_000
};


function getMass() {
    return rocket.dryMass + rocket.fuel;
}


// ============================================================
// TERRAIN
// ============================================================

function getTerrainHeight(x) {

    return (
        Math.sin(x / world.terrainWave) *
        world.terrainAmplitude
        +
        Math.sin(x / 240) *
        1.2
    );
}


// ============================================================
// GRAVITY
// ============================================================

function getGravity() {

    const radius =
        world.planetRadius + rocket.y;

    return world.surfaceGravity *
        Math.pow(
            world.planetRadius / radius,
            2
        );
}


// ============================================================
// ATMOSPHERE
// ============================================================

function getAtmosphereDensity() {

    if (rocket.y >= world.atmosphereHeight) {
        return 0;
    }

    return Math.max(
        0,
        1 - rocket.y / world.atmosphereHeight
    );
}


// ============================================================
// CAMERA
// ============================================================

const camera = {
    x: 0,
    y: 0,

    // World meters represented by one screen pixel.
    scale: 1.0
};


function updateCamera(dt) {

    const targetX = rocket.x;

    // Keep the rocket slightly above screen center.
    const targetY = rocket.y + 90;

    const smoothing =
        1 - Math.pow(0.001, dt);

    camera.x +=
        (targetX - camera.x) *
        smoothing;

    camera.y +=
        (targetY - camera.y) *
        smoothing;
}


// ============================================================
// RESET
// ============================================================

function resetRocket() {

    rocket.x = 0;

    rocket.y =
        getTerrainHeight(0) + 25;

    rocket.velocityX = 0;
    rocket.velocityY = 0;

    rocket.angle = 0;
    rocket.angularVelocity = 0;

    rocket.throttle = 0;

    rocket.fuel =
        rocket.fuelMass;

    camera.x = rocket.x;
    camera.y = rocket.y + 90;
}

resetRocket();


// ============================================================
// PHYSICS
// ============================================================

function updatePhysics(dt) {

    // ----------------------------------------
    // THROTTLE
    // ----------------------------------------

    if (
        keys["w"] ||
        keys["arrowup"]
    ) {
        rocket.throttle +=
            0.7 * dt;
    }

    if (
        keys["s"] ||
        keys["arrowdown"]
    ) {
        rocket.throttle -=
            0.7 * dt;
    }

    rocket.throttle =
        Math.max(
            0,
            Math.min(
                1,
                rocket.throttle
            )
        );


    // ----------------------------------------
    // ROTATION
    // ----------------------------------------

    const rotationInput =
        (keys["d"] || keys["arrowright"] ? 1 : 0) -
        (keys["a"] || keys["arrowleft"] ? 1 : 0);

    rocket.angularVelocity +=
        rotationInput *
        2.5 *
        dt;

    rocket.angularVelocity *=
        Math.pow(0.08, dt);

    rocket.angle +=
        rocket.angularVelocity *
        dt;


    // ----------------------------------------
    // GRAVITY
    // ----------------------------------------

    rocket.velocityY -=
        getGravity() * dt;


    // ----------------------------------------
    // THRUST
    // ----------------------------------------

    if (
        rocket.throttle > 0 &&
        rocket.fuel > 0
    ) {

        const acceleration =
            rocket.maxThrust *
            rocket.throttle /
            getMass();

        rocket.velocityX +=
            Math.sin(rocket.angle) *
            acceleration *
            dt;

        rocket.velocityY +=
            Math.cos(rocket.angle) *
            acceleration *
            dt;


        // Fuel consumption.

        rocket.fuel -=
            rocket.throttle *
            1.8 *
            dt;

        rocket.fuel =
            Math.max(
                0,
                rocket.fuel
            );
    }


    // ----------------------------------------
    // ATMOSPHERIC DRAG
    // ----------------------------------------

    const density =
        getAtmosphereDensity();

    const speed =
        Math.sqrt(
            rocket.velocityX ** 2 +
            rocket.velocityY ** 2
        );

    if (
        density > 0 &&
        speed > 0.1
    ) {

        const drag =
            density *
            speed *
            speed *
            0.000025;

        const dragAcceleration =
            drag / getMass();

        rocket.velocityX -=
            rocket.velocityX /
            speed *
            dragAcceleration *
            dt;

        rocket.velocityY -=
            rocket.velocityY /
            speed *
            dragAcceleration *
            dt;
    }


    // ----------------------------------------
    // POSITION
    // ----------------------------------------

    rocket.x +=
        rocket.velocityX * dt;

    rocket.y +=
        rocket.velocityY * dt;


    // ----------------------------------------
    // GROUND COLLISION
    // ----------------------------------------

    const ground =
        getTerrainHeight(
            rocket.x
        );

    const rocketBottom =
        rocket.y - 25;

    if (
        rocketBottom <= ground
    ) {

        rocket.y =
            ground + 25;

        if (
            rocket.velocityY < 0
        ) {
            rocket.velocityY = 0;
        }

        // Ground friction.

        rocket.velocityX *=
            Math.pow(
                0.25,
                dt
            );

        rocket.angularVelocity *=
            Math.pow(
                0.05,
                dt
            );
    }
}


// ============================================================
// WORLD → SCREEN
// ============================================================

function worldToScreen(x, y) {

    return {
        x:
            canvas.width / 2 +
            (x - camera.x) *
            camera.scale,

        y:
            canvas.height * 0.55 -
            (y - camera.y) *
            camera.scale
    };
}


// ============================================================
// SKY
// ============================================================

function drawSky() {

    const altitude =
        Math.max(
            0,
            rocket.y
        );

    const spaceAmount =
        Math.min(
            1,
            altitude /
            world.atmosphereHeight
        );


    // Surface = blue.
    // High altitude = dark space.

    const topR =
        Math.round(
            25 -
            23 *
            spaceAmount
        );

    const topG =
        Math.round(
            125 -
            110 *
            spaceAmount
        );

    const topB =
        Math.round(
            205 -
            175 *
            spaceAmount
        );


    const bottomR =
        Math.round(
            85 -
            75 *
            spaceAmount
        );

    const bottomG =
        Math.round(
            175 -
            155 *
            spaceAmount
        );

    const bottomB =
        Math.round(
            225 -
            195 *
            spaceAmount
        );


    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            canvas.height
        );


    gradient.addColorStop(
        0,
        `rgb(${topR}, ${topG}, ${topB})`
    );

    gradient.addColorStop(
        1,
        `rgb(${bottomR}, ${bottomG}, ${bottomB})`
    );


    ctx.fillStyle =
        gradient;

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // Stars appear gradually.

    if (
        spaceAmount > 0.35
    ) {

        const alpha =
            (spaceAmount - 0.35) /
            0.65;

        ctx.globalAlpha =
            alpha;


        for (
            let i = 0;
            i < 150;
            i++
        ) {

            const x =
                (i * 197.37) %
                canvas.width;

            const y =
                (i * 83.21) %
                (canvas.height * 0.85);

            ctx.fillStyle =
                "#ffffff";

            ctx.fillRect(
                x,
                y,
                i % 8 === 0 ? 2 : 1,
                i % 8 === 0 ? 2 : 1
            );
        }


        ctx.globalAlpha = 1;
    }
}


// ============================================================
// TERRAIN
// ============================================================

function drawTerrain() {

    const visibleWidth =
        canvas.width /
        camera.scale;

    const left =
        camera.x -
        visibleWidth / 2 -
        20;

    const right =
        camera.x +
        visibleWidth / 2 +
        20;


    ctx.beginPath();


    const step = 10;

    let first = true;


    for (
        let x = left;
        x <= right;
        x += step
    ) {

        const terrain =
            getTerrainHeight(x);

        const screen =
            worldToScreen(
                x,
                terrain
            );


        if (first) {

            ctx.moveTo(
                screen.x,
                screen.y
            );

            first = false;

        } else {

            ctx.lineTo(
                screen.x,
                screen.y
            );
        }
    }


    // Solid ground.

    ctx.lineTo(
        canvas.width,
        canvas.height
    );

    ctx.lineTo(
        0,
        canvas.height
    );

    ctx.closePath();


    ctx.fillStyle =
        "#596b43";

    ctx.fill();


    // Terrain surface.

    ctx.beginPath();

    first = true;


    for (
        let x = left;
        x <= right;
        x += step
    ) {

        const terrain =
            getTerrainHeight(x);

        const screen =
            worldToScreen(
                x,
                terrain
            );


        if (first) {

            ctx.moveTo(
                screen.x,
                screen.y
            );

            first = false;

        } else {

            ctx.lineTo(
                screen.x,
                screen.y
            );
        }
    }


    ctx.strokeStyle =
        "#8b9b68";

    ctx.lineWidth = 2;

    ctx.stroke();
}


// ============================================================
// LAUNCH PAD
// ============================================================

function drawLaunchPad() {

    const ground =
        getTerrainHeight(
            0
        );

    const center =
        worldToScreen(
            0,
            ground
        );


    const padWidth = 70;


    ctx.fillStyle =
        "#555a60";

    ctx.fillRect(
        center.x -
        padWidth / 2,
        center.y - 6,
        padWidth,
        6
    );


    // Simple launch structure.

    ctx.strokeStyle =
        "#696f74";

    ctx.lineWidth = 5;


    ctx.beginPath();

    ctx.moveTo(
        center.x - 30,
        center.y - 6
    );

    ctx.lineTo(
        center.x - 30,
        center.y - 75
    );

    ctx.stroke();


    ctx.beginPath();

    ctx.moveTo(
        center.x + 30,
        center.y - 6
    );

    ctx.lineTo(
        center.x + 30,
        center.y - 75
    );

    ctx.stroke();


    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.moveTo(
        center.x - 30,
        center.y - 50
    );

    ctx.lineTo(
        center.x + 30,
        center.y - 50
    );

    ctx.stroke();
}


// ============================================================
// ROCKET
// ============================================================

function drawRocket() {

    const screen =
        worldToScreen(
            rocket.x,
            rocket.y
        );


    ctx.save();


    ctx.translate(
        screen.x,
        screen.y
    );


    ctx.rotate(
        -rocket.angle
    );


    // Keep rocket visually readable
    // regardless of world scale.

    const width = 24;
    const bodyHeight = 58;


    // ----------------------------------------
    // ENGINE FLAME
    // ----------------------------------------

    if (
        rocket.throttle > 0 &&
        rocket.fuel > 0
    ) {

        const flameLength =
            12 +
            rocket.throttle *
            35;


        // Outer flame.

        ctx.beginPath();

        ctx.moveTo(
            -7,
            bodyHeight / 2
        );

        ctx.lineTo(
            0,
            bodyHeight / 2 +
            flameLength
        );

        ctx.lineTo(
            7,
            bodyHeight / 2
        );

        ctx.closePath();

        ctx.fillStyle =
            "#f07824";

        ctx.fill();


        // Inner flame.

        ctx.beginPath();

        ctx.moveTo(
            -3,
            bodyHeight / 2
        );

        ctx.lineTo(
            0,
            bodyHeight / 2 +
            flameLength * 0.7
        );

        ctx.lineTo(
            3,
            bodyHeight / 2
        );

        ctx.closePath();

        ctx.fillStyle =
            "#ffd86b";

        ctx.fill();
    }


    // ----------------------------------------
    // ROCKET BODY
    // ----------------------------------------

    ctx.fillStyle =
        "#e6e7e8";

    ctx.fillRect(
        -width / 2,
        -bodyHeight / 2 + 9,
        width,
        bodyHeight - 14
    );


    // ----------------------------------------
    // NOSE
    // ----------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        0,
        -bodyHeight / 2 - 13
    );

    ctx.lineTo(
        -width / 2,
        -bodyHeight / 2 + 9
    );

    ctx.lineTo(
        width / 2,
        -bodyHeight / 2 + 9
    );

    ctx.closePath();

    ctx.fillStyle =
        "#c5c8ca";

    ctx.fill();


    // ----------------------------------------
    // DARK NOSE TIP
    // ----------------------------------------

    ctx.fillStyle =
        "#777d82";

    ctx.beginPath();

    ctx.moveTo(
        0,
        -bodyHeight / 2 - 13
    );

    ctx.lineTo(
        -5,
        -bodyHeight / 2 + 1
    );

    ctx.lineTo(
        5,
        -bodyHeight / 2 + 1
    );

    ctx.closePath();

    ctx.fill();


    // ----------------------------------------
    // FUEL / BODY STRIPE
    // ----------------------------------------

    ctx.fillStyle =
        "#d44c43";

    ctx.fillRect(
        -width / 2,
        -8,
        width,
        6
    );


    // ----------------------------------------
    // WINDOW
    // ----------------------------------------

    ctx.fillStyle =
        "#345d78";

    ctx.beginPath();

    ctx.arc(
        0,
        7,
        5,
        0,
        Math.PI * 2
    );

    ctx.fill();


    // ----------------------------------------
    // FINS
    // ----------------------------------------

    ctx.fillStyle =
        "#656b70";


    ctx.beginPath();

    ctx.moveTo(
        -width / 2,
        17
    );

    ctx.lineTo(
        -width / 2 - 12,
        34
    );

    ctx.lineTo(
        -width / 2,
        31
    );

    ctx.closePath();

    ctx.fill();


    ctx.beginPath();

    ctx.moveTo(
        width / 2,
        17
    );

    ctx.lineTo(
        width / 2 + 12,
        34
    );

    ctx.lineTo(
        width / 2,
        31
    );

    ctx.closePath();

    ctx.fill();


    // ----------------------------------------
    // ENGINE NOZZLE
    // ----------------------------------------

    ctx.fillStyle =
        "#3f4549";

    ctx.fillRect(
        -6,
        bodyHeight / 2 - 2,
        12,
        7
    );


    ctx.restore();
}


// ============================================================
// HUD
// ============================================================

function drawHUD() {

    const altitude =
        Math.max(
            0,
            rocket.y -
            getTerrainHeight(
                rocket.x
            )
        );


    const speed =
        Math.sqrt(
            rocket.velocityX ** 2 +
            rocket.velocityY ** 2
        );


    // ----------------------------------------
    // TOP BAR
    // ----------------------------------------

    ctx.fillStyle =
        "rgba(10,20,30,0.68)";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        52
    );


    // Title.

    ctx.textAlign =
        "left";

    ctx.fillStyle =
        "#ffffff";

    ctx.font =
        "bold 19px Arial";

    ctx.fillText(
        "OLIFLIGHT",
        18,
        31
    );


    // Mission time.

    ctx.font =
        "14px Arial";

    ctx.fillStyle =
        "#d8e6ef";

    ctx.fillText(
        "FLIGHT 1",
        130,
        30
    );


    // ----------------------------------------
    // FLIGHT DATA
    // ----------------------------------------

    const panelWidth = 215;
    const panelHeight = 112;

    const panelX =
        canvas.width -
        panelWidth -
        15;

    const panelY = 67;


    ctx.fillStyle =
        "rgba(10,20,30,0.68)";

    ctx.fillRect(
        panelX,
        panelY,
        panelWidth,
        panelHeight
    );


    ctx.fillStyle =
        "#ffffff";

    ctx.font =
        "13px Arial";

    ctx.textAlign =
        "left";


    ctx.fillText(
        `ALTITUDE    ${altitude.toFixed(1)} m`,
        panelX + 14,
        panelY + 24
    );

    ctx.fillText(
        `VELOCITY    ${speed.toFixed(1)} m/s`,
        panelX + 14,
        panelY + 48
    );

    ctx.fillText(
        `VERTICAL    ${rocket.velocityY.toFixed(1)} m/s`,
        panelX + 14,
        panelY + 72
    );

    ctx.fillText(
        `MASS        ${getMass().toFixed(0)} kg`,
        panelX + 14,
        panelY + 96
    );


    // ----------------------------------------
    // THROTTLE
    // ----------------------------------------

    const throttleWidth = 180;
    const throttleHeight = 8;

    const throttleX =
        canvas.width / 2 -
        throttleWidth / 2;

    const throttleY =
        canvas.height -
        28;


    ctx.fillStyle =
        "rgba(10,20,30,0.7)";

    ctx.fillRect(
        throttleX - 5,
        throttleY - 23,
        throttleWidth + 10,
        40
    );


    ctx.fillStyle =
        "#ffffff";

    ctx.font =
        "12px Arial";

    ctx.textAlign =
        "center";

    ctx.fillText(
        `THROTTLE ${Math.round(rocket.throttle * 100)}%`,
        canvas.width / 2,
        throttleY - 9
    );


    ctx.fillStyle =
        "#242d34";

    ctx.fillRect(
        throttleX,
        throttleY,
        throttleWidth,
        throttleHeight
    );


    ctx.fillStyle =
        "#d9e4ea";

    ctx.fillRect(
        throttleX,
        throttleY,
        throttleWidth *
        rocket.throttle,
        throttleHeight
    );


    // ----------------------------------------
    // FUEL
    // ----------------------------------------

    const fuelX = 18;
    const fuelY =
        canvas.height -
        75;


    ctx.fillStyle =
        "rgba(10,20,30,0.68)";

    ctx.fillRect(
        fuelX,
        fuelY,
        165,
        54
    );


    ctx.textAlign =
        "left";

    ctx.fillStyle =
        "#ffffff";

    ctx.font =
        "12px Arial";

    ctx.fillText(
        `FUEL ${Math.round(rocket.fuel)} kg`,
        fuelX + 10,
        fuelY + 18
    );


    const fuelPercent =
        rocket.fuel /
        rocket.fuelMass;


    ctx.fillStyle =
        "#242d34";

    ctx.fillRect(
        fuelX + 10,
        fuelY + 29,
        140,
        8
    );


    ctx.fillStyle =
        "#d9e4ea";

    ctx.fillRect(
        fuelX + 10,
        fuelY + 29,
        140 * fuelPercent,
        8
    );


    // ----------------------------------------
    // CONTROLS
    // ----------------------------------------

    const controlsX =
        canvas.width -
        170;

    const controlsY =
        canvas.height -
        75;


    ctx.fillStyle =
        "rgba(10,20,30,0.68)";

    ctx.fillRect(
        controlsX,
        controlsY,
        152,
        54
    );


    ctx.fillStyle =
        "#ffffff";

    ctx.font =
        "11px Arial";

    ctx.fillText(
        "W/S  THROTTLE",
        controlsX + 10,
        controlsY + 18
    );

    ctx.fillText(
        "A/D  ROTATE",
        controlsX + 10,
        controlsY + 34
    );

    ctx.fillText(
        "R    RESET",
        controlsX + 10,
        controlsY + 48
    );
}


// ============================================================
// LOOP
// ============================================================

let lastTime =
    performance.now();


function gameLoop(time) {

    let dt =
        (time - lastTime) /
        1000;

    lastTime = time;

    dt =
        Math.min(
            dt,
            0.033
        );


    updatePhysics(dt);
    updateCamera(dt);


    drawSky();
    drawTerrain();
    drawLaunchPad();
    drawRocket();
    drawHUD();


    requestAnimationFrame(
        gameLoop
    );
}


requestAnimationFrame(
    gameLoop
);
