import { catcher } from "./catcher";

if (process.env.TMUX === undefined) {
  console.error("Need to be runnning in TMUX");
  process.exit(1);
}

const shellPort = Number(process.argv[2] ?? "4242");
const shellHost = process.argv[3] ?? "127.0.0.1";
const ipcPort = Number(process.argv[4] ?? "2424");

catcher(shellPort, shellHost, ipcPort);