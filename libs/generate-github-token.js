import jwt from "jsonwebtoken";
import fs from "fs";

const privateKey = fs.readFileSync("./malas-review-pr.pem", "utf-8");

const payload = {
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 600,
  iss: "Iv23lic12XAJdfnXMsmx",
};

const token = jwt.sign(payload, privateKey, {
  algorithm: "RS256",
});

console.log(token);
