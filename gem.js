import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getLoanAdvice(userQuery) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `${userQuery} Give a short and direct answer. No extra explanation. The answer should be related only to Indian loans and Indian banks. `;

        const result = await model.generateContent(prompt, {
            generationConfig: {
                maxOutputTokens: 30,  
                temperature: 0.1,   
                topP: 0.5
            }
        });

        console.log(result.response.text().trim());
    } catch (error) {
        console.error("Error:", error);
    }
}

getLoanAdvice("my loan amount 50000 and i want my loan term for 5 years and education loan interest rate is 9.5% tell me what will be my monthly emi");
