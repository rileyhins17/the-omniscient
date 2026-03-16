import HuntClient from "./HuntClient"
import { requireAdminSession } from "@/lib/session";

export default async function HuntPage() {
    await requireAdminSession();

    return <HuntClient />
}
