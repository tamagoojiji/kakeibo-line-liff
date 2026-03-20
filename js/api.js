/**
 * GAS API通信
 */
var API = (function() {
  // GASデプロイURL
  var BASE_URL = 'https://script.google.com/macros/s/AKfycbxnfdfAjIHbG2npCQbT0cE-5PYpHJzNN6TSsjt5Zq9EWHCRuVOq7T8rfWKfVx-0EhUE/exec';
  var accessToken = null;

  function setAccessToken(token) {
    accessToken = token;
  }

  function get(action, params) {
    params = params || {};
    params.action = action;
    params.accessToken = accessToken;

    var query = Object.keys(params).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');

    return fetch(BASE_URL + '?' + query)
      .then(function(res) { return res.json(); });
  }

  function post(action, data) {
    data = data || {};
    data.action = action;
    data.accessToken = accessToken;

    return fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(res) { return res.json(); });
  }

  return {
    setAccessToken: setAccessToken,
    getDashboard: function() { return get('dashboard'); },
    getTransactions: function(month) { return get('transactions', { month: month }); },
    getBudget: function(month) { return get('get_budget', { month: month }); },
    setBudget: function(month, totalBudget, categoryBudgets) {
      return post('set_budget', { month: month, totalBudget: totalBudget, categoryBudgets: categoryBudgets });
    },
    getAnnual: function(year) { return get('annual', { year: year }); },
    getTrend: function() { return get('trend'); },
    getSuggestBudget: function(month) { return get('suggest_budget', { month: month }); },
    updateTransaction: function(txId, data) {
      return post('update_transaction', { txId: txId, data: data });
    },
    deleteTransaction: function(txId) {
      return post('delete_transaction', { txId: txId });
    },
    deleteAllData: function() {
      return post('delete_all_data');
    }
  };
})();
