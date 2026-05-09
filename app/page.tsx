import type { Metadata } from "next";
import HomeClient from "@/components/HomeClient";
import { entityMetas } from "@/data";

const HOME_ENTITY_ID = "anthropic-team";

const homeEntity =
  entityMetas.find((e) => e.id === HOME_ENTITY_ID) ?? entityMetas[0];

export const metadata: Metadata = {
  title: homeEntity?.name ?? "ReleaseLog",
  description: homeEntity?.description,
  alternates: { canonical: `/${homeEntity?.id ?? ""}` },
  openGraph: homeEntity
    ? {
        title: `${homeEntity.name} · ReleaseLog`,
        description: homeEntity.description,
      }
    : undefined,
  twitter: homeEntity
    ? {
        title: `${homeEntity.name} · ReleaseLog`,
        description: homeEntity.description,
      }
    : undefined,
};

export default function RootPage() {
  return <HomeClient initialEntityId={homeEntity?.id} />;
}
