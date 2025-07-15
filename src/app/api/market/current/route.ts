import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  if (!ticker) {
    return new Response(JSON.stringify({ error: "ticker param required" }), { status: 400 });
  }

  const feedUrl = process.env.PROFIT_FEED_URL + `/current/${ticker.toUpperCase()}`;
  try {
    const resp = await fetch(feedUrl);
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "fetch_failed" }), { status: 500 });
  }
} 