import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Supabase client ───────────────────────────────────────────────
const SUPABASE_URL = "https://clvblgwfriflqhmkcsbq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsdmJsZ3dmcmlmbHFobWtjc2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDQ1MTgsImV4cCI6MjA5NTQ4MDUxOH0.oTrQkiyn_3ks1OOONXUgc1wJKxxqoqEeeLOBYsHqwEE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Load JSON data ────────────────────────────────────────────────
const dataDir = resolve(__dirname, "..", "data");

interface Insumo {
  code: string;
  name: string;
  unit: string;
  package_qty: number;
  package_price: number;
  unit_cost: number;
  casa: string;
}

interface Ingredient {
  insumo_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  ingredient_cost: number;
}

interface Drink {
  name: string;
  casa: string;
  category: string;
  sale_price: number;
  total_cost: number;
  markup: number;
  ingredients: Ingredient[];
}

interface BancoDados {
  casa: string;
  category: string;
  drink: string;
  sale_price: number;
  total_cost: number;
  margin: number;
  markup: number;
}

interface StockItem {
  category: string;
  product: string;
  quantity: number;
  minimum: number;
}

interface SeedData {
  insumos: Insumo[];
  drinks: Drink[];
  banco_dados: BancoDados[];
}

interface StockData {
  stock_isla: StockItem[];
  stock_playa: StockItem[];
  stock_viva: StockItem[];
}

const seedData: SeedData = JSON.parse(
  readFileSync(resolve(dataDir, "seed-data.json"), "utf-8")
);
const stockData: StockData = JSON.parse(
  readFileSync(resolve(dataDir, "stock-data.json"), "utf-8")
);

// ── Helpers ───────────────────────────────────────────────────────
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Map stock category names to a clean category string */
function mapStockCategory(cat: string): string {
  const upper = cat.toUpperCase();
  switch (upper) {
    case "SOFT DRINKS":
      return "Soft Drinks";
    case "ENERGETICO":
      return "Energetico";
    case "CERVEJA":
      return "Cerveja";
    case "VODKA":
      return "Vodka";
    case "GIN":
      return "Gin";
    case "WHISKY":
      return "Whisky";
    case "LICOR":
      return "Licor";
    case "TEQUILA":
      return "Tequila";
    case "ESPUMANTE":
      return "Espumante";
    case "DOSES":
      return "Doses";
    case "VINHO":
      return "Vinho";
    case "XR":
      return "XR";
    case "XAROPE":
      return "Xarope";
    case "OUTROS":
      return "Outros";
    default:
      return cat;
  }
}

