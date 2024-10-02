import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import analyzeCode from "./libs/openai.js"; // Pastikan pathnya benar

dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Function to search for all package.json files in the repository
async function getAllPackageJson(owner, repo) {
  try {
    const { data: searchResults } = await octokit.search.code({
      q: `filename:package.json repo:${owner}/${repo}`,
    });
    return searchResults.items.map((item) => item.path);
  } catch (error) {
    console.error("Error fetching package.json files:", error);
    return [];
  }
}

// Function to get the content of a file from GitHub
async function getFileContent(owner, repo, filePath) {
  try {
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
    });
    return Buffer.from(fileData.content, "base64").toString("utf-8");
  } catch (error) {
    console.error("Error fetching file content:", error);
    return null;
  }
}

// Function to get changed files in a pull request
async function getChangedFiles(owner, repo, pull_number) {
  try {
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });

    return files
      .filter(
        (file) =>
          file.filename.endsWith(".ts") ||
          file.filename.endsWith(".tsx") ||
          file.filename.endsWith(".json")
      )
      .map((file) => ({
        filename: file.filename,
        patch: file.patch || "",
      }));
  } catch (error) {
    console.error("Error fetching changed files:", error);
    return [];
  }
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
      .map((file) => `File: ${file.filename}\nChanges:\n${file.patch}`)
      .join("\n\n");

    const packageJsonPaths = await getAllPackageJson(owner, repo);

    let packageJsonContents = "";
    for (const path of packageJsonPaths) {
      const content = await getFileContent(owner, repo, path);
      if (content) {
        packageJsonContents += `File: ${path}\n${content}\n\n`;
      }
    }

    const trimmedPackageJson = packageJsonContents.slice(0, 2000); // Limit length

    const prompt = `
      Review code changes berikut. Sarankan hingga maksimal lima perbaikan (dan gunakan penomoran pada setiap poin), langsung pada intinya, jelas, dan fokus singkat pada masalah penting seperti logika bisnis atau kesalahan ketik:
      ${combinedChanges}

      Berikut adalah potongan file package.json dari proyeknya sebagai konteks projeknya saja:
      ${trimmedPackageJson}

      Dan bila berupa saran berkaitan dengan code tolong berikan juga diff nya, kode sebelumnya dan kode yang disarankan, contoh gambaran seperti ini yang bagus:

      1. Perubahan pada file \`apps/components/category/form/category-form.tsx\`: Perlu menonaktifkan tombol Submit jika terdapat kesalahan pada form.
      \`\`\`diff
            _text={{ fontWeight: 'bold', color: 'white' }}
      +          isDisabled={!form.formState.isValid}
            >
      \`\`\`

      Cukup berikan saran pada kode yang diubah dari PR tersebut saja dan pastikan clear dalam menjelaskan bagian codenya, bila perlu sebutkan juga bagian code yang mana dan solusi yang ditawarkan code yang seperti apa.

      Dan kalau bisa jangan urusi importing atau exporting yang sepertinya itu akan di pakai di file lain.
    `;

    const analysis = await analyzeCode(prompt);

    if (!analysis || analysis.trim() === "") {
      console.error("No suggestions from OpenAI.");
      return;
    }

    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number,
      body: `🤖 Automated PR Review Suggestion:\n${analysis}`,
      event: "COMMENT",
    });

    console.log("Success reviewing!");
  } catch (error) {
    console.error("Error processing pull request:", error);
  }
}

// Webhook endpoint for GitHub to trigger PR reviews
app.post("/webhook", async (req, res) => {
  console.log("🤖 Reviewd!");
  const { action, pull_request } = req.body;

  if (action === "opened" || action === "synchronize") {
    const owner = pull_request.head.repo.owner.login;
    const repo = pull_request.head.repo.name;
    const pull_number = pull_request.number;

    await processPullRequest(owner, repo, pull_number);
  }

  res.sendStatus(200);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
