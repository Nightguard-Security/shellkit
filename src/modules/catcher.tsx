// TODO: Move to it's own repo?
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, Socket } from "node:net";
import * as url from 'node:url';
import React from 'react';
import { render, Box, Text, BoxProps } from 'ink';

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

type CatcherComponentHeader = {
  children: any
}

type CatcherComponentProps = {
  config: {
    shellHost: string
    shellPort: number
    ipcPort: number
  }
  connections: Map<string, string>
}

const CatcherComponentHeader = ({children}: CatcherComponentHeader) => {
  return (
    <Box
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
      borderRight={true}
      paddingX={2}
    >
      {children}
    </Box>
  )
}

const CatcherComponent = ({config, connections}: CatcherComponentProps) => {
  return (
    <Box flexDirection="column" borderStyle="single" width="100%">
      <Box
        borderStyle="single"
        borderTop={false}
        borderBottom={true}
        borderLeft={false}
        borderRight={false}
      >
        <CatcherComponentHeader>
          <Text>Connections: {connections.size}</Text>
        </CatcherComponentHeader>
        <CatcherComponentHeader>
          <Text>Listening on: {config.shellHost}:{config.shellPort}</Text>
        </CatcherComponentHeader>
        <CatcherComponentHeader>
          <Text>IPC on: {config.ipcPort}</Text>
        </CatcherComponentHeader>
      </Box>
      <Box
        borderStyle="single"
        borderTop={false}
        borderBottom={true}
        borderLeft={false}
        borderRight={false}
      >
        <Box width="42"><Text>ID:</Text></Box>
        <Box><Text>Remote Host:</Text></Box>
      </Box>
      {Array.from(connections.entries()).map(([uuid, remoteAddress]) => {
        return (
          <Box key={uuid}>
            <Box width="42"><Text>{uuid}</Text></Box>
            <Box><Text>{remoteAddress}</Text></Box>
          </Box>
        );
      })}
    </Box>
  );
};

export const catcher = (shellPort: number, shellHost: string, ipcPort: number) => {
  const MARKER = Buffer.from("NODE_REV");
  const idMap = new Map<string, Socket>();
  const node = process.argv[0];

  const connections = new Map();

  const {rerender} = render(
    <CatcherComponent
      config={{
        shellHost,
        shellPort,
        ipcPort
      }}
      connections={connections}
    />
  );

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
          idMap.delete(uuid);
          pair.pipe(socket);
          socket.pipe(pair);
          socket.on("error", () => {
            socket.end();
            pair.end();
          });
          pair.on("end", () => {
            connections.delete(uuid);
            rerender(
              <Box>
                <CatcherComponent
                  config={{
                    shellHost,
                    shellPort,
                    ipcPort
                  }}
                  connections={connections}
                />
              </Box>
            );
          });
          pair.on("error", () => {
            socket.end();
            pair.end();
          });
          rerender(
            <Box>
              <CatcherComponent
                config={{
                  shellHost,
                  shellPort,
                  ipcPort
                }}
                connections={connections}
              />
            </Box>
          );
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
}

// Check if the file was imported or run directly.
if (import.meta.url.startsWith('file:')) {
  const modulePath = url.fileURLToPath(import.meta.url);
  if (process.argv[1] === modulePath) {
    // Directly run from CLI.  Collect parameters and start catcher.
    const [shellPort, shellHost, ipcPort]= process.argv.slice(2,5)
    catcher(Number(shellPort), shellHost, Number(ipcPort));
  }
}
