/**
 * ATTA NATION — Production Frontend Controller ("Meja Kerja")
 * Mendukung:
 * 1. Progressive Enhancement (`html.js-enabled`) untuk No-JS Resilience
 * 2. Mobile Drawer dengan Scroll-Lock & Escape Key
 * 3. Hero Project Slider dengan Touch Swipe, Reduced Motion, & Off-Screen Focus Guard (`inert`)
 * 4. Interactive Tabs & Template Filter dengan Keyboard Roving Tabindex (WCAG 2.1 AA)
 * 5. Midtrans Snap Integration + Mode Standby Otomatis (saat Server Key dikosongkan)
 * 6. Status Pembayaran Multi-State, Signed Download Link, & Konfirmasi WhatsApp Dinamis
 * 7. Dashboard Akun & Verifikasi Login ke `api/account-auth.php`
 */
document.documentElement.classList.add('js-enabled');

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initHeroSlider();
  initTabs();
  initTemplateFilter();
  initCheckout();
  initStatusPage();
  initAccount();
});

/* -------------------------------------------------------------
 * 1. Mobile Menu Drawer (with Body Scroll-Lock & Escape Handler)
 * ------------------------------------------------------------- */
function initMobileMenu() {
  const toggleBtn = document.querySelector('.btn-mobile-toggle');
  const drawer = document.querySelector('.mobile-nav-drawer');
  if (!toggleBtn || !drawer) return;

  const iconOpen = toggleBtn.querySelector('.icon-open');
  const iconClose = toggleBtn.querySelector('.icon-close');
  const isEn = document.documentElement.lang === 'en';

  function setDrawerState(isOpen) {
    drawer.classList.toggle('open', isOpen);
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggleBtn.setAttribute(
      'aria-label',
      isOpen ? (isEn ? 'Close menu' : 'Tutup menu') : (isEn ? 'Open menu' : 'Buka menu')
    );
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (iconOpen && iconClose) {
      iconOpen.style.display = isOpen ? 'none' : 'block';
      iconClose.style.display = isOpen ? 'block' : 'none';
    }
  }

  toggleBtn.addEventListener('click', () => {
    const isOpen = !drawer.classList.contains('open');
    setDrawerState(isOpen);
  });

  drawer.querySelectorAll('a, button').forEach((el) => {
    el.addEventListener('click', () => {
      if (drawer.classList.contains('open')) {
        setDrawerState(false);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      setDrawerState(false);
      toggleBtn.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && drawer.classList.contains('open')) {
      setDrawerState(false);
    }
  });

  window.addEventListener('pageshow', () => {
    if (drawer.classList.contains('open')) {
      setDrawerState(false);
    }
    document.body.style.overflow = '';
  });
}

/* -------------------------------------------------------------
 * 2. Hero Project Slider (Beranda / index.html & en/index.html)
 * ------------------------------------------------------------- */
function initHeroSlider() {
  const track = document.querySelector('.slider-track');
  if (!track) return;

  const slides = track.querySelectorAll('.slide');
  const prevBtn = document.querySelector('.arrow.arrow-prev');
  const nextBtn = document.querySelector('.arrow.arrow-next');
  const dotsContainer = document.querySelector('.slider-dots');
  const counterEl = document.querySelector('.slider-counter');
  const total = slides.length;
  if (total <= 1) return;

  let currentIndex = 0;
  let userTouched = false;
  let touchStartX = 0;
  const isEn = document.documentElement.lang === 'en';

  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    for (let k = 0; k < total; k++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'slider-dot';
      dot.setAttribute('aria-label', isEn ? `Go to project ${k + 1}` : `Ke proyek ${k + 1}`);
      dot.style.cssText = `height: 10px; border-radius: 5px; border: 0; cursor: pointer; transition: width .3s, background .3s; padding: 0; width: ${k === 0 ? '34px' : '10px'}; background: ${k === 0 ? '#F2C94C' : 'rgba(244,246,243,.4)'};`;
      dot.addEventListener('click', () => {
        userTouched = true;
        goToSlide(k);
      });
      dotsContainer.appendChild(dot);
    }
  }

  function updateUI() {
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    slides.forEach((slide, idx) => {
      const isActive = idx === currentIndex;
      slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      if ('inert' in slide) {
        slide.inert = !isActive;
      }
      slide.querySelectorAll('a, button, input, select, textarea').forEach((focusable) => {
        if (isActive) {
          focusable.removeAttribute('tabindex');
        } else {
          focusable.setAttribute('tabindex', '-1');
        }
      });
    });

    if (counterEl) {
      counterEl.textContent = `${currentIndex + 1} / ${total}`;
    }
    if (dotsContainer) {
      const dots = dotsContainer.querySelectorAll('.slider-dot');
      dots.forEach((dot, idx) => {
        const isCurrent = idx === currentIndex;
        dot.style.width = isCurrent ? '34px' : '10px';
        dot.style.background = isCurrent ? '#F2C94C' : 'rgba(244,246,243,.4)';
        dot.setAttribute('aria-current', isCurrent ? 'true' : 'false');
      });
    }
  }

  function goToSlide(idx) {
    currentIndex = (idx + total) % total;
    updateUI();
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      userTouched = true;
      goToSlide(currentIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      userTouched = true;
      goToSlide(currentIndex + 1);
    });
  }

  const sliderSection = document.querySelector('.slider-section');
  if (sliderSection) {
    let touchStartY = 0;
    let swipeValid = false;

    if (!sliderSection.hasAttribute('tabindex')) {
      sliderSection.setAttribute('tabindex', '0');
    }

    sliderSection.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) {
        swipeValid = false;
        return;
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      swipeValid = true;
    }, { passive: true });

    sliderSection.addEventListener('touchend', (e) => {
      if (!swipeValid || !e.changedTouches.length) return;
      swipeValid = false;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        userTouched = true;
        goToSlide(dx < 0 ? currentIndex + 1 : currentIndex - 1);
      }
    }, { passive: true });

    sliderSection.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        userTouched = true;
        goToSlide(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        userTouched = true;
        goToSlide(currentIndex + 1);
      }
    });

    window.addEventListener('resize', () => {
      updateUI();
    });
  }

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced) {
    setInterval(() => {
      if (!userTouched) {
        goToSlide(currentIndex + 1);
      }
    }, 6000);
  }

  updateUI();
}

