import express from "express";
import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import analyzeCode from "./libs/openai.js";

dotenv.config();

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  const payload = req.body;

  if (payload.action === "opened") {
    const pr = payload.pull_request;
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const analysis = await analyzeCode(pr.body);
    await octokit.pulls.createReview({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      pull_number: pr.number,
      body: `Automated review:\n${analysis}`,
      event: "COMMENT",
    });
  }
  res.sendStatus(200);
});

app.listen(5000, () => console.log("Bot listening on port 5000"));
