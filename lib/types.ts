export const STAGES = ["quarterfinal", "semifinal", "final", "completed"] as const;

export type TournamentStage = (typeof STAGES)[number];
export type ActiveTournamentStage = Exclude<TournamentStage, "completed">;

export interface MatchDocument {
  $id: string;
  stage: ActiveTournamentStage;
  matchIndex: number;
  itemA: string;
  itemB: string;
  votesA: number;
  votesB: number;
  winner?: string;
  itemAImage?: string;
  itemBImage?: string;
}

export interface NewMatch {
  stage: ActiveTournamentStage;
  matchIndex: number;
  itemA: string;
  itemB: string;
  votesA: number;
  votesB: number;
  winner?: string;
  itemAImage?: string;
  itemBImage?: string;
}

export interface TournamentDocument {
  $id: string;
  currentStage: TournamentStage;
  isVotingOpen: boolean;
}

export interface TournamentSnapshot {
  tournament: TournamentDocument;
  matches: MatchDocument[];
  champion: string | null;
}

export type VoteTarget = "A" | "B";
