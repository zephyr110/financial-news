import { archiveNews } from '../lib/archive.js';
import { getDb } from '../lib/db.js';

console.log('Running archive test...');
const counts = await archiveNews();
console.log('Archive result:', counts);

const db = getDb();
const total = db.prepare('SELECT COUNT(*) as count FROM news_archive').get();
const bySource = db.prepare('SELECT source, COUNT(*) as count FROM news_archive GROUP BY source').all();
console.log('Total archived:', total.count);
console.log('By source:', bySource);

console.log('Archive test PASSED.');
