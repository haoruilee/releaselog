import Link from "next/link";
import type { EntityMeta } from "@/data/types";

type Props = {
  entity: EntityMeta;
  daySpan: number;
  posterMode: boolean;
};

export function Header({ entity, daySpan, posterMode }: Props) {
  const headline =
    entity.headline?.replace("{name}", entity.name).replace("{days}", String(daySpan)) ??
    `Everything ${entity.name} shipped in ${daySpan} days.`;

  const parts = headline.split(entity.name);
  const hasSplit = parts.length > 1;

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
            aria-hidden
          >
            ✦
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">
            ReleaseLog
          </span>
        </div>
        {!posterMode && (
          <Link
            href="/subscribe"
            className="text-xs font-medium text-accent underline-offset-4 hover:underline"
          >
            Subscribe
          </Link>
        )}
      </div>

      <h1 className="max-w-4xl font-serif text-4xl leading-tight text-primary sm:text-5xl md:text-6xl">
        {hasSplit ? (
          <>
            {parts[0]}
            <span className="text-accent">{entity.name}</span>
            {parts.slice(1).join(entity.name)}
          </>
        ) : (
          headline
        )}
      </h1>

      {(entity.subtitle || entity.description) && (
        <p className="max-w-2xl text-base text-secondary sm:text-lg">
          {entity.subtitle ?? entity.description}
        </p>
      )}

      {entity.members && entity.members.length > 0 && !posterMode && (
        <div className="flex flex-wrap gap-4 pt-2">
          {entity.members.map((m) => (
            <div key={m.name + (m.handle ?? "")} className="flex items-center gap-2">
              {m.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(process.env.NEXT_PUBLIC_BASE_PATH ?? "") + m.avatar}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-empty-cell text-xs text-secondary ring-1 ring-white/10">
                  {m.name.slice(0, 1)}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-primary">{m.name}</p>
                {m.handle && (
                  <p className="text-xs text-secondary">{m.handle}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
