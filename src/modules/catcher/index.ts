import { spawn } from "node:child_process";
import { createServer, Socket } from "node:net";
import { randomUUID } from "node:crypto";
import { ConnectionTable } from "./connectionTable";

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

export function catcher(shellHost: string, shellPort: number, ipcPort: number) {
  const MARKER = Buffer.from("NODE_REV");
  const idMap = new Map<string, Socket>();
  const node = process.argv[0];
  const connections = new Map<string, string | undefined>();
  const connectionTable = new ConnectionTable({shellHost, shellPort, ipcPort});

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
          connections.set(uuid, pair.remoteAddress);
          renderConnectionTable();
          idMap.delete(uuid);
          pair.pipe(socket);
          socket.pipe(pair);
          socket.on("error", () => {
            socket.end();
            pair.end();
          });
          pair.on("end", () => {
            connections.delete(uuid);
            renderConnectionTable();
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

  const renderConnectionTable = () => {
    connectionTable.clear();
    connectionTable.render(connections);
  }

  shellServer.listen(shellPort, shellHost);
  ipcServer.listen(ipcPort, "127.0.0.1");
  renderConnectionTable();
}

// Check if the file was imported or run directly.
if (require.main === module) {
  // Directly run from CLI.  Collect parameters and start catcher.
  const [shellPort, shellHost, ipcPort]= process.argv.slice(2,5);
  catcher(shellHost, Number(shellPort), Number(ipcPort));
}