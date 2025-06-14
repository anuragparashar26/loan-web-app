// server.js
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { DecisionTreeClassifier } from "ml-cart";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function encodeCategorical(data, column) {
  const uniqueValues = [...new Set(data.map((row) => row[column]))];
  const mapping = Object.fromEntries(
    uniqueValues.map((val, idx) => [val.trim(), idx]),
  );
  return data.map((row) => ({
    ...row,
    [column]: mapping[row[column].trim()],
  }));
}

function trimKeys(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.trim(), v]));
}

const modelPath = path.join(process.cwd(), "loan_model.json");

async function saveModel(model) {
  fs.writeFileSync(modelPath, JSON.stringify(model.toJSON()));
}

async function loadModel() {
  if (fs.existsSync(modelPath)) {
    try {
      const modelJSON = JSON.parse(fs.readFileSync(modelPath, "utf8"));
      if (!modelJSON) throw new Error("Model file is empty or invalid");
      return DecisionTreeClassifier.load(modelJSON);
    } catch (err) {
      // If loading fails, remove the corrupted model file
      console.error(
        "Corrupted model file detected. Deleting and retraining...",
      );
      fs.unlinkSync(modelPath);
      return null;
    }
  }
  return null;
}

async function trainAndMaybeSaveModel() {
  return new Promise((resolve, reject) => {
    const csvPath = path.join(process.cwd(), "loan_approval_dataset.csv");
    try {
      const csvData = fs.readFileSync(csvPath, "utf8");

      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          let data = result.data.map(trimKeys);

          data = data.map((row) => {
            const { loan_id, ...rest } = row;
            return rest;
          });

          data = encodeCategorical(data, "education");
          data = encodeCategorical(data, "self_employed");
          data = encodeCategorical(data, "loan_status");

          const X = data.map((row) => [
            parseInt(row["no_of_dependents"]),
            parseInt(row["education"]),
            parseInt(row["self_employed"]),
            parseInt(row["income_annum"]),
            parseInt(row["loan_amount"]),
            parseInt(row["loan_term"]),
            parseInt(row["cibil_score"]),
            parseInt(row["residential_assets_value"]),
            parseInt(row["commercial_assets_value"]),
            parseInt(row["luxury_assets_value"]),
            parseInt(row["bank_asset_value"]),
          ]);
          const y = data.map((row) => parseInt(row["loan_status"]));

          const splitIndex = Math.floor(X.length * 0.8);
          const X_train = X.slice(0, splitIndex);
          const y_train = y.slice(0, splitIndex);

          const model = new DecisionTreeClassifier();
          model.train(X_train, y_train);
          saveModel(model); // Save the trained model after training
          resolve(model);
        },
        error: (err) => reject(err),
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Gemini loan advice function
async function getLoanAdvice(userQuery) {
  try {
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
            User query: "${userQuery}"
            Provide a short, direct answer related to Indian loans and Indian banks.
            - If the query is a greeting, respond with a greeting and prompt for a loan-related question.
            - If the query is unclear, empty, or a single character, respond with "Please ask a specific question about Indian loans!"
            - Avoid Markdown formatting. Use plain text.
            - No extra explanation beyond the answer.
        `;
    const result = await geminiModel.generateContent(prompt, {
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.1,
        topP: 0.5,
      },
    });
    let response = result.response.text().trim();
    response = response.replace(/\*\s*/g, "").replace(/\s+/g, " ").trim();
    return response;
  } catch (error) {
    return "Sorry, I couldn’t process your request.";
  }
}

// Add mapping for categorical fields
function encodeInput(data) {
  const educationMap = {
    Graduate: 1,
    "Not Graduate": 0,
    1: 1,
    0: 0,
    1: 1,
    0: 0,
  };
  const selfEmployedMap = { Yes: 1, No: 0, 1: 1, 0: 0, 1: 1, 0: 0 };
  return [
    parseInt(data.no_of_dependents),
    educationMap[data.education] !== undefined
      ? educationMap[data.education]
      : parseInt(data.education),
    selfEmployedMap[data.self_employed] !== undefined
      ? selfEmployedMap[data.self_employed]
      : parseInt(data.self_employed),
    parseInt(data.income_annum),
    parseInt(data.loan_amount),
    parseInt(data.loan_term),
    parseInt(data.cibil_score),
    parseInt(data.residential_assets_value),
    parseInt(data.commercial_assets_value),
    parseInt(data.luxury_assets_value),
    parseInt(data.bank_asset_value),
  ];
}

// Start server after loading or training model
let model;
(async () => {
  model = await loadModel();
  if (!model) {
    model = await trainAndMaybeSaveModel();
    console.log("Model trained and saved.");
  } else {
    console.log("Loaded trained model from disk.");
  }

  app.post("/api/loan-advice", async (req, res) => {
    const { query } = req.body;
    if (!query || query.trim().length === 0) {
      return res.json({
        response: "Please ask a specific question about loans!",
      });
    }
    const response = await getLoanAdvice(query);
    res.json({ response });
  });

  app.post("/check_eligibility", (req, res) => {
    try {
      if (!model) {
        return res
          .status(503)
          .json({
            error: "Model is still training. Please try again in a moment.",
          });
      }
      // Trim all keys in the incoming data
      const data = Object.fromEntries(
        Object.entries(req.body).map(([k, v]) => [k.trim(), v]),
      );
      // Validate all required fields
      const requiredFields = [
        "no_of_dependents",
        "education",
        "self_employed",
        "income_annum",
        "loan_amount",
        "loan_term",
        "cibil_score",
        "residential_assets_value",
        "commercial_assets_value",
        "luxury_assets_value",
        "bank_asset_value",
      ];
      for (const field of requiredFields) {
        if (
          data[field] === undefined ||
          data[field] === null ||
          data[field] === ""
        ) {
          return res.status(400).json({ error: `Missing field: ${field}` });
        }
      }
      const inputData = encodeInput(data);
      if (inputData.some((val) => isNaN(val))) {
        return res
          .status(400)
          .json({ error: "All fields must be valid numbers" });
      }
      const prediction = model.predict([inputData])[0];
      const result = prediction === 1 ? "Eligible" : "Not Eligible";
      res.json({ eligibility: result });
    } catch (error) {
      console.error("Eligibility check error:", error);
      res.status(400).json({ error: error.message || "Unknown error" });
    }
  });

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
})().catch((error) => {
  process.exit(1);
});
