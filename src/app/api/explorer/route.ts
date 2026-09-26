export async function GET(req: Request) {
  const fen = new URL(req.url).searchParams.get("fen");
  if (!fen) return Response.json({ error: "fen required" }, { status: 400 });
  const dest = `https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(fen)}`;
  const res = await fetch(dest, { headers: { Accept: "application/json" } });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
