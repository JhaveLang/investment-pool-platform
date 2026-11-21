import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt is memory-hard and built into Node, so no native add-on is needed in Docker.
const HASH_ALGORITHM = "scrypt";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const DEFAULT_OPTIONS = { cost: 2 ** 15, blockSize: 8, parallelization: 1 } as const;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: MAX_MEMORY_BYTES }, (error, derivedKey) =>
      error ? reject(error) : resolve(derivedKey),
    );
  });
}

/** Returns a self-describing hash: `scrypt$cost$blockSize$parallelization$salt$key`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(password, salt, DEFAULT_OPTIONS);
  const { cost, blockSize, parallelization } = DEFAULT_OPTIONS;
  return [HASH_ALGORITHM, cost, blockSize, parallelization, salt.toString("base64"), derivedKey.toString("base64")].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, saltBase64, keyBase64] = storedHash.split("$");
  if (algorithm !== HASH_ALGORITHM || !saltBase64 || !keyBase64) {
    return false;
  }

  const expectedKey = Buffer.from(keyBase64, "base64");
  const derivedKey = await deriveKey(password, Buffer.from(saltBase64, "base64"), {
    cost: Number(cost),
    blockSize: Number(blockSize),
    parallelization: Number(parallelization),
  });
  return derivedKey.length === expectedKey.length && timingSafeEqual(derivedKey, expectedKey);
}

let dummyHashPromise: Promise<string> | undefined;

/**
 * A valid hash of a random password. Verifying against it when a user doesn't exist
 * keeps login timing identical, so response times don't reveal registered emails.
 */
export function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(32).toString("hex"));
  return dummyHashPromise;
}
