"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const usernameError =
    username.length > 0 && !USERNAME_REGEX.test(username)
      ? "3-20 characters, letters, numbers, and underscores only"
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!USERNAME_REGEX.test(username)) {
      setError("Username must be 3-20 characters: letters, numbers, and underscores only.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // If email confirmation is required, show a message.
      // Otherwise redirect to home.
      setMessage(
        "Account created. Check your email to confirm your account."
      );
      router.push("/");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-surface-900">Create account</h1>
        <p className="text-surface-500 mt-2">
          Join the Lobby Market
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-surface-600 mb-1.5"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-surface-300 bg-surface-200 px-4 py-2.5 text-surface-900 placeholder-surface-500 focus:border-for-500 focus:outline-none focus:ring-1 focus:ring-for-500 transition-colors"
            placeholder="cool_username"
          />
          {usernameError && (
            <p className="mt-1 text-xs text-against-400">{usernameError}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-surface-600 mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-surface-300 bg-surface-200 px-4 py-2.5 text-surface-900 placeholder-surface-500 focus:border-for-500 focus:outline-none focus:ring-1 focus:ring-for-500 transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-surface-600 mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-surface-300 bg-surface-200 px-4 py-2.5 text-surface-900 placeholder-surface-500 focus:border-for-500 focus:outline-none focus:ring-1 focus:ring-for-500 transition-colors"
            placeholder="At least 6 characters"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-against-950 border border-against-800 px-4 py-3 text-sm text-against-400">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg bg-emerald/10 border border-emerald/30 px-4 py-3 text-sm text-emerald">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !!usernameError}
          className="w-full rounded-lg bg-for-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-for-600 focus:outline-none focus:ring-2 focus:ring-for-500 focus:ring-offset-2 focus:ring-offset-surface-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-surface-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-for-400 hover:text-for-300 transition-colors"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
