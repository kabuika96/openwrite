import { spawn } from "node:child_process";

export function getRevealCommand(targetPath, platform = process.platform) {
  if (platform === "darwin") {
    return { command: "open", args: ["-R", targetPath] };
  }

  if (platform === "win32") {
    return { command: "explorer", args: [`/select,${targetPath}`] };
  }

  return { command: "xdg-open", args: [targetPath] };
}

export function revealPathInSystem(targetPath) {
  const { command, args } = getRevealCommand(targetPath);
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });

  child.unref();
}
