// 불광동절 공통 스크립트
document.addEventListener("DOMContentLoaded", () => {
  // 모바일 내비게이션 토글
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      links.classList.toggle("open");
    });
  }

  // 스크롤 등장 애니메이션 (IntersectionObserver)
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  // 계좌번호 복사 버튼
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy");
      try {
        await navigator.clipboard.writeText(text);
        const orig = btn.textContent;
        btn.textContent = "복사됨 ✓";
        setTimeout(() => (btn.textContent = orig), 1600);
      } catch (e) {
        /* 클립보드 실패 시 무시 */
      }
    });
  });

  // 모달 (일반화: data-modal-open 속성으로 여러 모달 공통 처리)
  const openModal = (m) => {
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };
  const closeModal = (m) => {
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  // data-modal-open 버튼 -> 해당 id 모달 열기 (밥할머니 페이지의 두 글, 봉축법어 등)
  document.querySelectorAll("[data-modal-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-modal-open");
      const modal = document.getElementById(id);
      if (modal) openModal(modal);
    });
  });

  // 기존 봉축법어 전용 버튼(id=dhamraOpen -> dharmaModal)
  const dharmaModal = document.getElementById("dharmaModal");
  const dharmaOpen = document.getElementById("dharmaOpen");
  if (dharmaModal && dharmaOpen) {
    dharmaOpen.addEventListener("click", () => openModal(dharmaModal));
  }

  // 모든 모달에 닫기 핸들러 부착
  document.querySelectorAll(".dharma-modal").forEach((modal) => {
    modal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => closeModal(modal));
    });
  });

  // ESC 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".dharma-modal.open").forEach((m) => closeModal(m));
    }
  });

  // 법륜 3D 틸트 연출 (마우스 커서를 따라 부드럽게)
  const tiltZone = document.querySelector(".hero-visual");
  const tiltCore = document.querySelector(".orbit-core");
  if (tiltZone && tiltCore && window.matchMedia("(pointer: fine)").matches) {
    const maxTilt = 12; // 최대 기울기(도)
    let targetRX = 0, targetRY = 0;
    let curRX = 0, curRY = 0;
    let raf = null;

    const onMove = (e) => {
      const r = tiltZone.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const nx = (e.clientX - cx) / (r.width / 2);
      const ny = (e.clientY - cy) / (r.height / 2);
      targetRY = nx * maxTilt;
      targetRX = -ny * maxTilt;
      if (!raf) raf = requestAnimationFrame(animate);
    };

    const onLeave = () => {
      targetRX = 0;
      targetRY = 0;
      if (!raf) raf = requestAnimationFrame(animate);
    };

    const animate = () => {
      curRX += (targetRX - curRX) * 0.1;
      curRY += (targetRY - curRY) * 0.1;
      tiltCore.style.transform =
        "perspective(900px) rotateX(" + curRX.toFixed(2) + "deg) rotateY(" + curRY.toFixed(2) + "deg)";

      // 목표에 거의 다다르면 루프 정지 (성능 절약)
      const done =
        Math.abs(targetRX - curRX) < 0.05 && Math.abs(targetRY - curRY) < 0.05;
      if (done) {
        raf = null;
      } else {
        raf = requestAnimationFrame(animate);
      }
    };

    tiltZone.addEventListener("mousemove", onMove);
    tiltZone.addEventListener("mouseleave", onLeave);
  }
});
