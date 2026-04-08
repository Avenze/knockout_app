"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { Models } from "appwrite";

import { getBrowserAccount } from "@/lib/appwrite";
import type { MatchDocument, TournamentSnapshot, TournamentStage } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/voting";

const STAGE_SORT_ORDER: TournamentStage[] = [
  "quarterfinal",
  "semifinal",
  "final",
  "completed",
];

function sortMatches(matches: MatchDocument[]): MatchDocument[] {
  const rank = Object.fromEntries(STAGE_SORT_ORDER.map((stage, index) => [stage, index]));

  return [...matches].sort((left, right) => {
    const stageOrder = rank[left.stage] - rank[right.stage];

    if (stageOrder !== 0) {
      return stageOrder;
    }

    return left.matchIndex - right.matchIndex;
  });
}

export default function AdminPage() {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const fetchSnapshot = useCallback(async () => {
    const response = await fetch("/api/tournament", {
      cache: "no-store",
    });

    const data = (await response.json()) as TournamentSnapshot & { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Unable to load tournament data.");
    }

    setSnapshot(data);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadCurrentSession() {
      try {
        const currentUser = await getBrowserAccount().get();

        if (mounted) {
          setUser(currentUser);
          await fetchSnapshot();
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    void loadCurrentSession();

    return () => {
      mounted = false;
    };
  }, [fetchSnapshot]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setIsLoggingIn(true);

    try {
      await getBrowserAccount().createEmailPasswordSession(email, password);
      const currentUser = await getBrowserAccount().get();

      setUser(currentUser);
      await fetchSnapshot();
      setStatusMessage("Signed in. Admin controls are now available.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign in with those credentials.";
      setErrorMessage(message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await getBrowserAccount().deleteSession("current");
    } catch {
      // If the session is already missing, continue and clear client state.
    }

    setUser(null);
    setSnapshot(null);
  }

  async function handleAdvanceStage() {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsAdvancing(true);

    try {
      const jwt = await getBrowserAccount().createJWT();
      const response = await fetch("/api/admin/advance", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt.jwt}`,
        },
      });

      const payload = (await response.json()) as TournamentSnapshot & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to advance tournament stage.");
      }

      setSnapshot(payload);
      setStatusMessage("Stage advanced successfully.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to advance tournament stage.";
      setErrorMessage(message);
    } finally {
      setIsAdvancing(false);
    }
  }

  const sortedMatches = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return sortMatches(snapshot.matches);
  }, [snapshot]);

  if (isCheckingAuth) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10">
        <p className="text-sm font-medium text-stone-700">Checking admin session...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10">
        <section className="w-full rounded-3xl border border-stone-300 bg-white/90 p-6 shadow-lg backdrop-blur-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">
            Protected Admin Route
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-900">
            Tournament Control Panel
          </h1>
          <p className="mt-3 text-sm text-stone-700">
            Sign in using your Appwrite email/password credentials to manage bracket
            progression.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label
                className="mb-1 block text-sm font-semibold text-stone-700"
                htmlFor="password"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200"
              />
            </div>

            {errorMessage ? (
              <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingIn ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="rounded-3xl border border-stone-300 bg-white/90 p-6 shadow-md backdrop-blur-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">Admin</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-900">
              Tournament Dashboard
            </h1>
            <p className="mt-2 text-sm text-stone-700">
              Signed in as <span className="font-semibold text-stone-900">{user.email}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
          >
            Sign Out
          </button>
        </div>

        {statusMessage ? (
          <p className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {statusMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAdvanceStage}
            disabled={isAdvancing || !snapshot || snapshot.tournament.currentStage === "completed"}
            className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAdvancing ? "Advancing..." : "Advance Stage"}
          </button>

          <button
            type="button"
            onClick={() => {
              void fetchSnapshot();
            }}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
          >
            Refresh
          </button>

          {snapshot ? (
            <p className="text-sm text-stone-700">
              Current stage:{" "}
              <span className="font-semibold text-stone-900">
                {STAGE_LABELS[snapshot.tournament.currentStage]}
              </span>
              {" · "}
              Voting {snapshot.tournament.isVotingOpen ? "Open" : "Closed"}
            </p>
          ) : null}
        </div>
      </header>

      <section className="mt-6 rounded-3xl border border-stone-300 bg-white/90 p-6 shadow-md backdrop-blur-sm">
        <h2 className="text-xl font-black tracking-tight text-stone-900">Matches & Votes</h2>

        {!snapshot ? (
          <p className="mt-4 text-sm text-stone-700">Loading tournament data...</p>
        ) : sortedMatches.length === 0 ? (
          <p className="mt-4 text-sm text-stone-700">No matches found in the database.</p>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-left text-stone-700">
                  <th className="px-2 py-2 font-semibold">Stage</th>
                  <th className="px-2 py-2 font-semibold">Match</th>
                  <th className="px-2 py-2 font-semibold">Item A</th>
                  <th className="px-2 py-2 font-semibold">Votes A</th>
                  <th className="px-2 py-2 font-semibold">Item B</th>
                  <th className="px-2 py-2 font-semibold">Votes B</th>
                  <th className="px-2 py-2 font-semibold">Winner</th>
                </tr>
              </thead>
              <tbody>
                {sortedMatches.map((match) => (
                  <tr key={match.$id} className="border-b border-stone-200 text-stone-800">
                    <td className="px-2 py-2">{STAGE_LABELS[match.stage]}</td>
                    <td className="px-2 py-2">#{match.matchIndex + 1}</td>
                    <td className="px-2 py-2">{match.itemA}</td>
                    <td className="px-2 py-2 font-semibold">{match.votesA}</td>
                    <td className="px-2 py-2">{match.itemB}</td>
                    <td className="px-2 py-2 font-semibold">{match.votesB}</td>
                    <td className="px-2 py-2 font-semibold text-teal-700">
                      {match.winner ?? "Pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
