import { startAnalyticsRetention } from "./analytics-retention.mjs";
import { spawn } from "node:child_process";
import { productionSetup } from "./production-setup.mjs";
try {
  await productionSetup();
  const stopRetention = startAnalyticsRetention();
  // Setup credentials must not be inherited by the web application.
  const runtimeEnv = { ...process.env, NODE_ENV: "production" };
  for (const name of [
    "ADMIN_PASSWORD",
    "ADMIN_EMAIL",
    "INITIALIZE_ADMIN",
    "INITIALIZE_CATALOGUE",
  ])
    delete runtimeEnv[name];
  const port = process.env.PORT || "3000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error("Invalid server port.");
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "0.0.0.0",
      "-p",
      port,
    ],
    { stdio: "inherit", env: runtimeEnv },
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => server.kill(signal));
  server.on("error", () => {
    stopRetention();
    console.error("Application startup failed.");
    process.exitCode = 1;
  });
  server.on("exit", (code, signal) => {
    stopRetention();
    process.exitCode = code ?? (signal ? 1 : 0);
  });
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Deployment setup failed.",
  );
  process.exitCode = 1;
}