// ── Main seed function ────────────────────────────────────────────
async function seed() {
  console.log("=== Starting database seed ===\n");

  // ─── 1. Fetch casas ───────────────────────────────────────────
  console.log("1) Fetching casas...");
  const { data: casas, error: casasErr } = await supabase
    .from("casas")
    .select("*");
  if (casasErr) throw new Error(`Failed to fetch casas: ${casasErr.message}`);
  if (!casas || casas.length === 0) throw new Error("No casas found in DB");

  const casaMap: Record<string, string> = {}; // name -> uuid
  for (const c of casas) {
    casaMap[c.name] = c.id;
    // also map uppercase and "VIVA" alias
    casaMap[c.name.toUpperCase()] = c.id;
  }
  // VIVA is old name for Playa
  if (casaMap["Playa"]) {
    casaMap["VIVA"] = casaMap["Playa"];
    casaMap["Viva"] = casaMap["Playa"];
  }
  console.log(
    `   Found ${casas.length} casas:`,
    casas.map((c: { name: string }) => c.name).join(", ")
  );

  // ─── 2. Insert insumos (deduplicated by name) ────────────────
  console.log("\n2) Inserting insumos...");
  const seenInsumos = new Map<string, Insumo>();
  for (const ins of seedData.insumos) {
    if (!seenInsumos.has(ins.name)) {
      seenInsumos.set(ins.name, ins);
    }
  }

  const insumoRows = Array.from(seenInsumos.values()).map((ins) => ({
    code: ins.code,
    name: ins.name,
    unit: ins.unit,
    package_qty: ins.package_qty,
    package_price: ins.package_price,
    unit_cost: ins.unit_cost,
  }));

  // Check for existing insumos to avoid duplicates
  const { data: existingInsumos } = await supabase
    .from("insumos")
    .select("name");
  const existingNames = new Set(
    (existingInsumos ?? []).map((i: { name: string }) => i.name)
  );
  const newInsumoRows = insumoRows.filter((r) => !existingNames.has(r.name));

  let insertedInsumos: typeof newInsumoRows = [];
  if (newInsumoRows.length > 0) {
    const { data, error: insumoErr } = await supabase
      .from("insumos")
      .insert(newInsumoRows)
      .select();
    if (insumoErr)
      throw new Error(`Failed to insert insumos: ${insumoErr.message}`);
    insertedInsumos = data ?? [];
  }
  console.log(
    `   Skipped ${existingNames.size} existing, inserted ${insertedInsumos.length} new insumos`
  );
  // (log already printed above)

  // Build name -> id map for insumos (fetch all to be safe)
  const { data: allInsumos, error: fetchInsErr } = await supabase
    .from("insumos")
    .select("id, name");
  if (fetchInsErr)
    throw new Error(`Failed to fetch insumos: ${fetchInsErr.message}`);
  const insumoIdMap = new Map<string, string>();
  for (const ins of allInsumos ?? []) {
    insumoIdMap.set(ins.name, ins.id);
    insumoIdMap.set(normalize(ins.name), ins.id);
  }
  console.log(`   Insumo lookup map has ${insumoIdMap.size / 2} entries`);

  // ─── 3. Insert drinks as products ─────────────────────────────
  console.log("\n3) Inserting drinks as products...");

  // Build a lookup from banco_dados by (drink, casa_upper) for margin
  const bancoLookup = new Map<string, BancoDados>();
  for (const b of seedData.banco_dados) {
    const key = `${b.drink}|${b.casa.toUpperCase()}`;
    bancoLookup.set(key, b);
  }

  const drinkRows = seedData.drinks.map((d) => {
    const casaUpper = d.casa.toUpperCase();
    const casaId = casaMap[d.casa] || casaMap[casaUpper];
    const bancoKey = `${d.name}|${casaUpper}`;
    const banco = bancoLookup.get(bancoKey);

    return {
      name: d.name,
      category: d.category,
      type: "drink" as const,
      sale_price: d.sale_price,
      cost: d.total_cost,
      markup: d.markup,
      margin: banco?.margin ?? d.sale_price - d.total_cost,
      casa_id: casaId,
    };
  });

  const { data: insertedDrinks, error: drinkErr } = await supabase
    .from("products")
    .insert(drinkRows)
    .select();
  if (drinkErr)
    throw new Error(`Failed to insert drinks: ${drinkErr.message}`);
  console.log(`   Inserted ${insertedDrinks?.length ?? 0} drink products`);

  // Build lookup: (normalized_name, casa_id) -> product for drinks
  const drinkProductMap = new Map<string, { id: string; name: string }>();
  for (const p of insertedDrinks ?? []) {
    const key = `${normalize(p.name)}|${p.casa_id}`;
    drinkProductMap.set(key, p);
  }

  // ─── 4. Create drink_recipes and recipe_ingredients ───────────
  console.log("\n4) Creating drink recipes & ingredients...");
  let recipesCreated = 0;
  let ingredientsCreated = 0;

  for (const drink of seedData.drinks) {
    const casaUpper = drink.casa.toUpperCase();
    const casaId = casaMap[drink.casa] || casaMap[casaUpper];
    const productKey = `${normalize(drink.name)}|${casaId}`;
    const product = drinkProductMap.get(productKey);

    if (!product) {
      console.warn(
        `   WARN: No product found for drink "${drink.name}" (${drink.casa})`
      );
      continue;
    }

    // Create recipe
    const { data: recipe, error: recipeErr } = await supabase
      .from("drink_recipes")
      .insert({ product_id: product.id })
      .select()
      .single();

    if (recipeErr) {
      console.warn(
        `   WARN: Failed to create recipe for "${drink.name}": ${recipeErr.message}`
      );
      continue;
    }
    recipesCreated++;

    // Create ingredients
    const ingredientRows = drink.ingredients
      .map((ing) => {
        const insumoId =
          insumoIdMap.get(ing.insumo_name) ||
          insumoIdMap.get(normalize(ing.insumo_name));
        if (!insumoId) {
          console.warn(
            `   WARN: Insumo not found for ingredient "${ing.insumo_name}" in "${drink.name}"`
          );
          return null;
        }
        return {
          recipe_id: recipe.id,
          insumo_id: insumoId,
          quantity: ing.quantity,
          unit: ing.unit,
          ingredient_cost: ing.ingredient_cost,
        };
      })
      .filter(Boolean);

    if (ingredientRows.length > 0) {
      const { data: insertedIngredients, error: ingErr } = await supabase
        .from("recipe_ingredients")
        .insert(ingredientRows)
        .select();
      if (ingErr) {
        console.warn(
          `   WARN: Failed to insert ingredients for "${drink.name}": ${ingErr.message}`
        );
      } else {
        ingredientsCreated += insertedIngredients?.length ?? 0;
      }
    }
  }
  console.log(`   Created ${recipesCreated} recipes`);
  console.log(`   Created ${ingredientsCreated} recipe ingredients`);

  // ─── 5. Insert stock items ────────────────────────────────────
  console.log("\n5) Inserting stock items...");

  // Fetch all current products to build a lookup
  const { data: allProducts, error: prodFetchErr } = await supabase
    .from("products")
    .select("id, name, casa_id");
  if (prodFetchErr)
    throw new Error(`Failed to fetch products: ${prodFetchErr.message}`);

  // Build lookup: (normalized_name, casa_id) -> product_id
  const productLookup = new Map<string, string>();
  for (const p of allProducts ?? []) {
    productLookup.set(`${normalize(p.name)}|${p.casa_id}`, p.id);
  }

  // Process stock entries for (stock key, casa name) pairs
  const stockSources: { items: StockItem[]; casaName: string }[] = [
    { items: stockData.stock_isla, casaName: "Isla" },
    { items: stockData.stock_viva, casaName: "Playa" }, // VIVA = old name for Playa
    // stock_playa skipped - all quantities are 0
  ];

  let stockItemsInserted = 0;
  let newProductsCreated = 0;

  for (const { items, casaName } of stockSources) {
    const casaId = casaMap[casaName];
    if (!casaId) {
      console.warn(`   WARN: Casa "${casaName}" not found, skipping`);
      continue;
    }

    console.log(
      `   Processing ${items.length} stock items for ${casaName}...`
    );

    for (const item of items) {
      const normName = normalize(item.product);
      const lookupKey = `${normName}|${casaId}`;

      let productId = productLookup.get(lookupKey);

      // If no existing product match, create a new product with type='product'
      if (!productId) {
        // Title case the product name
        const productName = item.product
          .split(" ")
          .map(
            (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          )
          .join(" ");

        const category = mapStockCategory(item.category);

        const { data: newProd, error: newProdErr } = await supabase
          .from("products")
          .insert({
            name: productName,
            category,
            type: "product",
            sale_price: 0,
            cost: 0,
            markup: 0,
            margin: 0,
            casa_id: casaId,
          })
          .select()
          .single();

        if (newProdErr) {
          console.warn(
            `   WARN: Failed to create product "${productName}": ${newProdErr.message}`
          );
          continue;
        }
        productId = newProd.id;
        productLookup.set(lookupKey, productId);
        newProductsCreated++;
      }

      // Insert stock item
      const { error: stockErr } = await supabase.from("stock_items").insert({
        casa_id: casaId,
        product_id: productId,
        quantity: item.quantity,
        minimum: item.minimum,
        unit: "un",
      });

      if (stockErr) {
        console.warn(
          `   WARN: Failed to insert stock "${item.product}" for ${casaName}: ${stockErr.message}`
        );
      } else {
        stockItemsInserted++;
      }
    }
  }

  console.log(`   Created ${newProductsCreated} new products from stock data`);
  console.log(`   Inserted ${stockItemsInserted} stock items`);

  // ── Summary ───────────────────────────────────────────────────
  console.log("\n=== Seed complete ===");
  console.log(`   Casas:              ${casas.length}`);
  console.log(`   Insumos:            ${insertedInsumos?.length ?? 0}`);
  console.log(`   Drink products:     ${insertedDrinks?.length ?? 0}`);
  console.log(`   Recipes:            ${recipesCreated}`);
  console.log(`   Recipe ingredients: ${ingredientsCreated}`);
  console.log(`   New stock products: ${newProductsCreated}`);
  console.log(`   Stock items:        ${stockItemsInserted}`);
}

seed().catch((err) => {
  console.error("\nSEED FAILED:", err);
  process.exit(1);
});
