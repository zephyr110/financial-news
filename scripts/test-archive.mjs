import { archiveNews } from '../lib/archive.js';
import { getDbCounts } from '../lib/db.js';

console.log('Running archive test...');
const counts = await archiveNews();
console.log('Archive result:', counts);

const stats = await getDbCounts();
console.log('Total archived:', stats.total_news);
console.log('By source:', stats.by_source);

console.log('Archive test PASSED.');
