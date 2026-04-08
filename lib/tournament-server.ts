import { ID, Query, type Models } from "node-appwrite";

import { createAdminDatabases, getServerAppwriteConfig } from "@/lib/appwrite-server";
import type {
  MatchDocument,
  NewMatch,
  TournamentDocument,
  TournamentSnapshot,
  TournamentStage,
  VoteTarget,
} from "@/lib/types";
import { STAGE_FLOW, generateNextRound, getWinners } from "@/lib/voting";

type DocData = Record<string, unknown>;

function readString(data: DocData, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

function readOptionalString(data: DocData, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(data: DocData, key: string): number {
  const value = data[key];
  return typeof value === "number" ? value : 0;
}

function isActiveStage(value: string): value is MatchDocument["stage"] {
  return value === "quarterfinal" || value === "semifinal" || value === "final";
}

function isTournamentStage(value: string): value is TournamentStage {
  return (
    value === "quarterfinal" ||
    value === "semifinal" ||
    value === "final" ||
    value === "completed"
  );
}

function toMatchDocument(doc: Models.Document): MatchDocument {
  const data = doc as unknown as DocData;
  const stage = readString(data, "stage");

  return {
    $id: doc.$id,
    stage: isActiveStage(stage) ? stage : "quarterfinal",
    matchIndex: readNumber(data, "matchIndex"),
    itemA: readString(data, "itemA"),
    itemB: readString(data, "itemB"),
    votesA: readNumber(data, "votesA"),
    votesB: readNumber(data, "votesB"),
    winner: readOptionalString(data, "winner"),
    itemAImage: readOptionalString(data, "itemAImage"),
    itemBImage: readOptionalString(data, "itemBImage"),
  };
}

function toTournamentDocument(doc: Models.Document): TournamentDocument {
  const data = doc as unknown as DocData;
  const currentStage = readString(data, "currentStage");

  return {
    $id: doc.$id,
    currentStage: isTournamentStage(currentStage) ? currentStage : "quarterfinal",
    isVotingOpen: Boolean(data.isVotingOpen),
  };
}

export async function fetchTournamentSnapshot(): Promise<TournamentSnapshot> {
  const config = getServerAppwriteConfig();
  const databases = createAdminDatabases();

  const tournamentDoc = await databases.getDocument(
    config.databaseId,
    config.tournamentCollectionId,
    config.tournamentDocumentId,
  );

  const matchesResult = await databases.listDocuments(
    config.databaseId,
    config.matchesCollectionId,
    [Query.limit(100), Query.orderAsc("$createdAt")],
  );

  const matches = matchesResult.documents.map(toMatchDocument);
  const finalWinner = matches.find((match) => match.stage === "final")?.winner;

  return {
    tournament: toTournamentDocument(tournamentDoc),
    matches,
    champion: finalWinner ?? null,
  };
}

export async function castVote(matchId: string, target: VoteTarget): Promise<MatchDocument> {
  const config = getServerAppwriteConfig();
  const databases = createAdminDatabases();

  const tournamentDoc = await databases.getDocument(
    config.databaseId,
    config.tournamentCollectionId,
    config.tournamentDocumentId,
  );

  const tournament = toTournamentDocument(tournamentDoc);
  if (!tournament.isVotingOpen || tournament.currentStage === "completed") {
    throw new Error("Voting is currently closed.");
  }

  const matchDoc = await databases.getDocument(
    config.databaseId,
    config.matchesCollectionId,
    matchId,
  );

  const match = toMatchDocument(matchDoc);

  if (match.stage !== tournament.currentStage) {
    throw new Error("Voting is not open for this match stage.");
  }

  if (match.winner) {
    throw new Error("This match is already finalized.");
  }

  const updated = await databases.updateDocument(
    config.databaseId,
    config.matchesCollectionId,
    match.$id,
    {
      votesA: target === "A" ? match.votesA + 1 : match.votesA,
      votesB: target === "B" ? match.votesB + 1 : match.votesB,
    },
  );

  return toMatchDocument(updated);
}

function ensureStageCanAdvance(stage: TournamentStage): asserts stage is MatchDocument["stage"] {
  if (stage === "completed") {
    throw new Error("Tournament is already completed.");
  }
}

function assertRoundSize(stage: MatchDocument["stage"], winners: string[]): void {
  const expected = stage === "quarterfinal" ? 4 : stage === "semifinal" ? 2 : 1;

  if (winners.length !== expected) {
    throw new Error(`Expected ${expected} winners in ${stage}, received ${winners.length}.`);
  }
}

export async function advanceTournamentStage(): Promise<TournamentSnapshot> {
  const config = getServerAppwriteConfig();
  const databases = createAdminDatabases();

  const tournamentDoc = await databases.getDocument(
    config.databaseId,
    config.tournamentCollectionId,
    config.tournamentDocumentId,
  );

  const tournament = toTournamentDocument(tournamentDoc);
  ensureStageCanAdvance(tournament.currentStage);

  const matchesResult = await databases.listDocuments(
    config.databaseId,
    config.matchesCollectionId,
    [
      Query.equal("stage", tournament.currentStage),
      Query.orderAsc("matchIndex"),
      Query.limit(20),
    ],
  );

  const currentMatches = matchesResult.documents.map(toMatchDocument);

  if (currentMatches.length === 0) {
    throw new Error(`No matches found for stage: ${tournament.currentStage}`);
  }

  const winners = getWinners(currentMatches);
  assertRoundSize(tournament.currentStage, winners);

  await Promise.all(
    currentMatches.map((match, index) => {
      return databases.updateDocument(
        config.databaseId,
        config.matchesCollectionId,
        match.$id,
        {
          winner: winners[index],
        },
      );
    }),
  );

  const nextStage = STAGE_FLOW[tournament.currentStage];

  if (nextStage !== "completed") {
    const nextRound = generateNextRound(winners, nextStage);

    await Promise.all(
      nextRound.map((match: NewMatch) => {
        return databases.createDocument(
          config.databaseId,
          config.matchesCollectionId,
          ID.unique(),
          match,
        );
      }),
    );
  }

  await databases.updateDocument(
    config.databaseId,
    config.tournamentCollectionId,
    config.tournamentDocumentId,
    {
      currentStage: nextStage,
      isVotingOpen: nextStage !== "completed",
    },
  );

  return fetchTournamentSnapshot();
}
