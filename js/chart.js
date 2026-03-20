/**
 * Chart.js ラッパー
 */
var ChartHelper = (function() {
  var CATEGORY_COLORS = {
    '食費': '#FF6384',
    '日用品': '#36A2EB',
    '交通費': '#FFCE56',
    '医療費': '#4BC0C0',
    '教育費': '#9966FF',
    '趣味・娯楽': '#FF9F40',
    'その他': '#C9CBCF'
  };

  var CATEGORIES = ['食費', '日用品', '交通費', '医療費', '教育費', '趣味・娯楽', 'その他'];

  var charts = {};

  function destroy(id) {
    if (charts[id]) {
      charts[id].destroy();
      charts[id] = null;
    }
  }

  function renderDoughnut(canvasId, categoryTotals) {
    destroy(canvasId);
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;

    var labels = [];
    var data = [];
    var colors = [];

    CATEGORIES.forEach(function(cat) {
      var val = categoryTotals[cat] || 0;
      if (val > 0) {
        labels.push(cat);
        data.push(val);
        colors.push(CATEGORY_COLORS[cat]);
      }
    });

    if (data.length === 0) {
      labels.push('データなし');
      data.push(1);
      colors.push('#e0e0e0');
    }

    charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        cutout: '65%'
      }
    });
  }

  function renderTrend(canvasId, months) {
    destroy(canvasId);
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;

    var labels = months.map(function(m) {
      return m.month.split('-')[1] + '月';
    });
    var spentData = months.map(function(m) { return m.totalSpent; });
    var budgetData = months.map(function(m) { return m.budget; });

    var datasets = [{
      label: '支出',
      data: spentData,
      backgroundColor: 'rgba(76, 175, 80, 0.6)',
      borderColor: '#4CAF50',
      borderWidth: 1,
      type: 'bar'
    }];

    // 予算データがある月があれば予算ラインも表示
    var hasBudget = budgetData.some(function(b) { return b > 0; });
    if (hasBudget) {
      datasets.push({
        label: '予算',
        data: budgetData,
        borderColor: '#FF6384',
        borderWidth: 2,
        borderDash: [5, 5],
        type: 'line',
        fill: false,
        pointRadius: 3
      });
    }

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 12 } }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '¥' + value.toLocaleString();
              }
            }
          }
        }
      }
    });
  }

  return {
    renderDoughnut: renderDoughnut,
    renderTrend: renderTrend,
    CATEGORY_COLORS: CATEGORY_COLORS,
    CATEGORIES: CATEGORIES
  };
})();
