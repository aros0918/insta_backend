const path = require('path');
const { downloadFile, delay } = require('./utils');

const USER_AGENT =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const VIEWPORT = {
    width: 430,
    height: 932,
    deviceScaleFactor: 1,
};

const collectReelUrls = async (page, targetUsername, maxReels) => {
    console.log('Navigating to target profile reels section...');
    await page.goto(`https://www.instagram.com/${targetUsername}/reels/`, { waitUntil: 'networkidle0' });

    await delay(5000);
    await page.screenshot({ path: 'profile_reels_section.png', fullPage: true });

    const selectors = [
        'article',
        'div[role="presentation"]',
        'a[href*="/reel/"]',
        'div[data-visualcompletion="media-vc-image"]',
    ];
    let reelElement = null;

    for (const selector of selectors) {
        console.log(`Trying selector: ${selector}`);
        reelElement = await page.$(selector);
        if (reelElement) {
            console.log(`Found reels using selector: ${selector}`);
            break;
        } else {
            console.log(`Selector ${selector} didn't work`);
        }
    }

    if (!reelElement) {
        console.log(
            'No reels found on the page. The account might not have any reels or the page structure has changed.'
        );
        await page.close();
        return [];
    }

    let reelUrls = new Set();
    let previousHeight;

    console.log('Starting to collect reel URLs...');
    while (reelUrls.size < maxReels) {
        const newReels = await page.evaluate((selectors) => {
            return Array.from(document.querySelectorAll(selectors.join(', ')))
                .map((el) => el.href || el.querySelector('a')?.href)
                .filter((url) => url && url.includes('/reel/'));
        }, selectors);

        newReels.forEach((reel) => reelUrls.add(reel));

        previousHeight = await page.evaluate('document.body.scrollHeight');
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await delay(2000);
        const currentHeight = await page.evaluate('document.body.scrollHeight');

        console.log(`Collected ${reelUrls.size} reel URLs so far...`);

        if (currentHeight === previousHeight || reelUrls.size >= maxReels) {
            console.log('Reached the end of the profile page or collected enough reels.');
            break;
        }
    }

    reelUrls = Array.from(reelUrls).slice(0, maxReels);
    console.log(`Collected a total of ${reelUrls.length} reel URLs.`);
    await page.screenshot({ path: 'collected_reel_urls.png', fullPage: true });

    return reelUrls;
};

const downloadReels = async (browser, reelUrls) => {
    const downloadedReels = [];
    for (const reelUrl of reelUrls) {
        console.log(`Processing reel URL: ${reelUrl}`);
        try {
            const newPage = await browser.newPage();
            await newPage.setUserAgent(USER_AGENT);
            await newPage.setViewport(VIEWPORT);

            await newPage.goto(reelUrl, { waitUntil: 'networkidle0' });
            await delay(5000);

            const videoUrl = await newPage.evaluate(async () => {
                const [videoElement] = document.querySelectorAll('video');
                if (videoElement && videoElement.src) {
                    if (videoElement.src.startsWith('blob:')) {
                        try {
                            const response = await fetch(videoElement.src);
                            const blob = await response.blob();
                            return URL.createObjectURL(blob);
                        } catch (error) {
                            console.log(error);
                            return null;
                        }
                    }
                    return videoElement.src;
                }
                return null;
            });

            if (videoUrl) {
                console.log(`Downloading video from URL: ${videoUrl}`);
                const filePath = path.resolve(__dirname, 'downloads', `${path.basename(reelUrl)}.mp4`);

                // For blob URLs, we need to download the content directly in the browser
                if (videoUrl.startsWith('blob:')) {
                    await newPage.evaluate(
                        async (url, filePath) => {
                            const response = await fetch(url);
                            const blob = await response.blob();
                            const arrayBuffer = await blob.arrayBuffer();
                            const uint8Array = new Uint8Array(arrayBuffer);

                            // Send the data to the server
                            await fetch('/save-video', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/octet-stream',
                                },
                                body: uint8Array,
                            });
                        },
                        videoUrl,
                        filePath
                    );

                    console.log(`Downloaded reel and saved to: ${filePath}`);
                    downloadedReels.push(filePath);
                } else {
                    await downloadFile(videoUrl, filePath);
                    downloadedReels.push(filePath);
                    console.log(`Downloaded reel and saved to: ${filePath}`);
                }
            } else {
                console.log('Failed to find video URL. Skipping...');
            }

            await newPage.close();
        } catch (error) {
            console.error(`Failed to process reel URL: ${reelUrl}`, error);
        }
    }
    return downloadedReels;
};

async function downloadInstagram(browser, targetUsername, maxReels, reelUrl) {
    const page = await browser.newPage();

    await page.setUserAgent(USER_AGENT);
    await page.setViewport(VIEWPORT);

    let downloadedReels = [];
    let urls = [];
    if (reelUrl) {
        urls = [reelUrl];
    } else {
        urls = await collectReelUrls(page, targetUsername, maxReels);
    }

    downloadedReels = await downloadReels(browser, urls);

    await page.close();
    return downloadedReels;
}

module.exports = { downloadInstagram };
