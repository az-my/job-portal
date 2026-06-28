import { getDb } from "@/lib/db";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = getDb();

  return <Dashboard initialJobs={db.jobs} />;
}
