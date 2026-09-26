export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const dest = `https://api.chess.com/pub/${path.join("/")}`;
  const res = await fetch(dest, {
    headers: { "User-Agent": "ChessLab/1.0 (local analysis tool)" },
    next: { revalidate: 60 },
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
