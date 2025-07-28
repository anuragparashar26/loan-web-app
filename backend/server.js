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

app.use(
  cors({
    origin: [
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "https://loan-web-app-frontend.onrender.com",
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Add a test GET route for /check_eligibility
app.get("/check_eligibility", (req, res) => {
  res.json({ message: "This is a POST endpoint. Please send a POST request with loan data." });
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const educationMapping = { "Graduate": 1, "Not Graduate": 0 };
const selfEmployedMapping = { "Yes": 1, "No": 0 };
const loanStatusMapping = { "Approved": 1, "Rejected": 0 };

function cleanAndParseNumber(value) {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return typeof value === "number" ? value : 0;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : String(value).trim();
}

const featureRanges = {
  no_of_dependents: 10,
  education: 1,
  self_employed: 1,
  income_annum: 10000000,
  loan_amount: 5000000,
  loan_term: 30,
  cibil_score: 900,
  residential_assets_value: 5000000,
  commercial_assets_value: 5000000,
  luxury_assets_value: 5000000,
  bank_asset_value: 5000000,
};

function normalizeFeatures(features) {
  return [
    features[0] / featureRanges.no_of_dependents,
    features[1],
    features[2],
    features[3] / featureRanges.income_annum,
    features[4] / featureRanges.loan_amount,
    features[5] / featureRanges.loan_term,
    features[6] / featureRanges.cibil_score,
    features[7] / featureRanges.residential_assets_value,
    features[8] / featureRanges.commercial_assets_value,
    features[9] / featureRanges.luxury_assets_value,
    features[10] / featureRanges.bank_asset_value,
  ];
}

function preprocessDataWithMapping(data, headerMapping) {
  return data.map((row, index) => {
    const getField = (fieldName) => {
      const mappedField = headerMapping[fieldName] || fieldName;
      return row[mappedField];
    };

    const cleaned = {
      loan_id: cleanAndParseNumber(getField('loan_id')),
      no_of_dependents: cleanAndParseNumber(getField('no_of_dependents')),
      education: cleanString(getField('education')),
      self_employed: cleanString(getField('self_employed')),
      income_annum: cleanAndParseNumber(getField('income_annum')),
      loan_amount: cleanAndParseNumber(getField('loan_amount')),
      loan_term: cleanAndParseNumber(getField('loan_term')),
      cibil_score: cleanAndParseNumber(getField('cibil_score')),
      residential_assets_value: cleanAndParseNumber(getField('residential_assets_value')),
      commercial_assets_value: cleanAndParseNumber(getField('commercial_assets_value')),
      luxury_assets_value: cleanAndParseNumber(getField('luxury_assets_value')),
      bank_asset_value: cleanAndParseNumber(getField('bank_asset_value')),
      loan_status: cleanString(getField('loan_status')),
    };

    cleaned.education_encoded = educationMapping[cleaned.education] !== undefined ? educationMapping[cleaned.education] : 0;
    cleaned.self_employed_encoded = selfEmployedMapping[cleaned.self_employed] !== undefined ? selfEmployedMapping[cleaned.self_employed] : 0;
    cleaned.loan_status_encoded = loanStatusMapping[cleaned.loan_status] !== undefined ? loanStatusMapping[cleaned.loan_status] : 0;

    if (index < 5) {
      console.log(`Record ${index + 1}:`, {
        loan_id: cleaned.loan_id,
        loan_status: `"${cleaned.loan_status}" -> ${cleaned.loan_status_encoded}`,
        education: `"${cleaned.education}" -> ${cleaned.education_encoded}`,
        self_employed: `"${cleaned.self_employed}" -> ${cleaned.self_employed_encoded}`,
      });
    }

    return cleaned;
  });
}

function createFeatureVector(row) {
  const features = [
    row.no_of_dependents,
    row.education_encoded,
    row.self_employed_encoded,
    row.income_annum,
    row.loan_amount,
    row.loan_term,
    row.cibil_score,
    row.residential_assets_value,
    row.commercial_assets_value,
    row.luxury_assets_value,
    row.bank_asset_value,
  ];
  return normalizeFeatures(features);
}

const modelPath = path.join(process.cwd(), "loan_model.json");

async function saveModel(model, accuracy) {
  const modelData = {
    model: model.toJSON(),
    educationMapping,
    selfEmployedMapping,
    loanStatusMapping,
    featureRanges,
    accuracy,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));
  console.log(`Model saved with accuracy: ${(accuracy * 100).toFixed(2)}%`);
}

async function loadModel() {
  if (fs.existsSync(modelPath)) {
    try {
      const modelData = JSON.parse(fs.readFileSync(modelPath, "utf8"));
      if (!modelData || !modelData.model) {
        throw new Error("Invalid model file");
      }
      console.log(`Loaded model with accuracy: ${(modelData.accuracy * 100).toFixed(2)}%`);
      return DecisionTreeClassifier.load(modelData.model);
    } catch (err) {
      console.error("Error loading model:", err.message);
      if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
      }
      return null;
    }
  }
  return null;
}

async function trainAndMaybeSaveModel() {
  return new Promise((resolve, reject) => {
    const csvPath = path.join(process.cwd(), "loan_approval_dataset.csv");

    if (!fs.existsSync(csvPath)) {
      reject(new Error("Dataset file not found"));
      return;
    }

    try {
      const csvData = fs.readFileSync(csvPath, "utf8");

      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          try {
            console.log(`Loaded ${result.data.length} records from dataset`);

            const headerMapping = {};
            if (result.meta.fields) {
              result.meta.fields.forEach(field => {
                const trimmedField = field.trim().toLowerCase().replace(/\s+/g, '_');
                headerMapping[trimmedField] = field;
              });
            }
            console.log("Header mapping:", headerMapping);

            const processedData = preprocessDataWithMapping(result.data, headerMapping);

            const uniqueStatuses = [...new Set(processedData.map(row => row.loan_status))];
            console.log("Unique loan statuses:", uniqueStatuses);

            const features = processedData.map(createFeatureVector);
            const labels = processedData.map((row) => row.loan_status_encoded);

            const validIndices = features
              .map((feature, index) =>
                feature.every((f) => !isNaN(f) && isFinite(f)) && !isNaN(labels[index]) ? index : -1
              )
              .filter((i) => i >= 0);

            if (validIndices.length === 0) {
              throw new Error("No valid training data found");
            }

            const validFeatures = validIndices.map((i) => features[i]);
            const validLabels = validIndices.map((i) => labels[i]);

            console.log(`Training with ${validFeatures.length} valid records`);

            const approvedCount = validLabels.filter((l) => l === 1).length;
            const rejectedCount = validLabels.filter((l) => l === 0).length;
            console.log(`Dataset: ${approvedCount} approved, ${rejectedCount} rejected`);

            if (approvedCount === 0 || rejectedCount === 0) {
              throw new Error("Imbalanced dataset: All samples have the same label");
            }

            const splitIndex = Math.floor(validFeatures.length * 0.8);
            const trainFeatures = validFeatures.slice(0, splitIndex);
            const trainLabels = validLabels.slice(0, splitIndex);
            const testFeatures = validFeatures.slice(splitIndex);
            const testLabels = validLabels.slice(splitIndex);

            const model = new DecisionTreeClassifier({
              maxDepth: 15,
              minNumSamples: 5,
            });

            model.train(trainFeatures, trainLabels);

            const predictions = model.predict(testFeatures);
            const correct = predictions.filter((pred, i) => pred === testLabels[i]).length;
            const accuracy = correct / testLabels.length;

            console.log(`Model accuracy on test set: ${(accuracy * 100).toFixed(2)}%`);

            saveModel(model, accuracy);
            resolve(model);
          } catch (error) {
            reject(error);
          }
        },
        error: (err) => reject(err),
      });
    } catch (error) {
      reject(error);
    }
  });
}

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
    return "Sorry, I couldn't process your request.";
  }
}

