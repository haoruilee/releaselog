export function isServerDataEnabled(): boolean {
  return process.env.STATIC_EXPORT !== "1" && process.env.NEXT_PUBLIC_USE_SERVER_DATA !== "0";
}

export function isAdminEmail(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

export function isSubscriptionActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}
