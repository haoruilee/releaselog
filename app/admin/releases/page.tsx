import { redirect } from "next/navigation";
import { getEntityById } from "@/data";
import { getCurrentUser } from "@/lib/auth";
import { listRecentPublishedReleases } from "@/lib/releases-store";
import { isAdminEmail } from "@/lib/runtime-config";

export default async function AdminReleasesPage() {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login?next=/admin/releases");
  }
  if (!isAdminEmail(current.user.email)) {
    redirect("/subscribe");
  }

  const releases = await listRecentPublishedReleases(100);

  return (
    <div className="min-h-screen bg-page text-primary">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-3xl">Published releases</h1>
        <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-white/5">
          <table className="min-w-full divide-y divide-white/5 text-left text-sm">
            <thead className="bg-panel/70 text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Title</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-panel/30">
              {releases.map((release) => (
                <tr key={release.id}>
                  <td className="px-4 py-3">{release.item.date}</td>
                  <td className="px-4 py-3">{getEntityById(release.entityId)?.name ?? release.entityId}</td>
                  <td className="px-4 py-3">
                    {release.item.sourceUrl ? (
                      <a href={release.item.sourceUrl} className="text-accent underline-offset-4 hover:underline">
                        {release.item.title}
                      </a>
                    ) : (
                      release.item.title
                    )}
                  </td>
                </tr>
              ))}
              {releases.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-secondary">
                    No published releases yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
