const puppeteer = require('puppeteer');

async function launchBrowser() {
    const browser = await puppeteer.launch({ headless: true });
    return browser;
}

module.exports = { launchBrowser };
