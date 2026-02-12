/**
 * YMM4 Plugin Collector
 * 
 * GitHub APIを使用してYMM4プラグインを自動検索・収集するスクリプト。
 * GitHub Actionsで定期実行される。
 * 
 * 検索対象トピック: ymm4-plugin, ymm-plugin, YMM4Plugin
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ===== 設定 =====
const SEARCH_TOPICS = ['ymm4-plugin', 'ymm-plugin', 'YMM4Plugin'];
const DATA_DIR = path.join(__dirname, '..', 'data');
const PLUGINS_FILE = path.join(DATA_DIR, 'plugins.json');
const MANUAL_FILE = path.join(DATA_DIR, 'plugins-manual.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// カテゴリ推定マッピング（トピック → カテゴリ）
const TOPIC_CATEGORY_MAP = {
    'effect': 'video-effect',
    'video-effect': 'video-effect',
    'visual-effect': 'video-effect',
    'audio-effect': 'audio-effect',
    'sound-effect': 'audio-effect',
    'voice': 'voice-synthesis',
    'voice-synthesis': 'voice-synthesis',
    'tts': 'voice-synthesis',
    'shape': 'shape',
    'text': 'text',
    'subtitle': 'text',
    'output': 'video-output',
    'export': 'video-output',
    'utility': 'utility',
    'tool': 'utility',
};

// ===== HTTP Helper =====
function githubRequest(urlPath) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: urlPath,
            method: 'GET',
            headers: {
                'User-Agent': 'YMM4-Plugin-Collector',
                'Accept': 'application/vnd.github.v3+json',
            },
        };

        if (GITHUB_TOKEN) {
            options.headers['Authorization'] = `token ${GITHUB_TOKEN}`;
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`JSON parse error: ${e.message}`));
                    }
                } else {
                    reject(new Error(`GitHub API error: ${res.statusCode} - ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// wait helper
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== トピック検索 =====
async function searchByTopic(topic) {
    console.log(`  🔍 トピック "${topic}" を検索中...`);
    try {
        const encoded = encodeURIComponent(`topic:${topic}`);
        const result = await githubRequest(`/search/repositories?q=${encoded}&per_page=100&sort=updated`);
        console.log(`    → ${result.items?.length || 0}件のリポジトリを発見`);
        return result.items || [];
    } catch (error) {
        console.error(`    ⚠️ 検索エラー (${topic}):`, error.message);
        return [];
    }
}

// ===== リリース情報取得 =====
async function getLatestRelease(owner, repo) {
    try {
        const release = await githubRequest(`/repos/${owner}/${repo}/releases/latest`);
        return {
            version: release.tag_name || '',
            url: release.html_url || '',
        };
    } catch {
        return { version: '', url: '' };
    }
}

// ===== カテゴリ推定 =====
function guessCategory(topics, description) {
    // トピックからカテゴリを推定
    for (const topic of (topics || [])) {
        const lower = topic.toLowerCase();
        if (TOPIC_CATEGORY_MAP[lower]) {
            return TOPIC_CATEGORY_MAP[lower];
        }
    }

    // 説明文からカテゴリを推定
    const desc = (description || '').toLowerCase();
    if (desc.includes('エフェクト') || desc.includes('effect')) return 'video-effect';
    if (desc.includes('音声合成') || desc.includes('voice') || desc.includes('tts')) return 'voice-synthesis';
    if (desc.includes('図形') || desc.includes('shape') || desc.includes('polygon')) return 'shape';
    if (desc.includes('テキスト') || desc.includes('字幕') || desc.includes('subtitle')) return 'text';
    if (desc.includes('出力') || desc.includes('export') || desc.includes('output')) return 'video-output';
    if (desc.includes('音声') || desc.includes('audio') || desc.includes('sound')) return 'audio-effect';

    return 'other';
}

// ===== タグ生成 =====
function generateTags(topics, description, category) {
    const tags = new Set();
    const CATEGORY_LABELS = {
        'video-effect': '映像エフェクト',
        'audio-effect': '音声エフェクト',
        'voice-synthesis': '音声合成',
        'shape': '図形',
        'text': 'テキスト',
        'video-output': '動画出力',
        'utility': 'ユーティリティ',
        'other': 'その他',
    };

    if (CATEGORY_LABELS[category]) {
        tags.add(CATEGORY_LABELS[category]);
    }

    // トピックからタグ生成（YMM関連トピックは除外）
    for (const topic of (topics || [])) {
        const lower = topic.toLowerCase();
        if (!lower.includes('ymm') && !lower.includes('yukkuri') && lower !== 'plugin') {
            tags.add(topic);
        }
    }

    return Array.from(tags).slice(0, 6);
}

// ===== ID生成 =====
function generateId(owner, repoName) {
    return `${owner}-${repoName}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

// ===== メイン処理 =====
async function main() {
    console.log('🚀 YMM4 プラグイン収集開始');
    console.log('==========================================');

    // 1. トピック検索でリポジトリ収集
    const allRepos = new Map(); // full_name → repo data

    for (const topic of SEARCH_TOPICS) {
        const repos = await searchByTopic(topic);
        for (const repo of repos) {
            if (!allRepos.has(repo.full_name)) {
                allRepos.set(repo.full_name, repo);
            }
        }
        await wait(1000); // Rate limit対策
    }

    console.log(`\n📦 合計 ${allRepos.size}件のユニークなリポジトリを発見`);

    // 2. プラグインデータの構築
    const plugins = [];

    for (const [fullName, repo] of allRepos) {
        const [owner, repoName] = fullName.split('/');
        console.log(`  📋 ${fullName} を処理中...`);

        // リリース情報取得
        const release = await getLatestRelease(owner, repoName);
        await wait(500);

        const category = guessCategory(repo.topics, repo.description);
        const tags = generateTags(repo.topics, repo.description, category);

        plugins.push({
            id: generateId(owner, repoName),
            name: repo.name,
            description: repo.description || '説明なし',
            author: owner,
            authorUrl: `https://github.com/${owner}`,
            repoUrl: repo.html_url,
            downloadUrl: release.url || `${repo.html_url}/releases`,
            category: category,
            tags: tags,
            stars: repo.stargazers_count || 0,
            lastUpdated: repo.updated_at || repo.pushed_at || '',
            latestVersion: release.version || '',
            license: repo.license?.spdx_id || '',
        });
    }

    // 3. 手動データのマージ
    let manualData = { plugins: [], categoryOverrides: {}, excludeRepos: [] };
    try {
        if (fs.existsSync(MANUAL_FILE)) {
            manualData = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf8'));
            console.log(`\n📝 手動データ: ${manualData.plugins?.length || 0}件のプラグイン`);
        }
    } catch (error) {
        console.error('⚠️ 手動データの読み込みエラー:', error.message);
    }

    // 除外リポジトリを除去
    const excludeSet = new Set((manualData.excludeRepos || []).map(r => r.toLowerCase()));
    const filteredPlugins = plugins.filter(p => {
        const repoPath = p.repoUrl.replace('https://github.com/', '').toLowerCase();
        return !excludeSet.has(repoPath);
    });

    // カテゴリの上書き適用
    for (const plugin of filteredPlugins) {
        if (manualData.categoryOverrides && manualData.categoryOverrides[plugin.id]) {
            plugin.category = manualData.categoryOverrides[plugin.id];
        }
    }

    // 手動プラグインを追加
    const autoIds = new Set(filteredPlugins.map(p => p.id));
    for (const manualPlugin of (manualData.plugins || [])) {
        if (!autoIds.has(manualPlugin.id)) {
            filteredPlugins.push(manualPlugin);
        }
    }

    // 4. JSONファイルの書き出し
    const outputData = {
        lastUpdated: new Date().toISOString(),
        plugins: filteredPlugins,
    };

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PLUGINS_FILE, JSON.stringify(outputData, null, 2), 'utf8');

    console.log(`\n✅ 完了! ${filteredPlugins.length}件のプラグインを data/plugins.json に保存しました`);
    console.log('==========================================');
}

main().catch(error => {
    console.error('❌ エラー:', error);
    process.exit(1);
});
