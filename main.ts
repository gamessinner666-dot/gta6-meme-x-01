import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface PostPayload {
  url: string;
}

const MAX_POST_FILE_BYTES = 16384;
const X_STATUS_PATTERN =
  /^https:\/\/(?:(?:www|mobile)\.)?(?:x\.com|twitter\.com)\/(?:i\/web|[A-Za-z0-9_]+)\/status\/\d+(?:[?#].*)?$/;

function resolvePaths(): { inputFile: string; outputDir: string; outputFile: string } {
  const botRoot = process.env.MAKEFUN_BOT_DIR ?? '/bot';
  const outRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  return {
    inputFile: resolve(botRoot, 'POST.json'),
    outputDir: resolve(outRoot),
    outputFile: resolve(outRoot, 'POST.json'),
  };
}

function loadAndValidatePost(filePath: string): PostPayload {
  const raw = readFileSync(filePath, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('POST.json must contain a JSON object');
  }

  const candidate = (parsed as Record<string, unknown>).url;
  if (typeof candidate !== 'string' || !X_STATUS_PATTERN.test(candidate)) {
    throw new Error(`Invalid X post URL in POST.json: ${String(candidate)}`);
  }

  return { url: candidate };
}

function ensureReadable(targetPath: string, mode: number): void {
  try {
    chmodSync(targetPath, mode);
  } catch {
    // Ignore permission mode adjustments on filesystems that do not support POSIX bits.
  }
}

function run(): void {
  const { inputFile, outputDir, outputFile } = resolvePaths();
  const payload = loadAndValidatePost(inputFile);
  const serialized = `${JSON.stringify(payload)}\n`;

  if (Buffer.byteLength(serialized, 'utf8') > MAX_POST_FILE_BYTES) {
    throw new Error(`Serialized POST.json exceeds ${MAX_POST_FILE_BYTES} bytes`);
  }

  mkdirSync(outputDir, { recursive: true, mode: 0o755 });
  ensureReadable(outputDir, 0o755);
  writeFileSync(outputFile, serialized, { encoding: 'utf8', mode: 0o644 });
  ensureReadable(outputFile, 0o644);
}

run();