function validateAndEncodeInput(data) {
  try {
    const cleanedData = {
      no_of_dependents: cleanAndParseNumber(data.no_of_dependents),
      education: cleanAndParseNumber(data.education),
      self_employed: cleanAndParseNumber(data.self_employed),
      income_annum: cleanAndParseNumber(data.income_annum),
      loan_amount: cleanAndParseNumber(data.loan_amount),
      loan_term: cleanAndParseNumber(data.loan_term),
      cibil_score: cleanAndParseNumber(data.cibil_score),
      residential_assets_value: cleanAndParseNumber(data.residential_assets_value),
      commercial_assets_value: cleanAndParseNumber(data.commercial_assets_value),
      luxury_assets_value: cleanAndParseNumber(data.luxury_assets_value),
      bank_asset_value: cleanAndParseNumber(data.bank_asset_value),
    };

    if (cleanedData.no_of_dependents < 0 || cleanedData.no_of_dependents > 10) {
      throw new Error("Number of dependents must be between 0 and 10");
    }
    if (cleanedData.education !== 0 && cleanedData.education !== 1) {
      throw new Error("Education must be 0 (Not Graduate) or 1 (Graduate)");
    }
    if (cleanedData.self_employed !== 0 && cleanedData.self_employed !== 1) {
      throw new Error("Self employed must be 0 (No) or 1 (Yes)");
    }
    if (cleanedData.cibil_score < 300 || cleanedData.cibil_score > 900) {
      throw new Error("CIBIL score must be between 300 and 900");
    }
    if (cleanedData.income_annum <= 0) {
      throw new Error("Annual income must be positive");
    }
    if (cleanedData.loan_amount <= 0) {
      throw new Error("Loan amount must be positive");
    }
    if (cleanedData.loan_term <= 0 || cleanedData.loan_term > 30) {
      throw new Error("Loan term must be between 1 and 30 years");
    }

    const features = [
      cleanedData.no_of_dependents,
      cleanedData.education,
      cleanedData.self_employed,
      cleanedData.income_annum,
      cleanedData.loan_amount,
      cleanedData.loan_term,
      cleanedData.cibil_score,
      cleanedData.residential_assets_value,
      cleanedData.commercial_assets_value,
      cleanedData.luxury_assets_value,
      cleanedData.bank_asset_value,
    ];

    if (features.some((f) => isNaN(f) || !isFinite(f))) {
      throw new Error("All input values must be valid numbers");
    }

    const normalizedFeatures = normalizeFeatures(features);
    console.log("Normalized input features:", normalizedFeatures);
    return normalizedFeatures;
  } catch (error) {
    throw error;
  }
}

