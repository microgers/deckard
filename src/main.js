import './styles.css';
import { $, $$, markScrollers } from './ui.js';
import { state, loadLocal, saveLocal, connectCloud, disconnectCloud, activeCompany, ensureCompany } from './store.js';
import { isConfigured, signInWithGoogle, signOutUser, watchAuth } from './firebase.js';
import { initModal, openModal, closeModal } from './modal.js';
import { DDSAMPLE, ALL_CRIT } from './data/criteria.js';
import { SAMPLE } from './data/questions.js';
import { initAssess, renderQ, scoreA } from './views/assess.js';
import { initDiamond, renderDD, scoreD } from './views/diamond.js';
import { initModel, renderInputs, runModel, syncPfromProject, syncEtype, resetModel, setEtype } from './views/model.js';
import { initHome, renderHome } from './views/home.js';
import { initRail, renderProjects } from './views/rail.js';
import { initReport, renderReport } from './views/report.js';
import { renderLearn, resetLearnView } from './views/learn.js';
import { touchCompany } from './store.js';

const PANELS = ['home', 'report', 'assess', 'dd', 'irr', 'learn', 'notes'];

function go(id) {
  if (!PANELS.includes(id)) id = 'home';
  PANELS.forEach((p) => $('#p-' + p).classList.toggle('on', p === id));
  $$('#mainnav button').forEach((b) => b.setAttribute('aria-current', b.dataset.go === id ? 'true' : 'false'));
  state.prefs.panel = id; saveLocal();
  if (id === 'learn') { resetLearnView(); renderLearn(); }
  if (id === 'report') renderReport();
  // A hidden panel measures zero, so the views' own calls cannot tell whether their
  // tables overflow until the panel is on screen. Re-ask once it is.
  markScrollers();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function refreshDependents() { renderProjects(); renderHome(); if (state.prefs.panel === 'report') renderReport(); }

function renderAll() {
  syncPfromProject();
  const p = activeCompany();
  $('#ddwho').textContent = p ? p.name : 'no company selected';
  $('#irrwho').textContent = p ? p.name : 'no company selected';
  renderQ(); scoreA();
  renderDD(); scoreD();
  syncEtype(); renderInputs(); runModel();
  renderProjects(); renderHome();
  if (state.prefs.panel === 'learn') renderLearn();
  if (state.prefs.panel === 'report') renderReport();
}

function applyTheme(t) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  state.prefs.theme = t; saveLocal();
  const b = $('#themebtn'); if (b) b.title = 'Theme: ' + t;
}

function renderAccount() {
  const a = $('#acct'), av = $('#acctav'), lb = $('#acctlbl');
  const signedIn = !!state.user;
  a.classList.toggle('synced', signedIn && state.sync === 'cloud');
  a.classList.toggle('avonly', signedIn);
  a.classList.toggle('out', !signedIn);
  if (signedIn) {
    const who = (state.user.name || state.user.email || 'Account').trim();
    const initial = who[0].toUpperCase();
    av.innerHTML = state.user.photo
      ? '<img src="' + state.user.photo + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' + initial
      : initial;
    lb.textContent = '';
    a.setAttribute('aria-label', who + ' — account');
    a.title = who;
  } else {
    av.textContent = '';
    lb.textContent = isConfigured ? 'Sign in' : 'This device';
    a.setAttribute('aria-label', isConfigured ? 'Sign in with Google' : 'Storage');
    a.title = '';
  }
  const box = $('#syncinfo');
  if (box) {
    box.innerHTML = signedIn && state.sync === 'cloud'
      ? '<div class="note ok"><b>Synced to your Google account.</b> Your saved companies, their scores and models, your assessment and your learning progress are stored against ' + (state.user.email || 'your account') + '. Open this site on any device, sign in with the same account, and it is all there. Nobody else can read it — the security rules scope every document to your user id.</div>'
      : isConfigured
        ? '<div class="note"><b>Saved on this device only.</b> Sign in with Google to sync across your devices. Until then everything lives in this browser: it survives closing the tab, but it will not follow you, and clearing site data erases it.</div>'
        : '<div class="note"><b>Saved on this device only.</b> This build has no Firebase configuration, so sign-in is switched off and everything is stored in this browser. See the README to connect a project and turn on Google sign-in.</div>';
  }
}

