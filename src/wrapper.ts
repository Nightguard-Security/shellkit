import { createConnection } from "node:net";

const UUID = Buffer.from(process.argv[3]);
const MARKER = Buffer.from("NODE_REV");
const ipcPort = Number(process.argv[2] ?? "2424");

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
