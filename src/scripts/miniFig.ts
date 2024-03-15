import PromisePool from "@supercharge/promise-pool";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import { Browser } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { parseMiniFigAvgPrice } from "../parsers/miniFigAvgPrice";
import { MiniFig } from "../types";

const CSV_FILE = path.join(process.cwd(), "data/mini-figs/mini-figs.csv");
const PROCESSED_MINI_FIGS_FILE = path.join(process.cwd(), "data/mini-figs/processedMiniFigs.json");
const BASE_URL = "https://www.bricklink.com/v2/main.page";
const OUTPUT_CSV_FILE = path.join(process.cwd(), "data/mini-figs/avg-mini-fig-price.csv");

const puppet = puppeteer.use(StealthPlugin());

(async () => {
  if (!fsSync.existsSync(CSV_FILE)) {
    console.error(`File ${CSV_FILE} does not exist`);
    process.exit(1);
  }

  let browser: Browser | null = null;

  try {
    const csv = await fs.readFile(CSV_FILE);
    // filter out the header
    const lines = csv.toString().split("\n").slice(1);
    const miniFigs: MiniFig[] = lines.map((line) => {
      const [itemNumber, condition] = line.split(",");
      return { itemNumber, condition: condition as "U" | "N" };
    });

    console.log(`Processing ${miniFigs.length} mini figs`);

    // if the file does not exist, create it
    if (!fsSync.existsSync(PROCESSED_MINI_FIGS_FILE)) {
      await fs.writeFile(PROCESSED_MINI_FIGS_FILE, JSON.stringify({}));
    }

    let index = 0;
    browser = await puppet.launch();
    const page = await browser.newPage();

    const { results } = await PromisePool.for(miniFigs)
      .withConcurrency(1)
      .handleError((error, i) => {
        let miniFig = i as MiniFig;
        console.error(`Failed to process ${miniFig.itemNumber}: ${error.message}`);
      })
      .process(async (miniFig) => {
        const processedMiniFigs = await fs.readFile(PROCESSED_MINI_FIGS_FILE, "utf-8");
        // json file with keys as item numbers and values as the avg price
        const processedMiniFigObj = JSON.parse(processedMiniFigs) as Record<string, string>;

        if (processedMiniFigObj[miniFig.itemNumber]) {
          console.log(`Already processed ${miniFig.itemNumber}`);
          return { ...miniFig, value: processedMiniFigObj[miniFig.itemNumber] };
        }

        await page.goto(BASE_URL);
        const value = await parseMiniFigAvgPrice({ miniFig, page, index });
        index++;

        console.log(`Done with ${miniFig.itemNumber} and value ${value}`);
        console.log("Waiting 5 seconds before next mini fig");
        await new Promise((resolve) => setTimeout(resolve, 5000));

        await fs.writeFile(PROCESSED_MINI_FIGS_FILE, JSON.stringify({ ...processedMiniFigObj, [miniFig.itemNumber]: value }));
        return { ...miniFig, value };
      });

    const headers = "Item Number,Condition,Value\n";
    const newCsv = headers + results.map((fig) => `${fig.itemNumber},${fig.condition},${fig.value ?? ""}`).join("\n");
    await fs.writeFile(OUTPUT_CSV_FILE, newCsv);

    console.log("Done processing mini figs");
  } catch (error) {
    console.error("Error processing mini figs:", error);
  } finally {
    if (browser) await browser.close();
  }
})();
