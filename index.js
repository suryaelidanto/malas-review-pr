import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import analyzeCode from "./libs/openai.js";
import fs from "fs";
import path from "path";
import winston from "winston";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Winston Logger Setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(
      ({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "app.log",
      format: winston.format.uncolorize(),
    }),
  ],
});

app.get("/", (req, res) => {
  res.send("Welcome to malas review PR! 🧢");
});

// Webhook endpoint for GitHub to trigger PR reviews
app.post("/webhook", async (req, res) => {
  const { action, pull_request, installation } = req.body;

  if (action === "opened" || action === "synchronize") {
    logger.info(`PR action detected: ${action}`);
    const owner = pull_request.head.repo.owner.login;
    const repo = pull_request.head.repo.name;
    const pull_number = pull_request.number;
    const installationId = installation.id; // Retrieve the installation ID from the payload

    logger.info(
      `Processing PR #${pull_number} in ${owner}/${repo} with installation ID ${installationId}`
    );

    try {
      await processPullRequest(owner, repo, pull_number, installationId);
    } catch (error) {
      logger.error(`Failed to process PR: ${error.message}`);
    }
  }

  res.sendStatus(200);
});

// Function to process pull request changes and analyze them
async function processPullRequest(owner, repo, pull_number, installationId) {
  try {
    logger.info(
      `Processing PR #${pull_number} in ${owner}/${repo} with installation ID ${installationId}...`
    );
    const octokit = await initializeOctokit(installationId);

    const changedFiles = await getChangedFiles(
      octokit,
      owner,
      repo,
      pull_number
    );
    if (changedFiles.length === 0) {
      logger.warn(`No file changes found in PR #${pull_number}.`);
      return;
    }

    const combinedChanges = changedFiles
      .map((file) => `File: ${file.filename}\nChanges:\n${file.patch}`)
      .join("\n\n");

    const prompt = `
      Please review the following code changes. Provide up to five focused, actionable suggestions (numbered) that clearly address issues such as business logic mistakes, typing errors, or other critical problems. Be direct, concise, and ensure the feedback highlights areas that need attention.
    
      Additionally, if your suggestions involve code changes, provide a diff between the current and suggested code, formatted as shown in the example below:
    
      1. In \`apps/components/category/form/category-form.tsx\`, you should disable the Submit button when the form contains errors.
      \`\`\`diff
            _text={{ fontWeight: 'bold', color: 'white' }}
      +          isDisabled={!form.formState.isValid}
            >
      \`\`\`
    
      Focus only on the code that has been changed in this PR and avoid addressing issues related to imports or exports unless they are directly relevant to the logic changes. Your feedback should clearly explain what part of the code needs improvement and suggest an optimal solution.
    
      Please make sure that your suggestions go beyond simply pointing out what has changed, and instead provide clear guidance on how the code should be improved.
    `;

    const analysis = await analyzeCode(prompt);
    if (!analysis || analysis.trim() === "") {
      logger.warn(`No suggestions from OpenAI for PR #${pull_number}.`);
      return;
    }

    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number,
      body: `🤖 Malas Review PR Suggestion:\n${analysis}`,
      event: "COMMENT",
    });

    logger.info(`Successfully posted review on PR #${pull_number}.`);
  } catch (error) {
    logger.error(`Error processing PR #${pull_number}: ${error.message}`);
  }
}

// Function to initialize Octokit with the installation token
async function initializeOctokit(installationId) {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId, // Dynamically use the installation ID from webhook
    },
  });

  return octokit;
}

// Function to get changed files in a pull request
async function getChangedFiles(octokit, owner, repo, pull_number) {
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number,
  });
  return files.map((file) => ({
    filename: file.filename,
    patch: file.patch || "",
  }));
}

// Start the server
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
