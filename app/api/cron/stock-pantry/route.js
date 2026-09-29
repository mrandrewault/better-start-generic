import { stockPantry } from "../../../../lib/pantry.js";

// THE BACKGROUND JOB. Vercel calls this every 30 minutes (see vercel.json).
// On meanwhile.now it only runs when Vercel's secret handshake is present, so
// nobody else can make it spend money. On Preview test sites (which are behind
// the Vercel login) it can be started by hand by opening this address.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  const authorized = isPreview || (secret && request.headers.get("authorization") === `Bearer ${secret}`);
  if (!authorized) return Response.json({ok: false, error: "Not allowed."}, {status: 401});
  try {
    const summary = await stockPantry();
    return Response.json({ok: true, ...summary});
  } catch (error) {
    return Response.json({ok: false, error: String(error?.message || error)}, {status: 500});
  }
}
