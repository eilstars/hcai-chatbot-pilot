import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Import all the route handlers
import usersRouter from './routes/users.js';
import testsRouter from './routes/tests.js';
import surveysRouter from './routes/surveys.js';
import chatRouter from './routes/chat.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// --- Database Connection ---
const mongoURI = process.env.MONGO_URI;

async function startServer() {
	try {
		if (!mongoURI) {
			throw new Error('Missing MongoDB connection string. Set MONGO_URI.');
		}

		await mongoose.connect(mongoURI);
		console.log('MongoDB successfully connected');

		// --- Server Listener ---
		const PORT = process.env.PORT || 5000;
		app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
	} catch (err) {
		console.error('MongoDB connection error:', err);
		process.exit(1);
	}
}

// --- API Routes ---
app.use('/api/users', usersRouter);
app.use('/api/tests', testsRouter);
app.use('/api/surveys', surveysRouter);
app.use('/api/chat', chatRouter);

if (process.env.NODE_ENV === 'production') {
	const clientBuildPath = path.resolve(__dirname, '../client/build');
	app.use(express.static(clientBuildPath));

	app.get(/^(?!\/api).*/, (_req, res) => {
		res.sendFile(path.join(clientBuildPath, 'index.html'));
	});
}

startServer();
