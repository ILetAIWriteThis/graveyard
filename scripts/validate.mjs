import { loadCatalog } from './catalog.mjs';
try {
  const catalog = loadCatalog();
  console.log(`Catalog checked: ${catalog.items.length} entries, ${catalog.published.length} published, ${Object.keys(catalog.taxonomy.topics).length} topics.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
