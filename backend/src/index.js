import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pdfRouter from './routes/pdf.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ message: 'PDF Generator API', status: 'running', version: '1.0.0' });
});

app.use('/api/pdf', pdfRouter);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});