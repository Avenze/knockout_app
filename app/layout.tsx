import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Knockout Voting",
  description: "Real-time bracket voting with Next.js and Appwrite",
};

const appwritePublicConfig = {
  endpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT ?? "",
  projectId:
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID ?? "",
  databaseId:
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? process.env.APPWRITE_DATABASE_ID ?? "",
  matchesCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_MATCHES_COLLECTION_ID ??
    process.env.APPWRITE_MATCHES_COLLECTION_ID ??
    "",
  tournamentCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_TOURNAMENT_COLLECTION_ID ??
    process.env.APPWRITE_TOURNAMENT_COLLECTION_ID ??
    "",
};

const appwritePublicConfigScript = JSON.stringify(appwritePublicConfig).replace(
  /</g,
  "\\u003c",
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          id="appwrite-public-config"
          dangerouslySetInnerHTML={{
            __html: `window.__APPWRITE_PUBLIC_CONFIG = ${appwritePublicConfigScript};`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
