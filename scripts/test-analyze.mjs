import { analyzeUnanalyzedNews, getUsageStats } from '../lib/analyze.js';
import { getAnalyzedNews, getAnalysisStats } from '../lib/db.js';

// Ensure DEEPSEEK_API_KEY is set
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('ERROR: DEEPSEEK_API_KEY environment variable is not set.');
  console.error('Set it with: export DEEPSEEK_API_KEY=sk-...');
  process.exit(1);
}

console.log('Running analysis test (max 2 batches)...');
const result = await analyzeUnanalyzedNews(10, 2);
console.log('Analysis result:', result);

const stats = await getAnalysisStats();
console.log('Analysis stats:', stats);

const recent = await getAnalyzedNews({ limit: 5 });
console.log('Recent analyzed news:');
for (const item of recent) {
  console.log(`  [${item.signal_score}] ${item.summary} (${item.category})`);
}

const usage = getUsageStats();
console.log('Token usage:', usage);

console.log('Analysis test PASSED.');
