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
  var $themeToggleBtn = document.getElementById('theme-toggle-btn');
  var $chartWrapper = document.getElementById('chart-wrapper');
  var $chartEmpty = document.getElementById('chart-empty');

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
      renderTrendChart();
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

    // Theme toggle
    if ($themeToggleBtn) {
      $themeToggleBtn.addEventListener('click', toggleTheme);
    }

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

    var animationDelay = index < 20 ? index * 0.04 : 0;
    
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

    document.body.style.overflow = 'hidden';

    // DOMの反映（レイアウト計算・ペイント）が確実に終わってからアニメーションを開始しカクつきを防止
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        $modalOverlay.classList.add('active');
      });
    });
  }

  function closeModal() {
    $modalOverlay.classList.remove('active');
    // トランジションの完了を待ってからスクロールを再度有効化
    setTimeout(function() {
      if (!$modalOverlay.classList.contains('active')) {
        document.body.style.overflow = '';
      }
    }, 300);
  }

  // ===== Theme (Dark/Light) =====
  var THEME_STORAGE_KEY = 'ymm4-catalog-theme';

  function initTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (e) { /* localStorage unavailable */ }

    var theme = saved;
    if (!theme) {
      theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
        ? 'light'
        : 'dark';
    }
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) { /* localStorage unavailable */ }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Apply theme as early as possible (before full init) to avoid flash
  initTheme();

  // ===== Plugin Count Trend Chart =====
  function renderTrendChart() {
    if (!$chartWrapper) return;

    // createdAt を基に、月ごとの累積プラグイン数を算出
    var withDates = allPlugins.filter(function (p) { return p._createdAt; });

    if (withDates.length === 0) {
      $chartWrapper.style.display = 'none';
      if ($chartEmpty) $chartEmpty.style.display = 'block';
      return;
    }

    var sorted = withDates.slice().sort(function (a, b) { return a._createdAt - b._createdAt; });

    // 月単位（YYYY-MM）でグループ化して累積カウント
    var monthlyCounts = {};
    sorted.forEach(function (p) {
      var d = new Date(p._createdAt);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    });

    var months = Object.keys(monthlyCounts).sort();
    var cumulative = 0;
    var points = months.map(function (key) {
      cumulative += monthlyCounts[key];
      var parts = key.split('-');
      return {
        label: parts[0] + '年' + parseInt(parts[1], 10) + '月',
        shortLabel: parts[1] + '月',
        year: parts[0],
        value: cumulative
      };
    });

    if (points.length < 2) {
      // データ点が少なすぎる場合は現在の合計のみ表示
      $chartWrapper.style.display = 'none';
      if ($chartEmpty) $chartEmpty.style.display = 'block';
      return;
    }

    $chartWrapper.style.display = 'block';
    if ($chartEmpty) $chartEmpty.style.display = 'none';

    $chartWrapper.innerHTML = buildChartSvg(points);
    bindChartTooltips();
  }

  function buildChartSvg(points) {
    var width = 1000;
    var height = 340;
    var paddingLeft = 46;
    var paddingRight = 20;
    var paddingTop = 24;
    var paddingBottom = 40;

    var chartW = width - paddingLeft - paddingRight;
    var chartH = height - paddingTop - paddingBottom;

    var maxValue = points[points.length - 1].value;
    var niceMax = Math.ceil(maxValue / 5) * 5 || 5;

    var stepX = chartW / (points.length - 1);

    function xForIndex(i) { return paddingLeft + i * stepX; }
    function yForValue(v) { return paddingTop + chartH - (v / niceMax) * chartH; }

    var linePoints = points.map(function (p, i) {
      return xForIndex(i) + ',' + yForValue(p.value);
    }).join(' ');

    var areaPoints = linePoints +
      ' ' + xForIndex(points.length - 1) + ',' + (paddingTop + chartH) +
      ' ' + xForIndex(0) + ',' + (paddingTop + chartH);

    // Y軸グリッド線・ラベル（5分割）
    var gridLines = '';
    var yLabels = '';
    var gridCount = 5;
    for (var g = 0; g <= gridCount; g++) {
      var val = Math.round((niceMax / gridCount) * g);
      var y = yForValue(val);
      gridLines += '<line class="chart-grid-line" x1="' + paddingLeft + '" y1="' + y + '" x2="' + (width - paddingRight) + '" y2="' + y + '"/>';
      yLabels += '<text class="chart-axis-label" x="' + (paddingLeft - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + val + '</text>';
    }

    // X軸ラベル（データ点が多い場合は間引く）
    var maxLabels = 10;
    var labelInterval = Math.max(1, Math.ceil(points.length / maxLabels));
    var xLabels = '';
    points.forEach(function (p, i) {
      if (i % labelInterval !== 0 && i !== points.length - 1) return;
      xLabels += '<text class="chart-axis-label" x="' + xForIndex(i) + '" y="' + (height - paddingBottom + 20) + '" text-anchor="middle">' + escapeHtml(p.label) + '</text>';
    });

    // データ点（丸）とツールチップ用のtitle
    var circles = points.map(function (p, i) {
      var cx = xForIndex(i);
      var cy = yForValue(p.value);
      return '<g class="chart-point-group" data-label="' + escapeHtml(p.label) + '" data-value="' + p.value + '">' +
        '<circle class="chart-point" cx="' + cx + '" cy="' + cy + '" r="4"></circle>' +
        '<title>' + escapeHtml(p.label) + ': ' + p.value + '件</title>' +
        '</g>';
    }).join('');

    return (
      '<svg viewBox="0 0 ' + width + ' ' + height + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="プラグイン総数の推移グラフ">' +
        '<defs>' +
          '<linearGradient id="chart-line-grad" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0%" stop-color="#a78bfa"/>' +
            '<stop offset="100%" stop-color="#06b6d4"/>' +
          '</linearGradient>' +
          '<linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#a78bfa" stop-opacity="0.35"/>' +
            '<stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/>' +
          '</linearGradient>' +
        '</defs>' +
        gridLines +
        '<line class="chart-axis-line" x1="' + paddingLeft + '" y1="' + paddingTop + '" x2="' + paddingLeft + '" y2="' + (paddingTop + chartH) + '"/>' +
        '<line class="chart-axis-line" x1="' + paddingLeft + '" y1="' + (paddingTop + chartH) + '" x2="' + (width - paddingRight) + '" y2="' + (paddingTop + chartH) + '"/>' +
        yLabels +
        xLabels +
        '<polygon class="chart-area-fill" points="' + areaPoints + '"></polygon>' +
        '<polyline class="chart-line" points="' + linePoints + '"></polyline>' +
        circles +
      '</svg>'
    );
  }

  function bindChartTooltips() {
    // ネイティブ<title>によるツールチップのみ使用（シンプル・軽量）
    // 追加のインタラクションが必要な場合はここに拡張
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
