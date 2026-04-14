import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { entityMetas } from "@/data";
import HomeClient from "@/components/HomeClient";

export function generateStaticParams() {
  return entityMetas.map((e) => ({ entityId: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entityId: string }>;
}): Promise<Metadata> {
  const { entityId } = await params;
  const entity = entityMetas.find((e) => e.id === entityId);
  if (!entity) return {};
  return {
    title: entity.name,
    description: entity.description,
    openGraph: {
      title: `${entity.name} · ReleaseLog`,
      description: entity.description,
    },
    twitter: {
      title: `${entity.name} · ReleaseLog`,
      description: entity.description,
    },
  };
}

export default async function EntityPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  const entity = entityMetas.find((e) => e.id === entityId);
  if (!entity) notFound();
  return <HomeClient initialEntityId={entityId} />;
}
