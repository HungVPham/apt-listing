import express from 'express';
import scraperRoute from './routes/scraper.route';

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api', scraperRoute);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});