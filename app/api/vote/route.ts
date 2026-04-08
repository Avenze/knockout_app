import { NextResponse } from "next/server";

import { castVote } from "@/lib/tournament-server";
import type { VoteTarget } from "@/lib/types";

export const dynamic = "force-dynamic";

interface VoteRequestBody {
  matchId: string;
  target: VoteTarget;
}

function isVoteTarget(value: string): value is VoteTarget {
  return value === "A" || value === "B";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<VoteRequestBody>;

    if (!body.matchId || !body.target || !isVoteTarget(body.target)) {
      return NextResponse.json(
        { error: "Invalid vote payload." },
        {
          status: 400,
        },
      );
    }

    const updatedMatch = await castVote(body.matchId, body.target);

    return NextResponse.json({ match: updatedMatch });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to submit vote right now.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      },
    );
  }
}
