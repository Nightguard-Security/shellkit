import { catcher } from "./modules/catcher";

if (process.env.TMUX === undefined) {
  console.error("Need to be runnning in TMUX");
  process.exit(1);
}

const shellHost = process.argv[3] ?? "0.0.0.0";
const shellPort = Number(process.argv[2] ?? "4242");

catcher(shellHost, shellPort, {borderless: false});
