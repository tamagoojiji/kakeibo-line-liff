/**
 * 簡単家計簿 LIFF アプリ
 */
(function() {
  var LIFF_ID = '2009553035-Nz6zsu4s';
  var currentPage = 'dashboard';
  var currentMonth = getCurrentMonth();
  var currentYear = new Date().getFullYear().toString();
  var editingTxId = null;

  var CATEGORY_EMOJI = {
    '食費': '🛒', '外食費': '🍽', '日用品': '🧴', '交通費': '🚃',
    '医療費': '🏥', '教育費': '📚', '趣味・娯楽': '🎮', 'その他': '📦'
  };

  // カテゴリ別予算のクイック金額ボタン
  var CATEGORY_QUICK_AMOUNTS = {
    '食費': [10000, 20000, 30000, 50000, 80000]
    // 他のカテゴリはデフォルト [5000, 10000, 20000, 30000, 50000]
  };
  var DEFAULT_QUICK_AMOUNTS = [5000, 10000, 20000, 30000, 50000];

  function formatQuickLabel(n) {
    if (n >= 10000) return (n / 10000) + '万';
    return (n / 1000) + '千';
  }

  // === 初期化 ===
  function init() {
    if (!LIFF_ID) {
      // LIFF_IDが未設定の場合はデモモードで起動
      document.getElementById('loading').style.display = 'none';
      document.getElementById('nav').style.display = 'flex';
      showPage('dashboard');
      loadDashboard();
      return;
    }

    liff.init({ liffId: LIFF_ID }).then(function() {
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      var token = liff.getAccessToken();
      API.setAccessToken(token);

      document.getElementById('loading').style.display = 'none';
      document.getElementById('nav').style.display = 'flex';
      showPage('dashboard');
      loadDashboard();
    }).catch(function(err) {
      console.error('LIFF init error:', err);
      document.getElementById('loading').innerHTML = '<p>エラーが発生しました</p>';
    });
  }

  // === ページ切り替え ===
  function showPage(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(function(el) {
      el.style.display = 'none';
    });
    document.getElementById('page-' + page).style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // ページ初期化
    switch (page) {
      case 'dashboard': loadDashboard(); break;
      case 'budget': loadBudget(); break;
      case 'calendar': loadCalendar(); break;
      case 'analysis': loadAnalysis(); break;
    }
  }

  // === ダッシュボード ===
  function loadDashboard() {
    var monthLabel = formatMonthLabel(currentMonth);
    document.getElementById('dashboard-month-label').textContent = monthLabel + 'のまとめ';

    API.getDashboard().then(function(data) {
      if (!data.ok) return;

      var budget = data.budget || 0;
      var spent = data.totalSpent || 0;
      var remaining = budget - spent;

      document.getElementById('dashboard-budget').textContent = '¥' + formatNum(budget);
      document.getElementById('dashboard-spent').textContent = '¥' + formatNum(spent);

      if (budget > 0) {
        document.getElementById('dashboard-remaining').textContent = '¥' + formatNum(remaining);
        var pct = Math.max(0, Math.min(100, Math.round(remaining / budget * 100)));
        document.getElementById('dashboard-progress').style.width = pct + '%';
        document.getElementById('dashboard-progress').style.background =
          remaining < 0 ? '#e53935' : '#4CAF50';
      } else {
        document.getElementById('dashboard-remaining').textContent = '¥' + formatNum(spent);
        document.querySelector('.balance-label').textContent = '今月の使用額';
        document.getElementById('dashboard-progress').style.width = '0%';
      }

      // カテゴリグラフ
      ChartHelper.renderDoughnut('chart-category', data.categoryTotals || {});

      // カテゴリリスト
      var listEl = document.getElementById('category-list');
      listEl.innerHTML = '';
      ChartHelper.CATEGORIES.forEach(function(cat) {
        var amount = (data.categoryTotals || {})[cat] || 0;
        if (amount === 0) return;
        var pct = spent > 0 ? Math.round(amount / spent * 100) : 0;
        listEl.innerHTML +=
          '<div class="category-row">' +
            '<span class="category-name">' +
              '<span style="color:' + ChartHelper.CATEGORY_COLORS[cat] + '">●</span> ' +
              (CATEGORY_EMOJI[cat] || '') + ' ' + cat +
            '</span>' +
            '<span>' +
              '<span class="category-amount">¥' + formatNum(amount) + '</span>' +
              '<span class="category-pct"> (' + pct + '%)</span>' +
            '</span>' +
          '</div>';
      });
    });
  }

  // === 予算設定 ===
  var budgetMonth = getCurrentMonth();
  var lastSuggestion = null;

  function loadBudget() {
    document.getElementById('budget-month-label').textContent = formatMonthLabel(budgetMonth);

    // カテゴリ入力フィールド生成
    var catEl = document.getElementById('budget-categories');
    if (catEl.children.length === 0) {
      ChartHelper.CATEGORIES.forEach(function(cat) {
        var amounts = CATEGORY_QUICK_AMOUNTS[cat] || DEFAULT_QUICK_AMOUNTS;
        var quickHtml = amounts.map(function(n) {
          return '<button type="button" class="quick-btn quick-cat-btn" data-cat="' + cat + '" data-amount="' + n + '">' + formatQuickLabel(n) + '</button>';
        }).join('');
        catEl.innerHTML +=
          '<div class="form-group">' +
            '<label>' + (CATEGORY_EMOJI[cat] || '') + ' ' + cat + '</label>' +
            '<input type="number" id="budget-cat-' + cat + '" placeholder="0" inputmode="numeric">' +
            '<div class="quick-amount quick-amount-cat">' + quickHtml + '</div>' +
          '</div>';
      });

      // カテゴリ別クイック金額ボタンのイベント（イベント委譲で1回だけバインド）
      catEl.addEventListener('click', function(e) {
        var btn = e.target.closest('.quick-cat-btn');
        if (!btn) return;
        var input = document.getElementById('budget-cat-' + btn.dataset.cat);
        if (input) input.value = btn.dataset.amount;
      });
    }

    API.getBudget(budgetMonth).then(function(data) {
      if (!data.ok) return;
      document.getElementById('budget-total').value = data.totalBudget || '';
      ChartHelper.CATEGORIES.forEach(function(cat) {
        var input = document.getElementById('budget-cat-' + cat);
        if (input) input.value = (data.categoryBudgets || {})[cat] || '';
      });
    });

    // 翌月提案
    loadSuggestion();
  }

  function loadSuggestion() {
    var nextMonth = getNextMonth();
    API.getSuggestBudget(nextMonth).then(function(data) {
      if (!data.ok || !data.suggestion || data.suggestion.totalBudget === 0) {
        document.getElementById('budget-suggestion').style.display = 'none';
        return;
      }

      document.getElementById('budget-suggestion').style.display = 'block';
      var s = data.suggestion;
      lastSuggestion = { month: nextMonth, totalBudget: s.totalBudget, categoryBudgets: s.categoryBudgets || {} };
      var html = '<p style="font-size:13px;color:#999;margin-bottom:8px">' + s.basedOn + '</p>';
      html += '<div class="suggest-row"><span>合計</span><span>¥' + formatNum(s.totalBudget) + '</span></div>';
      ChartHelper.CATEGORIES.forEach(function(cat) {
        var val = (s.categoryBudgets || {})[cat] || 0;
        if (val > 0) {
          html += '<div class="suggest-row"><span>' + (CATEGORY_EMOJI[cat] || '') + ' ' + cat + '</span><span>¥' + formatNum(val) + '</span></div>';
        }
      });
      document.getElementById('suggestion-content').innerHTML = html;
    });
  }

  function applySuggestion() {
    if (!lastSuggestion) return;
    var s = lastSuggestion;
    API.setBudget(s.month, s.totalBudget, s.categoryBudgets).then(function(data) {
      if (data.ok) {
        alert(formatMonthLabel(s.month) + 'の予算として保存しました');
        budgetMonth = s.month;
        loadBudget();
      } else {
        alert('保存に失敗しました');
      }
    });
  }

  function saveBudget() {
    var totalBudget = parseInt(document.getElementById('budget-total').value) || 0;
    var categoryBudgets = {};
    ChartHelper.CATEGORIES.forEach(function(cat) {
      var input = document.getElementById('budget-cat-' + cat);
      if (input) categoryBudgets[cat] = parseInt(input.value) || 0;
    });

    API.setBudget(budgetMonth, totalBudget, categoryBudgets).then(function(data) {
      if (data.ok) {
        alert('保存しました');
      } else {
        alert('保存に失敗しました');
      }
    });
  }

  // === 編集モーダル ===
  function openEditModal(txId) {
    editingTxId = txId;
    var tx = calendarTransactions.find(function(t) { return t.id === txId; });
    if (!tx) return;

    document.getElementById('edit-date').value = tx.date;
    document.getElementById('edit-store').value = tx.store || '';
    document.getElementById('edit-total').value = tx.total;
    document.getElementById('edit-category').value = tx.category;
    document.getElementById('edit-modal').style.display = 'flex';
  }

  function saveEdit() {
    if (!editingTxId) return;
    var data = {
      date: document.getElementById('edit-date').value,
      store: document.getElementById('edit-store').value,
      total: parseInt(document.getElementById('edit-total').value) || 0,
      category: document.getElementById('edit-category').value
    };

    API.updateTransaction(editingTxId, data).then(function(res) {
      document.getElementById('edit-modal').style.display = 'none';
      editingTxId = null;
      if (res.ok) loadCalendar();
      else alert('更新に失敗しました');
    });
  }

  // === 分析（推移+年間） ===
  function loadAnalysis() {
    // 推移グラフ
    API.getTrend().then(function(data) {
      if (!data.ok) return;
      ChartHelper.renderTrend('chart-trend', data.months || []);
    });

    // 年間表
    loadAnnualTable();
  }

  function loadAnnualTable() {
    document.getElementById('annual-year-label').textContent = currentYear + '年';

    API.getAnnual(currentYear).then(function(data) {
      if (!data.ok) return;
      var table = document.getElementById('annual-table');
      var months = data.months || [];

      var html = '<thead><tr><th>月</th>';
      ChartHelper.CATEGORIES.forEach(function(cat) {
        html += '<th>' + (CATEGORY_EMOJI[cat] || '') + '</th>';
      });
      html += '<th>合計</th></tr></thead><tbody>';

      months.forEach(function(m) {
        var monthNum = parseInt(m.month.split('-')[1]);
        html += '<tr><td>' + monthNum + '月</td>';
        ChartHelper.CATEGORIES.forEach(function(cat) {
          var val = (m.categoryTotals || {})[cat] || 0;
          html += '<td>' + (val > 0 ? formatNum(val) : '-') + '</td>';
        });
        html += '<td><strong>' + (m.totalSpent > 0 ? formatNum(m.totalSpent) : '-') + '</strong></td></tr>';
      });

      html += '<tr style="border-top:2px solid #333"><td><strong>合計</strong></td>';
      ChartHelper.CATEGORIES.forEach(function(cat) {
        var val = (data.yearCategoryTotals || {})[cat] || 0;
        html += '<td><strong>' + (val > 0 ? formatNum(val) : '-') + '</strong></td>';
      });
      html += '<td><strong>' + formatNum(data.yearTotal || 0) + '</strong></td></tr>';

      html += '</tbody>';
      table.innerHTML = html;
    });
  }

  // === カレンダー ===
  var calendarMonth = getCurrentMonth();
  var calendarTransactions = [];
  var selectedCalDate = null;

  function loadCalendar() {
    document.getElementById('calendar-month-label').textContent = formatMonthLabel(calendarMonth);
    document.getElementById('calendar-detail').style.display = 'none';
    selectedCalDate = null;
    calendarTransactions = [];
    document.getElementById('calendar-total').textContent = '';

    // まずグリッドだけ描画（データなし）
    renderCalendar();

    API.getTransactions(calendarMonth).then(function(data) {
      if (!data.ok) return;
      calendarTransactions = data.transactions || [];

      var total = calendarTransactions.reduce(function(s, tx) { return s + tx.total; }, 0);
      document.getElementById('calendar-total').textContent =
        calendarTransactions.length + '件 / 合計 ¥' + formatNum(total);

      // データ付きで再描画
      renderCalendar();
    });
  }

  function renderCalendar() {
    var parts = calendarMonth.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]);
    var firstDay = new Date(year, month - 1, 1).getDay();
    var daysInMonth = new Date(year, month, 0).getDate();
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    // 日ごとの合計を計算
    var dayTotals = {};
    calendarTransactions.forEach(function(tx) {
      var day = parseInt(tx.date.split('-')[2]);
      dayTotals[day] = (dayTotals[day] || 0) + tx.total;
    });

    var html = '';
    // 空セル（月初の曜日まで）
    for (var i = 0; i < firstDay; i++) {
      html += '<div class="cal-cell empty"></div>';
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = calendarMonth + '-' + String(d).padStart(2, '0');
      var dow = (firstDay + d - 1) % 7;
      var classes = 'cal-cell';
      if (dow === 0) classes += ' sun';
      if (dow === 6) classes += ' sat';
      if (dateStr === todayStr) classes += ' today';
      if (dayTotals[d]) classes += ' has-data';
      if (dateStr === selectedCalDate) classes += ' selected';

      html += '<div class="' + classes + '" data-date="' + dateStr + '">';
      html += '<span class="cal-date">' + d + '</span>';
      if (dayTotals[d]) {
        html += '<span class="cal-amount">¥' + formatNum(dayTotals[d]) + '</span>';
      }
      html += '</div>';
    }

    document.getElementById('calendar-body').innerHTML = html;
  }

  function showCalendarDetail(dateStr) {
    selectedCalDate = dateStr;
    renderCalendar();

    var dayTx = calendarTransactions.filter(function(tx) { return tx.date === dateStr; });
    var detailEl = document.getElementById('calendar-detail');
    var listEl = document.getElementById('calendar-detail-list');

    if (dayTx.length === 0) {
      detailEl.style.display = 'none';
      return;
    }

    var parts = dateStr.split('-');
    var total = dayTx.reduce(function(s, tx) { return s + tx.total; }, 0);
    document.getElementById('calendar-detail-title').textContent =
      parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日の明細（¥' + formatNum(total) + '）';

    listEl.innerHTML = dayTx.map(function(tx) {
      return '<div class="history-item" data-id="' + tx.id + '">' +
        '<div class="history-left">' +
          '<span class="history-store">' + (tx.store || tx.memo || 'ー') + '</span>' +
          '<span class="history-meta">' + (CATEGORY_EMOJI[tx.category] || '') + ' ' + tx.category + '</span>' +
        '</div>' +
        '<div class="history-right">' +
          '<span class="history-amount">¥' + formatNum(tx.total) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    detailEl.style.display = 'block';
  }

  // === イベントバインド ===
  function bindEvents() {
    // ナビゲーション
    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.addEventListener('click', function() {
        showPage(this.dataset.page);
      });
    });

    // 予算月切り替え
    document.getElementById('budget-prev').addEventListener('click', function() {
      budgetMonth = shiftMonth(budgetMonth, -1);
      loadBudget();
    });
    document.getElementById('budget-next').addEventListener('click', function() {
      budgetMonth = shiftMonth(budgetMonth, 1);
      loadBudget();
    });
    document.getElementById('budget-save').addEventListener('click', saveBudget);

    // クイック金額ボタン
    document.querySelectorAll('.quick-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.getElementById('budget-total').value = this.dataset.amount;
      });
    });

    // 翌月提案を適用して保存
    document.getElementById('budget-apply-suggestion').addEventListener('click', applySuggestion);

    // 編集モーダル
    document.getElementById('edit-save').addEventListener('click', saveEdit);
    document.getElementById('edit-cancel').addEventListener('click', function() {
      document.getElementById('edit-modal').style.display = 'none';
      editingTxId = null;
    });

    // カレンダー月切り替え
    document.getElementById('calendar-prev').addEventListener('click', function() {
      calendarMonth = shiftMonth(calendarMonth, -1);
      loadCalendar();
    });
    document.getElementById('calendar-next').addEventListener('click', function() {
      calendarMonth = shiftMonth(calendarMonth, 1);
      loadCalendar();
    });

    // カレンダー日付クリック
    document.getElementById('calendar-body').addEventListener('click', function(e) {
      var cell = e.target.closest('.cal-cell');
      if (cell && !cell.classList.contains('empty')) {
        showCalendarDetail(cell.dataset.date);
      }
    });

    // カレンダー詳細の明細クリック → 編集
    document.getElementById('calendar-detail-list').addEventListener('click', function(e) {
      var item = e.target.closest('.history-item');
      if (item) openEditModal(item.dataset.id);
    });

    // 年間切り替え
    document.getElementById('annual-prev').addEventListener('click', function() {
      currentYear = (parseInt(currentYear) - 1).toString();
      loadAnnualTable();
    });
    document.getElementById('annual-next').addEventListener('click', function() {
      currentYear = (parseInt(currentYear) + 1).toString();
      loadAnnualTable();
    });

    // データ削除
    document.getElementById('delete-all').addEventListener('click', function() {
      if (confirm('本当に全データを削除しますか？\nこの操作は取り消せません。')) {
        API.deleteAllData().then(function(res) {
          if (res.ok) {
            alert('データを削除しました');
            if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
              liff.closeWindow();
            }
          } else {
            alert('削除に失敗しました');
          }
        });
      }
    });
  }

  // === ユーティリティ ===
  function getCurrentMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function getNextMonth() {
    var d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function shiftMonth(month, delta) {
    var parts = month.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function formatMonthLabel(month) {
    var parts = month.split('-');
    return parts[0] + '年' + parseInt(parts[1]) + '月';
  }

  function formatNum(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // === 起動 ===
  document.addEventListener('DOMContentLoaded', function() {
    bindEvents();
    init();
  });
})();
