import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AccessToken } from "@twurple/auth";
import { z } from "zod";

export interface StoredTwitchTokens {
  userId: string;
  token: AccessToken;
}

export interface TokenStore {
  load(): Promise<StoredTwitchTokens | null>;
  save(tokens: StoredTwitchTokens): Promise<void>;
}

const tokenSchema = z.object({
  userId: z.string(),
  token: z.object({
    accessToken: z.string(),
    refreshToken: z.string().nullable(),
    expiresIn: z.number().nullable(),
    obtainmentTimestamp: z.number(),
    scope: z.array(z.string()),
  }),
});

const tokenFile = fileURLToPath(new URL("../../../data/twitch-tokens.json", import.meta.url));

export class FileTokenStore implements TokenStore {
  async load(): Promise<StoredTwitchTokens | null> {
    try {
      const contents = await readFile(tokenFile, "utf8");
      return tokenSchema.parse(JSON.parse(contents));
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw new Error("Unable to read the saved Twitch token file");
    }
  }

  async save(tokens: StoredTwitchTokens): Promise<void> {
    try {
      await mkdir(dirname(tokenFile), { recursive: true });
      await writeFile(tokenFile, JSON.stringify(tokens, null, 2), { encoding: "utf8", mode: 0o600 });
    } catch {
      throw new Error("Unable to save Twitch tokens locally");
    }
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
