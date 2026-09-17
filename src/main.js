const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let W = 0;
let H = 0;
let dpr = 1;

function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);
resize();

/* =========================================================
   OLIFLIGHT PHYSICS CORE
   ========================================================= */

const PHYSICS = {
    g0: 9.80665,
    planetRadius: 6_371_000,
    atmosphereHeight: 100_000,
    airDensitySeaLevel: 1.225,

    // Drag coefficient for the current simple rocket
    dragCoefficient: 0.45,

    // Approximate reference area
    referenceArea: 0.008
};

/*
    The vehicle is built from parts.

    Every part has:
    - dry mass
    - fuel capacity
    - position
    - engine data when applicable
*/

const vehicleParts = [
    {
        name: "Command Module",
        type: "command",
        mass: 90,
        fuelCapacity: 0,
        x: 0,
        y: 22
    },

    {
        name: "Fuel Tank",
        type: "tank",
        mass: 55,
        fuelCapacity: 90,
        fuel: 90,
        x: 0,
        y: 0
    },

    {
        name: "OliEngine-1",
        type: "engine",
        mass: 35,
        fuelCapacity: 0,
        x: 0,
        y: -22,

        engine: {
            maxThrust: 5_000,
            isp: 280
        }
    }
];

function getDryMass() {
    return vehicleParts.reduce((total, part) => {
        return total + part.mass;
    }, 0);
}

function getFuelMass() {
    return vehicleParts.reduce((total, part) => {
        return total + (part.fuel || 0);
    }, 0);
}

function getTotalMass() {
    return getDryMass() + getFuelMass();
}

function getFuelCapacity() {
    return vehicleParts.reduce((total, part) => {
        return total + (part.fuelCapacity || 0);
    }, 0);
}

function getCurrentEngine() {
    return vehicleParts.find(part => part.type === "engine");
}

function getTotalThrust() {
    let thrust = 0;

    for (const part of vehicleParts) {
        if (part.type === "engine" && part.engine) {
            thrust += part.engine.maxThrust;
        }
    }

    return thrust;
}

function getFuelBurnRate() {
    let burn = 0;

    for (const part of vehicleParts) {
        if (part.type === "engine" && part.engine) {
            const engine = part.engine;

            // mdot = F / (Isp * g0)
            burn += engine.maxThrust /
                (engine.isp * PHYSICS.g0);
        }
    }

    return burn;
}

/* =========================================================
   ROCKET STATE
   ========================================================= */

const rocket = {
    x: 0,
    y: 0,

    vx: 0,
    vy: 0,

    angle: 0,
    angularVelocity: 0,

    throttle: 0,

    // Simple reaction-control torque.
    // This is deliberately much less sensitive than before.
    controlTorque: 150,

    width: 10,
    height: 62
};

/* =========================================================
   WORLD
   ========================================================= */

const world = {
    terrainScale: 850,
    terrainHeight: 5
};

function terrainHeight(x) {
    return (
        Math.sin(x / 180) * 2 +
        Math.sin(x / 420) * 3 +
        Math.sin(x / 90) * 0.8
    );
}

function altitude() {
    return Math.max(
        0,
        rocket.y - terrainHeight(rocket.x)
    );
}

function gravityAtAltitude(height) {
    const r = PHYSICS.planetRadius + Math.max(0, height);

    return PHYSICS.g0 *
        Math.pow(PHYSICS.planetRadius / r, 2);
}

function atmosphericDensity(height) {
    if (height >= PHYSICS.atmosphereHeight) {
        return 0;
    }

    const normalized =
        Math.max(
            0,
            1 - height / PHYSICS.atmosphereHeight
        );

    return PHYSICS.airDensitySeaLevel *
        Math.pow(normalized, 4);
}

/* =========================================================
   INPUT
   ========================================================= */

const keys = {};

window.addEventListener("keydown", event => {
    keys[event.code] = true;

    if (
        event.code === "KeyR" &&
        !event.repeat
    ) {
        resetRocket();
    }
});

window.addEventListener("keyup", event => {
    keys[event.code] = false;
});

/* =========================================================
   RESET
   ========================================================= */

