import { Request, Response } from "express";
import { ScraperService } from "../services/scraper.service";

const scraper = new ScraperService();

export class ScraperController {
  static async getListings(req: Request, res: Response) {
    try {
      await scraper.initialize();
      const results = await scraper.scrapeListings(req.query.search as string);
      res.json({ listings: results });
    } catch (error) {
      res.status(500).json({ error: "Scraping failed" });
    }
  }

  static async testSearch(req: Request, res: Response) {
    try {
      console.log("Starting Google search test for:", req.query.search);
      const results = await scraper.testGoogleSearch(
        req.query.search as string
      );
      console.log("Search test results:", results.length, "links found");
      res.json({ links: results });
      await scraper.closeBrowser();
    } catch (error) {
      await scraper.closeBrowser();
      console.error("Google test failed:", error);
      res.status(500).json({ error: "Google test failed" });
    }
  }

  static async testZillow(req: Request, res: Response) {
    try {
      console.log("Testing Zillow navigation");
      const screenshotPath = await scraper.testZillowNavigation();
      console.log("Screenshot saved:", screenshotPath);
      res.json({ success: true, screenshot: screenshotPath });
      await scraper.closeBrowser();
    } catch (error) {
      await scraper.closeBrowser();
      console.error("Zillow navigation test failed:", error);
      res.status(500).json({ error: "Zillow navigation test failed" });
    }
  }

  static async testWorkflow(req: Request, res: Response) {
    try {
      const { search, location } = req.query;
      console.log("Starting full workflow test for:", { search, location });

      const results = await scraper.testFullWorkflow(
        search as string,
        location as string
      );

      console.log("Workflow completed:", results);
      res.json(results);
    } catch (error) {
      console.error("Workflow test failed:", error);
      res.status(500).json({ error: "Workflow test failed" });
    }
  }
}
