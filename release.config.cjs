/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ["main"],
  plugins: [
    // Analyse commits with conventional commits format
    "@semantic-release/commit-analyzer",
    // Generate changelog from commits
    "@semantic-release/release-notes-generator",
    // Update CHANGELOG.md
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
      },
    ],
    // Publish to npm with provenance
    [
      "@semantic-release/npm",
      {
        npmPublish: true,
      },
    ],
    // Commit updated package.json + CHANGELOG.md back to repo
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    // Create a GitHub release
    "@semantic-release/github",
  ],
};
