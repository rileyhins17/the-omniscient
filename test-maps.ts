import { chromium } from "playwright";

async function run() {
    const browser = await chromium.launch({ headless: false }); // watch it
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

    console.log("Waiting 3s for content to load...");
    await page.waitForTimeout(3000);

    const htmlListings = await page.locator("div[role='feed'] > div:has(div.fontHeadlineSmall)").evaluateAll((elements) => {
        return elements.map(el => {
            const titleEl = el.querySelector("div.fontHeadlineSmall");
            let webBtn = el.querySelector('a[data-value="Website"]');
            if (!webBtn) {
                webBtn = Array.from(el.querySelectorAll('a')).find(a => (a as HTMLElement).innerText && (a as HTMLElement).innerText.toLowerCase().includes("website")) || null;
            }
            return {
                businessName: titleEl ? titleEl.textContent?.trim() || "" : "",
                website: webBtn ? webBtn.getAttribute("href") || "" : "",
                // don't pull full html to keep it clean
                text: (el as HTMLElement).innerText,
            };
        });
    });

    console.log(`Found ${htmlListings.length} listings. First 3:`);
    console.log(JSON.stringify(htmlListings.slice(0, 3), null, 2));

    await browser.close();
}

run().catch(console.error);
