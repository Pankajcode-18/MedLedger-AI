<template>
  <div id="app">
    <header id="main-header" :class="{ 'scrolled': isScrolled, 'menu-open': mobileMenuOpen }">
      <div class="nav-container">
        <!-- Brand Left -->
        <div class="brand-left">
          <router-link to="/" class="brand-link" @click.native="closeMobileMenu">
            <div class="logo-wrapper">
              <img src="./assets/logo.png" alt="MedLedger Logo" class="brand-logo" />
            </div>
            <div class="brand-info">
              <span class="brand-text">
                MedLedger <span class="brand-ai-chip">AI</span>
              </span>
              <span class="brand-tagline">Decentralized EHR</span>
            </div>
          </router-link>
        </div>

        <!-- Desktop Navigation Items -->
        <nav class="desktop-nav">
          <router-link to="/" exact class="nav-item">
            <span>Home</span>
          </router-link>

          <a href="/#portals" @click.prevent="goToSection('#portals')" class="nav-item">
            <span>Portals</span>
          </a>

          <a href="/#how-it-works" @click.prevent="goToSection('#how-it-works')" class="nav-item">
            <span>How It Works</span>
          </a>

          <a href="/#security" @click.prevent="goToSection('#security')" class="nav-item">
            <span>Security</span>
          </a>

          <a href="/#faq" @click.prevent="goToSection('#faq')" class="nav-item">
            <span>FAQ</span>
          </a>

          <a href="/#blockchain" @click.prevent="goToSection('#blockchain')" class="nav-item">
            <span>Blockchain</span>
          </a>

          <!-- Blockchain Ledger Status Chip -->
          <div class="network-badge" title="Cryptographically Anchored to Ethereum Sepolia">
            <span class="network-dot"></span>
            <span class="network-name">Sepolia Live</span>
          </div>

          <!-- Primary CTA Button (if not on Dashboard) -->
          <router-link to="/Login" v-if="!isDashboard" class="btn-nav-primary" id="btn-nav-launch">
            <span>Launch Portals</span>
          </router-link>

          <!-- Active Dashboard Role Indicator & Logout Button -->
          <div v-if="isDashboard" class="nav-auth-box">
            <div class="nav-role-badge">
              <span class="role-online-dot"></span>
              <span class="role-title">{{ activeRoleDisplay }}</span>
            </div>
            <button @click="logout" class="nav-logout-btn" title="Sign out of current session">
              <svg class="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </nav>

        <!-- Mobile Right Controls (Role Indicator + Hamburger Button) -->
        <div class="mobile-actions">
          <div v-if="isDashboard" class="mobile-mini-role" :title="activeRoleDisplay">
            <span class="role-online-dot"></span>
            <span class="mini-role-text">{{ shortRoleDisplay }}</span>
          </div>

          <!-- Hamburger Button -->
          <button
            class="hamburger-btn"
            :class="{ 'is-active': mobileMenuOpen }"
            @click="toggleMobileMenu"
            aria-label="Toggle navigation menu"
            :aria-expanded="mobileMenuOpen"
          >
            <span class="hamburger-bar bar-1"></span>
            <span class="hamburger-bar bar-2"></span>
            <span class="hamburger-bar bar-3"></span>
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown / Slide-down Menu -->
      <transition name="mobile-slide">
        <div v-if="mobileMenuOpen" class="mobile-drawer">
          <div class="mobile-drawer-content">
            <!-- Mobile Network Status -->
            <div class="mobile-network-status">
              <span class="network-dot"></span>
              <span>Ethereum Sepolia Network • Verified Smart Contract</span>
            </div>

            <div class="mobile-links-group">
              <router-link to="/" exact class="mobile-nav-link" @click.native="closeMobileMenu">
                <div class="link-icon-box">🏠</div>
                <div class="link-text-content">
                  <span class="link-title">Home</span>
                  <span class="link-desc">Platform overview &amp; verified records</span>
                </div>
              </router-link>

              <a href="/#portals" class="mobile-nav-link" @click.prevent="goToSection('#portals')">
                <div class="link-icon-box">🛏️</div>
                <div class="link-text-content">
                  <span class="link-title">Portals</span>
                  <span class="link-desc">Six dedicated healthcare workspaces</span>
                </div>
              </a>

              <a href="/#how-it-works" class="mobile-nav-link" @click.prevent="goToSection('#how-it-works')">
                <div class="link-icon-box">⚡</div>
                <div class="link-text-content">
                  <span class="link-title">How It Works</span>
                  <span class="link-desc">4-step patient permission &amp; encryption flow</span>
                </div>
              </a>

              <a href="/#security" class="mobile-nav-link" @click.prevent="goToSection('#security')">
                <div class="link-icon-box">🔐</div>
                <div class="link-text-content">
                  <span class="link-title">Security</span>
                  <span class="link-desc">AES-256-GCM, SHA-256 &amp; smart contracts</span>
                </div>
              </a>

              <a href="/#faq" class="mobile-nav-link" @click.prevent="goToSection('#faq')">
                <div class="link-icon-box">❓</div>
                <div class="link-text-content">
                  <span class="link-title">FAQ</span>
                  <span class="link-desc">Clear answers to healthcare questions</span>
                </div>
              </a>

              <a href="/#blockchain" class="mobile-nav-link" @click.prevent="goToSection('#blockchain')">
                <div class="link-icon-box">⛓️</div>
                <div class="link-text-content">
                  <span class="link-title">Blockchain</span>
                  <span class="link-desc">Ethereum Sepolia live verification</span>
                </div>
              </a>

              <router-link to="/Login" v-if="!isDashboard" class="mobile-cta-link" @click.native="closeMobileMenu">
                <span>🚀 Launch Portals (Sign In)</span>
              </router-link>
            </div>

            <!-- Mobile Active Session Card (if on Dashboard) -->
            <div v-if="isDashboard" class="mobile-session-card">
              <div class="session-card-header">
                <div class="session-avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div class="session-meta">
                  <span class="session-status-badge">
                    <span class="role-online-dot"></span> Authenticated Session
                  </span>
                  <span class="session-role-text">{{ activeRoleDisplay }}</span>
                </div>
              </div>
              <button @click="logoutAndClose" class="mobile-logout-btn">
                <svg class="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out / End Session
              </button>
            </div>
          </div>
        </div>
      </transition>
    </header>

    <!-- Backdrop when mobile drawer is open -->
    <div v-if="mobileMenuOpen" class="mobile-backdrop" @click="closeMobileMenu"></div>

    <main class="app-main-content">
      <router-view />
    </main>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'App',
  data() {
    return {
      mobileMenuOpen: false,
      isScrolled: false
    };
  },
  computed: {
    isDashboard() {
      const dashboardRoutes = [
        '/InsuranceDashboard',
        '/HospitalDashboard',
        '/LabDashboard',
        '/AdminDashboard',
        '/DoctorDashboard',
        '/PatientDashboard',
        '/LoginPatient',
        '/HospitalAdminDashboard'
      ];
      return dashboardRoutes.includes(this.$route.path);
    },
    activeRoleDisplay() {
      const path = this.$route.path;
      if (path.includes('InsuranceDashboard')) return 'Role: Insurance Company';
      if (path.includes('HospitalDashboard')) return 'Role: Hospital';
      if (path.includes('LabDashboard')) return 'Role: Diagnostic Lab';
      if (path.includes('AdminDashboard')) return 'Role: System Admin';
      if (path.includes('DoctorDashboard') || path.includes('LoginDoctor')) return 'Role: Doctor';
      if (path.includes('PatientDashboard') || path.includes('LoginPatient')) return 'Role: Patient';
      if (path.includes('HospitalAdminDashboard')) return 'Role: Hospital / Admin';
      return 'Session Active';
    },
    shortRoleDisplay() {
      const path = this.$route.path;
      if (path.includes('Insurance')) return 'Insurance';
      if (path.includes('Hospital')) return 'Hospital';
      if (path.includes('Lab')) return 'Lab';
      if (path.includes('Admin')) return 'Admin';
      if (path.includes('Doctor')) return 'Doctor';
      if (path.includes('Patient')) return 'Patient';
      return 'Active';
    }
  },
  watch: {
    $route() {
      // Close mobile menu on route change
      this.closeMobileMenu();
    }
  },
  mounted() {
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    window.addEventListener('resize', this.handleResize, { passive: true });
  },
  beforeDestroy() {
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);
  },
  methods: {
    handleScroll() {
      this.isScrolled = window.scrollY > 10;
    },
    handleResize() {
      if (window.innerWidth > 860 && this.mobileMenuOpen) {
        this.closeMobileMenu();
      }
    },
    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
      if (this.mobileMenuOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    },
    closeMobileMenu() {
      this.mobileMenuOpen = false;
      document.body.style.overflow = '';
    },
    goToSection(sectionId) {
      this.closeMobileMenu();
      if (this.$route.path !== '/') {
        this.$router.push('/' + sectionId).catch(() => {});
      } else {
        const target = document.querySelector(sectionId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    },
    logoutAndClose() {
      this.closeMobileMenu();
      this.logout();
    },
    logout() {
      // 1. Clear session storage
      sessionStorage.removeItem('jwtToken');
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentRole');
      sessionStorage.removeItem('currentPatientId');
      sessionStorage.clear();

      // 2. Clear local storage
      localStorage.removeItem('jwtToken');

      // 3. Clear default axios authorization header
      delete axios.defaults.headers.common['Authorization'];

      // 4. Redirect to Login
      if (this.$route.path !== '/Login') {
        this.$router.push('/Login');
      }
    }
  }
};
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  background-color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 0;
  color: #0f172a;
  -webkit-font-smoothing: antialiased;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main-content {
  flex: 1;
}

/* =======================================================
   STICKY GLASSMORPHIC HEADER
   ======================================================= */
#main-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-bottom: 1px solid rgba(226, 232, 240, 0.85);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

#main-header.scrolled {
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.08);
  border-bottom-color: rgba(203, 213, 225, 0.8);
}

.nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1440px;
  margin: 0 auto;
  height: 68px;
  padding: 0 28px;
}

/* =======================================================
   BRAND STYLING
   ======================================================= */
.brand-left {
  display: flex;
  align-items: center;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  transition: transform 0.2s ease;
}

.brand-link:hover .logo-wrapper {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
}

.logo-wrapper {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.12);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.brand-logo {
  height: 28px;
  width: 28px;
  object-fit: contain;
}

.brand-info {
  display: flex;
  flex-direction: column;
}

.brand-text {
  font-size: 1.35rem;
  font-weight: 850;
  color: #0f172a;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  line-height: 1.15;
}

.brand-ai-chip {
  background: linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%);
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 6px;
  margin-left: 6px;
  letter-spacing: 0.05em;
  box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);
  display: inline-block;
  line-height: 1.3;
}

.brand-tagline {
  font-size: 0.68rem;
  color: #64748b;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-top: 1px;
}

/* =======================================================
   DESKTOP NAVIGATION
   ======================================================= */
.desktop-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 9999px;
  font-size: 0.92rem;
  font-weight: 600;
  color: #475569;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.nav-icon {
  width: 16px;
  height: 16px;
  color: #64748b;
  transition: color 0.2s ease;
}

.nav-item:hover {
  color: #0284c7;
  background: rgba(2, 132, 199, 0.08);
  transform: translateY(-1px);
}

