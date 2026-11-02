"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { confirmEmailRepermission, declineEmailRepermission } from "@/modules/email-marketing";

async function requestMetadata() {
  const requestHeaders = await headers();
  return {
    responseIp: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip"),
    responseUserAgent: requestHeaders.get("user-agent"),
  };
}

export async function confirmRepermissionAction(token: string): Promise<never> {
  await confirmEmailRepermission({ token, ...(await requestMetadata()) });
  redirect(`/email-marketing/re-permission/${encodeURIComponent(token)}?result=confirmed`);
}

export async function declineRepermissionAction(token: string): Promise<never> {
  await declineEmailRepermission({ token, ...(await requestMetadata()) });
  redirect(`/email-marketing/re-permission/${encodeURIComponent(token)}?result=declined`);
}
