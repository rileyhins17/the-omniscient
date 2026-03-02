import { chromium } from "playwright";
import fs from "fs";

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: "en-CA" });
    const page = await context.newPage();

    const query = `Med Spa in Kitchener, Ontario`;
    console.log(`Navigating to google maps for: ${query}`);
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`);

    try {
        await page.waitForSelector("div[role='feed']", { timeout: 15000 });
        console.log("Feed container found!");
    } catch (e) {
        console.error("Maps results timed out. No targets found.");
        await browser.close();
        return;
    }

    await page.waitForTimeout(3000);

    const htmlListings = await page.locator("div[role='feed'] > div:has(div.fontHeadlineSmall)").evaluateAll((elements) => {
        return elements.map(el => el.innerHTML);
    });

    const organic = htmlListings.filter(html => !html.includes("Sponsored"));
    console.log(`Found ${htmlListings.length} total, ${organic.length} organic. Saving first organic to map-html.txt`);
    fs.writeFileSync("map-html.txt", organic[0] || htmlListings[0]);

    await browser.close();
}

run().catch(console.error);
