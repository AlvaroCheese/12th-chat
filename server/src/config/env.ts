import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));
dotenv.config({ path: rootEnvPath });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TWITCH_CLIENT_ID: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  TWITCH_CLIENT_SECRET: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  TWITCH_REDIRECT_URI: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().url().default("http://localhost:3000/auth/twitch/callback"),
  ),
  OPENAI_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  OPENAI_MODEL: z.preprocess((value) => value === "" ? undefined : value, z.string().default("gpt-4.1-mini")),
  REPORT_LANGUAGE: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^[a-zA-Z-]{2,20}$/).default("es")),
  REPORT_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(15_000),
  MOCK_MATCH_DURATION_MINUTES: z.coerce.number().int().positive().max(1_440).default(3),
  MOCK_CHAT: z.enum(["0", "1"]).default("0"),
  DEMO_CROWD: z.enum(["0", "1"]).default("0"),
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

if (env.NODE_ENV === "production" && !env.CONTROL_TOKEN) {
  throw new Error("Invalid environment configuration: CONTROL_TOKEN is required when NODE_ENV=production");
}
