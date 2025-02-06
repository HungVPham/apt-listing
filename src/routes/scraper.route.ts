import express from 'express';
import { ScraperController } from '../controllers/scraper.controller';

const router = express.Router();

router.get('/scrape', ScraperController.getListings);
router.get('/test-search', ScraperController.testSearch);
router.get('/test-zillow', ScraperController.testZillow);
router.get('/test-workflow', ScraperController.testWorkflow);

export default router;