import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";

/**
 * A form rather than an onClick handler: logging out is a state change, so it
 * belongs on a POST. It also means this works with JavaScript disabled.
 */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="border-paper/30 bg-transparent font-heading tracking-[0.08em] text-paper uppercase hover:bg-paper hover:text-ink"
      >
        Log out
      </Button>
    </form>
  );
}
