const { on, EventEmitter } = require('events');
const ws = require('ws');

const server = new ws.Server({ port: process.env.PORT || 9000 });

class Data {
    constructor(type, content) {
        this.type = type;
        this.content = content;
    }
}

class Square {
    constructor(x, y, size, speed, color, socket) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.speed = speed;
        this.color = color;
        this.socket = socket;
    }

    setPosition(vector) {
        this.x = vector.x;
        this.y = vector.y;
    }

    draw() {
        context.fillStyle = this.color;
        context.fillRect(this.x - (this.size / 2), this.y - (this.size / 2), this.size, this.size);
    }

    move(vector) {
        if (this.color == "white") {
            if (vector.x != 0 || vector.y != 0) {
                vector = vector.nomalize();
                vector = vector.mul(this.speed);
                this.x += vector.x;
                this.y += vector.y;
                this.clamp();
            }
        }
    }

    clamp() {
        this.x = Math.max(this.x, -mapSize + this.size / 2);
        this.x = Math.min(this.x, mapSize - this.size / 2);
        this.y = Math.max(this.y, -mapSize + this.size / 2);
        this.y = Math.min(this.y, mapSize - this.size / 2);
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

const mapSize = 150;
const entities = {}

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function broadcast(socket, data) {
    server.clients.forEach(function (client) {
        if (client != socket) {
            client.send(JSON.stringify(data));
        }
    });
}

function getUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

server.on('connection', (socket) => {
    socket.uuid = getUUID();
    socket.on('message', (data) => {
        const message = JSON.parse(data);
        const type = message.type;
        const content = message.content;

        if (type === 'join') {
            console.log(entities);
            Object.keys(entities).forEach((key) => {
                const entity = entities[key];
                try {
                    socket.send(JSON.stringify(new Data('join', { uuid: key, x: entity.x, y: entity.y, color: entity.color })));
                }
                catch (e) {
                    console.log(e);
                }
            });
            entities[socket.uuid] = new Square(content.x, content.y, 5, 2, getRandomColor(), socket, socket.uuid);
            broadcast(socket, new Data('join', { uuid: socket.uuid, x: content.x, y: content.y, color: entities[socket.uuid].color }));

        }
        else if (type === 'move') {
            entities[socket.uuid].setPosition(new Vector(content.x, content.y));
            broadcast(socket, new Data('move', { uuid: socket.uuid, x: content.x, y: content.y }));
        }
    });

    socket.on('close', () => {
        console.log('Client disconnected');
        delete entities[socket.uuid];
        broadcast(socket, new Data('leave', { uuid: socket.uuid }));
    });
});

server.on('listening', () => {
    console.log('Server started');
});