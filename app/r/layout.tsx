/**
 * Captains arrive here from a WhatsApp link on a phone, with no account and
 * no reason to go anywhere else, so there is no navigation: the page itself
 * draws the split between the tournament's photograph and the entry form.
 */
export default function RegistrationLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh">{children}</div>;
}
