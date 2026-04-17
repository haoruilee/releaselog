import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : "/subscribe";

  return (
    <div className="min-h-screen bg-page text-primary">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">ReleaseLog</p>
        <h1 className="mt-2 font-serif text-3xl text-primary sm:text-4xl">Sign in</h1>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          Use a magic link. No password, no extra account setup.
        </p>

        <div className="mt-8">
          <LoginForm nextPath={nextPath} />
        </div>

        <p className="mt-10 text-sm text-secondary">
          <Link href="/subscribe" className="text-accent underline-offset-4 hover:underline">
            ← Back to subscribe
          </Link>
        </p>
      </div>
    </div>
  );
}