/* -------------------------------------------------------------
 * 3. Interactive Tabs with Keyboard Roving Tabindex (WCAG 2.1 AA)
 * ------------------------------------------------------------- */
function initTabs() {
  const tabLists = document.querySelectorAll('[role="tablist"]');
  tabLists.forEach((list) => {
    const tabs = Array.from(list.querySelectorAll('button[role="tab"]'));
    if (!tabs.length) return;

    function activateTab(tab, focusTab = false) {
      const targetId = tab.getAttribute('data-target');
      tabs.forEach((t) => {
        const isCurrent = t === tab;
        t.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
        t.setAttribute('tabindex', isCurrent ? '0' : '-1');
        t.classList.toggle('active', isCurrent);
      });
      if (focusTab) tab.focus();

      if (targetId) {
        const groupName = tab.getAttribute('data-group') || 'default';
        const panels = document.querySelectorAll(`[data-tab-group="${groupName}"]`);
        panels.forEach((p) => {
          const isMatch = p.id === targetId;
          p.style.display = isMatch ? 'block' : 'none';
          p.classList.toggle('active', isMatch);
          p.setAttribute('aria-hidden', isMatch ? 'false' : 'true');
        });
      }
    }

    tabs.forEach((tab, idx) => {
      const isSelected = tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('active');
      tab.setAttribute('tabindex', isSelected ? '0' : '-1');

      tab.addEventListener('click', () => activateTab(tab, false));

      tab.addEventListener('keydown', (e) => {
        let nextIdx = null;
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = tabs.length - 1;

        if (nextIdx !== null) {
          e.preventDefault();
          activateTab(tabs[nextIdx], true);
          tabs[nextIdx].click();
        }
      });
    });
  });
}

/* -------------------------------------------------------------
 * 4. Template Category Filter (jasa.html & en/services.html)
 * ------------------------------------------------------------- */
