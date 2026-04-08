#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  AttributeStatus,
  Client,
  Databases,
  DatabasesIndexType,
  ID,
  IndexStatus,
  OrderBy,
  Permission,
  Query,
  Role,
} from "node-appwrite";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFiles = [".env.local", ".env", ".env.example"];

function parseEnvFile(content) {
  const output = {};
  const lines = content.split(/\r?\n/u);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    output[key] = value;
  }

  return output;
}

async function loadEnv() {
  for (const fileName of envFiles) {
    const absolutePath = path.join(rootDir, fileName);

    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      const parsed = parseEnvFile(raw);

      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined || process.env[key] === "") {
          process.env[key] = value;
        }
      }
    } catch {
      // Missing env files are fine; values can still come from process env.
    }
  }
}

function getEnvValue(keys, fallback) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return fallback;
}

function assertRequired(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAppwriteError(error) {
  return typeof error === "object" && error !== null && "code" in error;
}

function isNotFound(error) {
  if (!isAppwriteError(error)) {
    return false;
  }

  return Number(error.code) === 404;
}

function isConflict(error) {
  if (!isAppwriteError(error)) {
    return false;
  }

  return Number(error.code) === 409;
}

async function waitForAttributeReady(databases, databaseId, collectionId, key) {
  const maxAttempts = 60;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attribute = await databases.getAttribute({
      databaseId,
      collectionId,
      key,
    });

    if (attribute.status === AttributeStatus.Available) {
      return;
    }

    if (attribute.status === AttributeStatus.Failed || attribute.status === AttributeStatus.Stuck) {
      throw new Error(
        `Attribute \"${key}\" is in \"${attribute.status}\" state: ${attribute.error ?? "unknown error"}`,
      );
    }

    await sleep(1000);

    if (attempt === maxAttempts) {
      throw new Error(`Timed out waiting for attribute \"${key}\" to become available.`);
    }
  }
}

async function waitForIndexReady(databases, databaseId, collectionId, key) {
  const maxAttempts = 60;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const index = await databases.getIndex({
      databaseId,
      collectionId,
      key,
    });

    if (index.status === IndexStatus.Available) {
      return;
    }

    if (index.status === IndexStatus.Failed || index.status === IndexStatus.Stuck) {
      throw new Error(
        `Index \"${key}\" is in \"${index.status}\" state: ${index.error ?? "unknown error"}`,
      );
    }

    await sleep(1000);

    if (attempt === maxAttempts) {
      throw new Error(`Timed out waiting for index \"${key}\" to become available.`);
    }
  }
}

async function ensureDatabase(databases, databaseId, databaseName) {
  try {
    await databases.get({ databaseId });
    console.log(`Database exists: ${databaseId}`);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }

    await databases.create({
      databaseId,
      name: databaseName,
      enabled: true,
    });

    console.log(`Created database: ${databaseId}`);
  }
}

async function ensureCollection(databases, config) {
  const { databaseId, collectionId, name } = config;

  try {
    const existing = await databases.getCollection({
      databaseId,
      collectionId,
    });

    const publicReadPermission = Permission.read(Role.any());

    if (!existing.$permissions.includes(publicReadPermission)) {
      await databases.updateCollection({
        databaseId,
        collectionId,
        permissions: [...new Set([...existing.$permissions, publicReadPermission])],
        documentSecurity: false,
      });
      console.log(`Updated collection permissions: ${collectionId}`);
    } else {
      console.log(`Collection exists: ${collectionId}`);
    }
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }

    await databases.createCollection({
      databaseId,
      collectionId,
      name,
      permissions: [Permission.read(Role.any())],
      documentSecurity: false,
      enabled: true,
    });

    console.log(`Created collection: ${collectionId}`);
  }
}

