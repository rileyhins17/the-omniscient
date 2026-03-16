import DashboardClient from "./DashboardClient"
import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
    await requireSession();

    return <DashboardClient />
}