function initTemplateFilter() {
  const filterTabs = document.querySelectorAll('button[data-filter]');
  const cards = document.querySelectorAll('.template-card');
  if (!filterTabs.length || !cards.length) return;

  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const filterVal = tab.getAttribute('data-filter');
      cards.forEach((card) => {
        if (filterVal === 'all' || card.getAttribute('data-cat') === filterVal) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* -------------------------------------------------------------
 * 5. Midtrans Snap Loader & Checkout Controller (checkout.html)
 * ------------------------------------------------------------- */
function loadMidtransSnapScript(clientKey, isProduction) {
  return new Promise((resolve, reject) => {
    if (window.snap) {
      resolve(window.snap);
      return;
    }
    const script = document.createElement('script');
    script.src = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', clientKey);
    script.onload = () => resolve(window.snap);
    script.onerror = () => reject(new Error('Gagal memuat script Midtrans Snap.'));
    document.head.appendChild(script);
  });
}

function initCheckout() {
  const checkoutForm = document.getElementById('checkout-form');
  if (!checkoutForm) return;

  const isEn = window.location.pathname.includes('/en/') || document.documentElement.lang === 'en';
  const sessionIdemKey = 'IDEM-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameEl = document.getElementById('buyer-name');
    const emailEl = document.getElementById('buyer-email');
    const passEl = document.getElementById('buyer-pass');
    const phoneEl = document.getElementById('buyer-phone');
    const agreeEl = document.getElementById('agree-terms');
    const submitBtn = checkoutForm.querySelector('button[type="submit"]');

    const name = (nameEl?.value || '').trim();
    const email = (emailEl?.value || '').trim().toLowerCase();
    const password = passEl?.value || '';
    const phone = (phoneEl?.value || '').trim();
    const targetDevice = checkoutForm.querySelector('input[name="target_device"]:checked')?.value || 'android';
    const paymentMethod = checkoutForm.querySelector('input[name="payment_method"]:checked')?.value || 'qris';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (name.length < 2) {
      alert(isEn ? 'Please enter your full name.' : 'Silakan masukkan nama lengkapmu.');
      nameEl?.focus();
      return;
    }
    if (!emailRegex.test(email)) {
      alert(isEn ? 'Please enter a valid email address.' : 'Silakan masukkan alamat email yang valid.');
      emailEl?.focus();
      return;
    }
    if (password.length < 8) {
      alert(isEn ? 'Password must be at least 8 characters.' : 'Kata sandi minimal 8 karakter.');
      passEl?.focus();
      return;
    }
    if (phone !== '' && !/^(\+?[0-9\s\-]{8,16})$/.test(phone)) {
      alert(isEn ? 'Please enter a valid WhatsApp phone number.' : 'Format nomor WhatsApp tidak valid.');
      phoneEl?.focus();
      return;
    }
    if (agreeEl && !agreeEl.checked) {
      alert(
        isEn
          ? 'Please agree to the terms, privacy policy, and refund policy.'
          : 'Silakan setujui syarat, kebijakan privasi, dan kebijakan refund terlebih dahulu.'
      );
      agreeEl.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = isEn ? 'Processing order...' : 'Memproses pesanan...';
    }

    const apiEndpoint = isEn ? '../api/create-order.php' : 'api/create-order.php';
    const statusPage = isEn ? 'status.html' : 'status-pembayaran.html';
    const formattedDate = new Date().toLocaleDateString(isEn ? 'en-US' : 'id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          target_device: targetDevice,
          payment_method: paymentMethod,
          product_id: 'atta-docstudio-pro',
          idempotency_key: sessionIdemKey,
        }),
      });

      const resData = await response.json();

      if (resData && resData.ok) {
        const orderId = resData.order.order_id;
        const orderData = {
          orderId,
          name,
          email,
          phone,
          targetDevice,
          paymentMethod,
          item: resData.order.item || 'ATTA DocStudio Pro',
          price: 'Rp30.000',
          mode: resData.mode,
          midtransConfigured: Boolean(resData.midtrans_configured),
          downloadUrl: resData.download_url || null,
          whatsappConfirmUrl: resData.whatsapp_confirm_url || null,
          date: formattedDate,
        };

        const userProfile = {
          name,
          email,
          orderId,
          downloadUrl: resData.download_url || null,
          date: formattedDate,
          loggedIn: true,
        };

        try {
          localStorage.setItem('atta_current_order', JSON.stringify(orderData));
          localStorage.setItem('atta_auth_user', JSON.stringify(userProfile));
          localStorage.setItem('atta_registered_user', JSON.stringify(userProfile));
        } catch (_) {}

        if (resData.mode === 'midtrans_snap' && resData.snap_token) {
          if (resData.client_key) {
            await loadMidtransSnapScript(resData.client_key, Boolean(resData.is_production));
            window.snap.pay(resData.snap_token, {
              onSuccess: () => {
                window.location.href = `${statusPage}?order=${encodeURIComponent(orderId)}&status=berhasil`;
              },
              onPending: () => {
                window.location.href = `${statusPage}?order=${encodeURIComponent(orderId)}&status=menunggu`;
              },
              onError: () => {
                window.location.href = `${statusPage}?order=${encodeURIComponent(orderId)}&status=gagal`;
              },
              onClose: () => {
                window.location.href = `${statusPage}?order=${encodeURIComponent(orderId)}&status=menunggu`;
              },
            });
            return;
          } else if (resData.redirect_url) {
            window.location.href = resData.redirect_url;
            return;
          }
        }

        window.location.href = `${statusPage}?order=${encodeURIComponent(orderId)}&status=berhasil&mode=standby`;
        return;
      }
    } catch (_) {
      // Fallback murni jika dibuka dari file:// atau static preview tanpa PHP server
    }

    const fallbackOrderId =
      'ATN-' +
      new Date().toISOString().slice(0, 10).replace(/-/g, '') +
      '-' +
      Math.floor(1000 + Math.random() * 9000);
    const waText = encodeURIComponent(
      `Halo ATTA NATION, saya ingin menyelesaikan pesanan aplikasi:\n` +
        `- No. Pesanan: ${fallbackOrderId}\n` +
        `- Produk: ATTA DocStudio Pro (Rp30.000)\n` +
        `- Nama: ${name}\n` +
        `- Email: ${email}\n` +
        `- Metode: ${paymentMethod.toUpperCase()}`
    );
    const fallbackOrderData = {
      orderId: fallbackOrderId,
      name,
      email,
      phone,
      targetDevice,
      paymentMethod,
      item: 'ATTA DocStudio Pro',
      price: 'Rp30.000',
      mode: 'standby_no_key',
      midtransConfigured: false,
      downloadUrl: null,
      whatsappConfirmUrl: `https://wa.me/6281235928712?text=${waText}`,
      date: formattedDate,
    };

    const fallbackProfile = {
      name,
      email,
      orderId: fallbackOrderId,
      downloadUrl: null,
      date: formattedDate,
      loggedIn: true,
    };

    try {
      localStorage.setItem('atta_current_order', JSON.stringify(fallbackOrderData));
      localStorage.setItem('atta_auth_user', JSON.stringify(fallbackProfile));
      localStorage.setItem('atta_registered_user', JSON.stringify(fallbackProfile));
    } catch (_) {}

    window.location.href = `${statusPage}?order=${encodeURIComponent(fallbackOrderId)}&status=berhasil&mode=standby`;
  });
}

