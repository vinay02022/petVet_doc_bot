import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the BACKEND directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('Environment loaded. API Key status:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');