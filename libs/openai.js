import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

export default async function analyzeCode(code) {
  const response = await client.chat.completions.create({
    messages: [{ role: "user", content: code }],
    model: "gpt-3.5-turbo-0125", // Model yang lebih murah
  });
  return response.choices[0].message.content;
}