.nav-item:hover .nav-icon {
  color: #0284c7;
}

.nav-item.router-link-exact-active,
.nav-item.router-link-active:not([href="/"]) {
  color: #0284c7;
  background: #e0f2fe;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(2, 132, 199, 0.25);
}

.nav-item.router-link-exact-active .nav-icon,
.nav-item.router-link-active:not([href="/"]) .nav-icon {
  color: #0284c7;
}

/* Blockchain Network Badge */
.network-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 9999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 0.78rem;
  font-weight: 600;
  color: #334155;
  margin-left: 6px;
}

.network-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
  animation: pulseDot 2s infinite;
}

@keyframes pulseDot {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

/* Primary CTA in Navbar */
.btn-nav-primary {
  background: #2563eb;
  color: #ffffff;
  padding: 8px 18px;
  font-size: 0.88rem;
  font-weight: 700;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 3px 10px rgba(37, 99, 235, 0.25);
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
}

.btn-nav-primary:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 5px 16px rgba(37, 99, 235, 0.35);
  color: #ffffff;
}

.mobile-cta-link {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2563eb;
  color: #ffffff;
  padding: 12px 18px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.95rem;
  text-decoration: none;
  margin-top: 14px;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
  transition: all 0.2s ease;
}

.mobile-cta-link:hover {
  background: #1d4ed8;
  color: #ffffff;
}

/* Nav Auth Box & Logout */
.nav-auth-box {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  padding: 4px 6px 4px 12px;
  border-radius: 9999px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-left: 10px;
}

.nav-role-badge {
  font-size: 0.82rem;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 6px;
}

.role-online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulseDot 2s infinite;
  flex-shrink: 0;
}

.nav-logout-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-logout-btn:hover {
  background: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
  transform: translateY(-1px);
  box-shadow: 0 2px 10px rgba(239, 68, 68, 0.35);
}

