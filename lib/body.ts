export async function readLimitedBody(
  request: Request,
  limit: number,
): Promise<Buffer> {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new Error("Request too large");
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Request too large");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    reader.releaseLock();
  }
}
