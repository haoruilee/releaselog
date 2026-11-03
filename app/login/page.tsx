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
    <div className="min-h-[calc(100dvh-170px)] bg-page text-primary">
      <div className="mx-auto max-w-xl px-6 pb-20 pt-16 sm:pt-24">

        <h1 className="editorial-title text-center text-5xl text-primary sm:text-6xl">Sign in</h1>
        <p className="mx-auto mt-5 max-w-md text-center text-sm leading-relaxed text-secondary">
          Use a magic link. No password, no extra account setup.
        </p>

        <div className="mt-8">
          <LoginForm nextPath={nextPath} />
        </div>

        <p className="mt-8 text-center text-sm text-secondary">
          <Link href="/subscribe" className="text-accent underline-offset-4 hover:underline">
            ← Back to subscribe
          </Link>
        </p>
      </div>
    </div>
  );
}
