/* 부처님과 그의 담마 — 독서본 앱 로직
   - data.js(window.DHAMMA_DATA)로부터 컨텐츠 렌더링
   - localStorage: 마지막 읽은 위치, 저장 경구, 형광펜
   - 데스크톱: 마우스 선택 + 우클릭으로 경구 저장
   - 모바일: 길게 누르기(롱프레스)로 선택 텍스트 저장
   - 형광펜 밑줄(마우스 선택 → 저장 시 하이라이트 유지)
*/

(function () {
  'use strict';

  /* ---------- 저장소 ---------- */
  var STORE = {
    last: 'bd_lastChapter',      // 마지막 읽은 장 인덱스
    scroll: 'bd_scrollPos',      // 장 내 스크롤 위치
    quotes: 'bd_quotes',         // 저장 경구 [{ch, text, ts}]
    marks: 'bd_marks',           // 형광펜 [{ch, text}]
  };

  function lsGet(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ---------- DOM ---------- */
  var reader = document.getElementById('reader');
  var tocBody = document.getElementById('toc-body');
  var tocDrawer = document.getElementById('toc-drawer');
  var tocOverlay = document.getElementById('toc-overlay');
  var titleBar = document.getElementById('topbar-title');
  var quoteTip = document.getElementById('quote-tip');
  var toast = document.getElementById('toast');

  var chapters = window.DHAMMA_DATA || [];
  var currentIdx = 0;

  /* ---------- 유틸 ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }
  function normText(s) {
    return String(s).replace(/\s+/g, ' ').trim();
  }

  /* ---------- 형광펜 매칭용 텍스트 정규화 ---------- */
  // 저장된 경구 텍스트와 현재 장에서 다시 하이라이트를 복원하기 위한 키
  function textKey(s) {
    return normText(s).replace(/\s+/g, '');
  }

  /* ---------- 렌더링 ---------- */
  var sectionAnchors = {}; // 현재 장의 {anchorId: {top, title}} for 목차 하위 확장

  function renderChapter(idx) {
    if (idx < 0 || idx >= chapters.length) return;
    currentIdx = idx;
    var ch = chapters[idx];
    var tree = ch.tree;

    reader.innerHTML = '';
    var marksSet = getMarksForChapter(idx);
    sectionAnchors = {};
    var hlCounter = 0; // h2/h3 등 헤딩 순번

    // 트리 순회 렌더
    function walk(node, parent) {
      var t = node.type;
      if (t === 'text') { parent.appendChild(document.createTextNode(node.text)); return; }
      var dom;
      switch (t) {
        case 'h1': dom = el('h1'); break;
        case 'h2': dom = el('h2'); break;
        case 'h3': dom = el('h3'); break;
        case 'h4': dom = el('h4'); break;
        case 'p': dom = el('p'); break;
        case 'ol': dom = el('ol'); break;
        case 'li': dom = el('li'); break;
        default: dom = document.createDocumentFragment();
      }
      if (node.children) {
        node.children.forEach(function (c) { walk(c, dom); });
      }
      // 제목 노드(h2/h3)에 앵커 부여: 하위 목차에서 스크롤 이동용
      if (t === 'h2' || t === 'h3') {
        var headingText = textOf(node);
        if (headingText && headingText.trim() !== '****') {
          var anchorId = 'sec-' + idx + '-' + (hlCounter++);
          dom.setAttribute('id', anchorId);
          sectionAnchors[anchorId] = { title: headingText.replace(/^\s*\d+\.\s*/, '').trim() };
        }
      }
      if (dom.nodeType === 1 || dom.childNodes.length) {
        parent.appendChild(dom);
      }
    }
    tree.children.forEach(function (c) { walk(c, reader); });

    // 형광펜 복원
    applyMarks(reader, marksSet);

    // 상단 제목
    titleBar.textContent = chapterTitle(idx);

    // 목차 현재 강조
    updateTocHighlight(idx);

    // 이전/다음 버튼
    document.getElementById('prev-btn').disabled = (idx === 0);
    document.getElementById('next-btn').disabled = (idx === chapters.length - 1);
    document.getElementById('pager-pos').textContent = (idx + 1) + ' / ' + chapters.length;

    // 마지막 위치 저장
    lsSet(STORE.last, idx);
  }

  function chapterTitle(idx) {
    var tree = chapters[idx].tree;
    for (var i = 0; i < tree.children.length; i++) {
      var c = tree.children[i];
      if (c.type === 'h1') return textOf(c);
    }
    return chapters[idx].file;
  }
  function textOf(node) {
    var out = '';
    (node.children || []).forEach(function (c) {
      if (c.type === 'text') out += c.text;
      else out += textOf(c);
    });
    return out.trim();
  }

  /* ---------- 목차 ---------- */
  // 각 장의 h1/h2/h3 제목을 스캔해 계층형 목차 데이터 생성
  function scanChapterSections(idx) {
    var tree = chapters[idx].tree;
    var h1 = null, parts = []; // parts: [{kind:'h2', title, subs:[{kind:'h3', title}]}]
    var curH2 = null;

    function collect(node) {
      var t = node.type;
      if (t === 'h1') { if (!h1) h1 = textOf(node); return; }
      if (t === 'h2') {
        var th2 = textOf(node);
        if (th2.trim() === '****') return;
        curH2 = { kind: 'h2', title: th2, subs: [] };
        parts.push(curH2);
        return;
      }
      if (t === 'h3') {
        var th3 = textOf(node);
        if (th3.trim() === '****') return;
        if (curH2) curH2.subs.push({ kind: 'h3', title: th3 });
        else parts.push({ kind: 'h3', title: th3, subs: [] });
        return;
      }
      (node.children || []).forEach(collect);
    }
    (tree.children || []).forEach(collect);
    return { h1: h1 || chapterTitle(idx), parts: parts };
  }

  function buildToc() {
    tocBody.innerHTML = '';
    chapters.forEach(function (ch, i) {
      var sec = scanChapterSections(i);
      var title = sec.h1;
      var m = title.match(/^제(\d+)장/);
      var num = m ? m[1] + '장' : (i === 0 ? '서' : (i === chapters.length - 1 ? '발' : (i + 1)));

      // 장 버튼
      var btn = el('button', 'toc-chapter');
      btn.dataset.idx = i;
      var span = el('span', 'toc-num', (i + 1) + '. ');
      btn.appendChild(span);
      btn.appendChild(document.createTextNode(title));
      btn.addEventListener('click', function () {
        goChapter(i, true);
      });
      tocBody.appendChild(btn);

      // 하위 부/절 (아코디언)
      if (sec.parts.length) {
        var subWrap = el('div', 'toc-sub');
        sec.parts.forEach(function (part, pi) {
          if (part.kind === 'h2') {
            var h2 = el('div', 'toc-h2');
            h2.textContent = part.title;
            h2.addEventListener('click', function () {
              goToSection(i, pi, undefined, true);
            });
            subWrap.appendChild(h2);
            part.subs.forEach(function (sub, si) {
              var h3 = el('div', 'toc-h3');
              h3.textContent = sub.title;
              h3.addEventListener('click', function () {
                goToSection(i, pi, si, true);
              });
              subWrap.appendChild(h3);
            });
          } else {
            // h2 없이 바로 h3 (드묾)
            var h3top = el('div', 'toc-h3');
            h3top.textContent = part.title;
            h3top.addEventListener('click', function () {
              goToSection(i, pi, undefined, true);
            });
            subWrap.appendChild(h3top);
          }
        });
        tocBody.appendChild(subWrap);
      }
    });
  }

  // 목차에서 부/절 클릭 → 해당 장 렌더 후 섹션으로 스크롤
  function goToSection(idx, partIdx, subIdx, closeDrawer) {
    if (closeDrawer) closeToc();
    if (idx !== currentIdx) {
      renderChapter(idx);
    }
    // 앵커 계산: renderChapter의 hlCounter 순서 기준, h2/h3 순서로 매핑
    setTimeout(function () {
      var found = findSectionAnchor(idx, partIdx, subIdx);
      if (found) {
        var elx = document.getElementById(found);
        if (elx) {
          elx.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // 스크롤 위치 저장도 갱신
          setTimeout(function () {
            var map = lsGet(STORE.scroll, {});
            map[idx] = window.scrollY;
            lsSet(STORE.scroll, map);
          }, 400);
        }
      }
    }, 30);
  }

  // partIdx/subIdx → 실제 렌더된 앵커 id 매핑 (hlCounter 순서와 일치)
  function findSectionAnchor(idx, partIdx, subIdx) {
    var sec = scanChapterSections(idx);
    // 렌더 시 hlCounter는 h2/h3가 등장하는 순서로 증가하므로,
    // sec.parts를 순회하며 대상 헤딩의 순번을 계산한다.
    var headingPos = -1;
    var count = 0;
    for (var p = 0; p < sec.parts.length; p++) {
      var part = sec.parts[p];
      if (part.kind === 'h2') {
        if (p === partIdx && subIdx === undefined) { headingPos = count; break; }
        count++; // h2 자신
        for (var s = 0; s < part.subs.length; s++) {
          if (p === partIdx && s === subIdx) { headingPos = count; break; }
          count++;
        }
        if (headingPos >= 0) break;
      } else {
        if (p === partIdx) { headingPos = count; break; }
        count++;
      }
    }
    if (headingPos < 0) return null;
    return 'sec-' + idx + '-' + headingPos;
  }

  function updateTocHighlight(idx) {
    var btns = tocBody.querySelectorAll('.toc-chapter');
    btns.forEach(function (b, i) {
      if (i === idx) b.classList.add('current');
      else b.classList.remove('current');
    });
  }

  function goChapter(i, closeDrawer) {
    if (closeDrawer) closeToc();
    renderChapter(i);
    // 마지막 저장된 스크롤 유지 시도 (기본은 맨 위)
    var saved = lsGet(STORE.scroll, {})[i];
    setTimeout(function () {
      window.scrollTo(0, saved || 0);
    }, 0);
  }

  /* ---------- 목차 드로어 토글 ---------- */
  function openToc() {
    tocDrawer.classList.add('open');
    tocOverlay.classList.add('open');
  }
  function closeToc() {
    tocDrawer.classList.remove('open');
    tocOverlay.classList.remove('open');
  }
  document.getElementById('toc-btn').addEventListener('click', openToc);
  tocOverlay.addEventListener('click', closeToc);

  /* ---------- 형광펜 ---------- */
  function getMarksForChapter(idx) {
    var all = lsGet(STORE.marks, {});
    return all[idx] || [];
  }
  function addMark(idx, text) {
    var all = lsGet(STORE.marks, {});
    var set = all[idx] || [];
    var key = textKey(text);
    if (!set.some(function (s) { return textKey(s) === key; })) {
      set.push(text);
    }
    all[idx] = set;
    lsSet(STORE.marks, all);
  }
  function removeMark(idx, text) {
    var all = lsGet(STORE.marks, {});
    var set = all[idx] || [];
    var key = textKey(text);
    set = set.filter(function (s) { return textKey(s) !== key; });
    all[idx] = set;
    lsSet(STORE.marks, all);
  }

  // 형광펜 적용: 텍스트 노드를 순회하며 mark 래핑
  function applyMarks(rootEl, marks) {
    if (!marks.length) return;
    var markKeys = marks.map(textKey);
    var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    nodes.forEach(function (node) {
      var full = node.nodeValue;
      for (var k = 0; k < markKeys.length; k++) {
        var key = markKeys[k];
        // 연속된 공백 포함 매칭 시도
        var idxv = full.indexOf(marks[k]);
        if (idxv === -1) {
          // 공백 무시 매칭은 복잡하므로 정확 문자열 매칭 우선
          continue;
        }
        wrapRange(node, marks[k]);
        break;
      }
    });
  }

  function wrapRange(textNode, target) {
    var full = textNode.nodeValue;
    var start = full.indexOf(target);
    if (start === -1) return;
    var before = full.slice(0, start);
    var after = full.slice(start + target.length);
    var parent = textNode.parentNode;
    var mark = document.createElement('mark');
    mark.className = 'hl';
    mark.textContent = target;
    mark.dataset.quote = target;
    parent.insertBefore(document.createTextNode(before), textNode);
    parent.insertBefore(mark, textNode);
    parent.insertBefore(document.createTextNode(after), textNode);
    parent.removeChild(textNode);
  }

  /* ---------- 경구 저장 ---------- */
  function saveQuote(text) {
    text = normText(text);
    if (!text) return;
    var quotes = lsGet(STORE.quotes, []);
    var key = textKey(text);
    if (!quotes.some(function (q) { return textKey(q.text) === key; })) {
      quotes.push({ ch: currentIdx, title: chapterTitle(currentIdx), text: text, ts: Date.now() });
      lsSet(STORE.quotes, quotes);
    }
    // 형광펜도 함께
    addMark(currentIdx, text);
    applyMarks(reader, [text]);
    showToast('경구를 저장했습니다 ✨');
  }

  function getSelectionText() {
    var s = window.getSelection();
    return s ? normText(s.toString()) : '';
  }

  /* ---------- 우클릭 저장 (데스크톱) ---------- */
  reader.addEventListener('mouseup', function (e) {
    if (e.button === 2) { // 우클릭
      var t = getSelectionText();
      if (t) {
        e.preventDefault();
        saveQuote(t);
        window.getSelection().removeAllRanges();
      }
    }
  });
  reader.addEventListener('contextmenu', function (e) {
    var t = getSelectionText();
    if (t) {
      e.preventDefault();
      saveQuote(t);
      window.getSelection().removeAllRanges();
    } else {
      // 선택 없으면 기본 메뉴 허용하지 않음(독서방해 방지)
      e.preventDefault();
    }
  });

  /* ---------- 선택 툴팁 (드래그 후 버튼) ---------- */
  document.addEventListener('mouseup', function (e) {
    if (e.button !== 0) return;
    setTimeout(function () {
      var t = getSelectionText();
      if (!t) { hideQuoteTip(); return; }
      // 선택이 reader 안인지
      var sel = window.getSelection();
      if (!sel.rangeCount) { hideQuoteTip(); return; }
      var node = sel.anchorNode;
      if (!reader.contains(node)) { hideQuoteTip(); return; }
      showQuoteTip(sel);
    }, 10);
  });

  function showQuoteTip(sel) {
    var rect = sel.getRangeAt(0).getBoundingClientRect();
    quoteTip.style.left = (rect.left + rect.width / 2) + 'px';
    quoteTip.style.top = (rect.top + window.scrollY - 6) + 'px';
    quoteTip.style.display = 'block';
  }
  function hideQuoteTip() {
    quoteTip.style.display = 'none';
  }
  quoteTip.addEventListener('click', function () {
    var t = getSelectionText();
    if (t) saveQuote(t);
    hideQuoteTip();
    window.getSelection().removeAllRanges();
  });

  /* ---------- 모바일: 길게 누르기 저장 ---------- */
  var longPressTimer = null;
  var touchStartX = 0, touchStartY = 0;
  reader.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    touchStartX = t.clientX; touchStartY = t.clientY;
    longPressTimer = setTimeout(function () {
      // 길게 누르면 선택 텍스트 저장
      var txt = getSelectionText();
      if (txt) {
        saveQuote(txt);
        navigator.vibrate && navigator.vibrate(40);
      } else {
        showToast('경구를 저장하려면 텍스트를 선택해 주세요');
      }
    }, 600);
  }, { passive: true });
  function cancelLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }
  reader.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (Math.abs(t.clientX - touchStartX) > 12 || Math.abs(t.clientY - touchStartY) > 12) {
      cancelLongPress();
    }
  }, { passive: true });
  reader.addEventListener('touchend', cancelLongPress);
  reader.addEventListener('touchcancel', cancelLongPress);

  /* ---------- 저장 경구 보기 ---------- */
  document.getElementById('quotes-btn').addEventListener('click', function () {
    window.location.href = 'quotes.html';
  });

  /* ---------- 이전/다음 ---------- */
  document.getElementById('prev-btn').addEventListener('click', function () {
    if (currentIdx > 0) goChapter(currentIdx - 1, false);
  });
  document.getElementById('next-btn').addEventListener('click', function () {
    if (currentIdx < chapters.length - 1) goChapter(currentIdx + 1, false);
  });

  /* ---------- 스크롤 위치 저장 ---------- */
  var scrollSaving = false;
  window.addEventListener('scroll', function () {
    if (scrollSaving) return;
    scrollSaving = true;
    requestAnimationFrame(function () {
      var map = lsGet(STORE.scroll, {});
      map[currentIdx] = window.scrollY;
      lsSet(STORE.scroll, map);
      scrollSaving = false;
    });
  });

  /* ---------- 초기화 ---------- */
  function init() {
    if (!chapters.length) {
      reader.innerHTML = '<div class="empty">컨텐츠를 불러오지 못했습니다.<br>data.js 파일을 확인해 주세요.</div>';
      return;
    }
    buildToc();
    var last = lsGet(STORE.last, 0);
    if (typeof last !== 'number' || last < 0 || last >= chapters.length) last = 0;
    renderChapter(last);
    // 스크롤 복원
    var saved = lsGet(STORE.scroll, {})[last];
    if (saved) { window.scrollTo(0, saved); }
  }

  // data.js가 로드된 뒤 실행 보장
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 전역 노출(디버그/외부 연동용)
  window.DhammaReader = {
    goChapter: goChapter,
    rebuildToc: buildToc,
    scanChapterSections: scanChapterSections,
    goToSection: goToSection,
    findSectionAnchor: findSectionAnchor,
    getQuotes: function () { return lsGet(STORE.quotes, []); },
    getMarks: function () { return lsGet(STORE.marks, {}); }
  };
})();
