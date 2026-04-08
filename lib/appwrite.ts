import { Account, Client, Databases } from "appwrite";

interface PublicAppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId?: string;
  matchesCollectionId?: string;
  tournamentCollectionId?: string;
}

const staticPublicConfig: Partial<PublicAppwriteConfig> = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.trim(),
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim(),
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID?.trim(),
  matchesCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_MATCHES_COLLECTION_ID?.trim(),
  tournamentCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_TOURNAMENT_COLLECTION_ID?.trim(),
};

declare global {
  interface Window {
    __APPWRITE_PUBLIC_CONFIG?: Partial<PublicAppwriteConfig>;
  }
}

function requireConfigValue(name: string, value?: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function readConfigValue(runtimeKey: keyof PublicAppwriteConfig): string | undefined {
  const staticValue = staticPublicConfig[runtimeKey];

  if (typeof staticValue === "string" && staticValue.length > 0) {
    return staticValue;
  }

  if (typeof window !== "undefined") {
    const runtimeValue = window.__APPWRITE_PUBLIC_CONFIG?.[runtimeKey];

    if (typeof runtimeValue === "string" && runtimeValue.trim().length > 0) {
      return runtimeValue.trim();
    }
  }

  return undefined;
}

export function getPublicAppwriteConfig(): PublicAppwriteConfig {
  const endpoint = readConfigValue("endpoint");
  const projectId = readConfigValue("projectId");

  return {
    endpoint: requireConfigValue("NEXT_PUBLIC_APPWRITE_ENDPOINT", endpoint),
    projectId: requireConfigValue("NEXT_PUBLIC_APPWRITE_PROJECT_ID", projectId),
    databaseId: readConfigValue("databaseId"),
    matchesCollectionId: readConfigValue("matchesCollectionId"),
    tournamentCollectionId: readConfigValue("tournamentCollectionId"),
  };
}

let browserClient: Client | null = null;

export function getBrowserAppwriteClient(): Client {
  if (browserClient) {
    return browserClient;
  }

  const config = getPublicAppwriteConfig();
  browserClient = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);

  return browserClient;
}

export function getBrowserDatabases(): Databases {
  return new Databases(getBrowserAppwriteClient());
}

export function getBrowserAccount(): Account {
  return new Account(getBrowserAppwriteClient());
}

export function getRealtimeChannels(): string[] {
  const config = getPublicAppwriteConfig();

  if (
    !config.databaseId ||
    !config.matchesCollectionId ||
    !config.tournamentCollectionId
  ) {
    throw new Error(
      "Missing realtime Appwrite config: database and collection IDs are required.",
    );
  }

  return [
    `databases.${config.databaseId}.collections.${config.matchesCollectionId}.documents`,
    `databases.${config.databaseId}.collections.${config.tournamentCollectionId}.documents`,
  ];
}
