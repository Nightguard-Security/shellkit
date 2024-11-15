import { spawn } from "node:child_process";
import { createServer, Socket } from "node:net";
import { randomUUID } from "node:crypto";

const wrapper = function() {
  const { createConnection } = require("node:net");
  const UUID = Buffer.from(process.argv[2]);
  const MARKER = Buffer.from("NODE_REV");
  const ipcPort = Number(process.argv[1] ?? "2424");
  const socket = createConnection({
    port: ipcPort,
    host: "127.0.0.1",
    keepAlive: true
  });
  socket.on("ready", () => {
    socket.write(Buffer.concat([MARKER, UUID]));
    process.stdin.setRawMode(true);
    socket.pipe(process.stdout);
    process.stdin.pipe(socket);
  });
  socket.on("close", () => {
    process.exit();
  });
  process.stdin.on("end", () => {
    socket.end();
    process.exit();
  });
};
const WRAPPER_CODE = wrapper.toString().slice(13,-1);

export function catcher(shellPort: number, shellHost: string, ipcPort: number) {
  const MARKER = Buffer.from("NODE_REV");
  const idMap = new Map<string, Socket>();
  const node = process.argv[0];
  const shellServer = createServer({
    keepAlive: true
  });
  shellServer.on("connection", (socket) => {
    const uuid = randomUUID();
    idMap.set(uuid, socket);
    spawn("tmux", ["split-window", `exec ${node} -e '${WRAPPER_CODE}' ${ipcPort} ${uuid}`]);
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
}