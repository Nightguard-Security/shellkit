#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer, Socket } from "node:net";
import { randomUUID } from "node:crypto";
import yargs from "yargs/yargs";
import { ConnectionTable } from "./connectionTable";
import type { Readable } from "node:stream";
import { WRAPPER_PATH } from "./wrapper";

interface CommandLineArguments {
  [x: string]: unknown;
  borderless: boolean | undefined;
  _: (string | number)[];
}
type CatcherOptions = {
  borderless: boolean
};
type Connection = {
  id: string; // uuid
  socket: Socket;
};
// type Client = {
//   id: string; // uuid
//   target: string; // uuid
//   socket: Socket;
// };

function readUntilByte(target: Buffer, stream: Readable): Promise<Buffer> {
  return new Promise((resolve) => {
    const bytes: Buffer[] = [];
    let byte = Buffer.alloc(0);
    function readUntilEmpty() {
      while (true) {
        byte = stream.read(1);
        if (byte === null) {
          return stream.once("readable", readUntilEmpty);
        }
        if (byte.equals(target)) {
          return resolve(Buffer.concat(bytes));
        }
        bytes.push(byte);
      }
    }
    readUntilEmpty();
  });
}
const NEWLINE = Buffer.from("\n");
function readUntilLine(stream: Readable) {
  return readUntilByte(NEWLINE, stream);
}

export function catcher(shellHost: string, shellPort: number, options: CatcherOptions) {
  const connections = new Map<string, Connection>();
  // const clients = new Map<string, Client>();
  const IPC_SOCKET = "/shellkit/" + randomUUID();
  const MARKER = Buffer.from("NODE_REV");
  const node = process.execPath;
  const connectionTable = new ConnectionTable({shellHost, shellPort, borderless: options.borderless ?? true});
  const shellServer = createServer({
    keepAlive: true
  });
  shellServer.on("connection", (socket) => {
    const id = randomUUID();
    connections.set(id, { socket, id });
    socket.write("tty\n");
    function checkReady() {
      readUntilLine(socket).then(buffer => {
        if (buffer.toString("utf8").includes("/dev/pts")) {
          spawn("tmux", ["split-window", `exec ${node} ${WRAPPER_PATH} ${IPC_SOCKET} ${id} TTY`]);
        } else if (buffer.toString("utf8").includes("not a tty")) {
          spawn("tmux", ["split-window", `exec ${node} ${WRAPPER_PATH} ${IPC_SOCKET} ${id} NOTTY`]);
        } else {
          checkReady();
        }
      });
    }
    checkReady();
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
        const id = socket.read(36).toString("utf8");
        const pair = connections.get(id);
        if (pair) {
          renderConnectionTable();
          pair.socket.pipe(socket);
          socket.pipe(pair.socket);
          socket.on("error", () => {
            socket.end();
            pair.socket.end();
          });
          pair.socket.on("end", () => {
            connections.delete(id);
            renderConnectionTable();
          });
          pair.socket.on("error", () => {
            socket.end();
            pair.socket.end();
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
    connectionTable.render(new Map(Array.from(connections.entries()).map(([id, connection]) => {
      return [id, connection.socket.remoteAddress];
    })));
  };

  shellServer.listen(shellPort, shellHost);
  ipcServer.listen("\0" + IPC_SOCKET);
  renderConnectionTable();
}

// Check if the file was imported or run directly.
if (require.main === module) {
  
  const {_: [shellHost, shellPort] , borderless}: CommandLineArguments = yargs(process.argv.slice(2))
    .option("borderless", {
      alias: "b",
      type: "boolean",
      description: "Romove borders on display"
    })
    .parseSync();

  catcher(String(shellHost), Number(shellPort), { borderless: !!borderless });
}