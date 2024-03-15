import { Page } from "puppeteer";
import { LegoSet } from "../types";

type Params = {
  legoSet: LegoSet;
  page: Page;
  index: number;
};

export async function parseSetAvgPrice({ legoSet: { condition, itemNumber }, page, index }: Params): Promise<string> {
  let avgPrice = "";

  try {
    page.setDefaultTimeout(5000);

    if (index === 0) {
      // click on button that has text Just Necessary
      const btn = await page.waitForSelector("xpath/" + "//div[@id='js-btn-section']//button[contains(text(),'Just necessary')]", {});
      await btn?.click();
    }

    // search for the item number
    const ele = await page.waitForSelector("xpath/" + "//input[@name='nav-search']");
    await ele?.type(itemNumber, { delay: 100 });
    await page.keyboard.press("Enter");

    // click on tab with set
    const setTab = await page.waitForSelector("xpath/" + "//table[@id='_idTabMenu']/tbody/tr/td[contains(text(),'Set')]");
    await setTab?.click();

    const item = await page.waitForSelector("xpath/" + "(//div[@id='_idItemTableForS']/table/tbody/tr)[2]/td[@class='pspItemClick']/a");
    await item?.click();

    const priceGuide = await page.waitForSelector("xpath/" + "//td[contains(text(),'Price Guide')]");
    await priceGuide?.click();

    await page.waitForSelector("xpath/" + "//input[@id='_idchkPGGroupByCurrency']");
    await page.evaluate(() => {
      const checkBox = document.getElementById("_idchkPGGroupByCurrency");
      checkBox?.click();
    });

    await page.waitForSelector("xpath/" + "//input[@id='_idchkPGExcludeIncomplete' and @type='checkbox']");

    await page.evaluate(() => {
      const checkBox = document.getElementById("_idchkPGExcludeIncomplete");
      checkBox?.click();
    });

    // grab the cell with US Dollar in it, and then grab its parent row, and the row after that
    const row = await page.waitForSelector("xpath/" + "((//td[contains(text(),'US Dollar')])/parent::*)/following-sibling::tr");

    // if the condition is new, grab the first cell, else grab the second cell
    const cellTable = await row?.waitForSelector("xpath/" + `td[${condition === "N" ? 1 : 2}]`);
    // grab the table cell with Avg Price
    const rowTxt = await cellTable?.evaluate((node) => node.textContent);
    // given this string Times Sold:14Total Qty:15Min Price:US $125.00Avg Price:US $144.29Qty Avg Price:US $144.00Max Price:US $175.00
    // grab the avg price using regex
    avgPrice = rowTxt?.match(/Avg Price:US \$([\d.]+)/)?.[1] ?? "";
  } catch (error) {
    console.error(`Error parsing set avg price for set ${itemNumber} in condition ${condition} at index ${index}:`);
  }

  if (!avgPrice) return "N/A";

  return avgPrice;
}
