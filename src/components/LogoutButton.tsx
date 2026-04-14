import { signOut } from "../lib/auth-client";

export default function LogoutButton() {
  async function handleLogout() {
    await signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="ds-button"
      data-color="neutral"
      data-size="sm"
    >
      Logg ut
    </button>
  );
}
