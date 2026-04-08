import { NextResponse } from "next/server";

import { fetchTournamentSnapshot } from "@/lib/tournament-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await fetchTournamentSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to fetch tournament snapshot", error);

    return NextResponse.json(
      {
        error: "Unable to load tournament state.",
      },
      {
        status: 500,
      },
    );
  }
}
