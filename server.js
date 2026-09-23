const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const GameRoom = require("./shared/sim");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8082);
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MIMES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".mpeg": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
};

const roomsByMode = { br: [], raid: [], rush: [] };
const clients = new Set();

function send(sock, obj) {
  if (!sock || sock.readyState !== 1) return;
  try {
    sock.send(JSON.stringify(obj));
  } catch (e) {}
}

function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const fin = buf[0] & 128;
  const op = buf[0] & 15;
  const masked = buf[1] & 128;
  let len = buf[1] & 127;
  let i = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    i = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2));
    i = 10;
  }
  if (!masked) return { skip: buf.length };
  if (buf.length < i + 4 + len) return null;
  const mask = buf.slice(i, i + 4);
  i += 4;
  const data = Buffer.alloc(len);
  for (let k = 0; k < len; k++) data[k] = buf[i + k] ^ mask[k % 4];
  return { op: op, fin: fin, payload: data, total: i + len };
}

function encodeFrame(payload, opcode) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const op = opcode == null ? 1 : opcode;
  let head;
  if (data.length < 126) {
    head = Buffer.alloc(2);
    head[0] = 0x80 | op;
    head[1] = data.length;
  } else if (data.length < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x80 | op;
    head[1] = 126;
    head.writeUInt16BE(data.length, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | op;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(data.length), 2);
  }
  return Buffer.concat([head, data]);
}

function attachSocket(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash("sha1").update(key + GUID).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
      accept +
      "\r\n\r\n"
  );
  const sock = {
    raw: socket,
    readyState: 1,
    id: "p-" + crypto.randomBytes(4).toString("hex"),
    room: null,
    buf: Buffer.alloc(0),
    send: function (text) {
      if (this.readyState !== 1) return;
      try {
        this.raw.write(encodeFrame(text, 1));
      } catch (e) {
        this.close();
      }
    },
    close: function () {
      if (this.readyState !== 1) return;
      this.readyState = 3;
      try {
        this.raw.write(encodeFrame(Buffer.alloc(0), 8));
      } catch (e) {}
      try {
        this.raw.end();
      } catch (e) {}
    },
  };
  clients.add(sock);
  socket.on("data", (chunk) => {
    sock.buf = Buffer.concat([sock.buf, chunk]);
    while (sock.buf.length >= 2) {
      const frame = decodeFrame(sock.buf);
      if (!frame) break;
      if (frame.skip) {
        sock.buf = sock.buf.slice(frame.skip);
        continue;
      }
      sock.buf = sock.buf.slice(frame.total);
      if (frame.op === 8) {
        dropClient(sock);
        return;
      }
      if (frame.op === 9) {
        try {
          socket.write(encodeFrame(frame.payload, 10));
        } catch (e) {}
        continue;
      }
      if (frame.op !== 1) continue;
      try {
        onMessage(sock, JSON.parse(frame.payload.toString("utf8")));
      } catch (e) {}
    }
  });
  socket.on("close", () => dropClient(sock));
  socket.on("error", () => dropClient(sock));
}

function parseMode(mode) {
  if (mode === "raid" || mode === "rush") return mode;
  return "br";
}

function waitingRoom(mode) {
  const key = parseMode(mode);
  const list = roomsByMode[key];
  let room = list.find((r) => r.state === "waiting");
  if (!room) {
    room = new GameRoom(key);
    room.lobbyLeft = 28;
    wireRoom(room, key);
    list.push(room);
  }
  return room;
}

function forgetRoom(room, key) {
  const list = roomsByMode[key] || [];
  const i = list.indexOf(room);
  if (i >= 0) list.splice(i, 1);
}

function wireRoom(room, key) {
  room.on("lobby", (data) => {
    for (const c of clients) if (c.room === room) send(c, Object.assign({ t: "lobby" }, data));
  });
  room.on("start", (data) => {
    for (const c of clients) if (c.room === room) send(c, { t: "start", mode: data.mode, you: c.id });
  });
  room.on("frame", () => {
    for (const c of clients) {
      if (c.room !== room) continue;
      const viewer = room.players.get(c.id) || { x: room.barrierCx, y: room.barrierCy, id: c.id, alive: false };
      const snap = room.snapshotFor(viewer);
      snap.you = c.id;
      send(c, { t: "state", s: snap });
    }
  });
  room.on("fx", (f) => {
    for (const c of clients) if (c.room === room) send(c, { t: "fx", f: f });
  });
  room.on("impact", (d) => {
    for (const c of clients) if (c.room === room) send(c, { t: "impact", d: d });
  });
  room.on("sys", (row) => {
    for (const c of clients) if (c.room === room) send(c, { t: "sys", row: row });
  });
  room.on("bossAlert", (info) => {
    for (const c of clients) if (c.room === room) send(c, { t: "bossAlert", info: info });
  });
  room.on("end", (payload) => {
    for (const c of clients) {
      if (c.room !== room) continue;
      const p = room.players.get(c.id);
      send(c, {
        t: "end",
        payload: payload,
        youStats: p
          ? {
              kills: p.kills || 0,
              shadows: room.armyOf(c.id).length,
              alive: !!p.alive,
              win: !!(payload.winner && payload.winner.id === c.id),
              time: room.time || 0,
            }
          : null,
      });
    }
  });
  room.on("destroy", () => {
    for (const c of clients) if (c.room === room) c.room = null;
    forgetRoom(room, key);
  });
}

function onMessage(sock, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === "join") {
    if (sock.room) return;
    const mode = parseMode(msg.mode);
    const room = waitingRoom(mode);
    const ok = room.addPlayer(sock.id, msg.name, false, msg.cosmetics || {}, msg.startClass || "novice");
    if (!ok) {
      send(sock, { t: "err", m: "Salon plein, réessaie." });
      return;
    }
    sock.room = room;
    send(sock, { t: "hello", you: sock.id });
    return;
  }
  if (msg.t === "input" && sock.room) {
    sock.room.setInput(sock.id, msg);
  }
}

function dropClient(sock) {
  if (!clients.has(sock)) return;
  clients.delete(sock);
  sock.readyState = 3;
  if (sock.room) {
    try {
      sock.room.removePlayer(sock.id, "disconnect");
    } catch (e) {}
    sock.room = null;
  }
  try {
    sock.raw.destroy();
  } catch (e) {}
}

function sendFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const ctype = MIMES[ext] || "application/octet-stream";
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": ctype,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let urlPath = (req.url || "/").split("?")[0];
  try {
    urlPath = decodeURIComponent(urlPath);
  } catch (e) {}
  if (urlPath === "/") urlPath = "/index.html";
  const file = path.normalize(path.join(ROOT, urlPath.replace(/^[/\\]+/, "")));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    sendFile(res, file);
  });
});

server.on("upgrade", (req, socket) => {
  const urlPath = (req.url || "").split("?")[0];
  if (urlPath !== "/ws") {
    socket.destroy();
    return;
  }
  attachSocket(req, socket);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("SHADOW.io en ligne sur http://127.0.0.1:" + PORT);
  console.log("Tes potes (à distance) : cloudflared tunnel --url http://127.0.0.1:" + PORT);
  console.log("Envoie-leur le lien https://….trycloudflare.com  (pas Netlify)");
});
