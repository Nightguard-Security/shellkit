import { createConnection } from "node:net";

const wrapper = function(IPC_SOCKET: string, UUID: Buffer, RAW_MODE: boolean) {
  const MARKER = Buffer.from("NODE_REV");
  const socket = createConnection({
    path: "\0" + IPC_SOCKET,
    keepAlive: true
  });
  socket.on("ready", () => {
    socket.write(Buffer.concat([MARKER, UUID]));
    process.stdin.setRawMode(RAW_MODE);
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

export const WRAPPER_PATH = __filename;

if (require.main === module) {
  const IPC_SOCKET = process.argv[2];
  const UUID = Buffer.from(process.argv[3]);
  const RAW_MODE = process.argv[4] === "TTY";
  wrapper(IPC_SOCKET, UUID, RAW_MODE);
}