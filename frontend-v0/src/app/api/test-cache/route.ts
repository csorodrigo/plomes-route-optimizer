import { NextResponse } from "next/server";

export async function GET() {
  try {
    const fs = require('fs');
    const path = require('path');

    // Try multiple possible paths for the cached file
    const possiblePaths = [
      path.join(process.cwd(), 'deals-with-products-sample.json'),
      path.join(process.cwd(), 'frontend-v0', 'deals-with-products-sample.json'),
      path.join(__dirname, '..', '..', '..', '..', 'deals-with-products-sample.json'),
      '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/deals-with-products-sample.json'
    ];

    console.log(`[TEST CACHE] Current working directory: ${process.cwd()}`);

    let result = {
      cwd: process.cwd(),
      pathsChecked: [],
      foundPath: null,
      dataLength: 0,
      sampleData: null
    };

    for (const testPath of possiblePaths) {
      console.log(`[TEST CACHE] Checking path: ${testPath}`);
      const exists = fs.existsSync(testPath);
      result.pathsChecked.push({ path: testPath, exists });

      if (exists && !result.foundPath) {
        result.foundPath = testPath;
        try {
          const cachedData = fs.readFileSync(testPath, 'utf8');
          const deals = JSON.parse(cachedData);
          result.dataLength = deals.length;

          // Get first deal with products as sample
          const dealWithProducts = deals.find((d: any) => d.Products && d.Products.length > 0);
          if (dealWithProducts) {
            result.sampleData = {
              dealId: dealWithProducts.Id,
              productCount: dealWithProducts.Products.length,
              firstProduct: dealWithProducts.Products[0]
            };
          }
        } catch (error) {
          result.sampleData = { error: error.message };
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}