import { chromium } from "playwright";

async function run() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ locale: "en-CA" });
    const page = await context.newPage();

    console.log("Navigating to maps search...");
    await page.goto(`https://www.google.com/maps/search/Med+Spa+in+Kitchener,+Ontario`);
    await page.waitForSelector("div[role='feed']", { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 1. Get all place URLs
    const places = await page.locator("a.hfpxzc").evaluateAll(anchors =>
        anchors.map(a => ({
            name: a.getAttribute("aria-label") || "",
            url: a.getAttribute("href") || ""
        })).filter(p => p.url && !p.url.includes("/search/"))
    );

    console.log(`Found ${places.length} place URLs. Extracting first 3 directly...`);

    // 2. Extract directly in parallel
    const urlsToScrape = places.slice(0, 3);

    const results = await Promise.all(urlsToScrape.map(async (place) => {
        const p = await context.newPage();
        try {
            await p.goto(place.url, { waitUntil: "domcontentloaded", timeout: 10000 });

            // Wait for main block
            await p.waitForSelector('h1', { timeout: 8000 });

            // Evaluate
            const data = await p.evaluate(() => {
                const title = document.querySelector("h1")?.innerText || "";

                // Website
                const webBtn = document.querySelector('a[data-item-id="authority"]');
                const website = webBtn ? webBtn.getAttribute("href") : null;

                // Phone
                const phoneBtn = document.querySelector('button[data-item-id*="phone:tel:"]');
                let phone = null;
                if (phoneBtn) {
                    phone = phoneBtn.getAttribute("data-item-id")?.replace("phone:tel:", "");
                } else {
                    const allBtns = Array.from(document.querySelectorAll('button[data-tooltip="Copy phone number"]'));
                    if (allBtns.length > 0) phone = (allBtns[0] as HTMLElement).innerText;
                }

                // Address
                const addBtn = document.querySelector('button[data-item-id="address"]');
                const address = addBtn ? document.querySelector('button[data-item-id="address"]')?.getAttribute("aria-label")?.replace("Address: ", "") : null;

                // Category
                const catBtn = document.querySelector('button[jsaction="pane.rating.category"]');
                const category = catBtn ? (catBtn as HTMLElement).innerText : null;

                // Rating
                const ratingDiv = document.querySelector('div[jsaction="pane.rating.moreReviews"]');
                const ratingText = ratingDiv ? ratingDiv.getAttribute("aria-label") : null; // e.g. "4.9 stars 45 Reviews"

                return { title, website, phone, address, category, ratingText };
            });

            await p.close();
            return { ...place, extracted: data };
        } catch (e) {
            await p.close();
            return { ...place, error: "Failed to load" };
        }
    }));

    console.log(JSON.stringify(results, null, 2));
    await browser.close();
}

run().catch(console.error);
