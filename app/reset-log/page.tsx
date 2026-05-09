import type { Metadata } from "next";
import { getServerTranslator } from "@/lib/i18n";
import { ResetLogList } from "./ResetLogList";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  const title = t("meta.reset_log_title");
  const ogTitle = t("meta.reset_log_og_title");
  const description = t("meta.reset_log_description");
  return {
    title,
    description,
    alternates: { canonical: "/reset-log" },
    openGraph: {
      title: ogTitle,
      description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: ogTitle,
      description,
    },
  };
}

export default function ResetLogPage() {
  return <ResetLogList />;
}