function resetRocket() {
    for (const part of vehicleParts) {
        if (part.fuelCapacity) {
            part.fuel = part.fuelCapacity;
        }
    }

    rocket.x = 0;
    rocket.y = terrainHeight(0) + rocket.height / 2 + 1;

    rocket.vx = 0;
    rocket.vy = 0;

    rocket.angle = 0;
    rocket.angularVelocity = 0;

    rocket.throttle = 0;
}

resetRocket();

/* =========================================================
   PHYSICS
   ========================================================= */

function updatePhysics(dt) {
    /*
        Controls
    */

    const throttleRate = 0.65;

    if (keys["KeyW"]) {
        rocket.throttle += throttleRate * dt;
    }

    if (keys["KeyS"]) {
        rocket.throttle -= throttleRate * dt;
    }

    rocket.throttle =
        Math.max(
            0,
            Math.min(1, rocket.throttle)
        );

    /*
        Rotation control

        A/D apply torque instead of instantly changing
        the rocket's angle.
    */

    let controlInput = 0;

    if (keys["KeyA"]) {
        controlInput -= 1;
    }

    if (keys["KeyD"]) {
        controlInput += 1;
    }

    const totalMass = getTotalMass();

    /*
        Approximate moment of inertia for a long,
        narrow vehicle.

        I = 1/12 * m * (w² + h²)
    */

    const inertia =
        (1 / 12) *
        totalMass *
        (
            rocket.width * rocket.width +
            rocket.height * rocket.height
        );

    const angularAcceleration =
        (controlInput * rocket.controlTorque) /
        inertia;

    rocket.angularVelocity +=
        angularAcceleration * dt;

    /*
        Gentle rotational damping.
        This prevents the rocket from spinning forever
        while still allowing momentum.
    */

    rocket.angularVelocity *=
        Math.pow(0.12, dt);

    rocket.angle +=
        rocket.angularVelocity * dt;

    /*
        Engine
    */

    const engine = getCurrentEngine();

    let thrust = 0;

    if (
        engine &&
        engine.engine &&
        getFuelMass() > 0
    ) {
        thrust =
            engine.engine.maxThrust *
            rocket.throttle;
    }

    /*
        Fuel consumption

        mdot = F / (Isp * g0)

        This means:
        - more thrust = more fuel burned
        - less throttle = less fuel burned
        - higher-Isp engine = less fuel burned
    */

    let fuelBurn =
        0;

    if (
        engine &&
        engine.engine &&
        thrust > 0 &&
        getFuelMass() > 0
    ) {
        fuelBurn =
            thrust /
            (
                engine.engine.isp *
                PHYSICS.g0
            );

        fuelBurn *= dt;

        fuelBurn =
            Math.min(
                fuelBurn,
                getFuelMass()
            );

        consumeFuel(fuelBurn);
    }

    /*
        If we ran out of fuel, shut the engine down.
    */

    if (getFuelMass() <= 0.0001) {
        rocket.throttle = 0;
        thrust = 0;
    }

    /*
        Forces
    */

    let ax = 0;
    let ay = 0;

    /*
        Gravity

        Down is negative Y.
    */

    const g =
        gravityAtAltitude(
            altitude()
        );

    ay -= g;

    /*
        Thrust direction

        angle 0 = straight upward.
    */

    const thrustX =
        Math.sin(rocket.angle) *
        thrust;

    const thrustY =
        Math.cos(rocket.angle) *
        thrust;

    ax += thrustX / totalMass;
    ay += thrustY / totalMass;

    /*
        Atmospheric drag

        Fd = 1/2 * rho * Cd * A * v²
    */

    const rho =
        atmosphericDensity(
            altitude()
        );

    const speed =
        Math.hypot(
            rocket.vx,
            rocket.vy
        );

    if (
        rho > 0 &&
        speed > 0.01
    ) {
        const dragForce =
            0.5 *
            rho *
            PHYSICS.dragCoefficient *
            PHYSICS.referenceArea *
            speed *
            speed;

        const dragAcceleration =
            dragForce /
            totalMass;

        ax -=
            (rocket.vx / speed) *
            dragAcceleration;

        ay -=
            (rocket.vy / speed) *
            dragAcceleration;
    }

    /*
        Integrate velocity
    */

    rocket.vx += ax * dt;
    rocket.vy += ay * dt;

    /*
        Integrate position
    */

    rocket.x += rocket.vx * dt;
    rocket.y += rocket.vy * dt;

    /*
        Terrain collision
    */

    const ground =
        terrainHeight(rocket.x);

    const minimumY =
        ground +
        rocket.height / 2;

    if (rocket.y < minimumY) {
        rocket.y = minimumY;

        /*
            Don't allow the rocket to sink into terrain.
        */

        if (rocket.vy < 0) {
            rocket.vy = 0;
        }

        /*
            Small ground friction.
        */

        rocket.vx *= 0.92;

        /*
            Resting rocket gradually settles.
        */

        if (
            Math.abs(rocket.vx) < 0.02
        ) {
            rocket.vx = 0;
        }
    }
}

