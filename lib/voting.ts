import type {
  ActiveTournamentStage,
  MatchDocument,
  NewMatch,
  TournamentStage,
} from "@/lib/types";

export const STAGE_LABELS: Record<TournamentStage, string> = {
  quarterfinal: "Kvartsfinaler",
  semifinal: "Semifinaler",
  final: "Finaler",
  completed: "Avslutad",
};

export const STAGE_FLOW: Record<ActiveTournamentStage, TournamentStage> = {
  quarterfinal: "semifinal",
  semifinal: "final",
  final: "completed",
};

export function getNextStage(currentStage: ActiveTournamentStage): TournamentStage {
  return STAGE_FLOW[currentStage];
}

function breakTie(itemA: string, itemB: string): string {
  const compare = itemA.localeCompare(itemB, undefined, {
    sensitivity: "base",
    numeric: true,
  });

  if (compare <= 0) {
    return itemA;
  }

  return itemB;
}

export function getWinners(matches: MatchDocument[]): string[] {
  return [...matches]
    .sort((left, right) => left.matchIndex - right.matchIndex)
    .map((match) => {
      if (match.votesA > match.votesB) {
        return match.itemA;
      }

      if (match.votesB > match.votesA) {
        return match.itemB;
      }

      return breakTie(match.itemA, match.itemB);
    });
}

export function generateNextRound(
  winners: string[],
  nextStage: ActiveTournamentStage,
): NewMatch[] {
  if (winners.length % 2 !== 0) {
    throw new Error("Winners list must have an even count to generate match pairs.");
  }

  const nextRound: NewMatch[] = [];

  for (let index = 0; index < winners.length; index += 2) {
    nextRound.push({
      stage: nextStage,
      matchIndex: index / 2,
      itemA: winners[index],
      itemB: winners[index + 1],
      votesA: 0,
      votesB: 0,
    });
  }

  return nextRound;
}
