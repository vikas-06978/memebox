// Public local-review catalog. Never copies credentials or database records.
import fs from 'node:fs';
import path from 'node:path';
import { PRODUCTS, COSMETIC_DRAFTS } from '../site/src/shop.js';
const publicProducts = Object.fromEntries(Object.entries(PRODUCTS).filter(([id]) => id.startsWith('pass_') || id.startsWith('char_') || ['chars_eight','filters_fifteen','outfits_three'].includes(id) || id.startsWith('filter_') || id.startsWith('outfit_')).map(([id, p]) => [id, { name: p.name, inr: p.inr, usd: p.usd, closed: !!p.closed, proSeconds: p.proSeconds, maxSeconds: p.maxSeconds, addons: [...p.addons] }]));
fs.writeFileSync(path.resolve(import.meta.dirname, '../extension/lib/shop-catalog.js'), '// GENERATED from site/src/shop.js. Run npm run sync-fx.\n' + 'globalThis.MemeShop = Object.freeze(' + JSON.stringify({ products: publicProducts, cosmetics: COSMETIC_DRAFTS }) + ');\n');
console.log('lib/shop-catalog.js updated');
