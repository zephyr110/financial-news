import { getDb, insertNews, getUnanalyzedNews, insertAnalysis, getAnalyzedNews, getAnalysisStats } from '../lib/db.js';

const db = getDb();
console.log('Tables created:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));

// Test insert
const id = insertNews({
  source: 'test',
  source_id: 'test-001',
  title: 'Test News',
  content: 'This is a test financial news item about semiconductor industry.',
  published_at: new Date().toISOString(),
});
console.log('Inserted news id:', id);

// Test unanalyzed
const unanalyzed = getUnanalyzedNews();
console.log('Unanalyzed count:', unanalyzed.length);

// Test insert analysis
if (id) {
  insertAnalysis({
    news_id: id,
    signal_score: 4,
    category: 'industry',
    impact_level: 'significant',
    industries: ['半导体'],
    companies: ['中芯国际'],
    sentiment: 'positive',
    summary: '半导体行业测试摘要',
    deep_analysis: null,
    tags: ['测试'],
  });
}

// Test query
const analyzed = getAnalyzedNews();
console.log('Analyzed count:', analyzed.length);

const stats = getAnalysisStats();
console.log('Stats:', stats);

// Cleanup test data
db.prepare('DELETE FROM analysis_result WHERE news_id IN (SELECT id FROM news_archive WHERE source = ?)').run('test');
db.prepare('DELETE FROM news_archive WHERE source = ?').run('test');
console.log('Test data cleaned up.');
console.log('DB test PASSED.');
