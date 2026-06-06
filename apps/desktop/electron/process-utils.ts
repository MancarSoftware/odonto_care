import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";

export type ProcessResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export function runProcess(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {},
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (exitCode) => {
      resolve({
        exitCode: exitCode ?? -1,
        stderr: stderr.trim(),
        stdout: stdout.trim(),
      });
    });
  });
}

export async function runRequiredProcess(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {},
) {
  const result = await runProcess(command, args, options);
  if (result.exitCode !== 0) {
    throw new Error(
      result.stderr ||
        result.stdout ||
        `${command} termino con codigo ${result.exitCode}`,
    );
  }

  return result;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
