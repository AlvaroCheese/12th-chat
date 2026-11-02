import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CrowdReport } from "@twitch-graderia/shared";

const reportPath = fileURLToPath(new URL("../../../data/latest-report.json", import.meta.url));

export class ReportStore {
  latest: CrowdReport | null = null;

  async load(): Promise<void> {
    try {
      this.latest = JSON.parse(await readFile(reportPath, "utf8")) as CrowdReport;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.latest = null;
    }
  }

  async save(report: CrowdReport): Promise<void> {
    await mkdir(dirname(reportPath), { recursive: true });
    const temporaryPath = `${reportPath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(report, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, reportPath);
    this.latest = report;
  }
}