async function ensureAttribute(databases, options) {
  const {
    databaseId,
    collectionId,
    key,
    create,
  } = options;

  try {
    await databases.getAttribute({
      databaseId,
      collectionId,
      key,
    });

    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch (error) {
    if (!isNotFound(error) && !isConflict(error)) {
      throw error;
    }

    if (isNotFound(error)) {
      try {
        await create();
        console.log(`Created attribute: ${collectionId}.${key}`);
      } catch (createError) {
        if (!isConflict(createError)) {
          throw createError;
        }

        console.log(`Attribute already exists (race): ${collectionId}.${key}`);
      }
    }
  }

  await waitForAttributeReady(databases, databaseId, collectionId, key);
}

async function ensureIndex(databases, options) {
  const {
    databaseId,
    collectionId,
    key,
    type,
    attributes,
    orders,
  } = options;

  try {
    await databases.getIndex({
      databaseId,
      collectionId,
      key,
    });

    console.log(`Index exists: ${collectionId}.${key}`);
  } catch (error) {
    if (!isNotFound(error) && !isConflict(error)) {
      throw error;
    }

    if (isNotFound(error)) {
      try {
        await databases.createIndex({
          databaseId,
          collectionId,
          key,
          type,
          attributes,
          orders,
        });
        console.log(`Created index: ${collectionId}.${key}`);
      } catch (createError) {
        if (!isConflict(createError)) {
          throw createError;
        }

        console.log(`Index already exists (race): ${collectionId}.${key}`);
      }
    }
  }

  await waitForIndexReady(databases, databaseId, collectionId, key);
}

async function seedTournamentDocument(databases, config) {
  const {
    databaseId,
    tournamentCollectionId,
    tournamentDocumentId,
  } = config;

  try {
    await databases.getDocument({
      databaseId,
      collectionId: tournamentCollectionId,
      documentId: tournamentDocumentId,
    });

    console.log(`Tournament document exists: ${tournamentDocumentId}`);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }

    await databases.createDocument({
      databaseId,
      collectionId: tournamentCollectionId,
      documentId: tournamentDocumentId,
      data: {
        currentStage: "quarterfinal",
        isVotingOpen: true,
      },
    });

    console.log(`Seeded tournament document: ${tournamentDocumentId}`);
  }
}

function buildQuarterfinalMatches() {
  const items = [
    "Item 1",
    "Item 2",
    "Item 3",
    "Item 4",
    "Item 5",
    "Item 6",
    "Item 7",
    "Item 8",
  ];

  return [0, 1, 2, 3].map((matchIndex) => ({
    stage: "quarterfinal",
    matchIndex,
    itemA: items[matchIndex * 2],
    itemB: items[matchIndex * 2 + 1],
    votesA: 0,
    votesB: 0,
  }));
}

async function seedQuarterfinalMatches(databases, config) {
  const {
    databaseId,
    matchesCollectionId,
  } = config;

  const existing = await databases.listDocuments({
    databaseId,
    collectionId: matchesCollectionId,
    queries: [Query.limit(1)],
    total: true,
  });

  if (existing.total > 0) {
    console.log(`Matches already seeded (${existing.total} existing documents).`);
    return;
  }

  const matches = buildQuarterfinalMatches();

  for (const match of matches) {
    await databases.createDocument({
      databaseId,
      collectionId: matchesCollectionId,
      documentId: ID.unique(),
      data: match,
    });
  }

  console.log("Seeded quarterfinal matches (4 documents).\n");
}

