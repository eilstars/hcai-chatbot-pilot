import { OpenAI } from 'openai';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function test() {
    console.log("Testing current OpenAI API Key...");
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: "Test message" }],
        });
        console.log("Success! GPT-4 output:", response.choices[0].message.content);
    } catch (err) {
        console.error("OpenAI API Failure Error:");
        console.error("Status:", err.status);
        console.error("Code:", err.code);
        console.error("Message:", err.message);
        console.error("Type:", err.type);
    }
}

test();
