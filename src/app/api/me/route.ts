import { getSessionUser } from "@/app/auth-actions";
import { loadUserProfile, saveUserProfile } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in." }, { status: 401 });
  return Response.json(await loadUserProfile(user.id));
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in." }, { status: 401 });
  const text = await req.text();
  if (text.length > 1_000_000) return Response.json({ error: "Profile too large." }, { status: 413 });
  try {
    return Response.json(await saveUserProfile(user.id, JSON.parse(text) as unknown));
  } catch {
    return Response.json({ error: "Bad profile." }, { status: 400 });
  }
}
