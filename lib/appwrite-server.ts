import { Account, Client, Databases } from "node-appwrite";

interface ServerAppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
  matchesCollectionId: string;
  tournamentCollectionId: string;
  tournamentDocumentId: string;
  apiKey: string;
  adminEmails: string[];
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();

  if (!value) {
    return undefined;
  }

  return value;
}

export function getServerAppwriteConfig(): ServerAppwriteConfig {
  const adminEmailsRaw = getOptionalEnv("APPWRITE_ADMIN_EMAILS") ?? "";

  return {
    endpoint:
      getOptionalEnv("APPWRITE_ENDPOINT") ??
      requireEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT"),
    projectId:
      getOptionalEnv("APPWRITE_PROJECT_ID") ??
      requireEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID"),
    databaseId:
      getOptionalEnv("APPWRITE_DATABASE_ID") ??
      requireEnv("NEXT_PUBLIC_APPWRITE_DATABASE_ID"),
    matchesCollectionId:
      getOptionalEnv("APPWRITE_MATCHES_COLLECTION_ID") ??
      requireEnv("NEXT_PUBLIC_APPWRITE_MATCHES_COLLECTION_ID"),
    tournamentCollectionId:
      getOptionalEnv("APPWRITE_TOURNAMENT_COLLECTION_ID") ??
      requireEnv("NEXT_PUBLIC_APPWRITE_TOURNAMENT_COLLECTION_ID"),
    tournamentDocumentId:
      getOptionalEnv("APPWRITE_TOURNAMENT_DOCUMENT_ID") ?? "main",
    apiKey: requireEnv("APPWRITE_API_KEY"),
    adminEmails: adminEmailsRaw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  };
}

function createAdminClient(): Client {
  const config = getServerAppwriteConfig();

  return new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
}

export function createAdminDatabases(): Databases {
  return new Databases(createAdminClient());
}

export function createAccountFromJwt(jwt: string): Account {
  const config = getServerAppwriteConfig();
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setJWT(jwt);

  return new Account(client);
}
