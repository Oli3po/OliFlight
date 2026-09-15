const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function gameLoop() {
    ctx.fillStyle = "#050914";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "32px Arial";
    ctx.textAlign = "center";
    ctx.fillText("OLIFLIGHT", canvas.width / 2, 80);

    requestAnimationFrame(gameLoop);
}

gameLoop();
