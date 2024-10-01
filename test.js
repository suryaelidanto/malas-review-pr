import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import analyzeCode from "./libs/openai.js";

dotenv.config();

// Setup Octokit with authentication
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Function to get changed files in a pull request
async function getChangedFiles(owner, repo, pull_number) {
  try {
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });
    return files.map((file) => ({
      filename: file.filename,
      patch: file.patch, // Get only the diff of the changes in each file
    }));
  } catch (error) {
    console.error("Error fetching changed files:", error);
    return [];
  }
}

// Function to extract line numbers from diff patches
function extractLineNumbers(patch) {
  const lines = patch.split('\n');
  const lineNumbers = [];

  lines.forEach((line) => {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),\d+ \+(\d+),\d+ @@/);
      if (match) {
        lineNumbers.push({
          start: parseInt(match[2], 10),
          end: parseInt(match[2], 10),
        });
      }
    }
  });

  return lineNumbers;
}

// Function to process pull request changes and analyze them
async function processPullRequest(owner, repo, pull_number) {
  try {
    const changedFiles = await getChangedFiles(owner, repo, pull_number);

    if (changedFiles.length === 0) {
      console.error("No file changes found.");
      return;
    }

    const combinedChanges = changedFiles
      .map(file => `File: ${file.filename}\nChanges:\n${file.patch}`)
      .join("\n\n");

    const prompt = `
      Review the following code changes. Suggest up to five improvements and highlight any urgent logical issues:
      ${combinedChanges}
    `;

    const analysis = await analyzeCode(prompt);

    // Format the suggestions with file references
    const suggestions = analysis.split('\n').filter(Boolean);
    const formattedSuggestions = suggestions.map((suggestion, index) => {
      const file = changedFiles[index % changedFiles.length];
      const lineNumbers = extractLineNumbers(file.patch);
      const startLine = lineNumbers.length > 0 ? lineNumbers[0].start : 1; // Default to line 1 if no lines found
      return `${index + 1}. In \`${file.filename}\` line ${startLine}: ${suggestion.trim()}`;
    }).join("\n");

    // Create a review with the analysis
    if (formattedSuggestions.trim()) {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        body: `Automated PR Review:\n${formattedSuggestions}`,
        event: "COMMENT",
      });

      console.log("Single review created for all changes.");
    } else {
      console.log("No issues found in the PR.");
    }

  } catch (error) {
    console.error("Error processing pull request:", error);
  }
}

// Call the function to process the PR
processPullRequest("satuklinik-team", "satu-klinik-mobile", "37");
