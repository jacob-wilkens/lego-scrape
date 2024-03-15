import PromisePool from "@supercharge/promise-pool";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import { Browser } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { parseSetAvgPrice } from "../parsers/setAvgPrice";
import { LegoSet } from "../types";

const CSV_FILE = path.join(process.cwd(), "data/sets/sets.csv");
const PROCESSED_SETS_FILE = path.join(process.cwd(), "data/sets/processedSets.json");
const BASE_URL = "https://www.bricklink.com/v2/main.page";
const OUTPUT_CSV_FILE = path.join(process.cwd(), "data/sets/avg-set-price.csv");

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
    const miniFigs: LegoSet[] = lines.map((line) => {
      const [itemNumber, condition] = line.split(",");
      return { itemNumber, condition: condition as "U" | "N" };
    });

    console.log(`Processing ${miniFigs.length} sets`);

    // if the file does not exist, create it
    if (!fsSync.existsSync(PROCESSED_SETS_FILE)) {
      await fs.writeFile(PROCESSED_SETS_FILE, JSON.stringify({}));
    }

    let index = 0;

    browser = await puppet.launch();
    const page = await browser.newPage();

    const { results } = await PromisePool.withConcurrency(1)
      .handleError((error, i) => {
        let legoSet = i as LegoSet;
        console.error(`Failed to process ${legoSet.itemNumber}: ${error.message}`);
      })
      .for(miniFigs)
      .process(async (legoSet) => {
        const processedMiniFigs = await fs.readFile(PROCESSED_SETS_FILE, "utf-8");
        // json file with keys as item numbers and values as the avg price
        const processedMiniFigObj = JSON.parse(processedMiniFigs) as Record<string, string>;

        if (processedMiniFigObj[legoSet.itemNumber]) {
          console.log(`Already processed ${legoSet.itemNumber}`);
          return { ...legoSet, value: processedMiniFigObj[legoSet.itemNumber] };
        }

        await page.goto(BASE_URL);
        const value = await parseSetAvgPrice({ legoSet, page, index });
        index++;

        console.log(`Done with ${legoSet.itemNumber} and value ${value}`);
        console.log("Waiting 5 seconds");
        await new Promise((resolve) => setTimeout(resolve, 5000));

        await fs.writeFile(PROCESSED_SETS_FILE, JSON.stringify({ ...processedMiniFigObj, [legoSet.itemNumber]: value }));
        return { ...legoSet, value };
      });

    const headers = "Item Number,Condition,Value\n";
    const newCsv = headers + results.map((set) => `${set.itemNumber},${set.condition},${set.value ?? ""}`).join("\n");
    await fs.writeFile(OUTPUT_CSV_FILE, newCsv);

    console.log("Done processing sets");
  } catch (error) {
    console.error("Error processing sets figs:", error);
  } finally {
    if (browser) await browser.close();
  }
})();
