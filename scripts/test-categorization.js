/**
 * カテゴリ判定ロジックのテストスクリプト（外部JSONベース）
 */
const fs = require('fs');
const path = require('path');

// 外部JSON読み込み
const keywordsFile = path.join(__dirname, '..', 'data', 'category-keywords.json');
const keywordsConfig = JSON.parse(fs.readFileSync(keywordsFile, 'utf8'));

const TOPIC_CATEGORY_MAP = keywordsConfig.topicToCategory || {};
const DESCRIPTION_KEYWORDS = keywordsConfig.descriptionKeywords || {};
const DESCRIPTION_EXCLUDE = keywordsConfig.descriptionExcludeKeywords || {};

function guessCategory(topics, description) {
    for (const topic of (topics || [])) {
        const lower = topic.toLowerCase();
        if (TOPIC_CATEGORY_MAP[lower] && !lower.startsWith('_')) {
            return TOPIC_CATEGORY_MAP[lower];
        }
    }
    const desc = (description || '').toLowerCase();
    for (const [category, keywords] of Object.entries(DESCRIPTION_KEYWORDS)) {
        if (category.startsWith('_')) continue;
        const excludeWords = DESCRIPTION_EXCLUDE[category] || [];
        const hasExclude = excludeWords.some(ex => desc.includes(ex.toLowerCase()));
        for (const keyword of keywords) {
            if (desc.includes(keyword.toLowerCase())) {
                if (hasExclude) continue;
                return category;
            }
        }
    }
    return 'other';
}

// plugins.jsonを読み込んでシミュレーション
const pluginsFile = path.join(__dirname, '..', 'data', 'plugins.json');
const data = JSON.parse(fs.readFileSync(pluginsFile, 'utf8'));

const results = {
    total: data.plugins.length,
    oldOtherCount: data.plugins.filter(p => p.category === 'other').length,
    newOtherCount: 0,
    categories: {}
};

console.log('--- 分類シミュレーション結果 ---');
data.plugins.forEach(p => {
    const mockTopics = p.tags.filter(t => t !== 'その他');
    const newCategory = guessCategory(mockTopics, p.description);
    
    if (newCategory === 'other') results.newOtherCount++;
    results.categories[newCategory] = (results.categories[newCategory] || 0) + 1;

    if (p.category === 'other' && newCategory !== 'other') {
        console.log(`[Reclassified] ${p.name}: other -> ${newCategory}`);
    }
});

console.log('------------------------------');
console.log(`全プラグイン数: ${results.total}`);
console.log(`旧「その他」数: ${results.oldOtherCount}`);
console.log(`新「その他」数: ${results.newOtherCount}`);
console.log('カテゴリ別内訳:', results.categories);
