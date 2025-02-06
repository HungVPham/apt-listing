import * as puppeteer from "puppeteer";

declare global {
  interface Window {
    chrome: {
      runtime: any;
      [key: string]: any;
    };
  }
}

interface Listing {
  price: string;
  address: string;
  beds: number;
  baths: number;
  sqft: number;
  details: string;
  url: string;
}

interface ListingData {
  address: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
}

export class ScraperService {
  private browser: puppeteer.Browser | null = null;
  private page: puppeteer.Page | null = null;

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-blink-features=AutomationControlled",
        `--window-size=${1280 + Math.floor(Math.random() * 100)},${
          720 + Math.floor(Math.random() * 100)
        }`,
        "--start-maximized",
        "--disable-notifications",
        "--disable-geolocation",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ],
    });

    this.page = await this.browser.newPage();

    // Additional stealth configurations
    await this.page.evaluateOnNewDocument(() => {
      // Overwrite navigator properties
      Object.defineProperties(navigator, {
        webdriver: { get: () => undefined },
        languages: { get: () => ["en-US", "en"] },
        plugins: { get: () => [1, 2, 3, 4, 5] }, // Fake plugins length
        platform: { get: () => "Win32" },
      });

      // Overwrite permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any): Promise<any> =>
        parameters.name === "notifications" ||
        parameters.name === "clipboard-write"
          ? Promise.resolve({ state: "prompt", onchange: null })
          : originalQuery(parameters);

      // Add Chrome-specific properties
      window.chrome = {
        runtime: {},
        app: {},
        csi: () => {},
        loadTimes: () => {},
        webstore: {},
      };

      // Add language properties
      Object.defineProperty(navigator, "language", {
        get: function () {
          return "en-US";
        },
      });

      // Add webGL properties
      HTMLCanvasElement.prototype.toDataURL = function () {
        return "data:image/png;base64,";
      };
    });

    // Set more realistic viewport and headers
    await this.page.setViewport({
      width: 1280 + Math.floor(Math.random() * 100),
      height: 720 + Math.floor(Math.random() * 100),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false,
    });

    await this.page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "sec-ch-ua":
        '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
    });

    // Add mouse movement simulation
    await this.simulateHumanMouseMovement();
  }

  private async simulateHumanMouseMovement() {
    const moveCount = 3 + Math.floor(Math.random() * 4); // 3-6 movements
    for (let i = 0; i < moveCount; i++) {
      const x = Math.floor(Math.random() * 1280);
      const y = Math.floor(Math.random() * 720);
      await this.page!.mouse.move(x, y, {
        steps: 25 + Math.floor(Math.random() * 25),
      });
      await new Promise((resolve) =>
        setTimeout(resolve, 200 + Math.random() * 400)
      );
    }
  }

  async scrapeListings(searchQuery: string): Promise<Listing[]> {
    if (!this.browser) throw new Error("Browser not initialized");

    const page = await this.browser.newPage();
    await page.goto("https://www.google.com");

    // Step 1: Perform Google search
    await this.performGoogleSearch(page, searchQuery);

    // Step 2: Navigate to Zillow
    await this.navigateToZillow(page);

    // Step 3-7: Scrape listings with pagination
    const listings = await this.scrapeZillowListings(page);

    await page.close();
    return listings;
  }

  private async performGoogleSearch(page: puppeteer.Page, query: string) {
    // Add random delays between keystrokes
    for (const char of query) {
      await page.type('textarea[name="q"]', char, {
        delay: 100 + Math.floor(Math.random() * 200),
      });
      await new Promise((resolve) =>
        setTimeout(resolve, 10 + Math.random() * 50)
      );
    }

    // Random pause before pressing enter
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 1000)
    );

    // Move mouse to search button with random trajectory
    const searchButton = await page.$('input[name="btnK"]');
    if (searchButton) {
      const box = await searchButton.boundingBox();
      if (box) {
        await page.mouse.move(
          box.x + box.width / 2 + (Math.random() * 10 - 5),
          box.y + box.height / 2 + (Math.random() * 10 - 5),
          { steps: 20 }
        );
      }
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.keyboard.press("Enter"),
    ]);

    // Random scroll after results load
    await page.evaluate(() => {
      window.scrollTo({
        top: Math.random() * 500,
        behavior: "smooth",
      });
    });
  }

  private async navigateToZillow(page: puppeteer.Page) {
    const zillowLink = await page.waitForSelector('a[href*="zillow.com"]');
    await Promise.all([page.waitForNavigation(), zillowLink?.click()]);
  }

  private async scrapeZillowListings(page: puppeteer.Page): Promise<Listing[]> {
    const listings: Listing[] = [];

    while (true) {
      // Scroll to load all listings
      await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // After scrolling and before extraction, add wait for content
      await page.waitForFunction(
        () => {
          const cards = document.querySelectorAll(
            'ul[class*="List"] > li[class*="ListItem"]'
          );
          const visibleCards = Array.from(cards).filter((card) => {
            const rect = card.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
          });
          return visibleCards.length > 0;
        },
        { timeout: 10000 }
      );

      // Extract listing data
      const currentPageListings = await page.$$eval(".list-card", (cards) =>
        cards.map((card) => ({
          price:
            card.querySelector(".list-card-price")?.textContent?.trim() || "",
          address:
            card.querySelector(".list-card-addr")?.textContent?.trim() || "",
          beds: parseInt(
            card.querySelector(".list-card-details li:nth-child(1)")
              ?.textContent || "0"
          ),
          baths: parseInt(
            card.querySelector(".list-card-details li:nth-child(2)")
              ?.textContent || "0"
          ),
          sqft: parseInt(
            card
              .querySelector(".list-card-details li:nth-child(3)")
              ?.textContent?.replace(/,/g, "") || "0"
          ),
          details: "",
          url: card.querySelector("a")?.href || "",
        }))
      );

      // Get child page details
      for (const listing of currentPageListings) {
        const detailPage = await this.browser!.newPage();
        await detailPage.goto(listing.url);
        listing.details = await detailPage.$eval(
          ".ds-container",
          (el) => el.textContent?.trim() || ""
        );
        await detailPage.close();
      }

      listings.push(...currentPageListings);

      // Check for next page
      const nextButton = await page.$('a[rel="next"]');
      if (!nextButton) break;

      await Promise.all([page.waitForNavigation(), nextButton.click()]);
    }

    return listings;
  }

  async testGoogleSearch(query: string): Promise<string[]> {
    if (!this.browser || !this.page) {
      await this.initialize();
    }

    try {
      await this.page!.goto("https://www.google.com", {
        waitUntil: "networkidle2",
      });

      await this.performGoogleSearch(this.page!, query);

      // Handle "See results closer to you" popup
      try {
        const notNowButton = await this.page!.waitForSelector(
          'button:has-text("Not now")',
          { timeout: 5000 }
        );
        if (notNowButton) {
          await notNowButton.click();
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        // Popup not found, continue
      }

      await this.page!.waitForSelector("#search", { timeout: 10000 });
      await this.page!.screenshot({ path: "debug-search-results.png" });

      // Updated selector to find Zillow links in search results
      const links = await this.page!.$$eval(
        '#search a[href*="zillow.com"]',
        (anchors) => anchors.map((a) => a.href)
      );

      return links;
    } finally {
      await this.page!.goto("about:blank");
    }
  }

  private async bypassCaptcha() {
    try {
      console.log("Starting captcha bypass...");

      // Wait for the captcha element to be properly loaded
      await this.page!.waitForSelector("#px-captcha", {
        visible: true,
        timeout: 10000,
      });

      // Get exact button position
      const button = await this.page!.$("#px-captcha");
      const buttonBox = await button!.boundingBox();

      if (!buttonBox) {
        throw new Error("Could not get captcha button position");
      }

      console.log("Found captcha button at:", buttonBox);

      // Move to center of button
      const centerX = buttonBox.x + buttonBox.width / 2;
      const centerY = buttonBox.y + buttonBox.height / 2;

      // Slow, natural mouse movement
      await this.page!.mouse.move(centerX, centerY, {
        steps: 50,
      });

      // Small delay before pressing
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("Pressing mouse button...");
      await this.page!.mouse.down();

      // Hold for full 10 seconds
      console.log("Holding for 10 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 10000));

      console.log("Releasing mouse button...");
      await this.page!.mouse.up();

      // Wait to see if verification completes
      console.log("Waiting for verification...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error("Captcha bypass failed:", error);
      throw error; // Re-throw to handle in calling function
    }
  }

  async testZillowNavigation(location?: string): Promise<ListingData[]> {
    if (!this.browser || !this.page) {
      await this.initialize();
    }

    try {
      if (location) {
        // Add random mouse movements before typing
        const searchBox = await this.page!.waitForSelector(
          'input[placeholder="Enter an address, neighborhood, city, or ZIP code"]'
        );

        if (searchBox) {
          const box = await searchBox.boundingBox();
          if (box) {
            // Move mouse naturally to search box
            await this.page!.mouse.move(
              box.x + box.width / 2 + (Math.random() * 10 - 5),
              box.y + box.height / 2 + (Math.random() * 10 - 5),
              { steps: 25 }
            );
            await this.page!.mouse.click(
              box.x + box.width / 2,
              box.y + box.height / 2
            );
          }
        }

        // Type with human-like delays and intentional typos
        const typoLocation = location.slice(0, -2) + "alw"; // Add typo at end
        for (const char of typoLocation) {
          await this.page!.keyboard.type(char, {
            delay: 100 + Math.floor(Math.random() * 200),
          });
          await new Promise((resolve) =>
            setTimeout(resolve, 50 + Math.random() * 100)
          );
        }

        // Pause like a human noticing the error
        await new Promise((resolve) =>
          setTimeout(resolve, 800 + Math.random() * 400)
        );

        // Delete the typo
        await this.page!.keyboard.press("Backspace");
        await new Promise((resolve) => setTimeout(resolve, 100));
        await this.page!.keyboard.press("Backspace");
        await new Promise((resolve) => setTimeout(resolve, 200));
        await this.page!.keyboard.press("Backspace");
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Type the correct ending
        for (const char of location.slice(-2)) {
          await this.page!.keyboard.type(char, {
            delay: 150 + Math.floor(Math.random() * 200),
          });
          await new Promise((resolve) =>
            setTimeout(resolve, 100 + Math.random() * 100)
          );
        }

        // Random pause before pressing Enter
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 + Math.random() * 1000)
        );
        await this.page!.keyboard.press("Enter");

        // After Enter press, update the popup/captcha handling:
        try {
          console.log("Waiting for either popup or captcha...");

          // Take initial screenshot
          await this.page!.screenshot({ path: "initial-state.png" });

          // Wait for either element to appear
          const element = await Promise.race([
            // Popup detection
            this.page!.waitForSelector(
              'button[class*="StyledTextButton-c11n-8-106-0__sc-1nwmfqo-0 kmALMr"]',
              { timeout: 5000, visible: true }
            ).then((button) => ({ type: "popup", element: button })),

            // Captcha detection - try multiple selectors
            Promise.any([
              this.page!.waitForSelector("#px-captcha", { timeout: 5000 }),
              this.page!.waitForSelector('iframe[title*="challenge"]', {
                timeout: 5000,
              }),
              this.page!.waitForSelector('[class*="captcha"]', {
                timeout: 5000,
              }),
            ]).then((button) => ({ type: "captcha", element: button })),
          ]);

          if (element.type === "popup") {
            console.log("Found popup, attempting to skip...");
            
            // Click the skip button without waiting for navigation
            await this.page!.evaluate(() => {
              const skipButton = document.querySelector(
                'button[class*="StyledTextButton-c11n-8-106-0__sc-1nwmfqo-0 kmALMr"]'
              ) as HTMLElement;
              if (skipButton) skipButton.click();
            });

            // Wait for popup to disappear and content to appear
            await Promise.race([
              // Wait for popup to disappear
              this.page!.waitForFunction(
                () => !document.querySelector('[class*="StyledTextButton"]'),
                { timeout: 10000 }
              ),
              // Wait for content to appear
              this.page!.waitForSelector('article[class*="StyledPropertyCard"]', {
                visible: true,
                timeout: 10000
              })
            ]);

            // Wait for network to settle
            await this.page!.waitForNetworkIdle({ 
              idleTime: 1000, 
              timeout: 10000 
            }).catch(() => console.log("Network didn't fully settle, continuing anyway"));

            // Add a small delay to ensure everything is loaded
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else if (element.type === "captcha") {
            console.log("Found captcha, attempting to solve...");
            await this.bypassCaptcha();
          }
        } catch (error) {
          console.log("Challenge detection failed:", error);
          await this.page!.screenshot({
            path: "challenge-detection-failed.png",
          });
        }

        // Before extracting data, add scrolling logic
        console.log("Scrolling to load all listings...");

        // First, get initial listing count
        const initialCount = await this.page!.evaluate(
          () =>
            document.querySelectorAll(
              'ul[class*="List"] > li[class*="ListItem"]'
            ).length
        );

        // Scroll until no new listings are loaded
        let previousCount = 0;
        let currentCount = initialCount;
        while (previousCount !== currentCount) {
          previousCount = currentCount;

          // Scroll in chunks
          await this.page!.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });

          // Wait for potential new content
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Check new count
          currentCount = await this.page!.evaluate(
            () =>
              document.querySelectorAll(
                'ul[class*="List"] > li[class*="ListItem"]'
              ).length
          );

          console.log(`Scrolling: found ${currentCount} listings...`);
        }

        // Scroll back to top
        await this.page!.evaluate(() => {
          window.scrollTo(0, 0);
        });

        // Wait for everything to settle
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // After scrolling, proceed directly to extraction
        console.log("Starting extraction of all listings...");

        // Get all listing cards first
        const listingCards = await this.page!.$$(
          'ul[class*="List"] > li[class*="ListItem"]'
        );
        console.log(`Found ${listingCards.length} total cards`);

        // Process each card
        const listingData = [];
        for (const card of listingCards) {
          // Check if it's a valid property card (not an ad)
          const isAd = await card.$('[class*="AdCard"]');
          const isPropertyCard = await card.$(
            'article[class*="StyledPropertyCard"]'
          );

          if (!isAd && isPropertyCard) {
            // Scroll card into view
            await card.evaluate((element) => {
              element.scrollIntoView({ behavior: "smooth", block: "center" });
            });
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Extract data from the card
            const listing = await card.evaluate((element) => {
              const addressElement = element.querySelector(
                'address[data-test="property-card-addr"]'
              );
              const priceElement = element.querySelector(
                'span[data-test="property-card-price"]'
              );
              const detailsList = element.querySelector(
                'ul[class*="StyledPropertyCardHomeDetailsList"]'
              );
              const details = Array.from(
                detailsList?.querySelectorAll("li") || []
              );

              const bedElement = details.find((li) =>
                li.textContent?.includes("bds")
              );
              const bathElement = details.find((li) =>
                li.textContent?.includes("ba")
              );
              const sqftElement = details.find((li) =>
                li.textContent?.includes("sqft")
              );

              return {
                address:
                  addressElement?.textContent?.trim() || "Address not found",
                price: priceElement?.textContent?.trim() || "Price not found",
                beds:
                  bedElement?.querySelector("b")?.textContent?.trim() ||
                  "Beds not found",
                baths:
                  bathElement?.querySelector("b")?.textContent?.trim() ||
                  "Baths not found",
                sqft:
                  sqftElement?.querySelector("b")?.textContent?.trim() ||
                  "Sqft not found",
              };
            });

            listingData.push(listing);
          }
        }

        console.log(`Extracted ${listingData.length} listings`);
        return listingData;
      }
      return [
        {
          address: "No location provided",
          price: "N/A",
          beds: "N/A",
          baths: "N/A",
          sqft: "N/A",
        },
      ];
    } catch (error) {
      console.error("Error in testZillowNavigation:", error);
      throw error;
    } finally {
      await this.page!.goto("about:blank");
    }
  }

  async testFullWorkflow(
    query: string,
    location: string
  ): Promise<{
    googleLinks: string[];
    listingData: ListingData[];
  }> {
    try {
      const googleLinks = await this.testGoogleSearch(query);
      if (googleLinks.length === 0) {
        throw new Error("No Zillow links found in Google search");
      }

      await this.page!.goto(googleLinks[0], {
        waitUntil: "networkidle2",
      });

      const listingData = await this.testZillowNavigation(location);

      return {
        googleLinks,
        listingData,
      };
    } finally {
      await this.closeBrowser();
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