let model;
(async () => {
  try {
    console.log("Initializing loan prediction model...");
    model = await loadModel();

    if (!model) {
      console.log("Training new model...");
      model = await trainAndMaybeSaveModel();
      console.log("Model trained and saved successfully.");
    } else {
      console.log("Model loaded successfully.");
    }

    app.post("/api/loan-advice", async (req, res) => {
      try {
        const { query } = req.body;
        if (!query || query.trim().length === 0) {
          return res.json({
            response: "Please ask a specific question about loans!",
          });
        }
        const response = await getLoanAdvice(query);
        res.json({ response });
      } catch (error) {
        console.error("Loan advice error:", error);
        res.status(500).json({ error: "Failed to get loan advice" });
      }
    });

    app.post("/check_eligibility", (req, res) => {
      console.log("Received request headers:", req.headers);
      console.log("Received request body:", req.body);
      try {
        if (!model) {
          console.error("Model not loaded");
          return res.status(503).json({ error: "Model is not available. Please try again later." });
        }
        const inputFeatures = validateAndEncodeInput(req.body);
        const prediction = model.predict([inputFeatures])[0];
        const result = prediction === 1 ? "Eligible" : "Not Eligible";
        console.log("Prediction details:", { inputFeatures, prediction, result });
        res.json({
          eligibility: result,
          confidence: prediction === 1 ? "High" : "Low",
          factors: {
            cibil_score: req.body.cibil_score,
            income_to_loan_ratio: (req.body.income_annum / req.body.loan_amount).toFixed(2),
            loan_amount: req.body.loan_amount,
          },
        });
      } catch (error) {
        console.error("Eligibility check error:", error.message, error.stack);
        res.status(400).json({
          error: error.message || "Invalid input data",
          details: "Please check all input values and try again.",
        });
      }
    });

    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${port}`);
      console.log("Loan prediction service is ready!");
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
})();