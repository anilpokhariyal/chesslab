import type { Metadata } from "next";
import { OPENINGS } from "@/lib/openings";
import { meta, PassThrough, SITE } from "@/lib/seo";

export function generateStaticParams() {
  return OPENINGS.map((o) => ({ id: o.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const opening = OPENINGS.find((o) => o.id === id);
  if (!opening) return meta({ title: "Opening", description: "Unknown opening.", path: `/openings/${id}`, index: false });
  const next = meta({ title: opening.name, description: opening.blurb, path: `/openings/${id}` });
  return { ...next, title: { absolute: `${opening.name} · ${SITE.name}` } };
}

export default PassThrough;
