"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/modules/auth";

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
