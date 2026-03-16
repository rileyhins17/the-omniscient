import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

function createHandlers() {
  return toNextJsHandler(getAuth());
}

export async function GET(request: Request) {
  return createHandlers().GET(request);
}

export async function POST(request: Request) {
  return createHandlers().POST(request);
}

export async function PATCH(request: Request) {
  return createHandlers().PATCH(request);
}

export async function PUT(request: Request) {
  return createHandlers().PUT(request);
}

export async function DELETE(request: Request) {
  return createHandlers().DELETE(request);
}
