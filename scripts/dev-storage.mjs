import S3rver from "s3rver";
import { mkdir } from "node:fs/promises";
await mkdir("/tmp/ortho-test-storage", { recursive: true });
const server = new S3rver({
  port: 9000,
  address: "127.0.0.1",
  silent: true,
  directory: "/tmp/ortho-test-storage",
  configureBuckets: [{ name: "ortho-images" }],
});
await server.run();
console.log("Development-only S3 test service listening on port 9000");
