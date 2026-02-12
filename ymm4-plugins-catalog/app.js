/* ===================================================
   YMM4 Plugin Catalog - Application Logic
   =================================================== */

(function () {
  'use strict';

  // ===== Constants =====
  const CATEGORY_MAP = {
    'all': { label: 'すべて', icon: '📦' },
    'video-effect': { label: '映像エフェクト', icon: '🎬' },
    'audio-effect': { label: '音声エフェクト', icon: '🔊' },
    'voice-synthesis': { label: '音声合成', icon: '🗣️' },
    'shape': { label: '図形', icon: '🔷' },
    'text': { label: 'テキスト', icon: '✏️' },
    'video-output': { label: '動画出力', icon: '📹' },
    'utility': { label: 'ユーティリティ', icon: '🔧' },
    'other': { label: 'その他', icon: '📁' },
  };

  // ===== State =====
  let allPlugins = [];
  let filteredPlugins = [];
  let currentCategory = 'all';
  let currentSearch = '';
  let currentSort = 'updated-desc';

  // ===== DOM Elements =====
  const $grid = document.getElementById('plugin-grid');
  const $searchInput = document.getElementById('search-input');
  const $searchClear = document.getElementById('search-clear');
  const $categoryFilters = document.getElementById('category-filters');
  const $sortSelect = document.getElementById('sort-select');
  const $resultsCount = document.getElementById('results-count');
  const $emptyState = document.getElementById('empty-state');
  const $loadingState = document.getElementById('loading-state');
  const $btnReset = document.getElementById('btn-reset');
  const $modalOverlay = document.getElementById('modal-overlay');
  const $modalContent = document.getElementById('modal-content');
  const $modalClose = document.getElementById('modal-close');
  const $totalCount = document.getElementById('total-count');
  const $categoryCount = document.getElementById('category-count');
  const $authorCount = document.getElementById('author-count');
  const $lastUpdated = document.getElementById('last-updated');

  // ===== Initialization =====
  async function init() {
    try {
      const response = await fetch('data/plugins.json');
      if (!response.ok) throw new Error('データの読み込みに失敗しました');
      const data = await response.json();
      allPlugins = data.plugins || [];

      // Update last updated
      if (data.lastUpdated) {
        const date = new Date(data.lastUpdated);
        $lastUpdated.textContent = date.toLocaleDateString('ja-JP', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
      }

      updateStats();
      applyFilters();
      bindEvents();
      $loadingState.style.display = 'none';
    } catch (error) {
      console.error('Error loading plugins:', error);
      $loadingState.innerHTML = `
        <p style="color: #f87171;">⚠️ データの読み込みに失敗しました</p>
        <p style="margin-top:8px; font-size:0.82rem;">${error.message}</p>
      `;
    }
  }

  // ===== Stats =====
  function updateStats() {
    $totalCount.textContent = allPlugins.length;
    const categories = new Set(allPlugins.map(p => p.category));
    $categoryCount.textContent = categories.size;
    const authors = new Set(allPlugins.map(p => p.author));
    $authorCount.textContent = authors.size;

    // Animate numbers
    animateCounter($totalCount, allPlugins.length);
    animateCounter($categoryCount, categories.size);
    animateCounter($authorCount, authors.size);
  }

  function animateCounter(el, target) {
    let current = 0;
    const step = Math.max(1, Math.floor(target / 20));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      el.textContent = current;
    }, 30);
  }

  // ===== Events =====
  function bindEvents() {
    // Search
    $searchInput.addEventListener('input', debounce(function () {
      currentSearch = this.value.trim().toLowerCase();
      $searchClear.style.display = currentSearch ? 'flex' : 'none';
      applyFilters();
    }, 200));

    $searchClear.addEventListener('click', function () {
      $searchInput.value = '';
      currentSearch = '';
      $searchClear.style.display = 'none';
      applyFilters();
    });

    // Category filters
    $categoryFilters.addEventListener('click', function (e) {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      $categoryFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category;
      applyFilters();
    });

    // Sort
    $sortSelect.addEventListener('change', function () {
      currentSort = this.value;
      applyFilters();
    });

    // Reset
    $btnReset.addEventListener('click', function () {
      $searchInput.value = '';
      currentSearch = '';
      $searchClear.style.display = 'none';
      currentCategory = 'all';
      $categoryFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      $categoryFilters.querySelector('[data-category="all"]').classList.add('active');
      currentSort = 'updated-desc';
      $sortSelect.value = currentSort;
      applyFilters();
    });

    // Modal close
    $modalClose.addEventListener('click', closeModal);
    $modalOverlay.addEventListener('click', function (e) {
      if (e.target === $modalOverlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  // ===== Filtering & Sorting =====
  function applyFilters() {
    filteredPlugins = allPlugins.filter(plugin => {
      // Category filter
      if (currentCategory !== 'all' && plugin.category !== currentCategory) return false;

      // Search filter
      if (currentSearch) {
        const searchFields = [
          plugin.name,
          plugin.description,
          plugin.author,
          ...(plugin.tags || []),
          CATEGORY_MAP[plugin.category]?.label || ''
        ].join(' ').toLowerCase();
        return searchFields.includes(currentSearch);
      }
      return true;
    });

    // Sort
    filteredPlugins.sort((a, b) => {
      switch (currentSort) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'stars-desc':
          return (b.stars || 0) - (a.stars || 0);
        case 'updated-desc':
          return new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0);
        case 'updated-asc':
          return new Date(a.lastUpdated || 0) - new Date(b.lastUpdated || 0);
        default:
          return 0;
      }
    });

    renderGrid();
    updateResultsCount();
  }

  function updateResultsCount() {
    if (currentSearch || currentCategory !== 'all') {
      $resultsCount.textContent = `${filteredPlugins.length}件のプラグインが見つかりました`;
    } else {
      $resultsCount.textContent = `全${allPlugins.length}件のプラグイン`;
    }
  }

  // ===== Rendering =====
  function renderGrid() {
    if (filteredPlugins.length === 0) {
      $grid.style.display = 'none';
      $emptyState.style.display = 'block';
      return;
    }

    $grid.style.display = 'grid';
    $emptyState.style.display = 'none';

    $grid.innerHTML = filteredPlugins.map((plugin, index) => createCard(plugin, index)).join('');

    // Bind card click events
    $grid.querySelectorAll('.plugin-card').forEach(card => {
      card.addEventListener('click', function () {
        const pluginId = this.dataset.pluginId;
        const plugin = allPlugins.find(p => p.id === pluginId);
        if (plugin) openModal(plugin);
      });
    });
  }

  function createCard(plugin, index) {
    const categoryInfo = CATEGORY_MAP[plugin.category] || CATEGORY_MAP['other'];
    const badgeClass = `badge-${plugin.category}`;
    const authorInitial = (plugin.author || '?')[0].toUpperCase();
    const stars = plugin.stars || 0;
    const updatedDate = plugin.lastUpdated
      ? new Date(plugin.lastUpdated).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
      : '-';

    const tagsHtml = (plugin.tags || []).slice(0, 4).map(tag =>
      `<span class="card-tag">${escapeHtml(tag)}</span>`
    ).join('');

    return `
      <article class="plugin-card" data-plugin-id="${escapeHtml(plugin.id)}" style="animation-delay: ${index * 0.05}s">
        <div class="card-header">
          <h2 class="card-title">${escapeHtml(plugin.name)}</h2>
          <span class="card-category-badge ${badgeClass}">
            ${categoryInfo.icon} ${categoryInfo.label}
          </span>
        </div>
        <p class="card-description">${escapeHtml(plugin.description)}</p>
        ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
        <div class="card-footer">
          <div class="card-author">
            <span class="card-author-avatar">${authorInitial}</span>
            ${escapeHtml(plugin.author)}
          </div>
          <div class="card-meta">
            ${stars > 0 ? `
              <span class="card-meta-item">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ${stars}
              </span>
            ` : ''}
            <span class="card-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              ${updatedDate}
            </span>
          </div>
        </div>
      </article>
    `;
  }

  // ===== Modal =====
  function openModal(plugin) {
    const categoryInfo = CATEGORY_MAP[plugin.category] || CATEGORY_MAP['other'];
    const badgeClass = `badge-${plugin.category}`;
    const updatedDate = plugin.lastUpdated
      ? new Date(plugin.lastUpdated).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
      : '不明';

    const tagsHtml = (plugin.tags || []).map(tag =>
      `<span class="modal-tag">${escapeHtml(tag)}</span>`
    ).join('');

    $modalContent.innerHTML = `
      <span class="modal-badge card-category-badge ${badgeClass}">
        ${categoryInfo.icon} ${categoryInfo.label}
      </span>
      <h2 class="modal-title">${escapeHtml(plugin.name)}</h2>
      <div class="modal-author">
        <span class="card-author-avatar" style="width:28px;height:28px;font-size:0.75rem;">
          ${(plugin.author || '?')[0].toUpperCase()}
        </span>
        作者:
        <a href="${escapeHtml(plugin.authorUrl)}" target="_blank" rel="noopener">
          ${escapeHtml(plugin.author)}
        </a>
      </div>
      <div class="modal-description">
        ${escapeHtml(plugin.description)}
      </div>
      <div class="modal-info-grid">
        <div class="modal-info-item">
          <div class="modal-info-label">⭐ スター数</div>
          <div class="modal-info-value">${plugin.stars || 0}</div>
        </div>
        <div class="modal-info-item">
          <div class="modal-info-label">📅 最終更新</div>
          <div class="modal-info-value">${updatedDate}</div>
        </div>
        <div class="modal-info-item">
          <div class="modal-info-label">🏷️ バージョン</div>
          <div class="modal-info-value">${escapeHtml(plugin.latestVersion || '不明')}</div>
        </div>
        <div class="modal-info-item">
          <div class="modal-info-label">📜 ライセンス</div>
          <div class="modal-info-value">${escapeHtml(plugin.license || '不明')}</div>
        </div>
      </div>
      ${tagsHtml ? `<div class="modal-tags">${tagsHtml}</div>` : ''}
      <div class="modal-actions">
        ${plugin.downloadUrl ? `
          <a href="${escapeHtml(plugin.downloadUrl)}" target="_blank" rel="noopener" class="modal-btn modal-btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ダウンロード
          </a>
        ` : ''}
        ${plugin.repoUrl ? `
          <a href="${escapeHtml(plugin.repoUrl)}" target="_blank" rel="noopener" class="modal-btn modal-btn-secondary">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </a>
        ` : ''}
      </div>
    `;

    $modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ===== Utilities =====
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ===== Start =====
  document.addEventListener('DOMContentLoaded', init);
})();
