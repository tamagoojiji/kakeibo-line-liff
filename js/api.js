/**
 * GAS API通信（全てGETで統一 — GAS WebアプリのCORS制約回避）
 */
var API = (function() {
  var BASE_URL = 'https://script.google.com/macros/s/AKfycbxnfdfAjIHbG2npCQbT0cE-5PYpHJzNN6TSsjt5Zq9EWHCRuVOq7T8rfWKfVx-0EhUE/exec';
  var accessToken = null;

  function setAccessToken(token) {
    accessToken = token;
  }

  function get(action, params) {
    params = params || {};
    params.action = action;
    if (accessToken) params.accessToken = accessToken;

    var query = Object.keys(params).map(function(k) {
      var val = typeof params[k] === 'object' ? JSON.stringify(params[k]) : params[k];
      return encodeURIComponent(k) + '=' + encodeURIComponent(val);
    }).join('&');

    return fetch(BASE_URL + '?' + query, { redirect: 'follow' })
      .then(function(res) { return res.json(); })
      .catch(function(err) {
        console.error('API error:', err);
        return { ok: false, error: err.message };
      });
  }

  return {
    setAccessToken: setAccessToken,
    getDashboard: function() { return get('dashboard'); },
    getTransactions: function(month) { return get('transactions', { month: month }); },
    getBudget: function(month) { return get('get_budget', { month: month }); },
    setBudget: function(month, totalBudget, categoryBudgets) {
      return get('set_budget', { month: month, totalBudget: totalBudget, categoryBudgets: categoryBudgets });
    },
    getAnnual: function(year) { return get('annual', { year: year }); },
    getTrend: function() { return get('trend'); },
    getSuggestBudget: function(month) { return get('suggest_budget', { month: month }); },
    updateTransaction: function(txId, data) {
      return get('update_transaction', { txId: txId, data: data });
    },
    deleteTransaction: function(txId) {
      return get('delete_transaction', { txId: txId });
    },
    deleteAllData: function() {
      return get('delete_all_data');
    },
    importCsv: function(csvText) {
      return get('import_csv', { csvText: csvText });
    },
    confirmImport: function(items) {
      return get('confirm_import', { items: items });
    }
  };
})();