async function handleAccountClick() {
  if (!isConfigured) {
    openModal('Sign-in is not configured',
      '<p style="color:var(--tx2)">This build has no Firebase project attached, so Google sign-in is switched off and your work is saved in this browser only.</p>' +
      '<p style="color:var(--tx2);margin-top:12px">To turn it on: create a Firebase project, enable the Google provider under Authentication, copy the web config into a <code>.env</code> file, and redeploy. The README walks through it in about ten minutes.</p>');
    return;
  }
  if (state.user) {
    openModal('Signed in',
      '<p style="color:var(--tx2)">' + (state.user.email || '') + '</p>' +
      '<p style="color:var(--tx2);margin-top:12px">Your work syncs to this account. Signing out leaves the local copy on this device untouched.</p>',
      '<button class="btn ghost sm" data-close>Close</button><button class="btn danger sm" id="signout">Sign out</button>');
    $('#signout').onclick = async () => { await signOutUser(); closeModal(); };
  } else {
    try { await signInWithGoogle(); }
    catch (e) {
      if (e && e.code === 'auth/popup-closed-by-user') return;
      openModal('Could not sign in',
        '<p style="color:var(--tx2)">' + (e && e.code ? e.code : 'Unknown error') + '</p>' +
        '<p class="tiny" style="margin-top:10px">If this says <code>auth/unauthorized-domain</code>, add this site\'s hostname under Authentication → Settings → Authorized domains in the Firebase console.</p>');
    }
  }
}

function boot() {
  initModal();
  loadLocal(DDSAMPLE);
  applyTheme(state.prefs.theme || 'system');

  initHome({ nav: go });
  initReport({ nav: go });
  initRail({ onChange: renderAll, onOpen: () => go('report') });
  // Views refresh their DEPENDENTS (the rail and the home summary), never the
  // whole tree — re-entering renderAll from inside a view's own render recurses.
  initAssess({ onChange: refreshDependents, queueProfile: () => saveLocal() });
  initDiamond({ onChange: refreshDependents });
  initModel({ onChange: refreshDependents });

  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  $('#themebtn').addEventListener('click', () => {
    const o = ['system', 'light', 'dark'];
    applyTheme(o[(o.indexOf(state.prefs.theme || 'system') + 1) % 3]);
  });
  $('#acct').addEventListener('click', handleAccountClick);

  $('#afill').addEventListener('click', () => { SAMPLE.forEach((v, i) => (state.assessment[i] = v)); saveLocal(); renderAll(); });
  $('#aclear').addEventListener('click', () => { state.assessment = {}; saveLocal(); renderAll(); });
  $('#dfill').addEventListener('click', () => { const p = ensureCompany(); p.d = { ...DDSAMPLE }; touchCompany(); renderAll(); });
  $('#dclear').addEventListener('click', () => { const p = ensureCompany(); p.d = {}; touchCompany(); renderAll(); });
  $('#ireset').addEventListener('click', () => { resetModel(); renderAll(); });
  $$('#etype button').forEach((b) => b.addEventListener('click', () => { setEtype(b.dataset.t); renderAll(); }));
  $('#resetall').addEventListener('click', () => {
    openModal('Clear everything',
      '<p style="color:var(--tx2)">This removes every saved company, your assessment and your learning progress from this browser' +
      (state.sync === 'cloud' ? ' and from your account' : '') + '. It cannot be undone.</p>',
      '<button class="btn ghost sm" data-close>Cancel</button><button class="btn danger sm" id="wipeyes">Clear everything</button>');
    $('#wipeyes').onclick = () => {
      Object.keys(state.companies).forEach((id) => delete state.companies[id]);
      state.assessment = {}; state.srs = {}; state.reviewLog = []; state.active = null;
      ensureCompany(DDSAMPLE); saveLocal(); renderAll(); closeModal(); go('home');
    };
  });

  renderAll();
  renderAccount();
  go(state.prefs.panel || 'home');

  // Auth is optional and always late. The app is fully usable before it answers.
  watchAuth(async (user) => {
    if (user) {
      state.user = { uid: user.uid, name: user.displayName, email: user.email, photo: user.photoURL };
      renderAccount();
      await connectCloud(user);
    } else {
      disconnectCloud();
    }
    renderAccount(); renderAll();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
