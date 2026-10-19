/**
 * Chaos helpers for testing: event-loop stall, SIGSTOP/SIGCONT, docker pause/unpause.
 * Event-loop hook is test-only, enabled only when PROFILE=demo or test harness sets it.
 */

import { spawn } from "node:child_process";

/**
 * Block the event loop for N milliseconds.
 * Test-only: must be enabled by PROFILE=demo or explicit hook setup.
 * Used for testing event-loop stall recovery (R11).
 */
export function blockEventLoop(ms: number): Promise<void> {
  if (process.env.PROFILE !== "demo" && !process.env.TEST_CHAOS_ENABLED) {
    throw new Error("Event-loop blocking is only allowed in PROFILE=demo or with TEST_CHAOS_ENABLED");
  }

  return new Promise((resolve) => {
    const start = Date.now();
    // Busy-wait on the event loop (blocks all async operations)
    while (Date.now() - start < ms) {
      // Tight loop, no yield
    }
    resolve();
  });
}

/**
 * Send SIGSTOP to a process (freeze).
 * Returns a function to send SIGCONT (resume).
 */
export async function freezeProcess(pid: number): Promise<() => void> {
  return new Promise((resolve, reject) => {
    process.kill(pid, "SIGSTOP");

    resolve(() => {
      process.kill(pid, "SIGCONT");
    });
  });
}

/**
 * Docker pause a container (by name or service name).
 * Returns a function to unpause.
 */
export async function pauseContainer(containerName: string): Promise<() => Promise<void>> {
  return new Promise((resolve, reject) => {
    const pause = spawn("docker-compose", ["pause", containerName]);

    let output = "";
    pause.stderr.on("data", (data) => {
      output += data.toString();
    });

    pause.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`docker-compose pause failed: ${output}`));
      } else {
        // Return unpause function
        resolve(async () => {
          return new Promise<void>((res, rej) => {
            const unpause = spawn("docker-compose", ["unpause", containerName]);
            let err = "";
            unpause.stderr.on("data", (data) => {
              err += data.toString();
            });
            unpause.on("close", (c) => {
              if (c !== 0) {
                rej(new Error(`docker-compose unpause failed: ${err}`));
              } else {
                res();
              }
            });
          });
        });
      }
    });
  });
}

/**
 * Wait for a process to exit.
 * Used to verify fail-stop behavior (process exits after fencing).
 */
export async function waitForProcessExit(pid: number, timeoutMs = 10000): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const checkInterval = setInterval(() => {
      try {
        process.kill(pid, 0); // Check if process exists
      } catch {
        // Process exited
        clearInterval(checkInterval);
        resolve(Date.now() - start);
      }

      if (Date.now() - start > timeoutMs) {
        clearInterval(checkInterval);
        reject(new Error(`Process ${pid} did not exit within ${timeoutMs}ms`));
      }
    }, 100);
  });
}

/**
 * Kill a process and wait for it to exit.
 */
export async function killProcess(pid: number, signal = "SIGTERM"): Promise<void> {
  process.kill(pid, signal);
  try {
    await waitForProcessExit(pid, 5000);
  } catch {
    // Already exited
  }
}
