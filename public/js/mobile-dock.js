/* Cupertino 移动端底部悬浮工具栏（Liquid Glass pill）
 * 参考 extra_repo/obsidian-cupertino/src/app/mobile.scss:579 + elements/cupertino-mobile.scss
 * 纯 hash 链接，不依赖 app.js 内部状态。
 */
(function () {
  'use strict';

  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3.5l9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/></svg>',
    feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5"/></svg>',
    write: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5v13M5.5 12h13"/></svg>',
    rank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V11M12 20V4.5M19 20v-6"/></svg>',
    me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.7"/><path d="M4.8 20c.9-3.7 3.8-5.6 7.2-5.6s6.3 1.9 7.2 5.6"/></svg>'
  };

  var ITEMS = [
    { hash: '#/dashboard', label: '首页', icon: ICONS.home },
    { hash: '#/reports', label: '周报', icon: ICONS.feed },
    { hash: '#/report/new', label: '写周报', icon: ICONS.write, primary: true },
    { hash: '#/leaderboard', label: '排行', icon: ICONS.rank },
    { hash: '#/mine', label: '我的', icon: ICONS.me }
  ];

  var dock = null;

  function currentHash() {
    return (location.hash || '#/dashboard').split('?')[0];
  }

  function mark() {
    if (!dock) return;
    var h = currentHash();
    dock.querySelectorAll('a').forEach(function (a) {
      var target = a.getAttribute('href');
      var on = target === h || (target !== '#/dashboard' && h.indexOf(target) === 0);
      a.classList.toggle('active', on);
    });
  }

  function mount() {
    // 仅在已渲染应用外壳时挂载（登录/注册页不显示）
    var shell = document.querySelector('.gh-shell, .zh-container');
    if (!shell) {
      if (dock) { dock.remove(); dock = null; }
      return;
    }
    if (dock && document.body.contains(dock)) { mark(); return; }
    dock = document.createElement('nav');
    dock.className = 'm-dock';
    dock.setAttribute('aria-label', '主导航');
    dock.innerHTML = ITEMS.map(function (it) {
      return '<a class="m-dock-item' + (it.primary ? ' m-dock-primary' : '') + '" href="' + it.hash + '">' +
        '<span class="m-dock-ic">' + it.icon + '</span>' +
        '<span class="m-dock-lb">' + it.label + '</span></a>';
    }).join('');
    document.body.appendChild(dock);
    mark();
  }

  function boot() {
    mount();
    window.addEventListener('hashchange', function () {
      mount();
      mark();
    });
    // 外壳是异步渲染的，轻量轮询若干次直到出现
    var tries = 0;
    var t = setInterval(function () {
      mount();
      if (dock || ++tries > 40) clearInterval(t);
    }, 250);
    // 主题切换不影响结构，但 skin 变化会重绘外壳
    document.addEventListener('click', function () { setTimeout(mount, 60); }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
