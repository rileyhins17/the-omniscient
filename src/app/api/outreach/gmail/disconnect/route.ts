import { NextResponse } from "next/server";

import { decryptToken, revokeToken } from "@/lib/gmail";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/session";

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      mailboxId?: string;
      connectionId?: string;
    };
    const prisma = getPrisma();
    let connection = body.connectionId
      ? await prisma.gmailConnection.findUnique({ where: { id: body.connectionId } })
      : null;
    let mailbox = body.mailboxId
      ? await prisma.outreachMailbox.findUnique({ where: { id: body.mailboxId } })
      : null;

    if (!connection && mailbox?.gmailConnectionId) {
      connection = await prisma.gmailConnection.findUnique({
        where: { id: mailbox.gmailConnectionId },
      });
    }

    if (!connection) {
      connection = await prisma.gmailConnection.findFirst({
        where: { userId: authResult.session.user.id },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!mailbox && connection) {
      mailbox = await prisma.outreachMailbox.findFirst({
        where: { gmailConnectionId: connection.id },
      });
    }

    if (!connection) {
      return NextResponse.json({ error: "No Gmail connection found" }, { status: 404 });
    }

    // Best-effort revoke tokens with Google
    try {
      const refreshToken = await decryptToken(connection.refreshToken);
      await revokeToken(refreshToken);
    } catch {
      // Revocation is best-effort
    }

    if (mailbox) {
      await prisma.outreachMailbox.update({
        where: { id: mailbox.id },
        data: {
          status: "DISABLED",
          gmailConnectionId: null,
        },
      });
    }

    await prisma.gmailConnection.delete({
      where: { id: connection.id },
    });

    return NextResponse.json({ disconnected: true });
  } catch (error: any) {
    console.error("Gmail disconnect error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disconnect Gmail" },
      { status: 500 },
    );
  }
}
