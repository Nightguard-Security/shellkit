import { spawn } from "node:child_process";
import { join } from "node:path";
import { createServer, Socket } from "node:net";
import { randomUUID } from "node:crypto";

if (process.env.TMUX === undefined) {
  console.error("Need to be runnning in TMUX");
  process.exit(1);
}

const MARKER = Buffer.from("NODE_REV");
const idMap = new Map<string, Socket>();
const node = process.argv[0];
const wrapper = join(__dirname, "wrapper");
const shellPort = Number(process.argv[2] ?? "4242");
const shellHost = process.argv[3] ?? "127.0.0.1";
const ipcPort = Number(process.argv[4] ?? "2424");

const shellServer = createServer({
  keepAlive: true
});
shellServer.on("connection", (socket) => {
  const uuid = randomUUID();
  idMap.set(uuid, socket);
  spawn("tmux", ["split-window", `exec ${node} ${wrapper} ${ipcPort} ${uuid}`]);
});
const ipcServer = createServer({
  keepAlive: true
});
ipcServer.on("connection", (socket) => {
  let mark: Buffer = socket.read(MARKER.length);
  if (mark === null) {
    socket.once("readable", () => {
      let mark: Buffer = socket.read(MARKER.length);
      handle(mark);
    });
  } else {
    handle(mark);
  }
  function handle(mark: Buffer) {
    if (mark.equals(MARKER)) {
      const uuid = socket.read(36).toString("utf8");
      const pair = idMap.get(uuid);
      if (pair) {
        console.log(`New Connection ${uuid} from ${pair.remoteAddress}`);
        idMap.delete(uuid);
        pair.pipe(socket);
        socket.pipe(pair);
        socket.on("error", () => {
          socket.end();
          pair.end();
        });
        pair.on("end", () => {
          console.log(`Connection ${uuid} from ${pair.remoteAddress} closed`);
        });
        pair.on("error", () => {
          socket.end();
          pair.end();
        });
      } else {
        socket.end();
      }
    } else {
      socket.end();
    }
  }
});

shellServer.listen(shellPort, shellHost);
ipcServer.listen(ipcPort, "127.0.0.1");
console.log(`Listening for Reverse Shells on ${shellHost}:${shellPort}`);
console.log(`IPC on ${ipcPort}`);