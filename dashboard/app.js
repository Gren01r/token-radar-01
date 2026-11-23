// Token Radar's dashboard. It reads window.RADAR (data.js, written beside dashboard/ by main.ts)
// and renders the ranked pre-token board, a live-token table kept apart from the ranks, filters, a
// search, sortable columns and a per-protocol detail view with the model's arithmetic and the
// protocol's farm plan from board.json itself. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', watchOnly: false, tab: 'pre', sort: 'implied', dir: -1, selected: null };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + ' yrs';
    return Math.max(0, Math.round(days)) + ' days';
  }
  function fmtMult(n) { return 'x' + Number(n).toFixed(2); }

  // The model, recomputed in the page from the row's own figures, so a reader can check that the
  // board's number and the page's arithmetic are the same: impliedValue() in lib/model.ts.
  function impliedOf(row) {
    var m = DATA.model;
    var catMult = Object.prototype.hasOwnProperty.call(DATA.category_multiples, row.category)
      ? DATA.category_multiples[row.category] : m.default_multiple;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d == null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days == null ? m.unknown_age_days : row.age_days;
    var maturityMult = m.maturity_base + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var breadthMult = 1 + Math.min(Math.max(row.chains.length - 1, 0), m.breadth_max_extra) * m.breadth_per_chain;
    return Math.max(1, Math.round(row.tvl_usd * catMult * growthMult * maturityMult * breadthMult));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function categories() {
    var seen = {};
    DATA.rows.forEach(function (r) { if (r.category) seen[r.category] = true; });
    return Object.keys(seen).sort();
  }

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.indexOf(q) === -1) return false;
      return true;
    });
  }

  var SORTS = {
    rank: function (r) { return r.rank; },
    name: function (r) { return r.name.toLowerCase(); },
    tvl: function (r) { return r.tvl_usd; },
    change: function (r) { return r.change_7d == null ? -Infinity : r.change_7d; },
    age: function (r) { return r.age_days == null ? -1 : r.age_days; },
    implied: function (r) { return r.implied_value_usd; }
  };

  function sortedRows(rows) {
    var key = SORTS[state.sort] || SORTS.implied;
    return rows.slice().sort(function (a, b) {
      var va = key(a), vb = key(b);
      if (va < vb) return -state.dir;
      if (va > vb) return state.dir;
      return a.rank - b.rank;
    });
  }

  function header() {
    var top = el('header', { 'class': 'top' });
    var h1 = el('h1', null, 'Token ', el('span', { 'class': 'radar', text: 'Radar' }));
    top.appendChild(h1);
    top.appendChild(el('p', {
      'class': 'tagline',
      text: 'Protocols that record no token yet, ranked by what a launch could be worth. ' +
        'The board covers the whole ' + DATA.watchlist_size + '-protocol watchlist and every other rankable pre-token ' +
        'protocol in the snapshot; protocols whose token already trades are kept apart in the Live tokens tab, at market value.'
    }));
    var stats = el('div', { 'class': 'stats' });
    [
      [String(DATA.board_size), 'protocols ranked'],
      [String(DATA.watchlist_size), 'watchlist covered'],
      [String(DATA.early_size), 'early finds below the floor'],
      [String(DATA.live_size), 'live tokens set aside'],
      [DATA.as_of, 'snapshot date']
    ].forEach(function (pair) {
      stats.appendChild(el('div', { 'class': 'stat' }, el('b', { text: pair[0] }), el('span', { text: pair[1] })));
    });
    top.appendChild(stats);
    var box = el('section', { 'class': 'modelbox' });
    box.appendChild(el('h2', { text: 'The model, ' + DATA.model_version + ' — stated in full' }));
    var f = el('p');
    f.appendChild(el('code', { text: 'implied value = TVL x category multiple x growth x maturity x breadth' }));
    box.appendChild(f);
    box.appendChild(el('p', {
      text: 'The category multiple is what a launched token of that kind is worth per dollar of TVL (Chain x2.00, ' +
        'Derivatives x1.40, Dexs x1.10, Lending x0.80, Liquid Staking x0.50, Bridge x0.45, stablecoin wrappers x0.35, ' +
        'anything else x0.70). Growth is 1 + the seven-day TVL change (clamped to -50%..+100%) x 0.6. Maturity is ' +
        '0.80 + 0.35 x min(age, 4 years) / 4 years: the longer a protocol has run with no token, the more unrewarded ' +
        'usage stands behind a launch. Breadth is 1 + 0.04 per extra chain, up to six. No protocol is scored by name; ' +
        'open any row and the page recomputes its value from its own figures, next to the plan for farming it.'
    }));
    top.appendChild(box);
    return top;
  }

  function controls() {
    var bar = el('div', { 'class': 'controls' });
    var tabs = el('div', { 'class': 'tabs', role: 'tablist' });
    [['pre', 'Pre-token board'], ['live', 'Live tokens']].forEach(function (t) {
      var b = el('button', {
        role: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false', text: t[1],
        onclick: function () { state.tab = t[0]; state.selected = null; render(); }
      });
      tabs.appendChild(b);
    });
    bar.appendChild(tabs);
    if (state.tab === 'pre') {
      bar.appendChild(el('input', {
        type: 'search', placeholder: 'Search protocols', value: state.q, 'aria-label': 'Search protocols',
        oninput: function (ev) { state.q = ev.target.value; renderTable(); }
      }));
      var sel = el('select', {
        'aria-label': 'Filter by category',
        onchange: function (ev) { state.category = ev.target.value; renderTable(); }
      });
      sel.appendChild(el('option', { value: 'all', text: 'All categories' }));
      categories().forEach(function (c) {
        var o = el('option', { value: c, text: c });
        if (state.category === c) o.setAttribute('selected', 'selected');
        sel.appendChild(o);
      });
      bar.appendChild(sel);
      var check = el('input', {
        type: 'checkbox', onchange: function (ev) { state.watchOnly = ev.target.checked; renderTable(); }
      });
      if (state.watchOnly) check.setAttribute('checked', 'checked');
      bar.appendChild(el('label', { 'class': 'check' }, check, 'Watchlist only'));
    }
    bar.appendChild(el('span', { 'class': 'count', id: 'rowcount' }));
    return bar;
  }

  function sortHead(label, keyName, cls) {
    var th = el('th', {
      'class': 'sortable ' + (cls || ''), scope: 'col',
      onclick: function () {
        if (state.sort === keyName) state.dir = -state.dir;
        else { state.sort = keyName; state.dir = keyName === 'name' ? 1 : -1; }
        renderTable();
      }
    }, label);
    if (state.sort === keyName) th.appendChild(el('span', { 'class': 'arrow', text: state.dir === -1 ? ' v' : ' ^' }));
    return th;
  }

  function boardTable() {
    var rows = sortedRows(visibleRows());
    var table = el('table', { id: 'boardtable' });
    table.appendChild(el('caption', { text: 'Pre-token protocols by implied launch value. Click a row for its model breakdown and farm plan.' }));
    var head = el('tr');
    head.appendChild(sortHead('#', 'rank'));
    head.appendChild(sortHead('Protocol', 'name', 'name'));
    head.appendChild(el('th', { 'class': 'name', text: 'Category' }));
    head.appendChild(el('th', { 'class': 'hide-s', text: 'Chains' }));
    head.appendChild(sortHead('TVL', 'tvl'));
    head.appendChild(sortHead('7d', 'change'));
    head.appendChild(sortHead('Age', 'age', 'hide-s'));
    head.appendChild(sortHead('Implied value', 'implied'));
    table.appendChild(el('thead', null, head));
    var body = el('tbody');
    if (rows.length === 0) {
      var tr = el('tr');
      var td = el('td', { colspan: '8', 'class': 'empty', text: 'No protocol matches this filter.' });
      tr.appendChild(td);
      body.appendChild(tr);
    }
    rows.forEach(function (r) {
      var tr = el('tr', {
        'data-slug': r.slug,
        'class': state.selected === r.slug ? 'selected' : '',
        onclick: function () { state.selected = state.selected === r.slug ? null : r.slug; renderDetail(); markSelected(); }
      });
      tr.appendChild(el('td', { 'class': 'rank', text: String(r.rank) }));
      var nameTd = el('td', { 'class': 'name' }, el('span', { 'class': 'pname', text: r.name }));
      if (r.watchlist) nameTd.appendChild(el('span', { 'class': 'badge watch', text: 'watchlist' }));
      tr.appendChild(nameTd);
      var catTd = el('td', { 'class': 'name' });
      catTd.appendChild(el('span', { 'class': 'badge cat', text: r.category || 'Uncategorised' }));
      tr.appendChild(catTd);
      tr.appendChild(el('td', { 'class': 'hide-s', text: String(r.chains.length) }));
      tr.appendChild(el('td', { text: fmtUsd(r.tvl_usd) }));
      var chg = el('td', { 'class': r.change_7d == null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) });
      tr.appendChild(chg);
      tr.appendChild(el('td', { 'class': 'hide-s', text: fmtAge(r.age_days) }));
      tr.appendChild(el('td', { 'class': 'implied', text: fmtUsd(r.implied_value_usd) }));
      body.appendChild(tr);
    });
    table.appendChild(body);
    return table;
  }

  function liveTable() {
    var table = el('table', { id: 'livetable' });
    table.appendChild(el('caption', { text: 'Protocols whose token already trades, shown at the market\u2019s own value and never ranked by the model.' }));
    var head = el('tr');
    ['Protocol', 'Category', 'Chains', 'TVL', '7d', 'Market cap'].forEach(function (label, i) {
      head.appendChild(el('th', { 'class': i < 2 ? 'name' : '', text: label }));
    });
    table.appendChild(el('thead', null, head));
    var body = el('tbody');
    DATA.live.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', { 'class': 'name' }, el('span', { 'class': 'pname', text: r.name })));
      var catTd = el('td', { 'class': 'name' });
      catTd.appendChild(el('span', { 'class': 'badge cat', text: r.category || 'Uncategorised' }));
      tr.appendChild(catTd);
      tr.appendChild(el('td', { text: String(r.chains.length) }));
      tr.appendChild(el('td', { text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(el('td', { 'class': r.change_7d == null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }));
      tr.appendChild(el('td', { 'class': 'implied', text: fmtUsd(r.mcap_usd) }));
      body.appendChild(tr);
    });
    table.appendChild(body);
    return table;
  }

  function markSelected() {
    var rows = app.querySelectorAll('tbody tr[data-slug]');
    rows.forEach(function (tr) {
      tr.className = tr.getAttribute('data-slug') === state.selected ? 'selected' : '';
    });
  }

  function detail() {
    var wrap = el('div', { id: 'detail' });
    if (state.tab !== 'pre' || !state.selected) return wrap;
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === state.selected) row = r; });
    if (!row) return wrap;
    var d = el('section', { 'class': 'detail' });
    d.appendChild(el('button', {
      'class': 'close', text: 'Close x',
      onclick: function () { state.selected = null; renderDetail(); markSelected(); }
    }));
    var h = el('h2', null, row.name);
    if (row.watchlist) h.appendChild(el('span', { 'class': 'badge watch', text: 'on the watchlist' }));
    d.appendChild(h);
    d.appendChild(el('p', {
      'class': 'sub',
      text: 'Rank #' + row.rank + ' of ' + DATA.board_size + ' · ' + (row.category || 'Uncategorised') +
        ' · records no token in the snapshot (no market cap, no CoinGecko id, no symbol)'
    }));
    var grid = el('div', { 'class': 'grid' });
    [
      [fmtUsd(row.implied_value_usd), 'implied launch value'],
      [fmtUsd(row.tvl_usd), 'total value locked'],
      [fmtPct(row.change_7d), 'TVL change, 7 days'],
      [fmtAge(row.age_days), 'tracked with no token'],
      [row.listed_at || 'not recorded', 'first tracked'],
      [String(row.chains.length), 'chains recorded']
    ].forEach(function (pair) {
      grid.appendChild(el('div', { 'class': 'cell' }, el('b', { text: pair[0] }), el('span', { text: pair[1] })));
    });
    d.appendChild(grid);
    d.appendChild(el('h3', { text: 'How the model gets this value' }));
    var recomputed = impliedOf(row);
    var line = fmtUsd(row.tvl_usd) + ' TVL  x  ' + fmtMult(row.category_multiple) + ' category  x  ' +
      fmtMult(row.growth_multiplier) + ' growth  x  ' + fmtMult(row.maturity_multiplier) + ' maturity  x  ' +
      fmtMult(row.breadth_multiplier) + ' breadth  =  ' + fmtUsd(row.implied_value_usd);
    var f = el('p', { 'class': 'formula' }, line + '   ');
    f.appendChild(el('span', {
      'class': 'ok',
      text: recomputed === row.implied_value_usd ? 'recomputed in this page: matches' : 'recomputed in this page: ' + fmtUsd(recomputed)
    }));
    d.appendChild(f);
    d.appendChild(el('h3', { text: 'Chains' }));
    d.appendChild(el('p', { 'class': 'chains', text: row.chains.length ? row.chains.join(', ') : 'None recorded in the snapshot.' }));
    d.appendChild(el('h3', { text: 'Farm plan' }));
    var plan = el('ol', { 'class': 'plan' });
    row.farm_steps.forEach(function (s) { plan.appendChild(el('li', { text: s })); });
    d.appendChild(plan);
    wrap.appendChild(d);
    return wrap;
  }

  function footer() {
    return el('footer', {
      'class': 'note',
      text: 'Built from one sealed snapshot of the protocol universe (DefiLlama data, fetched ' + DATA.as_of + '), ' +
        'the same figures for every reader. "Records no token" is what the snapshot says, not a promise that none exists. ' +
        'An implied value is this board\u2019s own claim about a launch that may never happen; it is not a prediction, ' +
        'and farming any protocol can lose the capital it asks for.'
    });
  }

  var tableHost = null;
  var detailHost = null;

  function renderTable() {
    if (!tableHost) return;
    tableHost.innerHTML = '';
    tableHost.appendChild(state.tab === 'pre' ? boardTable() : liveTable());
    var count = app.querySelector('#rowcount');
    if (count) {
      count.textContent = state.tab === 'pre'
        ? visibleRows().length + ' of ' + DATA.board_size + ' protocols'
        : DATA.live_size + ' live-token protocols';
    }
    renderDetail();
  }

  function renderDetail() {
    if (!detailHost) return;
    var fresh = detail();
    detailHost.innerHTML = '';
    while (fresh.firstChild) detailHost.appendChild(fresh.firstChild);
  }

  function render() {
    app.innerHTML = '';
    app.appendChild(header());
    app.appendChild(controls());
    tableHost = el('div', { id: 'tablehost' });
    app.appendChild(tableHost);
    detailHost = el('div', { id: 'detailhost' });
    app.appendChild(detailHost);
    app.appendChild(footer());
    app.removeAttribute('aria-busy');
    renderTable();
  }

  // Hash routing, so a view can be linked (and screenshotted) directly: #p=<slug> opens a protocol,
  // #cat=<category> filters the board, #live opens the live tab, #watch shows the watchlist only.
  function applyHash() {
    var hash = window.location.hash.replace(/^#/, '');
    hash.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      var k = decodeURIComponent(kv[0] || '');
      var v = decodeURIComponent(kv[1] || '');
      if (k === 'p' && v) { state.tab = 'pre'; state.selected = v; }
      if (k === 'cat' && v) { state.tab = 'pre'; state.category = v; }
      if (k === 'live') state.tab = 'live';
      if (k === 'watch') { state.tab = 'pre'; state.watchOnly = true; }
    });
  }

  applyHash();
  render();
})();