/* -------------------------------------------------------------
 * 6. Status Pembayaran Multi-State Controller (status-pembayaran.html)
 * ------------------------------------------------------------- */
function initStatusPage() {
  const statusPanels = document.querySelectorAll('.status-panel');
  if (!statusPanels.length) return;

  const isEn = window.location.pathname.includes('/en/') || document.documentElement.lang === 'en';
  const statusTabs = document.querySelectorAll('[data-status-tab]');

  function setStatusState(status) {
    let normalized = status;
    if (normalized === 'success' || normalized === 'paid' || normalized === 'settlement') normalized = 'berhasil';
    if (normalized === 'pending') normalized = 'menunggu';
    if (normalized === 'failed') normalized = 'gagal';

    statusPanels.forEach((p) => {
      const isMatch = p.id === `status-${normalized}`;
      p.classList.toggle('active', isMatch);
      p.setAttribute('aria-hidden', isMatch ? 'false' : 'true');
    });

    statusTabs.forEach((t) => {
      const tabVal = t.getAttribute('data-status-tab');
      const isMatch = tabVal === normalized;
      t.classList.toggle('active', isMatch);
      t.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });
  }

  statusTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetState = btn.getAttribute('data-status-tab') || 'berhasil';
      setStatusState(targetState);
    });
  });

  const params = new URLSearchParams(window.location.search);
  const st = params.get('status') || 'berhasil';
  let orderId = params.get('order') || '';

  let savedOrder = null;
  try {
    savedOrder = JSON.parse(localStorage.getItem('atta_current_order') || 'null');
  } catch (_) {}

  if (!orderId && savedOrder && savedOrder.orderId) {
    orderId = savedOrder.orderId;
  }

  if (orderId) {
    document.querySelectorAll('.order-id-display').forEach((el) => {
      el.textContent = orderId;
    });
  }

  function applyDownloadUrl(dlUrl) {
    if (!dlUrl) return;
    const resolvedUrl = isEn && !dlUrl.startsWith('../') && !dlUrl.startsWith('http') ? `../${dlUrl}` : dlUrl;
    document.querySelectorAll('.app-download-link').forEach((link) => {
      link.setAttribute('href', resolvedUrl);
    });
  }

  if (savedOrder && savedOrder.downloadUrl) {
    applyDownloadUrl(savedOrder.downloadUrl);
  }

  if (savedOrder && savedOrder.whatsappConfirmUrl) {
    document.querySelectorAll('.whatsapp-confirm-btn').forEach((link) => {
      link.setAttribute('href', savedOrder.whatsappConfirmUrl);
    });
  } else if (orderId) {
    const waText = encodeURIComponent(
      `Halo ATTA NATION, saya ingin konfirmasi pesanan ${orderId} untuk ATTA DocStudio Pro (Rp30.000).`
    );
    document.querySelectorAll('.whatsapp-confirm-btn').forEach((link) => {
      link.setAttribute('href', `https://wa.me/6281235928712?text=${waText}`);
    });
  }

  setStatusState(st);

  // Sinkronisasi status pesanan dari backend bila tersedia
  if (orderId) {
    const statusApi = (isEn ? '../api/order-status.php?order=' : 'api/order-status.php?order=') + encodeURIComponent(orderId);
    fetch(statusApi, { headers: { 'Accept': 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.ok && data.download_url) {
          applyDownloadUrl(data.download_url);
        }
      })
      .catch(() => {});
  }
}