.logout-icon {
  width: 14px;
  height: 14px;
}

/* =======================================================
   MOBILE ACTIONS & HAMBURGER BUTTON
   ======================================================= */
.mobile-actions {
  display: none;
  align-items: center;
  gap: 10px;
}

.mobile-mini-role {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 0.76rem;
  font-weight: 700;
  color: #15803d;
}

.hamburger-btn {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s ease;
}

.hamburger-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.hamburger-bar {
  width: 20px;
  height: 2px;
  background: #334155;
  border-radius: 2px;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Hamburger to X Transformation */
.hamburger-btn.is-active {
  background: #e0f2fe;
  border-color: #bae6fd;
}

.hamburger-btn.is-active .bar-1 {
  transform: translateY(7px) rotate(45deg);
  background: #0284c7;
}

.hamburger-btn.is-active .bar-2 {
  opacity: 0;
  transform: scaleX(0);
}

.hamburger-btn.is-active .bar-3 {
  transform: translateY(-7px) rotate(-45deg);
  background: #0284c7;
}

/* =======================================================
   MOBILE DRAWER & DROPDOWN MENU
   ======================================================= */
.mobile-drawer {
  position: absolute;
  top: 68px;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
  padding: 16px 20px 24px 20px;
  z-index: 999;
}

.mobile-network-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #047857;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 8px 14px;
  border-radius: 10px;
  margin-bottom: 16px;
}

.mobile-links-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  text-decoration: none;
  color: #1e293b;
  background: #f8fafc;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.mobile-nav-link:hover {
  background: #f1f5f9;
  border-color: #e2e8f0;
  transform: translateX(2px);
}

.mobile-nav-link.router-link-exact-active,
.mobile-nav-link.router-link-active:not([href="/"]) {
  background: #e0f2fe;
  border-color: #bae6fd;
  color: #0284c7;
}

.mobile-nav-link.router-link-exact-active .link-icon-box,
.mobile-nav-link.router-link-active:not([href="/"]) .link-icon-box {
  background: #0284c7;
  color: #ffffff;
}

.link-icon-box {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.link-icon-box svg {
  width: 18px;
  height: 18px;
}

.link-text-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.link-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
}

.link-desc {
  font-size: 0.76rem;
  color: #64748b;
  font-weight: 500;
  margin-top: 1px;
}

.chevron-icon {
  width: 16px;
  height: 16px;
  color: #94a3b8;
}

/* Mobile Session Card */
.mobile-session-card {
  margin-top: 16px;
  padding: 16px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.session-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.session-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #e0f2fe;
  color: #0284c7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.session-avatar svg {
  width: 20px;
  height: 20px;
}

.session-meta {
  display: flex;
  flex-direction: column;
}

.session-status-badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: #15803d;
  display: flex;
  align-items: center;
  gap: 5px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.session-role-text {
  font-size: 0.92rem;
  font-weight: 800;
  color: #0f172a;
  margin-top: 1px;
}

.mobile-logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 16px;
  border-radius: 10px;
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mobile-logout-btn:hover {
  background: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
}

/* Backdrop */
.mobile-backdrop {
  position: fixed;
  top: 68px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 990;
  animation: fadeInBackdrop 0.2s ease;
}

@keyframes fadeInBackdrop {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Drawer Transition Animations */
.mobile-slide-enter-active,
.mobile-slide-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.mobile-slide-enter,
.mobile-slide-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* =======================================================
   RESPONSIVE BREAKPOINTS
   ======================================================= */
@media (max-width: 960px) {
  .brand-tagline {
    display: none;
  }
}

@media (max-width: 860px) {
  .nav-container {
    padding: 0 18px;
    height: 64px;
  }

  .logo-wrapper {
    width: 38px;
    height: 38px;
  }

  .brand-logo {
    height: 24px;
    width: 24px;
  }

  .brand-text {
    font-size: 1.2rem;
  }

  .desktop-nav {
    display: none;
  }

  .mobile-actions {
    display: flex;
  }

  .mobile-drawer {
    top: 64px;
  }

  .mobile-backdrop {
    top: 64px;
  }
}

@media (max-width: 480px) {
  .nav-container {
    padding: 0 14px;
  }

  .brand-text {
    font-size: 1.1rem;
  }

  .brand-ai-chip {
    font-size: 0.62rem;
    padding: 1px 5px;
  }

  .mobile-mini-role {
    font-size: 0.72rem;
    padding: 3px 8px;
  }
}
</style>
