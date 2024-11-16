import { terminal } from "terminal-kit";
import { padContents } from "./utils";

type ConnectionTableConfig = {
  shellHost: string
  shellPort: number
  ipcPort: number
};

export class ConnectionTable {

  config: ConnectionTableConfig;
  clear = terminal.clear;

  constructor(config: ConnectionTableConfig) {
    this.config = config;
  };

  render(connections: Map<string, string | undefined>) {
    const padding = 36;

    terminal.table([
      [
        padContents(padding,`Connections: ${connections.size}`),
        `Listening on: ${this.config.shellHost}:${this.config.shellPort}`
      ],
      ...Array.from(connections.entries()).map(
        ([uuid, remoteAddress]) => [padContents(padding,uuid), remoteAddress ?? ""]
      )
    ], {
      hasBorder: true,
      fit: true
    });
  };
}
