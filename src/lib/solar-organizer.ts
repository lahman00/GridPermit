export const SOLAR_ORGANIZER = {
  title: "Solar Project Organizer",
  priceCents: 900,
  currency: "USD",
  path: "/solar-project-organizer/",
  // Populate only after verifying the seller, USD price, uploaded ZIP and delivery settings.
  checkoutUrl: "https://whop.com/checkout/plan_40O1gcALdY9Hz/" as string | null,
} as const;

export function validatedOrganizerCheckout(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "whop.com" || url.port || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/checkout/plan_40O1gcALdY9Hz/") return null;
    return url.href;
  } catch {
    return null;
  }
}

export const organizerCheckout = validatedOrganizerCheckout(SOLAR_ORGANIZER.checkoutUrl);