function consumeFuel(amount) {
    let remaining = amount;

    /*
        For now, consume from tanks.
        Later the vehicle graph can determine which
        tanks are connected to which engines.
    */

    for (const part of vehicleParts) {
        if (
            part.type !== "tank" ||
            !part.fuel
        ) {
            continue;
        }

        const taken =
            Math.min(
                part.fuel,
                remaining
            );

        part.fuel -= taken;
        remaining -= taken;

        if (remaining <= 0) {
            break;
        }
    }
}

/* =========================================================
   CAMERA
   ========================================================= */

const camera = {
    x: 0,
    y: 0,
    zoom: 4
};

function updateCamera(dt) {
    const targetX = rocket.x;
    const targetY = rocket.y;

    camera.x +=
        (targetX - camera.x) *
        Math.min(1, dt * 5);

    camera.y +=
        (targetY - camera.y) *
        Math.min(1, dt * 5);

    const height = altitude();

    /*
        Zoom out gradually as the rocket climbs.
    */

    const targetZoom =
        Math.max(
            1.35,
            4 - Math.log10(
                Math.max(1, height + 10)
            ) * 0.7
        );

    camera.zoom +=
        (targetZoom - camera.zoom) *
        Math.min(1, dt * 2);
}

function worldToScreen(x, y) {
    return {
        x:
            W / 2 +
            (x - camera.x) *
            camera.zoom,

        y:
            H / 2 -
            (y - camera.y) *
            camera.zoom
    };
}

/* =========================================================
   VISUALS
   ========================================================= */

function drawBackground() {
    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            H
        );

    gradient.addColorStop(
        0,
        "#050a16"
    );

    gradient.addColorStop(
        0.65,
        "#0b1624"
    );

    gradient.addColorStop(
        1,
        "#132331"
    );

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    /*
        Stars
    */

    const starSeed = 1337;

    for (let i = 0; i < 120; i++) {
        const x =
            ((i * 7919 + starSeed) % 1000) /
            1000 *
            W;

        const y =
            ((i * 3137 + starSeed) % 1000) /
            1000 *
            H;

        const size =
            i % 7 === 0
                ? 1.5
                : 1;

        ctx.fillStyle =
            "rgba(255,255,255,0.55)";

        ctx.fillRect(
            x,
            y,
            size,
            size
        );
    }
}

