import type { NextConfig } from "next";

const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "world-cup-26-bracket";
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";
const isUserSite = repositoryName.endsWith(".github.io");
const basePath =
  isGitHubPagesBuild && !isUserSite ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