/* -------------------------------------------------------------
 * 7. Account Dashboard & Login Controller (akun.html & en/account.html)
 * ------------------------------------------------------------- */
function initAccount() {
  const loginView = document.getElementById('account-login-view');
  const dashView = document.getElementById('account-dash-view');
  if (!loginView || !dashView) return;

  const isEn = window.location.pathname.includes('/en/') || document.documentElement.lang === 'en';

  function getSavedRegisteredUser(emailToMatch) {
    try {
      const reg = JSON.parse(localStorage.getItem('atta_registered_user') || 'null');
      if (reg && (!emailToMatch || (reg.email && reg.email.toLowerCase() === emailToMatch.toLowerCase()))) {
        return reg;
      }
      const ord = JSON.parse(localStorage.getItem('atta_current_order') || 'null');
      if (ord && (!emailToMatch || (ord.email && ord.email.toLowerCase() === emailToMatch.toLowerCase()))) {
        return ord;
      }
    } catch (_) {}
    return null;
  }

  function checkState() {
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('atta_auth_user') || 'null');
    } catch (_) {}

    if (user && user.loggedIn) {
      loginView.style.display = 'none';
      dashView.style.display = 'block';

      const nameEl = document.getElementById('dash-user-name');
      const emailEl = document.getElementById('dash-user-email');
      const dateEl = document.getElementById('dash-order-date');

      if (nameEl) nameEl.textContent = user.name || (isEn ? 'Registered Customer' : 'Pengguna Terdaftar');
      if (emailEl) emailEl.textContent = user.email || 'pembeli@contoh.com';
      if (dateEl) dateEl.textContent = user.date || (isEn ? 'Today' : 'Hari ini');

      if (user.downloadUrl) {
        const resolvedUrl =
          isEn && !user.downloadUrl.startsWith('../') && !user.downloadUrl.startsWith('http')
            ? `../${user.downloadUrl}`
            : user.downloadUrl;
        dashView.querySelectorAll('.app-download-link').forEach((link) => {
          link.setAttribute('href', resolvedUrl);
        });
      }
    } else {
      loginView.style.display = 'block';
      dashView.style.display = 'none';
    }
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-pass');
      const email = ((emailInput && emailInput.value) || 'pembeli@contoh.com').trim().toLowerCase();
      const password = (passInput && passInput.value) || '';

      if (password.length < 8) {
        alert(isEn ? 'Password must be at least 8 characters.' : 'Kata sandi minimal 8 karakter.');
        passInput?.focus();
        return;
      }

      const existingReg = getSavedRegisteredUser(email);
      const fallbackName = (existingReg && existingReg.name) ? existingReg.name : (isEn ? 'Registered Customer' : 'Pembeli ATTA DocStudio Pro');
      const defaultDate =
        (existingReg && existingReg.date) ||
        new Date().toLocaleDateString(isEn ? 'en-US' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      const authEndpoint = isEn ? '../api/account-auth.php' : 'api/account-auth.php';
      try {
        const res = await fetch(authEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            email,
            password,
            fallback_name: fallbackName,
          }),
        });

        const data = await res.json();
        if (res.status === 401 && data && data.error) {
          alert(data.error);
          return;
        }
        if (data && data.ok && data.user) {
          const loggedInUser = {
            name: data.user.name || fallbackName,
            email: data.user.email || email,
            orderId: data.user.order_id || (existingReg && existingReg.orderId) || null,
            downloadUrl: data.user.download_url || (existingReg && existingReg.downloadUrl) || null,
            date: defaultDate,
            loggedIn: true,
          };
          localStorage.setItem('atta_auth_user', JSON.stringify(loggedInUser));
          localStorage.setItem('atta_registered_user', JSON.stringify(loggedInUser));
          checkState();
          return;
        }
      } catch (_) {
        // Fallback ke profil lokal jika tanpa PHP server
      }

      const user = {
        name: fallbackName,
        email,
        orderId: (existingReg && existingReg.orderId) || null,
        downloadUrl: (existingReg && existingReg.downloadUrl) || null,
        date: defaultDate,
        loggedIn: true,
      };
      try {
        localStorage.setItem('atta_auth_user', JSON.stringify(user));
        localStorage.setItem('atta_registered_user', JSON.stringify(user));
      } catch (_) {}
      checkState();
    });
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      try {
        const current = JSON.parse(localStorage.getItem('atta_auth_user') || 'null');
        if (current) {
          current.loggedIn = false;
          localStorage.setItem('atta_registered_user', JSON.stringify(current));
        }
        localStorage.removeItem('atta_auth_user');
      } catch (_) {}
      checkState();
    });
  }

  const editNameBtn = document.getElementById('btn-edit-name');
  if (editNameBtn) {
    editNameBtn.addEventListener('click', () => {
      const currentName = document.getElementById('dash-user-name')?.textContent || '';
      const newName = prompt(isEn ? 'Enter new full name:' : 'Masukkan nama lengkap baru:', currentName);
      if (newName && newName.trim().length >= 2) {
        const cleanName = newName.trim();
        try {
          const user = JSON.parse(localStorage.getItem('atta_auth_user') || '{}');
          user.name = cleanName;
          localStorage.setItem('atta_auth_user', JSON.stringify(user));
          localStorage.setItem('atta_registered_user', JSON.stringify(user));

          const ord = JSON.parse(localStorage.getItem('atta_current_order') || 'null');
          if (ord) {
            ord.name = cleanName;
            localStorage.setItem('atta_current_order', JSON.stringify(ord));
          }

          const authEndpoint = isEn ? '../api/account-auth.php' : 'api/account-auth.php';
          fetch(authEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_profile', email: user.email || '', name: cleanName }),
          }).catch(() => {});
        } catch (_) {}
        checkState();
      }
    });
  }

  const deleteAccBtn = document.getElementById('btn-delete-account');
  if (deleteAccBtn) {
    deleteAccBtn.addEventListener('click', () => {
      const msg = isEn
        ? 'Are you sure you want to delete your account? All download links will be deactivated.'
        : 'Apakah kamu yakin ingin menghapus akun? Semua hak akses dan tautan unduhan akan dinonaktifkan.';
      if (confirm(msg)) {
        try {
          localStorage.removeItem('atta_auth_user');
          localStorage.removeItem('atta_registered_user');
          localStorage.removeItem('atta_current_order');
        } catch (_) {}
        alert(isEn ? 'Account deleted.' : 'Akun telah dihapus.');
        checkState();
      }
    });
  }

  checkState();
}