function drawTerrain() {
    const startWorldX =
        camera.x -
        W / (2 * camera.zoom);

    const endWorldX =
        camera.x +
        W / (2 * camera.zoom);

    const step =
        Math.max(
            5,
            14 / camera.zoom
        );

    ctx.beginPath();

    let first = true;

    for (
        let x = startWorldX;
        x <= endWorldX;
        x += step
    ) {
        const y =
            terrainHeight(x);

        const screen =
            worldToScreen(x, y);

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

    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();

    ctx.fillStyle = "#182a28";
    ctx.fill();

    /*
        Terrain surface
    */

    ctx.beginPath();

    first = true;

    for (
        let x = startWorldX;
        x <= endWorldX;
        x += step
    ) {
        const y =
            terrainHeight(x);

        const screen =
            worldToScreen(x, y);

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
        "rgba(160,190,175,0.7)";

    ctx.lineWidth = 1.5;

    ctx.stroke();
}

function drawLaunchPad() {
    const ground =
        terrainHeight(0);

    const left =
        worldToScreen(
            -28,
            ground
        );

    const right =
        worldToScreen(
            28,
            ground
        );

    ctx.beginPath();

    ctx.moveTo(
        left.x,
        left.y
    );

    ctx.lineTo(
        right.x,
        right.y
    );

    ctx.lineWidth = 5;
    ctx.strokeStyle =
        "rgba(180,190,195,0.9)";

    ctx.stroke();

    /*
        Small pad supports
    */

    ctx.lineWidth = 2;

    for (
        const x of [-20, 20]
    ) {
        const top =
            worldToScreen(
                x,
                ground
            );

        const bottom =
            worldToScreen(
                x,
                ground - 4
            );

        ctx.beginPath();

        ctx.moveTo(
            top.x,
            top.y
        );

        ctx.lineTo(
            bottom.x,
            bottom.y
        );

        ctx.stroke();
    }
}

function drawRocket() {
    const center =
        worldToScreen(
            rocket.x,
            rocket.y
        );

    ctx.save();

    ctx.translate(
        center.x,
        center.y
    );

    ctx.rotate(
        -rocket.angle
    );

    /*
        Scale visual size according to camera.
    */

    const width =
        rocket.width *
        camera.zoom;

    const height =
        rocket.height *
        camera.zoom;

    /*
        Main body
    */

    ctx.fillStyle = "#c9cdd0";

    ctx.fillRect(
        -width / 2,
        -height / 2,
        width,
        height
    );

    /*
        Nose
    */

    ctx.beginPath();

    ctx.moveTo(
        -width / 2,
        -height / 2
    );

    ctx.lineTo(
        width / 2,
        -height / 2
    );

    ctx.lineTo(
        0,
        -height / 2 -
        8 * camera.zoom
    );

    ctx.closePath();

    ctx.fillStyle = "#e1e4e6";
    ctx.fill();

    /*
        Tank band
    */

    ctx.fillStyle =
        "rgba(70,80,88,0.8)";

    ctx.fillRect(
        -width / 2,
        -height * 0.05,
        width,
        3 * camera.zoom
    );

    /*
        Engine section
    */

    ctx.fillStyle = "#555d63";

    ctx.fillRect(
        -width / 2,
        height / 2 - 10 * camera.zoom,
        width,
        10 * camera.zoom
    );

    /*
        Engine nozzle
    */

    ctx.beginPath();

    ctx.moveTo(
        -width * 0.28,
        height / 2
    );

    ctx.lineTo(
        width * 0.28,
        height / 2
    );

    ctx.lineTo(
        width * 0.20,
        height / 2 +
        7 * camera.zoom
    );

    ctx.lineTo(
        -width * 0.20,
        height / 2 +
        7 * camera.zoom
    );

    ctx.closePath();

    ctx.fillStyle = "#30363a";
    ctx.fill();

    /*
        Flame
    */

    if (
        rocket.throttle > 0 &&
        getFuelMass() > 0
    ) {
        const flameLength =
            (
                8 +
                18 * rocket.throttle
            ) *
            camera.zoom;

        const flameWidth =
            width *
            0.32;

        const nozzleY =
            height / 2 +
            7 * camera.zoom;

        ctx.beginPath();

        ctx.moveTo(
            -flameWidth / 2,
            nozzleY
        );

        ctx.lineTo(
            flameWidth / 2,
            nozzleY
        );

        ctx.lineTo(
            0,
            nozzleY + flameLength
        );

        ctx.closePath();

        ctx.fillStyle =
            "rgba(255,190,75,0.9)";

        ctx.fill();
    }

    ctx.restore();
}

/* =========================================================
   HUD
   ========================================================= */

function roundedRect(
    x,
    y,
    width,
    height,
    radius
) {
    ctx.beginPath();

    ctx.roundRect(
        x,
        y,
        width,
        height,
        radius
    );

    ctx.fill();
}

function drawPanel(
    x,
    y,
    width,
    height
) {
    ctx.fillStyle =
        "rgba(5,10,15,0.72)";

    roundedRect(
        x,
        y,
        width,
        height,
        10
    );

    ctx.strokeStyle =
        "rgba(180,205,220,0.16)";

    ctx.lineWidth = 1;

    ctx.stroke();
}

function drawHUD() {
    const height =
        altitude();

    const speed =
        Math.hypot(
            rocket.vx,
            rocket.vy
        );

    const angleDegrees =
        rocket.angle *
        180 /
        Math.PI;

    const fuel =
        getFuelMass();

    const maxFuel =
        getFuelCapacity();

    /*
        Top-left: angle
    */

    drawPanel(
        18,
        18,
        150,
        70
    );

    ctx.fillStyle =
        "#aab6bf";

    ctx.font =
        "12px Arial";

    ctx.fillText(
        "ATTITUDE",
        32,
        40
    );

    ctx.fillStyle =
        "#f0f3f5";

    ctx.font =
        "bold 22px Arial";

    ctx.fillText(
        `${angleDegrees.toFixed(1)}°`,
        32,
        67
    );

    /*
        Top-right: altitude + velocity
    */

    drawPanel(
        W - 198,
        18,
        180,
        70
    );

    ctx.fillStyle =
        "#aab6bf";

    ctx.font =
        "12px Arial";

    ctx.fillText(
        "ALTITUDE",
        W - 182,
        40
    );

    ctx.fillText(
        "VELOCITY",
        W - 182,
        66
    );

    ctx.fillStyle =
        "#f0f3f5";

    ctx.font =
        "bold 14px Arial";

    ctx.fillText(
        formatDistance(height),
        W - 118,
        40
    );

    ctx.fillText(
        `${speed.toFixed(1)} m/s`,
        W - 118,
        66
    );

    /*
        Bottom-left: fuel
    */

    drawPanel(
        18,
        H - 88,
        190,
        70
    );

    ctx.fillStyle =
        "#aab6bf";

    ctx.font =
        "12px Arial";

    ctx.fillText(
        "FUEL",
        32,
        H - 61
    );

    ctx.fillStyle =
        "#f0f3f5";

    ctx.font =
        "bold 19px Arial";

    ctx.fillText(
        `${fuel.toFixed(1)} / ${maxFuel.toFixed(0)} kg`,
        32,
        H - 35
    );

    /*
        Bottom-right: throttle
    */

    drawPanel(
        W - 208,
        H - 88,
        190,
        70
    );

    ctx.fillStyle =
        "#aab6bf";

    ctx.font =
        "12px Arial";

    ctx.fillText(
        "THROTTLE",
        W - 192,
        H - 61
    );

    ctx.fillStyle =
        "#f0f3f5";

    ctx.font =
        "bold 19px Arial";

    ctx.fillText(
        `${Math.round(
            rocket.throttle * 100
        )}%`,
        W - 192,
        H - 35
    );

    /*
        Flight indicator
    */

    const cx = W / 2;
    const cy = H / 2;

    ctx.strokeStyle =
        "rgba(220,235,240,0.35)";

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(
        cx - 18,
        cy
    );

    ctx.lineTo(
        cx + 18,
        cy
    );

    ctx.moveTo(
        cx,
        cy - 18
    );

    ctx.lineTo(
        cx,
        cy + 18
    );

    ctx.stroke();

    /*
        Controls
    */

    ctx.fillStyle =
        "rgba(220,230,235,0.55)";

    ctx.font =
        "11px Arial";

    ctx.fillText(
        "W/S  THROTTLE    A/D  ROTATE    R  RESET",
        18,
        H - 102
    );
}

function formatDistance(value) {
    if (value >= 1_000_000) {
        return (
            (value / 1_000_000)
                .toFixed(2) +
            " Mm"
        );
    }

    if (value >= 1000) {
        return (
            (value / 1000)
                .toFixed(2) +
            " km"
        );
    }

    return (
        value.toFixed(0) +
        " m"
    );
}

/* =========================================================
   GAME LOOP
   ========================================================= */

let lastTime = performance.now();

function frame(now) {
    let dt =
        (now - lastTime) /
        1000;

    lastTime = now;

    /*
        Prevent giant physics jumps if the tab
        freezes for a moment.
    */

    dt =
        Math.min(
            dt,
            1 / 30
        );

    updatePhysics(dt);
    updateCamera(dt);

    drawBackground();
    drawTerrain();
    drawLaunchPad();
    drawRocket();
    drawHUD();

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
