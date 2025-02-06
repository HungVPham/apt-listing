import * as puppeteer from "puppeteer";

declare global {
  interface Window {
    chrome: {
      runtime: any;
      [key: string]: any;
    };
  }
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

    this.page = (await this.browser.pages())[0];

    // Move stealth configurations before navigation
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

    // Set viewport and headers before navigation
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

  async testGoogleSearch(query: string): Promise<string[]> {
    if (!this.browser || !this.page) {
      await this.initialize();
    }

    try {
      await this.page!.goto("https://www.google.com", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await this.performGoogleSearch(this.page!, query);

      // Handle "See results closer to you" popup
      try {
        const notNowButton = await this.page!.waitForSelector(
          'button:has-text("Not now"), div[role="dialog"] button:last-child',
          { timeout: 8000 }
        );
        if (notNowButton) {
          await notNowButton.click();
          await this.page!.waitForNetworkIdle({ timeout: 5000 });
        }
      } catch (error) {
        // Additional debug info
        console.log("No popup found or error closing it:", error);
      }

      await this.page!.waitForSelector("#search", { timeout: 10000 });
      await this.page!.screenshot({ path: "debug_screenshots/debug-search-results.png" });

      // Updated selector to find Zillow links in search results
      const links = await this.page!.$$eval(
        '#search a[href*="zillow"], a[href*="zillow.com"]',
        (anchors) => {
          // Filter and normalize links
          const uniqueLinks = new Set<string>();
          anchors.forEach((a) => {
            try {
              const url = new URL(a.href);
              // Clean URL parameters and handle redirects
              if (url.hostname.includes("zillow")) {
                url.search = "";
                uniqueLinks.add(url.href);
              }
            } catch (e) {
              // Ignore invalid URLs
            }
          });
          return Array.from(uniqueLinks);
        }
      );

      if (links.length === 0) {
        // Debugging: Save current page state
        await this.page!.screenshot({ path: "debug_screenshots/debug-no-zillow-links.png" });
        const html = await this.page!.content();
        require("fs").writeFileSync("debug-page.html", html);

        // Try alternative search method
        const fallbackLinks = await this.page!.$$eval(
          'a[href*="zillow"]',
          (anchors) => anchors.map((a) => a.href)
        );

        if (fallbackLinks.length > 0) {
          links.push(...fallbackLinks);
        }
      }

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

      console.log("Pressing mouse button...");
      await this.page!.mouse.down();

      // Hold for full 10 seconds
      console.log("Holding for 10 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 10000));

      console.log("Releasing mouse button...");
      await this.page!.mouse.up();

      // Wait for captcha to be solved: check that both the main captcha element
      // and any iframe challenge are gone.
      console.log("Waiting for captcha to be solved...");
      await this.page!.waitForFunction(
        () =>
          !document.querySelector("#px-captcha") &&
          !document.querySelector('iframe[title*="challenge"]'),
        { timeout: 15000 }
      );
      console.log("Captcha appears to be solved.");
      // Additional delay to ensure page state is updated after bypassing captcha
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
        const searchBox = await this.page!.waitForSelector(
          'input[placeholder="Enter an address, neighborhood, city, or ZIP code"]'
        );
        if (searchBox) {
          const box = await searchBox.boundingBox();
          if (box) {
            // Move mouse naturally to the search box
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

        const typoLocation = location.slice(0, -2) + "alw"; // Simulate a typo
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

        // Delete the typo characters to simulate correction
        for (let i = 0; i < 3; i++) {
          await this.page!.keyboard.press("Backspace");
          await new Promise((resolve) => setTimeout(resolve, 100 + i * 100));
        }

        // Type the correct ending characters
        for (const char of location.slice(-2)) {
          await this.page!.keyboard.type(char, {
            delay: 150 + Math.floor(Math.random() * 200),
          });
          await new Promise((resolve) =>
            setTimeout(resolve, 100 + Math.random() * 100)
          );
        }

        // Random pause before confirming with Enter
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 + Math.random() * 1000)
        );
        await this.page!.keyboard.press("Enter");

        // After Enter press, update the popup/captcha handling:
        try {
          console.log("Waiting for either popup or captcha...");

          // Take initial screenshot
          await this.page!.screenshot({ path: "debug_screenshots/initial-state.png" });

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
              this.page!.waitForSelector(
                'article[class*="StyledPropertyCard"]',
                {
                  visible: true,
                  timeout: 10000,
                }
              ),
            ]);

            // Wait for network to settle
            await this.page!.waitForNetworkIdle({
              idleTime: 1000,
              timeout: 10000,
            }).catch(() =>
              console.log("Network didn't fully settle, continuing anyway")
            );

            // Add a small delay to ensure everything is loaded
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else if (element.type === "captcha") {
            console.log("Found captcha, attempting to solve...");
            await this.bypassCaptcha();
          }
        } catch (error) {
          console.log("Challenge detection failed:", error);
          await this.page!.screenshot({
            path: "debug_screenshots/challenge-detection-failed.png",
          });
        }

        console.log("Starting extraction of all listings across pages...");
        const allListings: ListingData[] = [];
        let currentPage = 1;

        while (true) {
          console.log(`Processing page ${currentPage}`);

          // Scroll to load all listing elements on the current page
          let previousCount = 0;
          let currentCount = await this.page!.evaluate(() =>
            document.querySelectorAll('ul[class*="List"] > li[class*="ListItem"]').length
          );
          let scrollAttempts = 0;
          const maxScrollAttempts = 10;

          while (previousCount !== currentCount && scrollAttempts < maxScrollAttempts) {
            previousCount = currentCount;
            await this.page!.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await new Promise((resolve) => setTimeout(resolve, 2000));
            currentCount = await this.page!.evaluate(() =>
              document.querySelectorAll('ul[class*="List"] > li[class*="ListItem"]').length
            );
            console.log(`Scrolling: found ${currentCount} listings...`);
            scrollAttempts++;
          }

          // Scroll back to top for consistent extraction
          await this.page!.evaluate(() => window.scrollTo(0, 0));
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Extract listing cards on the current page
          const cards = await this.page!.$$('ul[class*="List"] > li[class*="ListItem"]');
          console.log(`Found ${cards.length} cards on page ${currentPage}`);

          for (const card of cards) {
            // Filter out ads and only extract valid property cards.
            const isAd = await card.$('[class*="AdCard"]');
            const isPropertyCard = await card.$('article[class*="StyledPropertyCard"]');

            if (!isAd && isPropertyCard) {
              // Scroll card into view to simulate human behavior
              await card.evaluate((element) => {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
              });
              await new Promise((resolve) => setTimeout(resolve, 100));

              // Extract listing data
              const listing = await card.evaluate((element) => {
                const addressElement = element.querySelector('address[data-test="property-card-addr"]');
                const priceElement = element.querySelector('span[data-test="property-card-price"]');
                const detailsList = element.querySelector('ul[class*="StyledPropertyCardHomeDetailsList"]');
                const details = Array.from(detailsList?.querySelectorAll("li") || []);
                const bedElement = details.find((li) => li.textContent?.includes("bds"));
                const bathElement = details.find((li) => li.textContent?.includes("ba"));
                const sqftElement = details.find((li) => li.textContent?.includes("sqft"));
                return {
                  address: addressElement?.textContent?.trim() || "Address not found",
                  price: priceElement?.textContent?.trim() || "Price not found",
                  beds: bedElement?.querySelector("b")?.textContent?.trim() || "Beds not found",
                  baths: bathElement?.querySelector("b")?.textContent?.trim() || "Baths not found",
                  sqft: sqftElement?.querySelector("b")?.textContent?.trim() || "Sqft not found",
                };
              });
              allListings.push(listing);
            }
          }

          // Check if there is a next page button
          const nextPageButton = await this.page!.$('a[rel="next"]:not([aria-disabled="true"]), button[aria-label*="Next"], a[aria-label*="Next"]');
          if (nextPageButton) {
            console.log("Found next page button. Navigating to the next page...");
            try {
              await Promise.all([
                nextPageButton.click(),
                this.page!.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
              ]);
              currentPage++;
            } catch (error) {
              console.log("Error navigating to next page, ending extraction:", error);
              break;
            }
          } else {
            console.log("No next page button found. Ending pagination loop.");
            break;
          }
        }

        // Deduplicate listings by address to avoid duplicates
        const uniqueListings = allListings.filter(
          (listing, index, self) =>
            index === self.findIndex((l) => l.address === listing.address)
        );

        return uniqueListings;
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
