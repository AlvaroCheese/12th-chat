import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));
dotenv.config({ path: rootEnvPath });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  TWITCH_CLIENT_ID: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  TWITCH_CLIENT_SECRET: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  TWITCH_REDIRECT_URI: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().url().default("http://localhost:3000/auth/twitch/callback"),
  ),
  OPENAI_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  MOCK_CHAT: z.enum(["0", "1"]).default("0"),
  CONTROL_TOKEN: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;
