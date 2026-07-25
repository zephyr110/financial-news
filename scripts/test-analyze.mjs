import { analyzeUnanalyzedNews, getUsageStats } from '../lib/analyze.js';
import { getAnalyzedNews, getAnalysisStats } from '../lib/db.js';

// Ensure LLM API key is set (check primary + fallbacks)
const apiKey = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
if (!apiKey) {
  console.error('ERROR: LLM API key not configured.');
  console.error('Set LLM_API_KEY (or DEEPSEEK_API_KEY) environment variable.');
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
