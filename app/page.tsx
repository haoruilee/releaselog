import HomeClient from "@/components/HomeClient";
import type { Metadata } from "next";
import { entityMetas } from "@/data";

// Root page renders the first entity by default.
// Each entity also has its own canonical URL at /{entityId}.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function RootPage() {
  const first = entityMetas[0];
  return <HomeClient initialEntityId={first?.id} />;
}
