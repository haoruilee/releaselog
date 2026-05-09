import type { Metadata } from "next";
import { ResetLogList } from "./ResetLogList";

const TITLE = "Reset Log — Codex & Claude Code quota events";
const DESCRIPTION =
  "A dated log of every public rate-limit, quota, and usage-window change to the two subscription-based code agents — Anthropic's Claude Code and OpenAI's Codex — with a link to the official record for each event.";

export const metadata: Metadata = {
  title: "Reset Log",
  description: DESCRIPTION,
  alternates: { canonical: "/reset-log" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function ResetLogPage() {
  return <ResetLogList />;
}
