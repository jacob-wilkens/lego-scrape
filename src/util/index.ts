import fs from "fs/promises";
import { LegoSet, MiniFig } from "../types";

export async function formatMiniFigCsv(file: string, outPutFile: string) {
  const csv = await fs.readFile(file);
  // filter out the header
  const lines = csv.toString().split("\n").slice(1);

  const sets: MiniFig[] = lines.map((line) => {
    const [_, itemNumber, condition] = line.split(",");
    return { itemNumber, condition: condition as "U" | "N" };
  });

  // create new csv file
  const headers = "Item Number,Condition,Value\n";
  const newCsv = headers + sets.map((set) => `${set.itemNumber},${set.condition},${set.value ?? ""}`).join("\n");

  await fs.writeFile(outPutFile, newCsv);
}

export async function formatSetCsv(filePath: string, outPutFile: string) {
  const csv = await fs.readFile(filePath);
  // filter out the header
  const lines = csv.toString().split("\n").slice(1);

  const sets: LegoSet[] = lines.map((line) => {
    const [_, itemNumber, condition] = line.split(",");
    return { itemNumber, condition: condition as "U" | "N" };
  });

  // create new csv file
  const headers = "Item Number,Condition,Value\n";
  const newCsv = headers + sets.map((set) => `${set.itemNumber},${set.condition},${set.value ?? ""}`).join("\n");

  await fs.writeFile(outPutFile, newCsv);
}
