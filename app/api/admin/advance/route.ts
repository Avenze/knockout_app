import { NextResponse } from "next/server";

import {
  createAccountFromJwt,
  getServerAppwriteConfig,
} from "@/lib/appwrite-server";
import { advanceTournamentStage } from "@/lib/tournament-server";

export const dynamic = "force-dynamic";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export async function POST(request: Request) {
  try {
    const jwt = getBearerToken(request);

    if (!jwt) {
      return NextResponse.json(
        { error: "Missing bearer token." },
        { status: 401 },
      );
    }

    const account = createAccountFromJwt(jwt);
    const user = await account.get();

    const config = getServerAppwriteConfig();
    const adminEmails = config.adminEmails;

    if (adminEmails.length > 0) {
      const userEmail = user.email.toLowerCase();

      if (!adminEmails.includes(userEmail)) {
        return NextResponse.json(
          { error: "You are not authorized to advance the tournament." },
          { status: 403 },
        );
      }
    }

    const snapshot = await advanceTournamentStage();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to advance tournament", error);

    const message =
      error instanceof Error ? error.message : "Unable to advance tournament.";

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