async function main() {
  await loadEnv();

  const endpoint = assertRequired(
    "NEXT_PUBLIC_APPWRITE_ENDPOINT or APPWRITE_ENDPOINT",
    getEnvValue(["APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_ENDPOINT"]),
  );

  const projectId = assertRequired(
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_PROJECT_ID",
    getEnvValue(["APPWRITE_PROJECT_ID", "NEXT_PUBLIC_APPWRITE_PROJECT_ID"]),
  );

  const apiKey = assertRequired("APPWRITE_API_KEY", getEnvValue(["APPWRITE_API_KEY"]));

  const databaseId = getEnvValue(
    ["APPWRITE_DATABASE_ID", "NEXT_PUBLIC_APPWRITE_DATABASE_ID"],
    "knockout_db",
  );
  const matchesCollectionId = getEnvValue(
    ["APPWRITE_MATCHES_COLLECTION_ID", "NEXT_PUBLIC_APPWRITE_MATCHES_COLLECTION_ID"],
    "matches",
  );
  const tournamentCollectionId = getEnvValue(
    ["APPWRITE_TOURNAMENT_COLLECTION_ID", "NEXT_PUBLIC_APPWRITE_TOURNAMENT_COLLECTION_ID"],
    "tournament",
  );
  const tournamentDocumentId = getEnvValue(["APPWRITE_TOURNAMENT_DOCUMENT_ID"], "main");

  console.log("Bootstrapping Appwrite resources...");
  console.log(`Project: ${projectId}`);
  console.log(`Database: ${databaseId}`);
  console.log(`Matches Collection: ${matchesCollectionId}`);
  console.log(`Tournament Collection: ${tournamentCollectionId}`);

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  const baseConfig = {
    databaseId,
    matchesCollectionId,
    tournamentCollectionId,
    tournamentDocumentId,
  };

  await ensureDatabase(databases, databaseId, "Knockout Voting");

  await ensureCollection(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    name: "Matches",
  });

  await ensureCollection(databases, {
    databaseId,
    collectionId: tournamentCollectionId,
    name: "Tournament",
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    key: "stage",
    create: () =>
      databases.createStringAttribute({
        databaseId,
        collectionId: matchesCollectionId,
        key: "stage",
        size: 24,
        required: true,
      }),
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    key: "matchIndex",
    create: () =>
      databases.createIntegerAttribute({
        databaseId,
        collectionId: matchesCollectionId,
        key: "matchIndex",
        required: true,
      }),
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    key: "itemA",
    create: () =>
      databases.createStringAttribute({
        databaseId,
        collectionId: matchesCollectionId,
        key: "itemA",
        size: 255,
        required: true,
      }),
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    key: "itemB",
    create: () =>
      databases.createStringAttribute({
        databaseId,
        collectionId: matchesCollectionId,
        key: "itemB",
        size: 255,
        required: true,
      }),
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    key: "votesA",
    create: () =>
      databases.createIntegerAttribute({
        databaseId,
        collectionId: matchesCollectionId,
        key: "votesA",
        required: true,
      }),
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    key: "votesB",
    create: () =>
      databases.createIntegerAttribute({
        databaseId,
        collectionId: matchesCollectionId,
        key: "votesB",
        required: true,
      }),
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    key: "winner",
    create: () =>
      databases.createStringAttribute({
        databaseId,
        collectionId: matchesCollectionId,
        key: "winner",
        size: 255,
        required: false,
      }),
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    key: "itemAImage",
    create: () =>
      databases.createStringAttribute({
        databaseId,
        collectionId: matchesCollectionId,
        key: "itemAImage",
        size: 2048,
        required: false,
      }),
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    key: "itemBImage",
    create: () =>
      databases.createStringAttribute({
        databaseId,
        collectionId: matchesCollectionId,
        key: "itemBImage",
        size: 2048,
        required: false,
      }),
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: tournamentCollectionId,
    key: "currentStage",
    create: () =>
      databases.createStringAttribute({
        databaseId,
        collectionId: tournamentCollectionId,
        key: "currentStage",
        size: 24,
        required: true,
      }),
  });

  await ensureAttribute(databases, {
    databaseId,
    collectionId: tournamentCollectionId,
    key: "isVotingOpen",
    create: () =>
      databases.createBooleanAttribute({
        databaseId,
        collectionId: tournamentCollectionId,
        key: "isVotingOpen",
        required: true,
      }),
  });

  await ensureIndex(databases, {
    databaseId,
    collectionId: matchesCollectionId,
    key: "idx_stage_match_index",
    type: DatabasesIndexType.Key,
    attributes: ["stage", "matchIndex"],
    orders: [OrderBy.Asc, OrderBy.Asc],
  });

  await seedTournamentDocument(databases, baseConfig);
  await seedQuarterfinalMatches(databases, baseConfig);

  console.log("Bootstrap complete.\n");
  console.log("If you used fallback IDs, add these to your .env.local:");
  console.log(`NEXT_PUBLIC_APPWRITE_DATABASE_ID=${databaseId}`);
  console.log(`NEXT_PUBLIC_APPWRITE_MATCHES_COLLECTION_ID=${matchesCollectionId}`);
  console.log(`NEXT_PUBLIC_APPWRITE_TOURNAMENT_COLLECTION_ID=${tournamentCollectionId}`);
  console.log(`APPWRITE_DATABASE_ID=${databaseId}`);
  console.log(`APPWRITE_MATCHES_COLLECTION_ID=${matchesCollectionId}`);
  console.log(`APPWRITE_TOURNAMENT_COLLECTION_ID=${tournamentCollectionId}`);
}

main().catch((error) => {
  console.error("Appwrite bootstrap failed.");
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
