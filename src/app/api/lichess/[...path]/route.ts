export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const src = new URL(req.url);
  const dest = `https://lichess.org/api/${path.join("/")}${src.search}`;
  const accept = req.headers.get("accept") ?? "application/json";
  const res = await fetch(dest, {
    headers: { Accept: accept, "User-Agent": "ChessLab/1.0" },
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
