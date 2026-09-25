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
      { threshold: 0, rootMargin: "0px 0px -40px 0px" }
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

  // 법륜 3D 틸트 연출 (마우스/자이로스코프를 따라 부드럽게)
  const tiltZone = document.querySelector(".hero-visual");
  const tiltOrbit = document.querySelector(".orbit");
  if (tiltZone && tiltOrbit) {
    const maxTilt = 14; // 최대 기울기(도)
    let targetRX = 0, targetRY = 0;
    let curRX = 0, curRY = 0;
    let raf = null;
    let hoverActive = false; // '절 둘러보기' 버튼 hover 여부

    const animate = () => {
      curRX += (targetRX - curRX) * 0.1;
      curRY += (targetRY - curRY) * 0.1;
      // orbit 전체(링·점·법륜)를 회전시켜 각 요소의 translateZ 깊이에 따라 패럴랙스 발생
      tiltOrbit.style.transform =
        "perspective(1000px) rotateX(" + curRX.toFixed(2) + "deg) rotateY(" + curRY.toFixed(2) + "deg)";

      // 목표에 거의 다다르면 루프 정지 (성능 절약)
      const done =
        Math.abs(targetRX - curRX) < 0.05 && Math.abs(targetRY - curRY) < 0.05;
      if (done) {
        raf = null;
      } else {
        raf = requestAnimationFrame(animate);
      }
    };

    const setTarget = (rx, ry) => {
      targetRX = rx;
      targetRY = ry;
      if (!raf) raf = requestAnimationFrame(animate);
    };

    // 1) 마우스 기기(데스크톱): 마우스 커서를 따라 틸트
    if (window.matchMedia("(pointer: fine)").matches) {
      const onMove = (e) => {
        if (hoverActive) return;
        const r = tiltZone.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const nx = (e.clientX - cx) / (r.width / 2);
        const ny = (e.clientY - cy) / (r.height / 2);
        setTarget(-ny * maxTilt, nx * maxTilt);
      };
      const onLeave = () => setTarget(0, 0);
      tiltZone.addEventListener("mousemove", onMove);
      tiltZone.addEventListener("mouseleave", onLeave);
    }

    // 2) 터치 기기(휴대폰/패드): 자이로스코프(기기 기울기)를 따라 틸트
    if (window.DeviceOrientationEvent && !window.matchMedia("(pointer: fine)").matches) {
      let gyroSupported = false;
      let beta0 = null, gamma0 = null; // 기준(초기) 기울기

      const onOrientation = (e) => {
        if (e.beta === null || e.gamma === null) return;
        if (hoverActive) return;
        if (!gyroSupported) {
          // 첫 유효 값으로 기준점 설정 (현재 드는 각도를 중립으로)
          beta0 = e.beta;
          gamma0 = e.gamma;
          gyroSupported = true;
        }
        // beta(앞뒤, -180~180) -> rotateX / gamma(좌우, -90~90) -> rotateY
        const dBeta = clamp(e.beta - beta0, -45, 45);
        const dGamma = clamp(e.gamma - gamma0, -45, 45);
        // 기울기를 maxTilt 범위로 매핑 (45도 -> maxTilt)
        const rx = (-dBeta / 45) * maxTilt;
        const ry = (dGamma / 45) * maxTilt;
        setTarget(rx, ry);
      };

      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

      // iOS 13+ 권한 요청 (사용자 제스처 필요할 수 있음)
      let permissionRequested = false;
      const requestPermission = () => {
        if (permissionRequested) return;
        permissionRequested = true;
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
          DeviceOrientationEvent.requestPermission()
            .then((state) => {
              if (state === "granted") {
                window.addEventListener("deviceorientation", onOrientation);
              } else {
                // 거부 시 첫 터치에서 재요청할 수 있도록 허용
                permissionRequested = false;
              }
            })
            .catch(() => {
              permissionRequested = false;
            });
        } else {
          window.addEventListener("deviceorientation", onOrientation);
        }
      };

      requestPermission();

      // iOS는 사용자 제스처가 필요하므로, 첫 터치 시 권한 재요청
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const onFirstTouch = () => {
          requestPermission();
          window.removeEventListener("touchstart", onFirstTouch);
          window.removeEventListener("click", onFirstTouch);
        };
        window.addEventListener("touchstart", onFirstTouch, { once: true });
        window.addEventListener("click", onFirstTouch, { once: true });
      }
    }

    // 3) '절 둘러보기' 버튼 hover → 법륜이 오른쪽→왼쪽으로 서서히 틸트
    const tourBtn = document.querySelector('.hero-actions a[href="about.html"]');
    if (tourBtn) {
      let swingRaf = null;
      let phase = 0; // 스윙 위상(시간)

      const swing = () => {
        if (!hoverActive) return;
        // sin 파형으로 rotateY를 오른쪽(+) → 왼쪽(-)으로 서서히 왕복
        const ry = Math.sin(phase) * maxTilt * 1.6;
        phase += 0.022; // 서서히
        setTarget(0, ry);
        swingRaf = requestAnimationFrame(swing);
      };

      tourBtn.addEventListener("mouseenter", () => {
        hoverActive = true;
        phase = 0;
        if (swingRaf) cancelAnimationFrame(swingRaf);
        swingRaf = requestAnimationFrame(swing);
      });

      tourBtn.addEventListener("mouseleave", () => {
        hoverActive = false;
        if (swingRaf) cancelAnimationFrame(swingRaf);
        swingRaf = null;
        setTarget(0, 0);
      });
    }
  }

  // '밥할머니 이야기'/'암베드카르 박사 이야기' 버튼 hover → 원형 일러스트를 법륜 위로 페이드 + 배경과 함께 오른쪽→왼쪽 틸트
  const wheelImg = document.querySelector(".dharma-wheel-img");
  const heroOrbit = document.querySelector(".orbit");
  const overlayMap = [
    { btn: '.hero-actions a[href="babhalmeoni.html"]', overlay: ".babhalmeoni-overlay" },
    { btn: '.hero-actions a[href="dharma.html"]', overlay: ".ambedkar-overlay" }
  ];

  overlayMap.forEach((item) => {
    const btn = document.querySelector(item.btn);
    const overlay = document.querySelector(item.overlay);
    if (!btn || !overlay) return;

    let raf = null;
    let phase = 0;

    const swing = () => {
      // orbit 전체(법륜 배경·링·점 + 원형 일러스트)를 함께 회전시켜 일체감 유지
      const deg = Math.sin(phase) * 30; // 오른쪽(+) → 왼쪽(-) 왕복
      phase += 0.02;
      if (heroOrbit) {
        heroOrbit.style.transform =
          "perspective(1000px) rotateX(0deg) rotateY(" + deg.toFixed(2) + "deg)";
      }
      raf = requestAnimationFrame(swing);
    };

    btn.addEventListener("mouseenter", () => {
      // 법륜 이미지를 잠시 숨기고 원형 일러스트만 표시
      if (wheelImg) wheelImg.classList.add("hidden");
      overlay.classList.add("visible");
      phase = Math.PI / 2; // 오른쪽(양수)에서 시작
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(swing);
    });

    btn.addEventListener("mouseleave", () => {
      // 마우스를 떼면 법륜 다시 표시 + orbit 원위치
      if (wheelImg) wheelImg.classList.remove("hidden");
      overlay.classList.remove("visible");
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      if (heroOrbit) {
        heroOrbit.style.transform =
          "perspective(1000px) rotateX(0deg) rotateY(0deg)";
      }
    });
  });

  // 암베드카르 박사 사진 카드 3D 틸트 (마우스 커서를 따라 살짝)
  const profileImg = document.querySelector(".profile-card-img");
  if (profileImg && window.matchMedia("(pointer: fine)").matches) {
    const maxTilt = 10; // 최대 기울기(도)
    let raf = null;
    let targetRX = 0, targetRY = 0;
    let curRX = 0, curRY = 0;

    const animate = () => {
      curRX += (targetRX - curRX) * 0.12;
      curRY += (targetRY - curRY) * 0.12;
      profileImg.style.transform =
        "rotateX(" + curRX.toFixed(2) + "deg) rotateY(" + curRY.toFixed(2) + "deg)";
      const done =
        Math.abs(targetRX - curRX) < 0.05 && Math.abs(targetRY - curRY) < 0.05;
      if (done) {
        raf = null;
      } else {
        raf = requestAnimationFrame(animate);
      }
    };

    const setTarget = (rx, ry) => {
      targetRX = rx;
      targetRY = ry;
      if (!raf) raf = requestAnimationFrame(animate);
    };

    profileImg.addEventListener("mousemove", (e) => {
      const r = profileImg.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5; // -0.5 ~ 0.5
      const ny = (e.clientY - r.top) / r.height - 0.5;
      setTarget(-ny * maxTilt * 2, nx * maxTilt * 2);
    });

    profileImg.addEventListener("mouseleave", () => setTarget(0, 0));
  }
});
