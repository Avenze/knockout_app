"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MatchCard } from "@/components/MatchCard";
import { getBrowserAppwriteClient, getRealtimeChannels } from "@/lib/appwrite";
import type {
  MatchDocument,
  TournamentSnapshot,
  TournamentStage,
  VoteTarget,
} from "@/lib/types";
import { STAGE_LABELS } from "@/lib/voting";

const VOTE_STORAGE_KEY = "knockout-votes-v1";
const ACTIVE_STAGES: Array<Extract<TournamentStage, "quarterfinal" | "semifinal" | "final">> =
  ["quarterfinal", "semifinal", "final"];

function readSavedVotes(): Record<string, VoteTarget> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(VOTE_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as Record<string, VoteTarget>;
  } catch {
    return {};
  }
}

function writeSavedVotes(votes: Record<string, VoteTarget>): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(votes));
}

function buildStageBuckets(matches: MatchDocument[]): Record<TournamentStage, MatchDocument[]> {
  const buckets: Record<TournamentStage, MatchDocument[]> = {
    quarterfinal: [],
    semifinal: [],
    final: [],
    completed: [],
  };

  for (const match of matches) {
    buckets[match.stage].push(match);
  }

  for (const stage of ACTIVE_STAGES) {
    buckets[stage].sort((left, right) => left.matchIndex - right.matchIndex);
  }

  return buckets;
}

export function BracketView() {
  const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null);
  const [savedVotes, setSavedVotes] = useState<Record<string, VoteTarget>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    const response = await fetch("/api/tournament", {
      cache: "no-store",
    });

    const data = (await response.json()) as TournamentSnapshot & { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Unable to fetch current tournament data.");
    }

    setSnapshot(data);
  }, []);

  useEffect(() => {
    setSavedVotes(readSavedVotes());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      setIsLoading(true);

      try {
        await fetchSnapshot();
        if (mounted) {
          setError(null);
        }
      } catch (loadError) {
        if (mounted) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Unexpected error while loading tournament.";
          setError(message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      mounted = false;
    };
  }, [fetchSnapshot]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    try {
      const appwriteClient = getBrowserAppwriteClient();
      unsubscribe = appwriteClient.subscribe(getRealtimeChannels(), () => {
        void fetchSnapshot();
      });
    } catch {
      // Realtime should not block rendering if Appwrite env vars are missing.
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchSnapshot]);

  const groupedMatches = useMemo(() => {
    if (!snapshot) {
      return buildStageBuckets([]);
    }

    return buildStageBuckets(snapshot.matches);
  }, [snapshot]);

  async function submitVote(match: MatchDocument, target: VoteTarget) {
    if (!snapshot) {
      return;
    }

    const alreadyVoted = Boolean(savedVotes[match.$id]);
    const isCurrentStage = snapshot.tournament.currentStage === match.stage;

    if (
      alreadyVoted ||
      !isCurrentStage ||
      !snapshot.tournament.isVotingOpen ||
      snapshot.tournament.currentStage === "completed"
    ) {
      return;
    }

    setError(null);
    setIsVoting(match.$id);

    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: match.$id,
          target,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Vote request failed.");
      }

      const nextVotes = {
        ...savedVotes,
        [match.$id]: target,
      };

      setSavedVotes(nextVotes);
      writeSavedVotes(nextVotes);
      await fetchSnapshot();
    } catch (voteError) {
      const message =
        voteError instanceof Error ? voteError.message : "Unable to submit vote.";
      setError(message);
    } finally {
      setIsVoting(null);
    }
  }

  const currentStageLabel = snapshot
    ? STAGE_LABELS[snapshot.tournament.currentStage]
    : STAGE_LABELS.quarterfinal;

  const champion = snapshot?.champion ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-8">
      <header className="relative mb-10 overflow-hidden rounded-3xl border border-stone-300 bg-white/80 p-6 shadow-lg backdrop-blur-sm sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />

        <p className="relative text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
          Vad ska vi hitta på?
        </p>
        <h1 className="relative mt-2 text-3xl font-black tracking-tight text-stone-900 sm:text-4xl">
          Utslagsröstning
        </h1>
      </header>

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {isLoading && !snapshot ? (
        <section className="rounded-2xl border border-stone-300 bg-white/90 p-6 text-sm text-stone-700 shadow-sm">
          Laddar status...
        </section>
      ) : null}

      {snapshot ? (
        <>
          {snapshot.tournament.currentStage === "completed" ? (
            <section className="mb-6 rounded-2xl border border-emerald-400 bg-emerald-50/80 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Vinnare
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-emerald-900">
                {champion ?? "Winner pending final lock"}
              </h2>
            </section>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-3">
            {ACTIVE_STAGES.map((stage) => {
              const stageMatches = groupedMatches[stage];
              const isCurrentStage = snapshot.tournament.currentStage === stage;
              const isStageVotingOpen =
                isCurrentStage &&
                snapshot.tournament.currentStage !== "completed" &&
                snapshot.tournament.isVotingOpen;

              const lockedReason = isCurrentStage
                ? "Röstningen har stängts."
                : "Denna runda låses upp efter föregående har avklarats.";

              return (
                <section
                  key={stage}
                  className={`rounded-3xl border p-4 shadow-sm backdrop-blur-sm sm:p-5 ${
                    isCurrentStage
                      ? "border-teal-400 bg-teal-50/65"
                      : "border-stone-300 bg-white/85"
                  }`}
                >
                  <header className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-black tracking-tight text-stone-900">
                      {STAGE_LABELS[stage]}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        isCurrentStage
                          ? "bg-teal-700 text-white"
                          : "bg-stone-200 text-stone-700"
                      }`}
                    >
                      {isCurrentStage ? "Pågående" : "Stoppad"}
                    </span>
                  </header>

                  {stageMatches.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-sm text-stone-600">
                      Inga matcher är tillgängliga för denna runda ännu.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {stageMatches.map((match) => {
                        return (
                          <MatchCard
                            key={match.$id}
                            match={match}
                            isInteractive={isStageVotingOpen}
                            hasVoted={Boolean(savedVotes[match.$id])}
                            selectedVote={savedVotes[match.$id]}
                            isSubmitting={isVoting === match.$id}
                            lockedReason={lockedReason}
                            onVote={(target) => {
                              void submitVote(match, target);
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
