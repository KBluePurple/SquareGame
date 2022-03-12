var server = "wss://https://square-game-back.herokuapp.com:9000/";

/** @type {WebSocket} */
var ws;
/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let context;
let player;

let touchStartPos;
let touchCurrentPos;
let touching = false;

let subMessage = "Wait for connecting...";

const mapSize = 150;

const keyDict = {}
const entities = {}

//#region class definitions
class Data {
    constructor(type, content) {
        this.type = type;
        this.content = content;
    }
}

class Square {
    constructor(x, y, size, speed, color) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.speed = speed;
        this.color = color;
        this.targetPos = new Vector(x, y);
    }

    draw() {
        context.fillStyle = this.color;
        context.fillRect(this.x - (this.size / 2), this.y - (this.size / 2), this.size, this.size);
    }

    move(vector) {
        if (vector.x != 0 || vector.y != 0) {
            vector = vector.nomalize();
            vector = vector.mul(this.speed);
            this.x += vector.x;
            this.y += vector.y;
            this.clamp();
        }
    }

    clamp() {
        this.x = Math.max(this.x, -mapSize + this.size / 2);
        this.x = Math.min(this.x, mapSize - this.size / 2);
        this.y = Math.max(this.y, -mapSize + this.size / 2);
        this.y = Math.min(this.y, mapSize - this.size / 2);
    }

    update() {
        if (this.targetPos.distance(new Vector(this.x, this.y)) > this.speed) {
            let vector = this.targetPos.sub(new Vector(this.x, this.y));
            this.move(vector);
        }
        else {
            this.x = this.targetPos.x;
            this.y = this.targetPos.y;
        }
    }
}

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    nomalize() {
        let length = this.length();
        return new Vector(this.x / length, this.y / length);
    }

    add(vector) {
        return new Vector(this.x + vector.x, this.y + vector.y);
    }

    sub(vector) {
        return new Vector(this.x - vector.x, this.y - vector.y);
    }

    mul(scalar) {
        return new Vector(this.x * scalar, this.y * scalar);
    }

    distance(vector) {
        return Math.sqrt(Math.pow(this.x - vector.x, 2) + Math.pow(this.y - vector.y, 2));
    }

    equals(vector) {
        return this.x == vector.x && this.y == vector.y;
    }
}
//#endregion

let count = 0;
function update() {
    for (const [key, entity] of Object.entries(entities)) {
        entity.update();
        entity.draw();
    }

    if (player.color == "white") {
        let moveVector = new Vector(0, 0);
        if (keyDict['w'] || keyDict['ArrowUp']) {
            moveVector = moveVector.add(new Vector(0, -1));
        }
        if (keyDict['s'] || keyDict['ArrowDown']) {
            moveVector = moveVector.add(new Vector(0, 1));
        }
        if (keyDict['a'] || keyDict['ArrowLeft']) {
            moveVector = moveVector.add(new Vector(-1, 0));
        }
        if (keyDict['d'] || keyDict['ArrowRight']) {
            moveVector = moveVector.add(new Vector(1, 0));
        }
        player.move(moveVector);

        if (touching) {
            let direction = new Vector(touchCurrentPos.x - touchStartPos.x, touchCurrentPos.y - touchStartPos.y);
            direction = direction.nomalize();
            let length = (touchStartPos.distance(touchCurrentPos) > 3 ? 3 : touchStartPos.distance(touchCurrentPos)) / 3;
            if (length != 0) {
                length = player.speed * (length > 1 ? 1 : length);
                direction = direction.mul(length);
                player.x += direction.x;
                player.y += direction.y;
                player.clamp();
            }
        }
    }

    player.draw();
}

//#region system functions
function clearScreen() {
    width = canvas.width;
    height = canvas.height;
    context.fillStyle = "gray";
    context.fillRect(-width / 2, -height / 2, width, height);
    context.fillStyle = "black";
    context.fillRect(-mapSize, -mapSize, mapSize * 2, mapSize * 2);
    context.fillStyle = "white";
    context.font = "20px Arial";
    context.fillText(subMessage, -mapSize, mapSize + 40);
}

function init() {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    player = new Square(randomRange(-150, 150), randomRange(-150, 150), 5, 2, "white");

    width = canvas.width;
    height = canvas.height;
    context.clearRect(-width / 2, -height / 2, width, height);
    context.fillStyle = "gray";
    context.fillRect(-width / 2, -height / 2, width, height);
    context.translate(canvas.width / 2, canvas.height / 2);

    setInterval(() => {
        context.canvas.width = window.innerWidth;
        context.canvas.height = window.innerHeight;
        context.translate(canvas.width / 2, canvas.height / 2);
        clearScreen();
        update();
    }, 1000 / 60, 0);

    ws = new WebSocket(server);
    for (const key of Object.keys(entities)) {
        delete entities[key];
    }
    player.color = "gray";
    subMessage = "Wait for connecting...";

    let previousPos = new Vector(player.x, player.y);
    setInterval(() => {
        if (ws.readyState == WebSocket.OPEN) {
            if (previousPos.distance(new Vector(player.x, player.y)) > 0.1) {
                ws.send(JSON.stringify(new Data("move", new Vector(player.x, player.y))));
                previousPos = new Vector(player.x, player.y);
            }
        }
    }, 1000 / 20, 0);

    ws.onmessage = (event) => {
        const { type, content } = JSON.parse(event.data);
        if (type == "join") {
            entities[content.uuid] = new Square(content.x, content.y, 5, 2, content.color);
        }
        else if (type == "move") {
            // entities[content.uuid].x = content.x;
            // entities[content.uuid].y = content.y;
            entities[content.uuid].targetPos = new Vector(content.x, content.y);
        }
        else if (type == "leave") {
            delete entities[content.uuid];
        }
    }

    ws.onopen = () => {
        subMessage = "[W], [A], [S], [D] or [Drag] to move";
        ws.send(JSON.stringify(new Data("join", new Vector(player.x, player.y))));
        player.color = "white";
    }

    ws.onclose = () => {
        ws = new WebSocket(server);
        for (const key of Object.keys(entities)) {
            delete entities[key];
        }
        player.color = "gray";
        subMessage = "Wait for connecting...";
    }
}

function screenToContext(screenPos) {
    return new Vector(screenPos.x - canvas.width / 2, screenPos.y - canvas.height / 2);
}

function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}
//#endregion

//#region event handlers
window.addEventListener("load", init, false);

window.addEventListener("touchstart", (e) => {
    touching = true;
    touchStartPos = screenToContext(new Vector(e.touches[0].screenX, e.touches[0].screenY));
    touchCurrentPos = touchStartPos;
    e.preventDefault();
}, false);
window.addEventListener("touchmove", (e) => {
    touchCurrentPos = screenToContext(new Vector(e.touches[0].screenX, e.touches[0].screenY));
});
window.addEventListener("touchend", (e) => {
    touching = false;
});

window.addEventListener("mousedown", (e) => {
    touching = true;
    touchStartPos = screenToContext(new Vector(e.screenX, e.screenY));
    touchCurrentPos = touchStartPos;
});
window.addEventListener("mousemove", (e) => {
    touchCurrentPos = screenToContext(new Vector(e.screenX, e.screenY));
});
window.addEventListener("mouseup", (e) => {
    touching = false;
});

window.addEventListener("keydown", (e) => {
    keyDict[e.key] = true;
});

window.addEventListener("keyup", (e) => {
    keyDict[e.key] = false;
});

document.addEventListener('contextmenu', event => event.preventDefault());
//#endregion