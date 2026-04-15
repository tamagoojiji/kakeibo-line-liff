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
    '食費': '🍽', '日用品': '🧴', '交通費': '🚃',
    '医療費': '🏥', '教育費': '📚', '趣味・娯楽': '🎮', 'その他': '📦'
  };

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
      case 'history': loadHistory(); break;
      case 'trend': loadTrend(); break;
      case 'calendar': loadCalendar(); break;
      case 'annual': loadAnnual(); break;
      case 'import': loadImport(); break;
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

  function loadBudget() {
    document.getElementById('budget-month-label').textContent = formatMonthLabel(budgetMonth);

    // カテゴリ入力フィールド生成
    var catEl = document.getElementById('budget-categories');
    if (catEl.children.length === 0) {
      ChartHelper.CATEGORIES.forEach(function(cat) {
        catEl.innerHTML +=
          '<div class="form-group">' +
            '<label>' + (CATEGORY_EMOJI[cat] || '') + ' ' + cat + '</label>' +
            '<input type="number" id="budget-cat-' + cat + '" placeholder="0" inputmode="numeric">' +
          '</div>';
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

  // === 明細一覧 ===
  var historyMonth = getCurrentMonth();

  function loadHistory() {
    document.getElementById('history-month-label').textContent = formatMonthLabel(historyMonth);

    API.getTransactions(historyMonth).then(function(data) {
      if (!data.ok) return;
      var list = data.transactions || [];
      var listEl = document.getElementById('history-list');
      var emptyEl = document.getElementById('history-empty');
      var totalEl = document.getElementById('history-total');

      if (list.length === 0) {
        listEl.innerHTML = '';
        emptyEl.style.display = 'block';
        totalEl.textContent = '';
        return;
      }

      emptyEl.style.display = 'none';
      var total = list.reduce(function(sum, tx) { return sum + tx.total; }, 0);
      totalEl.textContent = list.length + '件 / 合計 ¥' + formatNum(total);

      listEl.innerHTML = list.map(function(tx) {
        return '<div class="history-item" data-id="' + tx.id + '">' +
          '<div class="history-left">' +
            '<span class="history-store">' + (tx.store || tx.memo || 'ー') + '</span>' +
            '<span class="history-meta">' + tx.date + '</span>' +
          '</div>' +
          '<div class="history-right">' +
            '<span class="history-amount">¥' + formatNum(tx.total) + '</span>' +
            '<span class="history-category">' + (CATEGORY_EMOJI[tx.category] || '') + ' ' + tx.category + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    });
  }

  function openEditModal(txId) {
    editingTxId = txId;

    API.getTransactions(historyMonth).then(function(data) {
      var tx = (data.transactions || []).find(function(t) { return t.id === txId; });
      if (!tx) return;

      document.getElementById('edit-date').value = tx.date;
      document.getElementById('edit-store').value = tx.store || '';
      document.getElementById('edit-total').value = tx.total;
      document.getElementById('edit-category').value = tx.category;
      document.getElementById('edit-modal').style.display = 'flex';
    });
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
      if (res.ok) loadHistory();
      else alert('更新に失敗しました');
    });
  }

  // === 月別推移 ===
  function loadTrend() {
    API.getTrend().then(function(data) {
      if (!data.ok) return;
      ChartHelper.renderTrend('chart-trend', data.months || []);
    });
  }

  // === 年間表 ===
  function loadAnnual() {
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

      // 年間合計行
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

    API.getTransactions(calendarMonth).then(function(data) {
      if (!data.ok) return;
      calendarTransactions = data.transactions || [];

      var total = calendarTransactions.reduce(function(s, tx) { return s + tx.total; }, 0);
      document.getElementById('calendar-total').textContent =
        calendarTransactions.length + '件 / 合計 ¥' + formatNum(total);

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

  // === CSVインポート ===
  var importItems = [];

  function loadImport() {
    document.getElementById('import-status').style.display = 'none';
    document.getElementById('import-preview').style.display = 'none';
    document.getElementById('csv-file-input').value = '';
    importItems = [];
  }

  function handleCsvUpload(file) {
    if (!file || !file.name.match(/\.csv$/i)) {
      alert('CSVファイル（.csv）を選択してください。');
      return;
    }

    var statusEl = document.getElementById('import-status');
    statusEl.style.display = 'block';
    statusEl.textContent = '解析中...';
    statusEl.className = 'import-status loading';
    document.getElementById('import-preview').style.display = 'none';

    var reader = new FileReader();
    reader.onload = function(e) {
      var csvText = e.target.result;
      API.importCsv(csvText).then(function(data) {
        if (!data.ok || !data.items || data.items.length === 0) {
          statusEl.textContent = 'CSVの解析に失敗しました。銀行口座やクレカの明細CSVを選択してください。';
          statusEl.className = 'import-status error';
          return;
        }
        importItems = data.items;
        statusEl.style.display = 'none';
        renderImportPreview(importItems);
      });
    };
    reader.readAsText(file);
  }

  function renderImportPreview(items) {
    var total = 0;
    for (var i = 0; i < items.length; i++) total += items[i].total;

    document.getElementById('import-summary').textContent = items.length + '件 / 合計 ¥' + formatNum(total);
    var tbody = document.getElementById('import-tbody');
    var categories = ['食費', '日用品', '交通費', '医療費', '教育費', '趣味・娯楽', 'その他'];

    tbody.innerHTML = items.map(function(item, idx) {
      var options = categories.map(function(cat) {
        var selected = cat === item.category ? ' selected' : '';
        return '<option value="' + cat + '"' + selected + '>' + cat + '</option>';
      }).join('');
      return '<tr>' +
        '<td>' + (item.date || '-') + '</td>' +
        '<td>' + (item.store || '-') + '</td>' +
        '<td class="amount">¥' + formatNum(item.total) + '</td>' +
        '<td><select class="import-cat-select" data-idx="' + idx + '">' + options + '</select></td>' +
        '</tr>';
    }).join('');

    document.getElementById('import-preview').style.display = 'block';
  }

  function confirmImport() {
    // カテゴリ変更を反映
    var selects = document.querySelectorAll('.import-cat-select');
    selects.forEach(function(sel) {
      var idx = parseInt(sel.dataset.idx);
      if (importItems[idx]) importItems[idx].category = sel.value;
    });

    var statusEl = document.getElementById('import-status');
    statusEl.style.display = 'block';
    statusEl.textContent = '保存中...';
    statusEl.className = 'import-status loading';

    API.confirmImport(importItems).then(function(data) {
      if (data.ok) {
        statusEl.textContent = '✅ ' + data.count + '件を取り込みました！';
        statusEl.className = 'import-status success';
        document.getElementById('import-preview').style.display = 'none';
        importItems = [];
      } else {
        statusEl.textContent = '保存に失敗しました: ' + (data.error || '');
        statusEl.className = 'import-status error';
      }
    });
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

    // 明細月切り替え
    document.getElementById('history-prev').addEventListener('click', function() {
      historyMonth = shiftMonth(historyMonth, -1);
      loadHistory();
    });
    document.getElementById('history-next').addEventListener('click', function() {
      historyMonth = shiftMonth(historyMonth, 1);
      loadHistory();
    });

    // 明細クリック → 編集
    document.getElementById('history-list').addEventListener('click', function(e) {
      var item = e.target.closest('.history-item');
      if (item) openEditModal(item.dataset.id);
    });

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

    // 年間切り替え
    document.getElementById('annual-prev').addEventListener('click', function() {
      currentYear = (parseInt(currentYear) - 1).toString();
      loadAnnual();
    });
    document.getElementById('annual-next').addEventListener('click', function() {
      currentYear = (parseInt(currentYear) + 1).toString();
      loadAnnual();
    });

    // CSVインポート
    document.getElementById('csv-file-input').addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) handleCsvUpload(e.target.files[0]);
    });
    document.getElementById('import-confirm').addEventListener('click', confirmImport);
    document.getElementById('import-cancel').addEventListener('click', function() {
      loadImport();
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
