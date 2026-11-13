"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

// Cookie sesi dibersihkan plugin nextCookies pada respons signOut.
export async function keluar() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/");
}
