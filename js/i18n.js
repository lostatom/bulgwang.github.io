// 간단한 i18n 언어 토글 (data-en 속성 기반)
(function () {
  // 언어 토글 버튼 자동 생성
  function createToggle() {
    const nav = document.querySelector(".nav-inner");
    if (!nav) return;
    if (document.querySelector(".lang-toggle")) return; // 이미 있으면 스킵

    const saved = localStorage.getItem("bulgwang-lang") || "ko";

    const wrap = document.createElement("div");
    wrap.className = "lang-toggle";
    wrap.innerHTML =
      '<button data-lang="ko">한국어</button>' +
      '<button data-lang="en">EN</button>';
    nav.appendChild(wrap);

    wrap.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === saved);
      btn.addEventListener("click", () => {
        const lang = btn.dataset.lang;
        localStorage.setItem("bulgwang-lang", lang);
        applyLang(lang);
        wrap.querySelectorAll("button").forEach((b) =>
          b.classList.toggle("active", b.dataset.lang === lang)
        );
      });
    });

    applyLang(saved);
  }

  function applyLang(lang) {
    document.documentElement.setAttribute("lang", lang);

    // data-en이 있는 모든 요소의 텍스트 전환
    document.querySelectorAll("[data-en]").forEach((el) => {
      if (lang === "en") {
        // 원래 한국어 텍스트를 저장(최초 1회) 후 영어로 교체
        if (!el.dataset.ko) {
          el.dataset.ko = el.innerHTML;
        }
        el.innerHTML = el.dataset.en;
      } else {
        if (el.dataset.ko) {
          el.innerHTML = el.dataset.ko;
        }
      }
    });

    // title/meta 교체
    const titleEl = document.querySelector("title");
    if (titleEl && titleEl.dataset.en) {
      if (lang === "en") {
        if (!titleEl.dataset.ko) titleEl.dataset.ko = titleEl.textContent;
        titleEl.textContent = titleEl.dataset.en;
      } else {
        if (titleEl.dataset.ko) titleEl.textContent = titleEl.dataset.ko;
      }
    }

    // meta description 교체
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && metaDesc.dataset.en) {
      if (lang === "en") {
        if (!metaDesc.dataset.ko) metaDesc.dataset.ko = metaDesc.content;
        metaDesc.content = metaDesc.dataset.en;
      } else {
        if (metaDesc.dataset.ko) metaDesc.content = metaDesc.dataset.ko;
      }
    }

    // placeholder 교체
    document.querySelectorAll("[data-en-placeholder]").forEach((el) => {
      if (lang === "en") {
        if (!el.dataset.koPlaceholder) el.dataset.koPlaceholder = el.placeholder;
        el.placeholder = el.dataset.enPlaceholder;
      } else {
        if (el.dataset.koPlaceholder) el.placeholder = el.dataset.koPlaceholder;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createToggle);
  } else {
    createToggle();
  }
})();
