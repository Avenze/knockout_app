/* eslint-disable @next/next/no-img-element */

import type { MatchDocument, VoteTarget } from "@/lib/types";

interface MatchCardProps {
  match: MatchDocument;
  isInteractive: boolean;
  hasVoted: boolean;
  selectedVote?: VoteTarget;
  isSubmitting: boolean;
  lockedReason?: string;
  onVote: (target: VoteTarget) => void;
}

function getVoteWidth(votes: number, totalVotes: number): string {
  if (totalVotes === 0) {
    return "0%";
  }

  return `${Math.round((votes / totalVotes) * 100)}%`;
}

export function MatchCard({
  match,
  isInteractive,
  hasVoted,
  selectedVote,
  isSubmitting,
  lockedReason,
  onVote,
}: MatchCardProps) {
  const totalVotes = match.votesA + match.votesB;
  const leadingTarget =
    match.votesA === match.votesB ? null : match.votesA > match.votesB ? "A" : "B";

  const canVote = isInteractive && !hasVoted && !isSubmitting && !match.winner;

  const statusMessage = match.winner
    ? `Vinnare: ${match.winner}`
    : isSubmitting
      ? "Skickar rösten..."
      : hasVoted
        ? ""
        : isInteractive
          ? "Klicka på ett objekt för att rösta."
          : lockedReason ?? "Röstning är inte tillgänglig för denna match.";

  return (
    <article className="rounded-2xl border border-stone-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
      <header className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">Match {match.matchIndex + 1}</p>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
          {totalVotes} röster
        </p>
      </header>

      <div className="space-y-3">
        <button
          type="button"
          disabled={!canVote}
          onClick={() => onVote("A")}
          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
            leadingTarget === "A"
              ? "border-emerald-500 bg-emerald-50"
              : "border-stone-200 bg-stone-50"
          } ${
            selectedVote === "A" ? "ring-2 ring-teal-300" : ""
          } ${canVote ? "hover:-translate-y-0.5 hover:shadow-md" : "cursor-not-allowed opacity-85"}`}
        >
          <div className="flex items-center gap-3">
            {match.itemAImage ? (
              <img
                src={match.itemAImage}
                alt={match.itemA}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-700">
                {match.itemA.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold text-stone-900">{match.itemA}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: getVoteWidth(match.votesA, totalVotes) }}
                />
              </div>
            </div>
            <p className="text-lg font-bold text-stone-900">{match.votesA}</p>
          </div>
        </button>

        <button
          type="button"
          disabled={!canVote}
          onClick={() => onVote("B")}
          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
            leadingTarget === "B"
              ? "border-emerald-500 bg-emerald-50"
              : "border-stone-200 bg-stone-50"
          } ${
            selectedVote === "B" ? "ring-2 ring-teal-300" : ""
          } ${canVote ? "hover:-translate-y-0.5 hover:shadow-md" : "cursor-not-allowed opacity-85"}`}
        >
          <div className="flex items-center gap-3">
            {match.itemBImage ? (
              <img
                src={match.itemBImage}
                alt={match.itemB}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-700">
                {match.itemB.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold text-stone-900">{match.itemB}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: getVoteWidth(match.votesB, totalVotes) }}
                />
              </div>
            </div>
            <p className="text-lg font-bold text-stone-900">{match.votesB}</p>
          </div>
        </button>
      </div>

      <footer className="mt-3 border-t border-stone-200 pt-3 text-xs font-medium text-stone-600">
        {statusMessage}
      </footer>
    </article>
  );
}
