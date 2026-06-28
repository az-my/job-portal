"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function getJobs() {
  return getDb().jobs;
}

export async function scrapeAllAction(maxPages: number = 5) {
  try {
    const cmd = `npx tsx index.ts ${maxPages}`;
    const { stdout } = await execAsync(cmd, { cwd: path.join(process.cwd(), "scraper") });
    const lines = stdout.split("\n").filter((l: string) => l.includes("Done:"));
    const total = lines.reduce((sum: number, l: string) => {
      const m = l.match(/Done: (\d+) jobs found/);
      return sum + (m ? parseInt(m[1], 10) : 0);
    }, 0);
    revalidatePath("/");
    return { success: true, count: total, details: lines };
  } catch (err: any) {
    console.error("Scraper execution failed:", err);
    return { success: false, error: err.message || "Failed to execute scraper." };
  }
}
