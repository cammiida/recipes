import { useState } from "react";
import { signIn } from "../lib/auth-client";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Innlogging feilet");
      setLoading(false);
    } else {
      window.location.href = "/admin";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-sm">
      <div className="ds-field" data-size="md">
        <label htmlFor="email" className="ds-label">
          E-post
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="ds-input"
          data-size="md"
        />
      </div>

      <div className="ds-field" data-size="md">
        <label htmlFor="password" className="ds-label">
          Passord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="ds-input"
          data-size="md"
        />
      </div>

      {error && (
        <div className="ds-alert" data-color="danger" data-size="sm">
          <p>{error}</p>
        </div>
      )}

      <button type="submit" className="ds-button" data-color="accent" data-size="md" disabled={loading}>
        {loading ? "Logger inn..." : "Logg inn"}
      </button>
    </form>
  );
}
