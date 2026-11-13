import { getAuth } from "@/lib/auth";

// getAuth() dipanggil saat permintaan, bukan di tingkat modul, agar build tidak butuh env.
export const GET = (request: Request) => getAuth().handler(request);
export const POST = GET;
