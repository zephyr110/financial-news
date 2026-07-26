export const FILTER_KEYWORDS = [
  '比特币', '以太坊', '莱特币', '疫苗', '疫情', '蓬佩奥',
];

// --- Category & Sentiment Labels (shared across analysis components) ---

export const CATEGORY_LABELS = {
  policy: '政策',
  geopolitics: '地缘',
  industry: '行业',
  company: '公司',
  macro: '宏观',
  market_rumor: '传闻',
};

export const CATEGORY_COLORS = {
  policy: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  geopolitics: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  industry: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  company: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  macro: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  market_rumor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

export const SCORE_COLORS = {
  5: 'bg-red-600 text-white',
  4: 'bg-orange-500 text-white',
  3: 'bg-yellow-500 text-white',
  2: 'bg-gray-400 text-white',
  1: 'bg-gray-300 text-gray-600',
};

export const SCORE_TO_IMPACT = {
  5: 'critical',
  4: 'significant',
  3: 'moderate',
  2: 'minor',
  1: 'noise',
};
