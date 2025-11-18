// script.js - logic gabungan untuk index.html dan scare.html (demo client-side)
// NOTE: Demo ini menyimpan akun di localStorage dengan hash SHA-256.
// Ini untuk keperluan demo/tes saja — TIDAK aman buat produksi.

async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

/* ----- Utility: try to unlock audio by resuming/playing a tiny silent buffer ----- */
async function tryUnlockAudio() {
  // returns true if AudioContext could be created/resumed and played
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    window.__demoAudioCtx = new AudioCtx();
    // create 1-frame silent buffer
    const buffer = window.__demoAudioCtx.createBuffer(1, 1, window.__demoAudioCtx.sampleRate);
    const src = window.__demoAudioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(window.__demoAudioCtx.destination);
    src.start(0);
    await window.__demoAudioCtx.resume();
    // mark unlocked for same-origin future playback attempts
    sessionStorage.setItem('audio_unlocked', '1');
    return true;
  } catch (e) {
    console.warn('unlockAudio failed', e);
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // --- AUTH (index.html) ---
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const msg = document.getElementById('msg');

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active'); tabRegister.classList.remove('active');
      loginForm.classList.add('active'); registerForm.classList.remove('active');
      msg.textContent = '';
    });
    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active'); tabLogin.classList.remove('active');
      registerForm.classList.add('active'); loginForm.classList.remove('active');
      msg.textContent = '';
    });
  }

  // Registration
  const regUser = document.getElementById('regUser');
  const regPass = document.getElementById('regPass');
  const regPass2 = document.getElementById('regPass2');
  const register = document.getElementById('registerForm');

  if (register) {
    register.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.style.color = '#ffd6d6';
      const user = (regUser.value || '').trim();
      const pass = regPass.value || '';
      const pass2 = regPass2.value || '';
      if (!user || pass.length < 4) { msg.textContent = 'Username dan password (>=4) required.'; return; }
      if (pass !== pass2) { msg.textContent = 'Password tidak cocok.'; return; }

      const users = JSON.parse(localStorage.getItem('demo_users') || '{}');
      if (users[user]) { msg.textContent = 'Username sudah ada.'; return; }

      const hash = await hashPassword(pass);
      users[user] = { hash, created: Date.now() };
      localStorage.setItem('demo_users', JSON.stringify(users));
      msg.style.color = '#b8ffd6';
      msg.textContent = 'Daftar berhasil. Silakan masuk.';
      // auto-switch ke login
      tabLogin.click();
      regUser.value = regPass.value = regPass2.value = '';
    });
  }

  // Login
  const login = document.getElementById('loginForm');
  const loginUser = document.getElementById('loginUser');
  const loginPass = document.getElementById('loginPass');

  if (login) {
    login.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.style.color = '#ffd6d6';
      const user = (loginUser.value || '').trim();
      const pass = loginPass.value || '';
      if (!user || !pass) { msg.textContent = 'Masukkan username & password.'; return; }

      const users = JSON.parse(localStorage.getItem('demo_users') || '{}');
      if (!users[user]) { msg.textContent = 'Akun tidak ditemukan.'; return; }

      const hash = await hashPassword(pass);
      if (hash !== users[user].hash) { msg.textContent = 'Password salah.'; return; }

      // sukses: sebelum pindah, gunakan this user gesture to "unlock audio" (try)
      try {
        await tryUnlockAudio(); // best-effort — may set sessionStorage audio_unlocked
      } catch(_) {}

      sessionStorage.setItem('demo_logged_in', user);
      // langsung pindah ke halaman video
      location.href = 'scare.html';
    });
  }

  // --- Scare page logic (scare.html) ---
  const videoWrapper = document.getElementById('videoWrapper');
  const scareVideo = document.getElementById('scareVideo');
  const autoplayBlocked = document.getElementById('autoplayBlocked');
  const playWithSound = document.getElementById('playWithSound');
  const playMuted = document.getElementById('playMuted');
  const logoutBtn = document.getElementById('logoutBtn');

  // Only run scare logic on scare.html
  if (window.location.pathname.endsWith('scare.html')) {
    const logged = sessionStorage.getItem('demo_logged_in');
    if (!logged) {
      location.href = 'index.html';
      return;
    }

    function showAutoplayOverlay() { if (autoplayBlocked) autoplayBlocked.hidden = false; }
    function hideAutoplayOverlay() { if (autoplayBlocked) autoplayBlocked.hidden = true; }

    // If we earlier "unlocked" audio, try play with unmuted; otherwise start muted for best chance
    const unlocked = sessionStorage.getItem('audio_unlocked') === '1';

    if (scareVideo) {
      try {
        scareVideo.muted = !unlocked; // mute if not unlocked
      } catch (_) {}

      async function tryAutoplay() {
        try {
          const p = scareVideo.play();
          if (p !== undefined) await p;
          // playback started
          hideAutoplayOverlay();
        } catch (err) {
          // autoplay with current settings blocked -> show overlay
          showAutoplayOverlay();
        }
      }

      tryAutoplay();
    }

    // Buttons on overlay
    if (playWithSound) {
      playWithSound.addEventListener('click', async () => {
        try {
          // explicit user gesture: unmute and play
          scareVideo.muted = false;
          await scareVideo.play();
          try { if (videoWrapper.requestFullscreen) await videoWrapper.requestFullscreen(); } catch (_) {}
          hideAutoplayOverlay();
        } catch (e) {
          console.warn('playWithSound failed', e);
          showAutoplayOverlay();
        }
      });
    }

    if (playMuted) {
      playMuted.addEventListener('click', async () => {
        try {
          scareVideo.muted = true;
          await scareVideo.play();
          try { if (videoWrapper.requestFullscreen) await videoWrapper.requestFullscreen(); } catch (_) {}
          hideAutoplayOverlay();
        } catch (e) {
          console.warn('playMuted failed', e);
          showAutoplayOverlay();
        }
      });
    }

    // Logout/keluar
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { if (!scareVideo.paused) scareVideo.pause(); } catch(_) {}
        try { if (document.fullscreenElement) await document.exitFullscreen(); } catch(_) {}
        sessionStorage.removeItem('demo_logged_in');
        // keep audio_unlocked so future visits still try unmuted (optional)
        location.href = 'index.html';
      });
    }

    // Esc to exit
    document.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        try { if (document.fullscreenElement) await document.exitFullscreen(); } catch(_) {}
        sessionStorage.removeItem('demo_logged_in');
        location.href = 'index.html';
      }
    });

    // When video ends, return
    if (scareVideo) {
      scareVideo.addEventListener('ended', () => {
        sessionStorage.removeItem('demo_logged_in');
        location.href = 'index.html';
      });
    }
  }
});