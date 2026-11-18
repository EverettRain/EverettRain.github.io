/**
 * Blog music player UI.
 *
 * The APlayer that MetingJS creates inside #nav-music (theme.nav_music) is the site's only audio engine.
 * It sits outside the pjax-swapped area, so playback survives page changes, and the theme's right-click
 * menu, console and shortcuts keep driving it. This file only draws views around that engine:
 *   - the mini player on every page (a spinning record that expands into a card),
 *   - the full-screen "now playing" overlay (cover, controls, synced lyrics, queue),
 *   - the music library at /music/ (#em-library, playlists from theme.music_page.playlists).
 */
(() => {
  'use strict';

  /* ---------------- Pure helpers ---------------- */

  const LRC_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  // Lines are highlighted slightly early so the eye lands on them as they are sung
  const LYRIC_LEAD = 0.25;

  /** LRC text → [{ time, text, translation }]. A second line at the same time is the translation. */
  function parseLrc(text) {
    const entries = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const tags = [...raw.matchAll(LRC_TAG)];
      const words = raw.replace(/\[[^\]]*\]/g, '').trim();
      if (!tags.length || !words) continue;
      for (const [, m, s, f] of tags) {
        entries.push({ time: Number(m) * 60 + Number(s) + (f ? Number(f) / 10 ** f.length : 0), text: words });
      }
    }
    // Array.prototype.sort is stable, so an original line stays ahead of its translation
    entries.sort((a, b) => a.time - b.time);
    const lines = [];
    for (const entry of entries) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.time - entry.time) < 0.01) {
        if (!last.translation && entry.text !== last.text && entry.text !== '//') last.translation = entry.text;
        continue;
      }
      lines.push({ time: entry.time, text: entry.text, translation: '' });
    }
    return lines;
  }

  /** Index of the line being sung at `time`, or -1 before the first line. */
  function activeLine(lines, time) {
    let index = -1;
    for (let i = 0; i < lines.length && lines[i].time <= time + LYRIC_LEAD; i++) index = i;
    return index;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** "11 首歌曲 · 44 分钟"; the length is left out unless every track knows its duration. */
  function playlistMeta(tracks) {
    const known = tracks.every(t => t.duration > 0);
    const minutes = Math.round(tracks.reduce((sum, t) => sum + (t.duration || 0), 0) / 60);
    return known && tracks.length ? `${tracks.length} 首歌曲 · ${minutes} 分钟` : `${tracks.length} 首歌曲`;
  }

  function playlistKey(playlist) {
    return playlist.url ? `url:${playlist.url}` : `${playlist.server}:${playlist.id}`;
  }

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

  /* ---------------- Icons ---------------- */

  const stroke = (paths, size = 20, width = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const fill = (paths, size, flip = false) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"${flip ? ' style="transform:scaleX(-1)"' : ''}>${paths}</svg>`;
  const SKIP = '<path d="M2.5 6.3v11.4a.9.9 0 0 0 1.38.76L12 13.2v4.5a.9.9 0 0 0 1.38.76l8.6-5.7a.9.9 0 0 0 0-1.52l-8.6-5.7A.9.9 0 0 0 12 6.3v4.5L3.88 5.54A.9.9 0 0 0 2.5 6.3z"/>';
  const icon = {
    play: (s = 24) => fill('<path d="M7.5 4.9v14.2a1 1 0 0 0 1.52.85l11.3-7.1a1 1 0 0 0 0-1.7L9.02 4.05A1 1 0 0 0 7.5 4.9z"/>', s),
    pause: (s = 24) => fill('<rect x="5.5" y="4" width="4.6" height="16" rx="1.2"/><rect x="13.9" y="4" width="4.6" height="16" rx="1.2"/>', s),
    next: (s = 22) => fill(SKIP, s),
    prev: (s = 22) => fill(SKIP, s, true),
    shuffle: (s = 20) => stroke('<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>', s),
    repeat: (s = 20) => stroke('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>', s),
    repeatOne: (s = 20) => stroke('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/>', s),
    lyrics: (s = 20) => stroke('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 12a2 2 0 0 0 2-2V8H8"/><path d="M14 12a2 2 0 0 0 2-2V8h-2"/>', s),
    queue: (s = 20) => stroke('<path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/>', s),
    volLow: (s = 16) => stroke('<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/>', s),
    volHigh: (s = 16) => stroke('<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.8"/>', s),
    down: (s = 20) => stroke('<path d="m6 9 6 6 6-6"/>', s, 2.4),
    expand: (s = 11) => stroke('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>', s),
    search: (s = 16) => stroke('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', s),
    clock: (s = 15) => stroke('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s),
  };

  /* ---------------- Engine: the APlayer in #nav-music ---------------- */

  const engine = (() => {
    const listeners = new Set();
    let ap = null;
    let source = null;
    let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });

    const emit = type => listeners.forEach(fn => fn(type));

    function attach(element) {
      ap = element.aplayer;
      source = `${element.getAttribute('server')}:${element.getAttribute('id')}`;
      for (const type of ['play', 'pause', 'timeupdate', 'durationchange', 'volumechange', 'listadd', 'listclear']) {
        ap.on(type, () => emit(type));
      }
      // APlayer announces a switch before it updates list.index
      ap.on('listswitch', () => setTimeout(() => emit('listswitch')));
      ap.on('error', () => {
        const track = current();
        if (track && ap.list.audios.length > 1 && window.anzhiyu && anzhiyu.snackbarShow) {
          anzhiyu.snackbarShow(`《${track.name}》在当前网络地区无法播放，即将跳到下一首`);
        }
      });
      resolveReady();
      emit('ready');
    }

    function locate() {
      const element = document.querySelector('#nav-music meting-js');
      if (!element) return true; // nav_music disabled: there is no engine to wait for
      if (element.aplayer && element.aplayer.list.audios.length) {
        attach(element);
        return true;
      }
      return false;
    }

    function start() {
      if (locate()) return;
      const timer = setInterval(() => locate() && clearInterval(timer), 200);
    }

    function current() {
      return ap ? ap.list.audios[ap.list.index] : null;
    }

    function state() {
      const track = current();
      const audio = ap.audio;
      return {
        track,
        index: ap.list.index,
        tracks: ap.list.audios,
        source,
        playing: !audio.paused,
        time: audio.currentTime || 0,
        duration: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (track && track.duration) || 0,
        order: ap.options.order,
        loop: ap.options.loop,
        volume: audio.volume,
      };
    }

    return {
      ready,
      start,
      state,
      current,
      get available() { return Boolean(ap); },
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      toggle() { ap.toggle(); },
      next() { ap.skipForward(); ap.play(); },
      prev() { ap.skipBack(); ap.play(); },
      seek(seconds) { ap.seek(seconds); },
      setVolume(ratio) { ap.volume(ratio); },
      setOrder(order) { ap.options.order = order; emit('mode'); },
      toggleOrder() { this.setOrder(ap.options.order === 'random' ? 'list' : 'random'); },
      cycleLoop() {
        const order = ['all', 'one', 'none'];
        ap.options.loop = order[(order.indexOf(ap.options.loop) + 1) % order.length];
        emit('mode');
      },
      playAt(index) { ap.list.switch(index); ap.play(); },
      /** Make `tracks` (identified by `key`) the queue, then play `index` or a random track. */
      playFrom(key, tracks, index) {
        if (source !== key) {
          ap.list.clear();
          ap.list.add(tracks.map(track => ({ ...track })));
          source = key;
        }
        const target = index === 'random' ? Math.floor(Math.random() * tracks.length) : index;
        this.playAt(target);
      },
    };
  })();

  /* ---------------- Lyrics: fetched once per song ---------------- */

  const lyrics = (() => {
    const cache = new Map();
    return {
      load(track) {
        const lrc = track && track.lrc;
        if (!lrc) return Promise.resolve([]);
        if (!cache.has(lrc)) {
          const text = /^\s*\[/.test(lrc) ? Promise.resolve(lrc) : fetch(lrc).then(r => (r.ok ? r.text() : ''));
          cache.set(lrc, text.then(parseLrc).catch(() => []));
        }
        return cache.get(lrc);
      },
    };
  })();

  /* ---------------- Shared UI pieces ---------------- */

  /** Progress / volume slider driven by pointer and arrow keys; `onSeek` gets a 0–1 ratio. */
  function bindSlider(element, onSeek, step = 0.05) {
    const ratioAt = event => {
      const rect = element.getBoundingClientRect();
      return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    };
    element.addEventListener('pointerdown', event => {
      element.setPointerCapture(event.pointerId);
      element.classList.add('dragging');
      setSlider(element, ratioAt(event));
      const move = e => setSlider(element, ratioAt(e));
      const up = e => {
        element.classList.remove('dragging');
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', up);
        element.removeEventListener('pointercancel', up);
        onSeek(ratioAt(e));
      };
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerup', up);
      element.addEventListener('pointercancel', up);
    });
    element.addEventListener('keydown', event => {
      const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      onSeek(Math.min(1, Math.max(0, Number(element.getAttribute('aria-valuenow')) / 100 + delta)));
    });
  }

  function setSlider(element, ratio) {
    if (!element || (element.classList.contains('dragging') && ratio === undefined)) return;
    const percent = `${(ratio * 100).toFixed(2)}%`;
    element.querySelector('i').style.width = percent;
    element.querySelector('b').style.left = percent;
    element.setAttribute('aria-valuenow', Math.round(ratio * 100));
  }

  function updateSlider(element, ratio) {
    if (element && !element.classList.contains('dragging')) setSlider(element, ratio);
  }

  const slider = (cls, label) =>
    `<div class="em-slider ${cls}" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i><b></b></div>`;

  const isTypingTarget = target => target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName));

  /** Pointer devices toggle playback on the record; touch devices have no hover, so a tap opens the card. */
  const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------- Mini player (every page except /music/) ---------------- */

  const mini = (() => {
    const STORE = 'blogMusic.mini';
    const RING = 2 * Math.PI * 29;
    let root;
    let shownTrack;

    function build() {
      root = document.createElement('div');
      root.id = 'em-mini';
      root.className = 'em-root';
      root.hidden = true;
      root.dataset.state = readState();
      root.innerHTML = `
        <div class="em-record-wrap">
          <button class="em-record" type="button" data-act="record">
            <svg class="em-ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="track" cx="32" cy="32" r="29"/><circle class="value" cx="32" cy="32" r="29" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/></svg>
            <span class="em-vinyl"><img alt=""></span>
            <span class="em-record-over"></span>
          </button>
          <button class="em-tip" type="button" data-act="expand"><b class="em-ellipsis"></b><span class="em-ellipsis"></span><span class="em-tip-hint">${icon.expand()}点击展开</span></button>
        </div>
        <div class="em-card">
          <div class="em-card-row">
            <button class="em-card-open" type="button" data-act="open" aria-label="打开播放页"><img alt=""><span><b class="em-ellipsis"></b><small class="em-ellipsis"></small></span></button>
            <div class="em-card-ctl">
              <button type="button" data-act="toggle"></button>
              <button type="button" data-act="next" aria-label="下一首">${icon.next(20)}</button>
              <button class="em-fold" type="button" data-act="collapse" aria-label="收起成唱片">${icon.down(18)}</button>
            </div>
          </div>
          <button class="em-card-lrc em-ellipsis" type="button" data-act="open"></button>
          ${slider('em-mini-progress', '播放进度')}
          <div class="em-card-times"><span class="em-cur">0:00</span><span class="em-dur">0:00</span></div>
        </div>`;
      document.body.appendChild(root);

      root.addEventListener('click', event => {
        const act = event.target.closest('[data-act]')?.dataset.act;
        if (act === 'record') canHover() ? engine.toggle() : setState('card');
        else if (act === 'expand') setState('card');
        else if (act === 'collapse') setState('record');
        else if (act === 'toggle') engine.toggle();
        else if (act === 'next') engine.next();
        else if (act === 'open') nowPlaying.open();
      });
      bindSlider(root.querySelector('.em-mini-progress'), ratio => engine.seek(ratio * engine.state().duration));
    }

    function readState() {
      try { return localStorage.getItem(STORE) === 'card' ? 'card' : 'record'; } catch { return 'record'; }
    }

    function setState(next) {
      root.dataset.state = next;
      try { localStorage.setItem(STORE, next); } catch { /* storage unavailable: the choice lasts until reload */ }
    }

    function render(type) {
      const s = engine.state();
      if (!s.track) return;
      root.hidden = false;
      root.classList.toggle('playing', s.playing);
      const ratio = s.duration ? s.time / s.duration : 0;
      root.querySelector('.em-ring .value').style.strokeDashoffset = String(RING * (1 - ratio));
      updateSlider(root.querySelector('.em-mini-progress'), ratio);
      root.querySelector('.em-cur').textContent = formatTime(s.time);
      root.querySelector('.em-dur').textContent = formatTime(s.duration);
      if (type === 'timeupdate') return renderLyric(s);

      const toggleIcon = s.playing ? icon.pause(18) : icon.play(18);
      const toggleLabel = s.playing ? '暂停' : '播放';
      root.querySelector('.em-record-over').innerHTML = s.playing ? icon.pause(18) : icon.play(18);
      root.querySelector('.em-record').setAttribute('aria-label', canHover() ? `${toggleLabel}：${s.track.name}` : `展开播放器：${s.track.name}`);
      const toggle = root.querySelector('[data-act="toggle"]');
      toggle.innerHTML = toggleIcon;
      toggle.setAttribute('aria-label', toggleLabel);

      if (shownTrack !== s.track) {
        shownTrack = s.track;
        root.querySelector('.em-vinyl img').src = s.track.cover || '';
        root.querySelector('.em-card-open img').src = s.track.cover || '';
        root.querySelector('.em-tip b').textContent = s.track.name;
        root.querySelector('.em-tip span').textContent = s.track.artist;
        root.querySelector('.em-card-open b').textContent = s.track.name;
        root.querySelector('.em-card-open small').textContent = s.track.artist;
        root.querySelector('.em-card-lrc').textContent = '';
        lyrics.load(s.track).then(() => renderLyric(engine.state()));
      }
    }

    function renderLyric(s) {
      lyrics.load(s.track).then(lines => {
        if (engine.current() !== s.track) return;
        const index = activeLine(lines, s.time);
        root.querySelector('.em-card-lrc').textContent = index >= 0 ? lines[index].text : '';
      });
    }

    return { build, render };
  })();

  /* ---------------- Now playing (full-screen overlay) ---------------- */

  const nowPlaying = (() => {
    let root;
    let shownTrack;
    let shownTracks;
    let lines = [];
    let activeIndex = -2;

    function build() {
      root = document.createElement('div');
      root.id = 'em-np';
      root.className = 'em-root';
      root.hidden = true;
      root.dataset.pane = 'lyrics';
      root.dataset.page = 'cover';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', '正在播放');
      root.innerHTML = `
        <img class="em-np-bg" alt="">
        <div class="em-np-shade"></div>
        <header class="em-np-top">
          <button class="em-round" type="button" data-act="close" aria-label="收起播放页">${icon.down()}</button>
          <div class="em-np-tabs" role="tablist" aria-label="右侧显示">
            <button type="button" role="tab" data-pane="lyrics">歌词</button>
            <button type="button" role="tab" data-pane="queue">队列</button>
          </div>
        </header>
        <div class="em-np-stage">
          <section class="em-np-player">
            <img class="em-np-art" alt="">
            <div class="em-np-info"><b class="em-ellipsis"></b><span class="em-ellipsis"></span></div>
            <div class="em-np-progress">${slider('em-np-seek', '播放进度')}<div class="em-np-times"><span class="em-cur">0:00</span><span class="em-left">0:00</span></div></div>
            <div class="em-np-ctl">
              <button class="em-mode" type="button" data-act="order"></button>
              <button type="button" data-act="prev" aria-label="上一首">${icon.prev(34)}</button>
              <button class="em-big" type="button" data-act="toggle"></button>
              <button type="button" data-act="next" aria-label="下一首">${icon.next(34)}</button>
              <button class="em-mode" type="button" data-act="loop"></button>
            </div>
            <div class="em-np-vol">${icon.volLow()}${slider('em-np-volume', '音量')}${icon.volHigh()}</div>
            <nav class="em-np-pages" aria-label="切换页面">
              <button type="button" data-page="lyrics" aria-label="歌词">${icon.lyrics(22)}</button>
              <button type="button" data-page="queue" aria-label="播放队列">${icon.queue(22)}</button>
            </nav>
          </section>
          <section class="em-np-pane">
            <div class="em-np-head"><img alt=""><span><b class="em-ellipsis"></b><small class="em-ellipsis"></small></span></div>
            <div class="em-lyrics"><div class="em-lyrics-inner"></div></div>
            <div class="em-queue"></div>
          </section>
        </div>`;
      document.body.appendChild(root);

      root.addEventListener('click', event => {
        const target = event.target.closest('[data-act], [data-pane], [data-page], [data-seek], [data-index]');
        if (!target) return;
        if (target.dataset.pane) return showPane(target.dataset.pane);
        if (target.dataset.page) return showPage(root.dataset.page === target.dataset.page ? 'cover' : target.dataset.page);
        if (target.dataset.seek) { engine.seek(Number(target.dataset.seek)); if (!engine.state().playing) engine.toggle(); return; }
        if (target.dataset.index) return engine.playAt(Number(target.dataset.index));
        ({ close, toggle: () => engine.toggle(), next: () => engine.next(), prev: () => engine.prev(), order: () => engine.toggleOrder(), loop: () => engine.cycleLoop() })[target.dataset.act]?.();
      });
      bindSlider(root.querySelector('.em-np-seek'), ratio => engine.seek(ratio * engine.state().duration));
      bindSlider(root.querySelector('.em-np-volume'), ratio => engine.setVolume(ratio));
      document.addEventListener('keydown', event => {
        if (root.hidden) return;
        if (event.key === 'Escape') close();
        else if (event.key === ' ' && !isTypingTarget(event.target)) { event.preventDefault(); engine.toggle(); }
      });
      window.addEventListener('resize', () => !root.hidden && positionLyrics());
    }

    function open(pane) {
      if (!engine.available) return;
      if (pane) { showPane(pane); showPage(pane); } else { showPage('cover'); }
      root.hidden = false;
      root.classList.add('entering');
      setTimeout(() => root.classList.remove('entering'), 400);
      document.documentElement.classList.add('em-np-open');
      render('open');
      root.querySelector('[data-act="close"]').focus({ preventScroll: true });
    }

    function close() {
      root.hidden = true;
      document.documentElement.classList.remove('em-np-open');
    }

    function showPane(pane) {
      root.dataset.pane = pane;
      root.querySelectorAll('.em-np-tabs [data-pane]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pane === pane)));
      positionLyrics();
    }

    function showPage(page) {
      root.dataset.page = page;
      if (page !== 'cover') showPane(page);
    }

    function render(type) {
      if (!root || root.hidden) return;
      const s = engine.state();
      if (!s.track) return;
      root.classList.toggle('playing', s.playing);
      updateSlider(root.querySelector('.em-np-seek'), s.duration ? s.time / s.duration : 0);
      root.querySelector('.em-cur').textContent = formatTime(s.time);
      root.querySelector('.em-left').textContent = `-${formatTime(s.duration - s.time)}`;
      highlightLyric(s.time);
      if (type === 'timeupdate') return;

      root.querySelector('[data-act="toggle"]').innerHTML = s.playing ? icon.pause(46) : icon.play(46);
      root.querySelector('[data-act="toggle"]').setAttribute('aria-label', s.playing ? '暂停' : '播放');
      const order = root.querySelector('[data-act="order"]');
      order.innerHTML = icon.shuffle();
      order.classList.toggle('on', s.order === 'random');
      order.setAttribute('aria-label', s.order === 'random' ? '随机播放：开' : '随机播放：关');
      const loop = root.querySelector('[data-act="loop"]');
      loop.innerHTML = s.loop === 'one' ? icon.repeatOne() : icon.repeat();
      loop.classList.toggle('on', s.loop !== 'none');
      loop.setAttribute('aria-label', { all: '列表循环', one: '单曲循环', none: '不循环' }[s.loop]);
      updateSlider(root.querySelector('.em-np-volume'), s.volume);

      if (shownTrack !== s.track) {
        shownTrack = s.track;
        for (const img of root.querySelectorAll('.em-np-bg, .em-np-art, .em-np-head img')) img.src = s.track.cover || '';
        root.querySelector('.em-np-info b').textContent = s.track.name;
        root.querySelector('.em-np-info span').textContent = s.track.artist;
        root.querySelector('.em-np-head b').textContent = s.track.name;
        root.querySelector('.em-np-head small').textContent = s.track.artist;
        renderLyrics(s.track);
      }
      if (shownTracks !== s.tracks.length + ':' + s.index + ':' + s.source) {
        shownTracks = s.tracks.length + ':' + s.index + ':' + s.source;
        renderQueue(s);
      }
    }

    function renderLyrics(track) {
      const inner = root.querySelector('.em-lyrics-inner');
      inner.innerHTML = '';
      inner.style.transform = '';
      lines = [];
      activeIndex = -2;
      lyrics.load(track).then(parsed => {
        if (engine.current() !== track) return;
        lines = parsed;
        inner.innerHTML = lines.length
          ? lines.map((line, i) => `<button class="em-ly" type="button" data-seek="${line.time}" data-line="${i}">${esc(line.text)}${line.translation ? `<small>${esc(line.translation)}</small>` : ''}</button>`).join('')
          : '<p class="em-lyrics-empty">暂无歌词，请欣赏</p>';
        highlightLyric(engine.state().time);
      });
    }

    function highlightLyric(time) {
      const index = activeLine(lines, time);
      if (index === activeIndex) return;
      activeIndex = index;
      root.querySelectorAll('.em-ly').forEach((el, i) => {
        el.classList.toggle('past', i < index);
        el.classList.toggle('on', i === index);
        el.classList.toggle('next', i === index + 1);
      });
      positionLyrics();
    }

    /** Keep the sung line about a third of the way down the lyric area. */
    function positionLyrics() {
      const box = root.querySelector('.em-lyrics');
      const inner = root.querySelector('.em-lyrics-inner');
      const line = inner.querySelector('.em-ly.on') || inner.querySelector('.em-ly');
      if (!line || !box.clientHeight) return;
      inner.style.transform = `translateY(${-(line.offsetTop - box.clientHeight * 0.34)}px)`;
    }

    function renderQueue(s) {
      root.querySelector('.em-queue').innerHTML = `<h3>播放队列 · ${s.tracks.length} 首</h3>` + s.tracks.map((t, i) =>
        `<button class="em-q${i === s.index ? ' cur' : ''}" type="button" data-index="${i}"><img src="${esc(t.cover)}" alt="" loading="lazy"><span><b class="em-ellipsis">${esc(t.name)}</b><small class="em-ellipsis">${esc(t.artist)}</small></span>${i === s.index ? `<span class="em-eq${s.playing ? ' on' : ''}" style="flex:none"><i></i><i></i><i></i><i></i></span>` : ''}</button>`).join('');
      root.querySelector('.em-q.cur')?.scrollIntoView({ block: 'center' });
    }

    return { build, open, close, render };
  })();

  /* ---------------- Music library (/music/) ---------------- */

  const library = (() => {
    const trackCache = new Map();
    let view = null;

    function fetchTracks(playlist) {
      const key = playlistKey(playlist);
      if (!trackCache.has(key)) {
        // Same URL MetingJS requests through theme CDN.option.meting_api, so the browser cache is shared
        const url = playlist.url || `/api/meting?server=${encodeURIComponent(playlist.server)}&type=playlist&id=${encodeURIComponent(playlist.id)}`;
        const request = fetch(url).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }).then(list => (Array.isArray(list) ? list : []).map(t => ({ ...t, name: t.name || t.title, artist: t.artist || t.author, cover: t.cover || t.pic })));
        request.catch(() => trackCache.delete(key));
        trackCache.set(key, request);
      }
      return trackCache.get(key);
    }

    /** /music/?server=netease&id=… (used by the nav menu) opens that playlist, adding it when it is not configured. */
    function requestedPlaylist(playlists) {
      const params = new URLSearchParams(location.search);
      const server = params.get('server');
      const id = params.get('id');
      if (!server || !id) return 0;
      const index = playlists.findIndex(p => p.server === server && String(p.id) === id);
      if (index >= 0) return index;
      playlists.push({ name: '歌单', server, id });
      return playlists.length - 1;
    }

    function mount(element) {
      let playlists;
      try { playlists = JSON.parse(element.dataset.playlists || '[]'); } catch { playlists = []; }
      const initial = requestedPlaylist(playlists);
      element.classList.add('em-root');
      element.innerHTML = `
        <div class="em-lib">
          <aside class="em-side">
            <h2>音乐馆</h2>
            <label class="em-search">${icon.search()}<input type="search" placeholder="在歌单中搜索" aria-label="在歌单中搜索"></label>
            <div class="em-group">歌单</div>
            ${playlists.map((p, i) => `<button class="em-pl" type="button" data-pl="${i}"><span class="em-pl-art">${icon.queue(18)}</span><span><b class="em-ellipsis">${esc(p.name)}</b><small>载入中…</small></span></button>`).join('')}
            <div class="em-group">播放</div>
            <button class="em-pl em-open-queue" type="button" data-act="queue"><span class="em-pl-art">${icon.queue(18)}</span><span><b>播放队列</b><small class="em-queue-count"></small></span></button>
          </aside>
          <main class="em-main"><div class="em-content"></div></main>
        </div>
        <div class="em-bar" hidden>
          <button class="em-bar-now" type="button" data-act="open" aria-label="打开播放页"><img alt=""><span><b class="em-ellipsis"></b><small class="em-ellipsis"></small></span></button>
          <div class="em-bar-ctl">
            <button class="em-prev" type="button" data-act="prev" aria-label="上一首">${icon.prev(22)}</button>
            <button type="button" data-act="toggle"></button>
            <button type="button" data-act="next" aria-label="下一首">${icon.next(22)}</button>
          </div>
          <div class="em-bar-side">
            <button type="button" data-act="lyrics" aria-label="歌词">${icon.lyrics(19)}</button>
            <button type="button" data-act="queue" aria-label="播放队列">${icon.queue(19)}</button>
            <div class="em-bar-vol">${icon.volLow()}${slider('em-bar-volume', '音量')}</div>
          </div>
          <div class="em-bar-line"><i></i></div>
        </div>`;

      view = { element, playlists, selected: 0, tracks: [], filter: '' };
      element.addEventListener('click', onClick);
      element.querySelector('.em-search input').addEventListener('input', event => {
        view.filter = event.target.value.trim().toLowerCase();
        applyFilter();
      });
      bindSlider(element.querySelector('.em-bar-volume'), ratio => engine.setVolume(ratio));
      playlists.forEach((p, i) => fetchTracks(p).then(tracks => sidebarItem(i, tracks), () => sidebarItem(i, null)));
      select(initial);
      render('mount');
    }

    function sidebarItem(i, tracks) {
      const item = view && view.element.querySelector(`[data-pl="${i}"]`);
      if (!item) return;
      item.querySelector('small').textContent = tracks ? `${tracks.length} 首` : '载入失败';
      if (tracks && tracks[0] && tracks[0].cover) item.querySelector('.em-pl-art').innerHTML = `<img src="${esc(tracks[0].cover)}" alt="">`;
    }

    function select(i) {
      const current = view;
      current.selected = i;
      current.element.querySelectorAll('[data-pl]').forEach(b => b.classList.toggle('on', Number(b.dataset.pl) === i));
      const playlist = current.playlists[i];
      const content = current.element.querySelector('.em-content');
      if (!playlist) { content.innerHTML = '<p class="em-status">还没有配置歌单（theme.music_page.playlists）。</p>'; return; }
      content.innerHTML = '<p class="em-status">歌单载入中…</p>';
      fetchTracks(playlist).then(tracks => {
        if (view !== current || current.selected !== i) return;
        current.tracks = tracks;
        content.innerHTML = renderPlaylist(playlist, tracks);
        applyFilter();
        render('select');
      }, () => {
        if (view === current && current.selected === i) content.innerHTML = '<p class="em-status">歌单载入失败，请稍后刷新重试。</p>';
      });
    }

    function renderPlaylist(playlist, tracks) {
      const covers = [...new Set(tracks.map(t => t.cover).filter(Boolean))].slice(0, 4);
      const collage = covers.length >= 4
        ? `<div class="em-collage">${covers.map(c => `<img src="${esc(c)}" alt="">`).join('')}</div>`
        : `<div class="em-collage single">${covers[0] ? `<img src="${esc(covers[0])}" alt="">` : ''}</div>`;
      const rows = tracks.map((t, i) => `
        <button class="em-row" type="button" data-row="${i}">
          <span class="em-n"><span class="em-n-num">${i + 1}</span><span class="em-n-play">${icon.play(14)}</span></span>
          <span class="em-t"><img src="${esc(t.cover)}" alt="" loading="lazy"><span><b class="em-ellipsis">${esc(t.name)}</b><small class="em-ellipsis">${esc(t.artist)}</small></span></span>
          <span class="em-a em-ellipsis">${esc(t.album || '')}</span>
          <span class="em-d">${t.duration ? formatTime(t.duration) : ''}</span>
        </button>`).join('');
      return `
        <section class="em-hero">
          ${collage}
          <div class="em-hero-txt">
            <div class="em-kicker">歌单</div>
            <h1>${esc(playlist.name)}</h1>
            <div class="em-meta">${playlistMeta(tracks)}</div>
            ${playlist.description ? `<p class="em-desc">${esc(playlist.description)}</p>` : ''}
            <div class="em-actions">
              <button class="em-btn primary" type="button" data-act="play-all">${icon.play(16)}播放</button>
              <button class="em-btn soft" type="button" data-act="shuffle-all">${icon.shuffle(16)}随机播放</button>
            </div>
          </div>
        </section>
        <div class="em-table">
          <div class="em-th"><span class="em-n">#</span><span>歌曲</span><span>专辑</span><span class="em-d" style="display:flex;justify-content:flex-end">${icon.clock()}</span></div>
          ${rows}
          <p class="em-status em-no-match" hidden>没有找到匹配的歌曲。</p>
        </div>`;
    }

    function applyFilter() {
      if (!view) return;
      let shown = 0;
      view.element.querySelectorAll('.em-row').forEach(row => {
        const t = view.tracks[Number(row.dataset.row)];
        const match = !view.filter || `${t.name} ${t.artist} ${t.album || ''}`.toLowerCase().includes(view.filter);
        row.hidden = !match;
        shown += match;
      });
      const empty = view.element.querySelector('.em-no-match');
      if (empty) empty.hidden = shown > 0;
    }

    async function onClick(event) {
      const target = event.target.closest('[data-pl], [data-row], [data-act]');
      if (!target || !view) return;
      if (target.dataset.pl) return select(Number(target.dataset.pl));
      await engine.ready;
      const key = playlistKey(view.playlists[view.selected] || {});
      if (target.dataset.row) return engine.playFrom(key, view.tracks, Number(target.dataset.row));
      switch (target.dataset.act) {
        case 'play-all': engine.setOrder('list'); return engine.playFrom(key, view.tracks, 0);
        case 'shuffle-all': engine.setOrder('random'); return engine.playFrom(key, view.tracks, 'random');
        case 'toggle': return engine.toggle();
        case 'next': return engine.next();
        case 'prev': return engine.prev();
        case 'open': return nowPlaying.open();
        case 'lyrics': return nowPlaying.open('lyrics');
        case 'queue': return nowPlaying.open('queue');
      }
    }

    function render(type) {
      if (!view) return;
      if (!view.element.isConnected) { view = null; return; }
      if (!engine.available) return;
      const s = engine.state();
      if (!s.track) return;
      const bar = view.element.querySelector('.em-bar');
      bar.hidden = false;
      bar.querySelector('.em-bar-line i').style.width = `${s.duration ? (s.time / s.duration) * 100 : 0}%`;
      if (type === 'timeupdate') return;

      bar.querySelector('.em-bar-now img').src = s.track.cover || '';
      bar.querySelector('.em-bar-now b').textContent = s.track.name;
      bar.querySelector('.em-bar-now small').textContent = s.track.artist;
      const toggle = bar.querySelector('[data-act="toggle"]');
      toggle.innerHTML = s.playing ? icon.pause(26) : icon.play(26);
      toggle.setAttribute('aria-label', s.playing ? '暂停' : '播放');
      updateSlider(bar.querySelector('.em-bar-volume'), s.volume);
      view.element.querySelector('.em-queue-count').textContent = `${s.tracks.length} 首`;

      const showing = playlistKey(view.playlists[view.selected] || {}) === s.source;
      view.element.querySelectorAll('.em-row').forEach(row => {
        const isCurrent = showing && Number(row.dataset.row) === s.index;
        row.classList.toggle('cur', isCurrent);
        const n = row.querySelector('.em-n-num');
        n.innerHTML = isCurrent ? `<span class="em-eq${s.playing ? ' on' : ''}"><i></i><i></i><i></i><i></i></span>` : String(Number(row.dataset.row) + 1);
      });
    }

    function scan() {
      const element = document.getElementById('em-library');
      if (element && !element.classList.contains('em-root')) mount(element);
    }

    return { scan, render };
  })();

  /* ---------------- Wiring ---------------- */

  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !engine.available) return;
    const s = engine.state();
    if (!s.track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: s.track.name,
      artist: s.track.artist,
      album: s.track.album || '',
      artwork: s.track.cover ? [{ src: s.track.cover, sizes: '300x300' }] : [],
    });
    navigator.mediaSession.playbackState = s.playing ? 'playing' : 'paused';
  }

  function init() {
    mini.build();
    nowPlaying.build();
    library.scan();
    document.addEventListener('pjax:complete', library.scan);

    engine.subscribe(type => {
      mini.render(type);
      nowPlaying.render(type);
      library.render(type);
      if (type !== 'timeupdate') updateMediaSession();
    });
    engine.ready.then(() => {
      if (!('mediaSession' in navigator)) return;
      const handlers = {
        play: () => engine.state().playing || engine.toggle(),
        pause: () => engine.state().playing && engine.toggle(),
        previoustrack: () => engine.prev(),
        nexttrack: () => engine.next(),
        seekto: details => engine.seek(details.seekTime),
      };
      for (const [action, handler] of Object.entries(handlers)) {
        try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* action unsupported in this browser */ }
      }
    });
    // Space toggles playback on the music page, as the old music page did
    document.addEventListener('keydown', event => {
      if (event.key !== ' ' || isTypingTarget(event.target) || document.body.dataset.type !== 'music' || !engine.available) return;
      if (!document.getElementById('em-np').hidden) return;
      event.preventDefault();
      engine.toggle();
    });
    engine.start();
  }

  window.blogMusic = { parseLrc, activeLine, formatTime, playlistMeta, open: pane => nowPlaying.open(pane) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
