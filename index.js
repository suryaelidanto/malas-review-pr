import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import analyzeCode from "./libs/openai.js";
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
  res.send("Welcome to Malas Review PR! 🧢");
});

// Webhook endpoint for GitHub to trigger PR reviews
app.post("/webhook", async (req, res) => {
  const { action, pull_request, installation } = req.body;

  if (action === "opened" || action === "synchronize") {
    logger.info(`PR action detected: ${action}`);
    const owner = pull_request.head.repo.owner.login;
    const repo = pull_request.head.repo.name;
    const pull_number = pull_request.number;
    const installationId = installation.id;

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

// Function to retrieve the content of package manager files from the repo
async function getPackageFileContent(octokit, owner, repo, filePath) {
  try {
    const { data: fileContent } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
    });

    const content = Buffer.from(fileContent.content, "base64").toString("utf8");
    return content;
  } catch (error) {
    if (error.status === 403) {
      logger.error(
        `Forbidden (403): Insufficient permissions to access ${filePath}`
      );
    } else if (error.status === 404) {
      logger.error(`File not found (404): ${filePath}`);
    } else {
      logger.error(`Failed to retrieve ${filePath}: ${error.message}`);
    }
    return null;
  }
}

// Function to process pull request changes and analyze them
async function processPullRequest(owner, repo, pull_number, installationId) {
  try {
    logger.info(
      `Processing PR #${pull_number} in ${owner}/${repo} with installation ID ${installationId}...`
    );
    const octokit = await initializeOctokit(installationId);

    // Get only the changed files in the PR
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

    // Define the list of package manager files
    const packageFiles = [
      "package.json",
      "pom.xml",
      "build.gradle",
      "Cargo.toml",
    ];
    let packageFileContent = "";

    // Check for each package file in the repo
    for (const file of packageFiles) {
      const content = await getPackageFileContent(octokit, owner, repo, file);
      if (content) {
        logger.info(`Found and retrieved ${file} in ${owner}/${repo}.`);
        packageFileContent += `\n\n=== Content of ${file} ===\n${content}`;
      }
    }

    if (!packageFileContent) {
      logger.warn(`No package manager files found in ${owner}/${repo}.`);
    }

    // Combine the changes and focus only on the diff patches
    const combinedChanges = changedFiles
      .map((file) => `File: ${file.filename}\nChanges:\n${file.patch}`)
      .join("\n\n");

    // OpenAI prompt with instructions to not force changes to package files
    const prompt = `
      Act as an expert developer. For React projects, you're Dan Abramov; for Express, you're Guillermo Rauch. Provide highly opinionated, critical feedback on the following code changes, focusing only on critical issues that affect performance, business logic, or potential bugs.

      Important:
      - Suggest improvements but **do not force changes to package files**; only recommend them if appropriate.
      - Provide exactly **five** clear, actionable suggestions.
      - Prioritize the most important issues, and focus on the files that were changed.

      Here's the project context and package files: 
      ${packageFileContent}

      Here are the diffs for the changed files:
      ${combinedChanges}

      Important:
      - Avoid commenting on imports/exports unless directly related to critical functionality.
      - Focus on addressing only business logic issues, potential bugs, or serious typing mistakes.
      - Be clear and opinionated, prioritize impact, and avoid discussing trivial matters.
    
      Example of sharp, impactful feedback:
      
     
1. Disable button when form contains errors
   File: \`apps/components/category/form/category\`-form.tsx
   Perbaikan: Nonaktifkan tombol Submit ketika form memiliki error.
   \`\`\`diff
         _text={{ fontWeight: 'bold', color: 'white' }}
   +         isDisabled={!form.formState.isValid}
         >
   \`\`\`

2. Rename onSubmit handler for clarity
   File: \`apps/features/service/components/service\`-form.tsx
   Perbaikan: Ubah nama onSubmit menjadi handleFormSubmit untuk meningkatkan kejelasan bahwa fungsi ini menangani form submission.
   \`\`\`diff
   -    onPress={handleSubmit(onSubmit)}
   +    onPress={handleSubmit(handleFormSubmit)}
   \`\`\`

3. Add missing error handling in fetch function
   File: \`apps/utils/api/fetchData.ts\`
   Perbaikan: Tambahkan penanganan error dalam fungsi fetch untuk menghindari crash jika request gagal.
   \`\`\`diff
   -    const response = await fetch(url);
   +    const response = await fetch(url).catch(error => {
   +        console.error('Error fetching data:', error);
   +        return null;
   +    });
   \`\`\`

4. Improve conditional rendering for loading state
   File: \`apps/components/loading/LoadingSpinner.tsx\`
   Perbaikan: Tambahkan pengecekan isLoading agar komponen hanya dirender ketika status loading benar.
   \`\`\`diff
   -    return <Spinner />;
   +    return isLoading ? <Spinner /> : null;
   \`\`\`

5. Optimize useEffect dependency array
   File: \`apps/features/user/components/UserProfile\`.tsx
   Perbaikan: Kurangi dependensi useEffect agar hanya dijalankan ketika userId berubah.
   \`\`\`diff
   -    useEffect(() => { fetchUserData(); }, [userId, fetchUserData]);
   +    useEffect(() => { fetchUserData(); }, [userId]);
   \`\`\`

6. Change let to const for variable declaration
   File: \`apps/utils/helpers/formatDate.ts\`
   Perbaikan: Ganti let dengan const untuk deklarasi variabel yang tidak diubah.
   \`\`\`diff
   -    let formattedDate = new Date(date).toLocaleDateString();
   +    const formattedDate = new Date(date).toLocaleDateString();
   \`\`\`

7. Move inline styles to StyleSheet for performance
   File: \`apps/components/button/SubmitButton.tsx\`
   Perbaikan: Pindahkan style inline ke StyleSheet untuk meningkatkan performa dan keterbacaan kode.
   \`\`\`diff
   -    <Button style={{ backgroundColor: 'blue', padding: 10 }}>
   +    const styles = StyleSheet.create({ button: { backgroundColor: 'blue', padding: 10 } });
   +    <Button style={styles.button}>
   \`\`\`

8. Use optional chaining to prevent undefined error
   File: \`apps/components/user/UserDetail.tsx\`
   Perbaikan: Gunakan optional chaining untuk menghindari error jika objek undefined.
   \`\`\`diff
   -    const username = user.profile.name;
   +    const username = user?.profile?.name;
   \`\`\`

9. Refactor duplicated logic into a helper function
   File: \`apps/features/invoice/components/InvoiceItem\`.tsx
   Perbaikan: Refactor logika duplikat menjadi fungsi helper untuk mengurangi pengulangan kode.
   \`\`\`diff
   -    const tax = item.price * 0.1;
   -    const total = item.price + tax;
   +    const calculateTotal = (price) => price + (price * 0.1);
   +    const total = calculateTotal(item.price);
   \`\`\`

10. Avoid directly mutating state in setState
    File: \`apps/features/cart/components/CartItem\`.tsx
    Perbaikan: Hindari memutasi state secara langsung, gunakan spread operator untuk update state.
    \`\`\`diff
    -    setItems(currentItems => currentItems.push(newItem));
    +    setItems(currentItems => [...currentItems, newItem]);
    \`\`\`
      
      Provide five suggestions following this structure, and prioritize only the most important feedback.
    `;

    const analysis = await analyzeCode(prompt);
    if (!analysis || analysis.trim() === "") {
      logger.warn(`No suggestions from OpenAI for PR #${pull_number}.`);
      return;
    }

    // Post the review as a comment on the pull request
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
      installationId,
    },
  });

  return octokit;
}

// Function to get the changed files in a pull request
async function getChangedFiles(octokit, owner, repo, pull_number) {
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number,
  });
  return files
    .filter((file) => file.patch) // Filter files with actual changes
    .map((file) => ({
      filename: file.filename,
      patch: file.patch || "",
    }));
}

// Start the server
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
