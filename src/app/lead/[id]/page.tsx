import { DossierClient } from "@/components/dossier/dossier-client";
import { ToastProvider } from "@/components/ui/toast-provider";

export default async function LeadDossierPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const leadId = parseInt(id, 10);

    return (
        <ToastProvider>
            <DossierClient leadId={leadId} />
        </ToastProvider>
    );
}
