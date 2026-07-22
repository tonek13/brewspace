import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Under the Bun runtime this uses Bun's built-in argon2id hasher, per the
 * platform requirements. Vitest executes its workers under Node, where
 * `Bun.password` does not exist, so a scrypt-based implementation covers that
 * path. Hashes are self-describing ($argon2id$… vs $scrypt$…) so either
 * runtime verifies its own output; production traffic only ever sees argon2id.
 */
const hasBunPassword = typeof globalThis.Bun !== "undefined" && !!globalThis.Bun?.password;

const SCRYPT_KEYLEN = 64;

function scryptHash(plainText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16);
    scrypt(plainText, salt, SCRYPT_KEYLEN, (error, derived) => {
      if (error) return reject(error);
      resolve(`$scrypt$${salt.toString("hex")}$${derived.toString("hex")}`);
    });
  });
}

function scryptVerify(plainText: string, hash: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = hash.split("$");
    const saltHex = parts[2];
    const digestHex = parts[3];
    if (!saltHex || !digestHex) return resolve(false);
    scrypt(plainText, Buffer.from(saltHex, "hex"), SCRYPT_KEYLEN, (error, derived) => {
      if (error) return resolve(false);
      const expected = Buffer.from(digestHex, "hex");
      resolve(expected.length === derived.length && timingSafeEqual(expected, derived));
    });
  });
}

export const PasswordService = {
  async hash(plainText: string): Promise<string> {
    if (hasBunPassword) {
      return Bun.password.hash(plainText, { algorithm: "argon2id", memoryCost: 19456, timeCost: 2 });
    }
    return scryptHash(plainText);
  },

  async verify(plainText: string, hash: string): Promise<boolean> {
    try {
      if (hash.startsWith("$scrypt$")) return await scryptVerify(plainText, hash);
      if (hasBunPassword) return await Bun.password.verify(plainText, hash);
      return false;
    } catch {
      return false;
    }
  },
};
