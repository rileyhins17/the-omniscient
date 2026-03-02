import { chromium } from "playwright";

async function run() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ locale: "en-CA" });
    const page = await context.newPage();

    console.log("Navigating to maps...");
    await page.goto(`https://www.google.com/maps/search/Med+Spa+in+Kitchener,+Ontario`);
    await page.waitForSelector("div[role='feed']", { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Get all listing links
    const links = await page.locator("div[role='feed'] > div:has(div.fontHeadlineSmall) a.hfpxzc").elementHandles();
    console.log(`Found ${links.length} organic listings.`);

    const results = [];

    // Test the first 2
    for (let i = 0; i < Math.min(2, links.length); i++) {
        console.log(`Clicking listing ${i + 1}...`);
        await links[i].click();

        // Wait for detail panel to slide in - usually has role="main" or aria-label="Information for..."
        await page.waitForTimeout(2000); // simple wait for animation and load

        // The website button in detail panel usually has data-item-id="authority" or contains "Website"
        const businessName = await page.locator("h1").first().innerText().catch(() => "Unknown");

        const websiteLink = await page.evaluate(() => {
            const btn = document.querySelector('a[data-item-id="authority"]');
            return btn ? btn.getAttribute("href") : null;
        });

        const phoneText = await page.evaluate(() => {
            // usually starts with "tel:" or contains a phone format
            const btn = document.querySelector('button[data-item-id*="phone:tel:"]');
            if (btn) return btn.getAttribute("data-item-id")?.replace("phone:tel:", "");

            // fallback
            const allBtns = Array.from(document.querySelectorAll('button[data-tooltip="Copy phone number"]'));
            if (allBtns.length > 0) return (allBtns[0] as HTMLElement).innerText;
            return null;
        });

        results.push({ businessName, websiteLink, phoneText });
        console.log(results[i]);
    }

    await browser.close();
}

run().catch(console.error);
