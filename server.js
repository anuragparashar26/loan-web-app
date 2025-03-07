// server.js
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import cors from "cors";
import fs from "fs";
import Papa from "papaparse";
import { DecisionTreeClassifier } from "ml-cart";

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function encodeCategorical(data, column) {
    const uniqueValues = [...new Set(data.map(row => row[column]))];
    const mapping = Object.fromEntries(uniqueValues.map((val, idx) => [val.trim(), idx]));
    return data.map(row => ({
        ...row,
        [column]: mapping[row[column].trim()]
    }));
}

// Train the model and return a Promise
async function trainModel() {
    return new Promise((resolve, reject) => {
        const csvPath = "loan_approval_dataset.csv";
        console.log("Loading CSV from:", csvPath);
        try {
            const csvData = fs.readFileSync(csvPath, "utf8");

            Papa.parse(csvData, {
                header: true,
                skipEmptyLines: true,
                complete: (result) => {
                    console.log("CSV parsed successfully");
                    let data = result.data;

                    data = data.map(row => {
                        const { loan_id, ...rest } = row;
                        return rest;
                    });

                    data = encodeCategorical(data, " education");
                    data = encodeCategorical(data, " self_employed");
                    data = encodeCategorical(data, " loan_status");

                    const X = data.map(row => [
                        parseInt(row[" no_of_dependents"]),
                        parseInt(row[" education"]),
                        parseInt(row[" self_employed"]),
                        parseInt(row[" income_annum"]),
                        parseInt(row[" loan_amount"]),
                        parseInt(row[" loan_term"]),
                        parseInt(row[" cibil_score"]),
                        parseInt(row[" residential_assets_value"]),
                        parseInt(row[" commercial_assets_value"]),
                        parseInt(row[" luxury_assets_value"]),
                        parseInt(row[" bank_asset_value"])
                    ]);
                    const y = data.map(row => parseInt(row[" loan_status"]));

                    const splitIndex = Math.floor(X.length * 0.8);
                    const X_train = X.slice(0, splitIndex);
                    const y_train = y.slice(0, splitIndex);

                    const model = new DecisionTreeClassifier();
                    model.train(X_train, y_train);
                    console.log("Decision Tree model trained successfully");
                    resolve(model);
                },
                error: (err) => {
                    console.error("CSV parsing error:", err);
                    reject(err);
                }
            });
        } catch (error) {
            console.error("Error loading CSV:", error);
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
            - If the query is a greeting (e.g., "hi", "hello"), respond with a greeting and prompt for a loan-related question.
            - If the query is unclear, empty, or a single character (e.g., "."), respond with "Please ask a specific question about Indian loans!"
            - Avoid Markdown formatting like asterisks or bullet points. Use plain text with line breaks if needed.
            - No extra explanation beyond the answer.
        `;

        const result = await geminiModel.generateContent(prompt, {
            generationConfig: {
                maxOutputTokens: 100,
                temperature: 0.1,
                topP: 0.5
            }
        });

        let response = result.response.text().trim();
        response = response.replace(/\*\s*/g, "").replace(/\s+/g, " ").trim();
        return response;
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Sorry, I couldn’t process your request.";
    }
}

// Start server after training model
let model;
trainModel()
    .then(trainedModel => {
        model = trainedModel;

        app.get("/", (req, res) => {
            res.sendFile("home_loan.html", { root: "public" });
        });

        app.post("/api/loan-advice", async (req, res) => {
            const { query } = req.body;
            if (!query || query.trim().length === 0) {
                return res.json({ response: "Please ask a specific question about loans!" });
            }
            const response = await getLoanAdvice(query);
            res.json({ response });
        });

        app.post("/check_eligibility", (req, res) => {
            console.log("Received eligibility request:", req.body); // Debug
            try {
                const data = req.body;
                const inputData = [
                    parseInt(data.no_of_dependents),
                    parseInt(data.education),
                    parseInt(data.self_employed),
                    parseInt(data.income_annum),
                    parseInt(data.loan_amount),
                    parseInt(data.loan_term),
                    parseInt(data.cibil_score),
                    parseInt(data.residential_assets_value),
                    parseInt(data.commercial_assets_value),
                    parseInt(data.luxury_assets_value),
                    parseInt(data.bank_asset_value)
                ];

                if (inputData.some(val => isNaN(val))) {
                    throw new Error("All fields must be valid numbers");
                }

                const prediction = model.predict([inputData])[0];
                const result = prediction === 1 ? "Eligible" : "Not Eligible";
                console.log("Prediction result:", result); // Debug
                res.json({ eligibility: result });
            } catch (error) {
                console.error("Eligibility Error:", error);
                res.status(400).json({ error: error.message });
            }
        });

        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    })
    .catch(error => {
        console.error("Failed to start server due to training error:", error);
        process.exit(1);
    });
