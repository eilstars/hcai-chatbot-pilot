import fs from 'fs';
import { pipeline } from '@xenova/transformers';
import { questions as originalQuestions } from './testQuestions.js';
import { semanticBank } from './semanticBank.js';

async function generateAndSaveEmbeddings() {
    console.log('Loading feature extraction model (this may take a minute on first run)...');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    const questionsWithEmbeddings = [...originalQuestions];

    console.log('Generating embeddings for original questions and semantic variations...');
    for (const question of questionsWithEmbeddings) {
        // Skip if this question is not in the list to process

        // Generate embedding for the main question text
        const mainOutput = await extractor(question.text, { pooling: 'mean', normalize: true });
        question.embedding = Array.from(mainOutput.data);

        // Find the bank of variations for this question
        const variations = semanticBank[question.id] || [];
        question.semanticEmbeddings = []; // Initialize the array to store variation embeddings

        console.log(`  - Processing ${variations.length} variations for question ${question.id}`);
        for (const variation of variations) {
            const variationOutput = await extractor(variation, { pooling: 'mean', normalize: true });
            question.semanticEmbeddings.push(Array.from(variationOutput.data));
        }
    }

    // We also need to export the answerKey for the test logic to work
    const answerKey = questionsWithEmbeddings.reduce((acc, q) => {
        acc[q.id] = q.answer;
        return acc;
    }, {});

    const fileContent = `export const questions = ${JSON.stringify(questionsWithEmbeddings, null, 2)};\n\nexport const answerKey = ${JSON.stringify(answerKey, null, 2)};`;

    fs.writeFileSync('./testQuestions.js', fileContent);
    console.log('Embeddings generated and saved to testQuestions.js successfully!');
}

generateAndSaveEmbeddings();

