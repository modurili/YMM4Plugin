/* ===================================================
   YMM4 Plugin Catalog - Application Logic (Optimized)
   =================================================== */

(function () {
  'use strict';

  // ===== Constants =====
  var CATEGORY_MAP = {
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

  var SORT_OPTIONS = [
    { value: 'updated-desc', label: '更新日（新しい順）', icon: '🕐' },
    { value: 'updated-asc', label: '更新日（古い順）', icon: '🕐' },
    { value: 'created-desc', label: '公開日（新しい順）', icon: '📅' },
    { value: 'created-asc', label: '公開日（古い順）', icon: '📅' },
    { value: 'stars-desc', label: 'スター数（多い順）', icon: '⭐' },
    { value: 'name-asc', label: '名前（A→Z）', icon: '🔤' },
    { value: 'name-desc', label: '名前（Z→A）', icon: '🔤' },
  ];

  // ===== State =====
  var allPlugins = [];
  var filteredPlugins = [];
  var currentCategory = 'all';
  var currentSearch = '';
  var currentSort = 'updated-desc';
  var sortDropdownOpen = false;

  // ===== DOM Elements =====
  var $grid = document.getElementById('plugin-grid');
  var $searchInput = document.getElementById('search-input');
  var $searchClear = document.getElementById('search-clear');
  var $categoryFilters = document.getElementById('category-filters');
  var $sortDropdown = document.getElementById('sort-dropdown');
  var $resultsCount = document.getElementById('results-count');
  var $emptyState = document.getElementById('empty-state');
  var $loadingState = document.getElementById('loading-state');
  var $btnReset = document.getElementById('btn-reset');
  var $modalOverlay = document.getElementById('modal-overlay');
  var $modalContent = document.getElementById('modal-content');
  var $modalClose = document.getElementById('modal-close');
  var $totalCount = document.getElementById('total-count');
  var $authorCount = document.getElementById('author-count');
  var $lastUpdated = document.getElementById('last-updated');

  // ===== Initialization =====
  async function init() {
    try {
      var response = await fetch('data/plugins.json');
      if (!response.ok) throw new Error('データの読み込みに失敗しました (HTTP ' + response.status + ')');
      var data = await response.json();
      
      var sourcePlugins = data.plugins || [];
      allPlugins = sourcePlugins.map(function(plugin) {
        // Safer object creation for older browsers
        var p = Object.assign({}, plugin);
        
        // Pre-parse dates to timestamps for faster sorting
        p._updatedAt = p.lastUpdated ? new Date(p.lastUpdated).getTime() : 0;
        p._createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;
        
        // Pre-generate search string for faster filtering
        var catLabel = (CATEGORY_MAP[p.category] && CATEGORY_MAP[p.category].label) || '';
        p._searchStr = [
          p.name,
          p.description,
          p.author,
          (p.tags || []).join(' '),
          catLabel
        ].join(' ').toLowerCase();
        
        return p;
      });

      // Update last updated
      if (data.lastUpdated) {
        var date = new Date(data.lastUpdated);
        $lastUpdated.textContent = date.toLocaleDateString('ja-JP', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
      }

      updateStats();
      initSortDropdown();
      applyFilters();
      bindEvents();
      $loadingState.style.display = 'none';
    } catch (error) {
      console.error('Error loading plugins:', error);
      $loadingState.innerHTML = 
        '<p style="color: #f87171;">⚠️ データの読み込みに失敗しました</p>' +
        '<p style="margin-top:8px; font-size:0.82rem;">' + escapeHtml(error.message) + '</p>' +
        '<p style="margin-top:4px; font-size:0.7rem; opacity:0.6;">' + escapeHtml(error.stack || '') + '</p>';
    }
  }

  // ===== Stats =====
  function updateStats() {
    $totalCount.textContent = allPlugins.length;
    var authors = new Set(allPlugins.map(function(p) { return p.author; }));
    $authorCount.textContent = authors.size;

    // Animate numbers
    animateCounter($totalCount, allPlugins.length);
    animateCounter($authorCount, authors.size);
  }

  function animateCounter(el, target) {
    var current = 0;
    var duration = 600; // ms
    var start = performance.now();

    function update(timestamp) {
      var elapsed = timestamp - start;
      var progress = Math.min(elapsed / duration, 1);
      
      // Easing function (outQuad)
      var easeProgress = progress * (2 - progress);
      current = Math.floor(easeProgress * target);
      
      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target;
      }
    }
    requestAnimationFrame(update);
  }

  // ===== Custom Sort Dropdown =====
  function initSortDropdown() {
    var currentOption = SORT_OPTIONS.find(function(o) { return o.value === currentSort; }) || SORT_OPTIONS[0];
    $sortDropdown.innerHTML = 
      '<button class="sort-trigger" id="sort-trigger" type="button">' +
        '<span class="sort-trigger-icon">' + currentOption.icon + '</span>' +
        '<span class="sort-trigger-text">' + currentOption.label + '</span>' +
        '<svg class="sort-trigger-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<polyline points="6 9 12 15 18 9"/>' +
        '</svg>' +
      '</button>' +
      '<div class="sort-menu" id="sort-menu">' +
        SORT_OPTIONS.map(function(opt) {
          return '<button class="sort-option ' + (opt.value === currentSort ? 'active' : '') + '" data-value="' + opt.value + '" type="button">' +
            '<span class="sort-option-icon">' + opt.icon + '</span>' +
            '<span>' + opt.label + '</span>' +
            (opt.value === currentSort ? '<svg class="sort-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
          '</button>';
        }).join('') +
      '</div>';
  }

  function toggleSortDropdown() {
    sortDropdownOpen = !sortDropdownOpen;
    var $menu = document.getElementById('sort-menu');
    var $trigger = document.getElementById('sort-trigger');
    if (sortDropdownOpen) {
      $menu.classList.add('open');
      $trigger.classList.add('open');
    } else {
      $menu.classList.remove('open');
      $trigger.classList.remove('open');
    }
  }

  function closeSortDropdown() {
    sortDropdownOpen = false;
    var $menu = document.getElementById('sort-menu');
    var $trigger = document.getElementById('sort-trigger');
    if ($menu) $menu.classList.remove('open');
    if ($trigger) $trigger.classList.remove('open');
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
      var chip = e.target.closest('.filter-chip');
      if (!chip) return;
      $categoryFilters.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
      chip.classList.add('active');
      currentCategory = chip.dataset.category;
      applyFilters();
    });

    // Sort dropdown
    $sortDropdown.addEventListener('click', function (e) {
      var trigger = e.target.closest('.sort-trigger');
      if (trigger) {
        e.stopPropagation();
        toggleSortDropdown();
        return;
      }
      var option = e.target.closest('.sort-option');
      if (option) {
        currentSort = option.dataset.value;
        closeSortDropdown();
        initSortDropdown();
        applyFilters();
      }
    });

    // Close dropdown on outside click
    document.addEventListener('click', function (e) {
      if (!$sortDropdown.contains(e.target)) {
        closeSortDropdown();
      }
    });

    // Reset
    $btnReset.addEventListener('click', function () {
      $searchInput.value = '';
      currentSearch = '';
      $searchClear.style.display = 'none';
      currentCategory = 'all';
      $categoryFilters.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
      var $allChip = $categoryFilters.querySelector('[data-category="all"]');
      if ($allChip) $allChip.classList.add('active');
      currentSort = 'updated-desc';
      initSortDropdown();
      applyFilters();
    });

    // Modal close
    $modalClose.addEventListener('click', closeModal);
    $modalOverlay.addEventListener('click', function (e) {
      if (e.target === $modalOverlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeModal();
        closeSortDropdown();
      }
    });
  }

  // ===== Filtering & Sorting =====
  function applyFilters() {
    filteredPlugins = allPlugins.filter(function(plugin) {
      // Category filter
      if (currentCategory !== 'all' && plugin.category !== currentCategory) return false;

      // Search filter
      if (currentSearch) {
        return plugin._searchStr.indexOf(currentSearch) !== -1;
      }
      return true;
    });

    // Sort
    filteredPlugins.sort(function(a, b) {
      switch (currentSort) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'stars-desc':
          return (b.stars || 0) - (a.stars || 0);
        case 'updated-desc':
          return b._updatedAt - a._updatedAt;
        case 'updated-asc':
          return a._updatedAt - b._updatedAt;
        case 'created-desc':
          return b._createdAt - a._createdAt;
        case 'created-asc':
          return a._createdAt - b._createdAt;
        default:
          return 0;
      }
    });

    renderGrid();
    updateResultsCount();
  }

  function updateResultsCount() {
    if (currentSearch || currentCategory !== 'all') {
      $resultsCount.textContent = filteredPlugins.length + '件のプラグインが見つかりました';
    } else {
      $resultsCount.textContent = '全' + allPlugins.length + '件のプラグイン';
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

    var htmlChunks = filteredPlugins.map(function(plugin, index) {
      return createCardHtml(plugin, index);
    });
    $grid.innerHTML = htmlChunks.join('');

    // Use event delegation (already bound or bind here once)
    $grid.onclick = function (e) {
      var card = e.target.closest('.plugin-card');
      if (!card) return;
      
      var pluginId = card.dataset.pluginId;
      var plugin = allPlugins.find(function(p) { return p.id === pluginId; });
      if (plugin) openModal(plugin);
    };
  }

  function createCardHtml(plugin, index) {
    var categoryInfo = CATEGORY_MAP[plugin.category] || CATEGORY_MAP['other'];
    var badgeClass = 'badge-' + plugin.category;
    var authorInitial = (plugin.author || '?')[0].toUpperCase();
    var stars = plugin.stars || 0;
    var updatedDate = plugin.lastUpdated
      ? new Date(plugin.lastUpdated).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
      : '-';
    
    var tagsHtml = (plugin.tags || []).slice(0, 4).map(function(tag) {
      return '<span class="card-tag">' + escapeHtml(tag) + '</span>';
    }).join('');

    var animationDelay = Math.min(index * 0.05, 1.2);
    
    return '<article class="plugin-card" data-plugin-id="' + escapeHtml(plugin.id) + '" style="animation-delay: ' + animationDelay + 's">' +
        '<div class="card-header">' +
          '<h2 class="card-title">' + escapeHtml(plugin.name) + '</h2>' +
          '<span class="card-category-badge ' + badgeClass + '">' +
            categoryInfo.icon + ' ' + categoryInfo.label +
          '</span>' +
        '</div>' +
        '<p class="card-description">' + escapeHtml(plugin.description) + '</p>' +
        (tagsHtml ? '<div class="card-tags">' + tagsHtml + '</div>' : '') +
        '<div class="card-footer">' +
          '<div class="card-author">' +
            '<span class="card-author-avatar">' + authorInitial + '</span>' +
            escapeHtml(plugin.author) +
          '</div>' +
          '<div class="card-meta">' +
            (stars > 0 ? 
              '<span class="card-meta-item">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
                stars +
              '</span>' : ''
            ) +
            '<span class="card-meta-item">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
              updatedDate +
            '</span>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  // ===== Modal =====
  function openModal(plugin) {
    var categoryInfo = CATEGORY_MAP[plugin.category] || CATEGORY_MAP['other'];
    var badgeClass = 'badge-' + plugin.category;
    var updatedDate = plugin.lastUpdated
      ? new Date(plugin.lastUpdated).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
      : '不明';
    var createdDate = plugin.createdAt
      ? new Date(plugin.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
      : '不明';

    var tagsHtml = (plugin.tags || []).map(function(tag) {
      return '<span class="modal-tag">' + escapeHtml(tag) + '</span>';
    }).join('');

    $modalContent.innerHTML = 
      '<span class="modal-badge card-category-badge ' + badgeClass + '">' +
        categoryInfo.icon + ' ' + categoryInfo.label +
      '</span>' +
      '<h2 class="modal-title">' + escapeHtml(plugin.name) + '</h2>' +
      '<div class="modal-author">' +
        '<span class="card-author-avatar" style="width:28px;height:28px;font-size:0.75rem;">' +
          (plugin.author || '?')[0].toUpperCase() +
        '</span>' +
        ' 作者: ' +
        '<a href="' + escapeHtml(plugin.authorUrl) + '" target="_blank" rel="noopener">' +
          escapeHtml(plugin.author) +
        '</a>' +
      '</div>' +
      '<div class="modal-description">' +
        escapeHtml(plugin.description) +
      '</div>' +
      '<div class="modal-info-grid">' +
        '<div class="modal-info-item">' +
          '<div class="modal-info-label">⭐ スター数</div>' +
          '<div class="modal-info-value">' + (plugin.stars || 0) + '</div>' +
        '</div>' +
        '<div class="modal-info-item">' +
          '<div class="modal-info-label">📅 最終更新</div>' +
          '<div class="modal-info-value">' + updatedDate + '</div>' +
        '</div>' +
        '<div class="modal-info-item">' +
          '<div class="modal-info-label">🆕 初回公開日</div>' +
          '<div class="modal-info-value">' + createdDate + '</div>' +
        '</div>' +
        '<div class="modal-info-item">' +
          '<div class="modal-info-label">🏷️ バージョン</div>' +
          '<div class="modal-info-value">' + escapeHtml(plugin.latestVersion || '不明') + '</div>' +
        '</div>' +
        '<div class="modal-info-item">' +
          '<div class="modal-info-label">📜 ライセンス</div>' +
          '<div class="modal-info-value">' + escapeHtml(plugin.license || '不明') + '</div>' +
        '</div>' +
      '</div>' +
      (tagsHtml ? '<div class="modal-tags">' + tagsHtml + '</div>' : '') +
      '<div class="modal-actions">' +
        (plugin.downloadUrl ? 
          '<a href="' + escapeHtml(plugin.downloadUrl) + '" target="_blank" rel="noopener" class="modal-btn modal-btn-primary">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>' +
              '<polyline points="7 10 12 15 17 10"/>' +
              '<line x1="12" y1="15" x2="12" y2="3"/>' +
            '</svg>' +
            'ダウンロード' +
          '</a>' : ''
        ) +
        (plugin.repoUrl ? 
          '<a href="' + escapeHtml(plugin.repoUrl) + '" target="_blank" rel="noopener" class="modal-btn modal-btn-secondary">' +
            '<svg viewBox="0 0 24 24" fill="currentColor">' +
              '<path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>' +
            '</svg>' +
            'GitHub' +
          '</a>' : ''
        ) +
      '</div>';

    $modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ===== Utilities =====
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      var args = arguments;
      var context = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  // ===== Start =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
