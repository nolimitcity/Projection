const el = {
  googleSignOut: document.querySelector('#googleSignOut'),
  settingsToggle: document.querySelector('#settingsToggle'),
  settingsPanel: document.querySelector('#settingsPanel'),
  closeSettingsPanel: document.querySelector('#closeSettingsPanel'),
  themeToggle: document.querySelector('#themeToggle'),
  authStatus: document.querySelector('#authStatus'),
  userId: document.querySelector('#userId'),
  userRole: document.querySelector('#userRole'),
  refreshAll: document.querySelector('#refreshAll'),
  showHeatmapView: document.querySelector('#showHeatmapView'),
  showRoadmapView: document.querySelector('#showRoadmapView'),
  showProjectsView: document.querySelector('#showProjectsView'),
  showPersonnelView: document.querySelector('#showPersonnelView'),
  showPlanningView: document.querySelector('#showPlanningView'),
  adminSubtabs: document.querySelector('#adminSubtabs'),
  requestDestroyerAccess: document.querySelector('#requestDestroyerAccess'),
  heatmapView: document.querySelector('#heatmapView'),
  roadmapView: document.querySelector('#roadmapView'),
  projectsView: document.querySelector('#projectsView'),
  personnelView: document.querySelector('#personnelView'),
  planningView: document.querySelector('#planningView'),
  roadmapProjectsList: document.querySelector('#roadmapProjectsList'),
  loadProjectsOverview: document.querySelector('#loadProjectsOverview'),
  addTemplateRow: document.querySelector('#addTemplateRow'),
  addProjectRow: document.querySelector('#addProjectRow'),
  loadTemplates: document.querySelector('#loadTemplates'),
  templatesList: document.querySelector('#templatesList'),
  overviewProjectsList: document.querySelector('#overviewProjectsList'),
  newPersonArea: document.querySelector('#newPersonArea'),
  addPersonRow: document.querySelector('#addPersonRow'),
  loadUtilization: document.querySelector('#loadUtilization'),
  projectHeatmapDensityPresets: document.querySelector('#projectHeatmapDensityPresets'),
  personnelHeatmapDensityPresets: document.querySelector('#personnelHeatmapDensityPresets'),
  projectOverviewStatusFilter: document.querySelector('#projectOverviewStatusFilter'),
  projectsOverviewStatusFilter: document.querySelector('#projectsOverviewStatusFilter'),
  roadmapOverviewStatusFilter: document.querySelector('#roadmapOverviewStatusFilter'),
  personnelOverviewStatusFilter: document.querySelector('#personnelOverviewStatusFilter'),
  heatmapPersonnelFilter: document.querySelector('#heatmapPersonnelFilter'),
  roadmapPersonnelFilter: document.querySelector('#roadmapPersonnelFilter'),
  utilizationSummary: document.querySelector('#utilizationSummary'),
  utilizationTimeline: document.querySelector('#utilizationTimeline'),
  projectTimelineSummary: document.querySelector('#projectTimelineSummary'),
  projectUtilizationTimeline: document.querySelector('#projectUtilizationTimeline'),
  loadClosures: document.querySelector('#loadClosures'),
  closuresList: document.querySelector('#closuresList'),
  createClosureForm: document.querySelector('#createClosureForm'),
  loadMappings: document.querySelector('#loadMappings'),
  mappingsList: document.querySelector('#mappingsList'),
  mappingForm: document.querySelector('#mappingForm'),
  mappingTargetTable: document.querySelector('#mappingTargetTable'),
  cancelMappingEdit: document.querySelector('#cancelMappingEdit'),
  rolesList: document.querySelector('#rolesList'),
  addRoleRow: document.querySelector('#addRoleRow'),
  officesList: document.querySelector('#officesList'),
  addOfficeRow: document.querySelector('#addOfficeRow'),
  loadUsers: document.querySelector('#loadUsers'),
  loadAuditLog: document.querySelector('#loadAuditLog'),
  usersList: document.querySelector('#usersList'),
  auditLogList: document.querySelector('#auditLogList'),
  responseLog: document.querySelector('#responseLog'),
  confirmDialog: document.querySelector('#confirmDialog'),
  confirmDialogMessage: document.querySelector('#confirmDialogMessage'),
  confirmChangeConfirm: document.querySelector('#confirmChangeConfirm'),
  confirmChangeCancel: document.querySelector('#confirmChangeCancel'),
  conflictDialog: document.querySelector('#conflictDialog'),
  conflictDialogMessage: document.querySelector('#conflictDialogMessage'),
  conflictAttemptedPayload: document.querySelector('#conflictAttemptedPayload'),
  conflictLatestPayload: document.querySelector('#conflictLatestPayload'),
  conflictDialogClose: document.querySelector('#conflictDialogClose')
};

const state = {
  templates: [],
  projects: [],
  people: [],
  roles: [],
  offices: [],
  assignments: [],
  mappings: [],
  mappingTables: [],
  googleConfig: null,
  csrfToken: null,
  utilization: null,
  utilizationTimeline: null,
  projectUtilizationTimeline: null,
  globalClosures: [],
  editingClosureId: null,
  activeView: 'heatmap',
  activeAdminSubView: 'templates',
  editingTemplateId: null,
  creatingTemplateRow: false,
  editingProjectId: null,
  creatingProjectRow: false,
  expandedPersonIds: [],
  expandedProjectIds: [],
  editingMappingId: null,
  projectAssignmentEditor: null,
  projectAssignmentDateSelection: null,
  roadmapRoleEditor: null,
  projectHeatmapDensity: 'medium',
  personnelHeatmapDensity: 'medium',
  projectOverviewFilter: 'active',
  personnelProjectFilter: '',
  overviewAnalyticsDirty: false,
  currentUser: null,
  users: [],
  auditEvents: [],
  liveEditing: []
};

let overviewAnalyticsPromise = null;

const LIVE_EDIT_HEARTBEAT_MS = 5000;
const LIVE_EDIT_FALLBACK_POLL_MS = 8000;
const LIVE_EDIT_WS_RETRY_MS = 2500;
const localEditingKeys = new Set();
let liveEditFallbackPollTimer = null;
let liveEditHeartbeatTimer = null;
let liveEditSocket = null;
let liveEditSocketRetryTimer = null;

const THEME_MODE_KEY = 'projection_theme_mode';
const HEATMAP_DENSITY_KEY = 'projection_project_heatmap_density';
const PERSONNEL_DENSITY_KEY = 'projection_personnel_heatmap_density';
const PROJECT_LIST_COLUMNS_KEY = 'projection_projects_list_columns';
const ROADMAP_LIST_COLUMNS_KEY = 'projection_roadmap_list_columns';
const PROJECT_TIMELINE_LEAD_WIDTH_KEY = 'projection_project_timeline_lead_width';
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

const THEME_TOGGLE_ICON = '<svg class="theme-toggle-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="theme-sun" cx="12" cy="12" r="4"></circle><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke-width="1.7" stroke-linecap="round"/></svg>';
const RESIZE_HANDLE_ICON = '<span class="col-resize-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><line x1="9" y1="5" x2="9" y2="19" stroke-width="1.8" stroke-linecap="round"></line><line x1="15" y1="5" x2="15" y2="19" stroke-width="1.8" stroke-linecap="round"></line><path d="M5 12h4" stroke-width="1.8" stroke-linecap="round"></path><path d="M15 12h4" stroke-width="1.8" stroke-linecap="round"></path></svg></span>';

const HEATMAP_DENSITY_WIDTH = {
  large: 72,
  medium: 52,
  compact: 36
};

const APP_VIEWS = new Set(['heatmap', 'roadmap', 'projects', 'personnel', 'planning', 'mappings', 'users']);
const ADMIN_SUB_VIEWS = new Set([
  'templates',
  'closures',
  'roles',
  'offices',
  'response-log',
  'mapping-list',
  'mapping-editor',
  'users',
  'audit'
]);

const ROLE_TINT_PRESETS = {
  PROD: { bg: '#7a2d0c', border: '#f18a2a', text: '#fff5eb' },
  FE: { bg: '#0e5b38', border: '#2bd17f', text: '#edfff5' },
  GFX: { bg: '#7a144f', border: '#ff5eb7', text: '#ffeef8' },
  ANIM: { bg: '#6e4a00', border: '#f4b729', text: '#fff8e8' },
  SND: { bg: '#0f4f86', border: '#3ca5ff', text: '#eef7ff' },
  SRV: { bg: '#2e1c7a', border: '#8b78ff', text: '#f3f0ff' },
  QA: { bg: '#5c1c7e', border: '#cd6bff', text: '#f9efff' },
  AQA: { bg: '#0f615b', border: '#33d2c4', text: '#ecfffd' },
  CERT: { bg: '#7a4705', border: '#ffab3f', text: '#fff4e7' }
};

const ROLE_TINT_FALLBACKS = [
  { bg: '#6f1324', border: '#ef5c7a', text: '#ffeef1' },
  { bg: '#125f46', border: '#39d393', text: '#ecfff6' },
  { bg: '#173f7b', border: '#58a0ff', text: '#edf4ff' },
  { bg: '#6f4a06', border: '#f0af34', text: '#fff6e8' },
  { bg: '#3f2478', border: '#9d84ff', text: '#f2edff' },
  { bg: '#115c62', border: '#42cad4', text: '#ebfeff' },
  { bg: '#6d1e62', border: '#d56bc7', text: '#ffeeff' },
  { bg: '#3f3f3f', border: '#9d9d9d', text: '#f5f5f5' }
];

const hashRoleCode = (roleCode) => {
  const source = String(roleCode || 'UNKNOWN').toUpperCase();
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const roleTintTokens = (roleCode) => {
  const normalized = String(roleCode || '').trim().toUpperCase();
  if (!normalized) {
    return { bg: '#3f3f3f', border: '#9d9d9d', text: '#f5f5f5' };
  }

  if (ROLE_TINT_PRESETS[normalized]) {
    return ROLE_TINT_PRESETS[normalized];
  }

  return ROLE_TINT_FALLBACKS[hashRoleCode(normalized) % ROLE_TINT_FALLBACKS.length];
};

const roleTintStyleAttr = (roleCode) => {
  const tint = roleTintTokens(roleCode);
  return `style="--role-tint-bg:${tint.bg};--role-tint-border:${tint.border};--role-tint-text:${tint.text};"`;
};

const roleTintInlineStyle = (roleCode) => {
  const tint = roleTintTokens(roleCode);
  return `background-color:${tint.bg};border-color:${tint.border};color:${tint.text};`;
};

const beginRefreshOverlay = (hostElement) => {
  if (!(hostElement instanceof HTMLElement)) {
    return () => undefined;
  }

  const currentCount = Number(hostElement.dataset.refreshCount || '0');
  const nextCount = currentCount + 1;
  hostElement.dataset.refreshCount = String(nextCount);
  hostElement.classList.add('refresh-host', 'is-refreshing');

  if (!hostElement.querySelector('.refresh-overlay')) {
    const overlay = document.createElement('div');
    overlay.className = 'refresh-overlay';
    overlay.innerHTML = '<span class="refresh-spinner" aria-hidden="true"></span><span class="refresh-label">Refreshing...</span>';
    hostElement.appendChild(overlay);
  }

  return () => {
    const count = Math.max(0, Number(hostElement.dataset.refreshCount || '1') - 1);
    hostElement.dataset.refreshCount = String(count);
    if (count === 0) {
      hostElement.classList.remove('is-refreshing');
      const overlay = hostElement.querySelector('.refresh-overlay');
      overlay?.remove();
    }
  };
};

const viewNeedsOverviewAnalytics = () => state.activeView === 'heatmap' || state.activeView === 'personnel';

const parseStoredColumnWidths = (storageKey) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

state.projectsColumnWidths = parseStoredColumnWidths(PROJECT_LIST_COLUMNS_KEY);
state.roadmapColumnWidths = parseStoredColumnWidths(ROADMAP_LIST_COLUMNS_KEY);

const clampColumnWidth = (value, min = 10, max = 760) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
};

state.projectTimelineLeadWidth = clampColumnWidth(Number(localStorage.getItem(PROJECT_TIMELINE_LEAD_WIDTH_KEY) || '192'), 120, 420);

const resolveColumnWidth = (widthMap, key, fallback, minWidth = 10) =>
  clampColumnWidth(widthMap?.[key] ?? fallback, minWidth);

const storeColumnWidths = (storageKey, widths) => {
  localStorage.setItem(storageKey, JSON.stringify(widths));
};

const buildResizableListHeader = (listType, columns, widthMap, extraClass = '') => {
  const template = columns
    .map((column) => `${resolveColumnWidth(widthMap, column.key, column.defaultWidth, column.minWidth)}px`)
    .join(' ');

  const cells = columns
    .map((column) => `
      <span class="resizable-head-cell ${column.headClass || ''}" data-col-key="${column.key}">
        <span class="resizable-head-label">${escapeHtml(column.label)}</span>
        <button
          type="button"
          class="col-resize-handle"
          data-list-type="${listType}"
          data-col-key="${column.key}"
          aria-label="Resize ${escapeHtml(column.label)} column"
          title="Drag to resize column"
        >${RESIZE_HANDLE_ICON}</button>
      </span>
    `)
    .join('');

  return {
    template,
    html: `<div class="list-header ${extraClass}" style="grid-template-columns: ${template};">${cells}</div>`
  };
};

const startColumnResize = (listType, columnKey, startX, startWidth) => {
  const widthMap = listType === 'projects' ? state.projectsColumnWidths : state.roadmapColumnWidths;
  const storageKey = listType === 'projects' ? PROJECT_LIST_COLUMNS_KEY : ROADMAP_LIST_COLUMNS_KEY;

  const onPointerMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    widthMap[columnKey] = clampColumnWidth(startWidth + delta);
    storeColumnWidths(storageKey, widthMap);
    if (listType === 'projects') {
      renderProjects();
    } else {
      renderRoadmapProjects();
    }
  };

  const onPointerUp = () => {
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
};

const startProjectTimelineLeadResize = (startX, startWidth) => {
  const onPointerMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    state.projectTimelineLeadWidth = clampColumnWidth(startWidth + delta, 120, 420);
    localStorage.setItem(PROJECT_TIMELINE_LEAD_WIDTH_KEY, String(state.projectTimelineLeadWidth));
    renderProjectUtilizationTimeline({ preservePosition: true });
  };

  const onPointerUp = () => {
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
};

const normalizeThemeMode = (value) => (value === 'light' || value === 'dark' || value === 'system' ? value : 'system');
const resolvedTheme = (mode) => (mode === 'system' ? (darkModeQuery.matches ? 'dark' : 'light') : mode);

const refreshThemeToggle = () => {
  if (!el.themeToggle) {
    return;
  }

  const mode = normalizeThemeMode(localStorage.getItem(THEME_MODE_KEY));
  const activeTheme = document.documentElement.dataset.theme || resolvedTheme(mode);
  el.themeToggle.dataset.theme = activeTheme;
  el.themeToggle.innerHTML = THEME_TOGGLE_ICON;
  el.themeToggle.setAttribute('aria-label', activeTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  el.themeToggle.title = activeTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
};

const applyThemeMode = (mode) => {
  const nextMode = normalizeThemeMode(mode);
  document.documentElement.dataset.themeMode = nextMode;
  document.documentElement.dataset.theme = resolvedTheme(nextMode);
  localStorage.setItem(THEME_MODE_KEY, nextMode);
  refreshThemeToggle();
};

const initializeThemeMode = () => {
  applyThemeMode(localStorage.getItem(THEME_MODE_KEY));

  const handleSystemThemeChange = () => {
    if (normalizeThemeMode(localStorage.getItem(THEME_MODE_KEY)) === 'system') {
      applyThemeMode('system');
    }
  };

  if (typeof darkModeQuery.addEventListener === 'function') {
    darkModeQuery.addEventListener('change', handleSystemThemeChange);
  } else if (typeof darkModeQuery.addListener === 'function') {
    darkModeQuery.addListener(handleSystemThemeChange);
  }
};

const redirectToLogin = (reason = '') => {
  stopLiveEditingLoop();
  const url = reason ? `/login.html?reason=${encodeURIComponent(reason)}` : '/login.html';
  window.location.href = url;
};

const apiHeaders = () => ({
  'Content-Type': 'application/json',
  ...(state.csrfToken ? { 'x-csrf-token': state.csrfToken } : {}),
  'x-user-id': el.userId.value.trim() || 'demo-user',
  'x-user-role': el.userRole.value.trim() || 'PROJECT_OWNER'
});

const renderAuthStatus = () => {
  if (state.currentUser) {
    el.authStatus.textContent = `Signed in as ${state.currentUser.email} (${state.currentUser.accessLevel})`;
  } else if (state.googleConfig?.enabled) {
    el.authStatus.textContent = `Not signed in (allowed domain: @${state.googleConfig.allowedEmailDomain})`;
  } else {
    el.authStatus.textContent = 'Google login not configured on server';
  }
};

const getCurrentAccessLevel = () => String(state.currentUser?.accessLevel || 'VOYEUR').toUpperCase();
const hasMappingAccess = () => getCurrentAccessLevel() === 'ADMIN';
const hasUserManagementAccess = () => getCurrentAccessLevel() === 'ADMIN';
const canEditData = () => getCurrentAccessLevel() !== 'VOYEUR';

const syncAccessRequestButton = () => {
  if (!(el.requestDestroyerAccess instanceof HTMLButtonElement)) {
    return;
  }

  const isVoyeur = getCurrentAccessLevel() === 'VOYEUR';
  const requested = Boolean(state.currentUser?.destroyerAccessRequested);
  el.requestDestroyerAccess.classList.toggle('hidden-view', !isVoyeur);
  el.requestDestroyerAccess.disabled = requested;
  el.requestDestroyerAccess.textContent = requested ? 'Destroyer Access Requested' : 'Request Destroyer Access';
};

const syncEditingVisibility = () => {
  const editable = canEditData();
  if (el.addTemplateRow) {
    el.addTemplateRow.classList.toggle('hidden-view', !editable);
  }
  if (el.addProjectRow) {
    el.addProjectRow.classList.toggle('hidden-view', !editable);
  }
  if (el.addPersonRow) {
    el.addPersonRow.classList.toggle('hidden-view', !editable);
  }
  if (el.addRoleRow) {
    el.addRoleRow.classList.toggle('hidden-view', !editable);
  }
  if (el.addOfficeRow) {
    el.addOfficeRow.classList.toggle('hidden-view', !editable);
  }
};

const ensureEditable = () => {
  if (canEditData()) {
    return true;
  }

  log('Read-only mode', { detail: 'Voyeur users can only view data.' });
  return false;
};

const syncRoleEchoFields = () => {
  if (!(el.userId instanceof HTMLInputElement) || !(el.userRole instanceof HTMLInputElement)) {
    return;
  }

  el.userId.value = state.currentUser?.email || 'demo-user';
  if (state.currentUser?.accessLevel === 'ADMIN') {
    el.userRole.value = 'SYSTEM_ADMIN,PROJECT_OWNER';
  } else if (state.currentUser?.accessLevel === 'DESTROYER') {
    el.userRole.value = 'PROJECT_OWNER';
  } else {
    el.userRole.value = 'STAKEHOLDER';
  }
  el.userId.disabled = true;
  el.userRole.disabled = true;
};

const normalizeAdminSubViewName = (value) => (ADMIN_SUB_VIEWS.has(value) ? value : 'templates');

const isAdminSubViewAllowed = (subViewName) => {
  const subView = normalizeAdminSubViewName(subViewName);
  if (subView === 'mapping-list' || subView === 'mapping-editor') {
    return hasMappingAccess();
  }
  if (subView === 'users' || subView === 'audit') {
    return hasUserManagementAccess();
  }
  return canEditData();
};

const resolveDefaultAdminSubView = () => {
  const orderedSubViews = ['templates', 'closures', 'roles', 'offices', 'response-log', 'mapping-list', 'mapping-editor', 'users', 'audit'];
  return orderedSubViews.find((subView) => isAdminSubViewAllowed(subView)) || null;
};

const setActiveAdminSubView = (subViewName, options = {}) => {
  const requestedSubView = normalizeAdminSubViewName(subViewName);
  const fallbackSubView = resolveDefaultAdminSubView();
  const nextSubView = isAdminSubViewAllowed(requestedSubView) ? requestedSubView : fallbackSubView;
  if (!nextSubView) {
    state.activeAdminSubView = 'templates';
    return;
  }

  state.activeAdminSubView = nextSubView;

  const subTabButtons = el.adminSubtabs?.querySelectorAll('button[data-admin-subtab]') || [];
  subTabButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const buttonSubView = normalizeAdminSubViewName(button.dataset.adminSubtab || '');
    const allowed = isAdminSubViewAllowed(buttonSubView);
    button.classList.toggle('hidden-view', !allowed);
    button.classList.toggle('primary', allowed && buttonSubView === nextSubView);
  });

  const subViewPanels = document.querySelectorAll('[data-admin-subview]');
  subViewPanels.forEach((panel) => {
    if (!(panel instanceof HTMLElement)) {
      return;
    }
    const panelSubView = normalizeAdminSubViewName(panel.dataset.adminSubview || '');
    panel.classList.toggle('hidden-view', panelSubView !== nextSubView);
  });

  if (nextSubView === 'mapping-list' || nextSubView === 'mapping-editor') {
    Promise.all([loadMappingTables(), loadMappings()])
      .then(() => {
        resetMappingEditor();
      })
      .catch((error) => {
        log('Load mappings failed', error);
      });
  }

  if (nextSubView === 'users') {
    loadUsers().catch((error) => {
      log('Load users failed', error);
    });
  }

  if (nextSubView === 'audit') {
    loadAuditLog().catch((error) => {
      log('Load audit log failed', error);
    });
  }

  if (options.updateHistory && state.activeView === 'planning') {
    writeViewToHistory('planning', Boolean(options.replaceHistory));
  }
};

const syncPlanningVisibility = () => {
  const allowed = canEditData() || hasMappingAccess() || hasUserManagementAccess();
  el.showPlanningView.classList.toggle('hidden-view', !allowed);
  if (!allowed && (state.activeView === 'planning' || state.activeView === 'mappings' || state.activeView === 'users')) {
    setActiveView('heatmap', { updateHistory: true, replaceHistory: true });
    return;
  }
  if (allowed) {
    setActiveAdminSubView(state.activeAdminSubView);
  }
};

const clearDataViews = () => {
  state.templates = [];
  state.projects = [];
  state.people = [];
  state.assignments = [];
  state.mappings = [];
  state.mappingTables = [];
  state.utilization = null;
  state.utilizationTimeline = null;
  state.projectUtilizationTimeline = null;
  state.globalClosures = [];
  state.users = [];
  state.auditEvents = [];
  state.currentUser = null;

  renderTemplates();
  renderProjects();
  renderPeople();
  renderMappings();
  renderMappingTableOptions();
  renderUtilization();
  renderUtilizationTimeline();
  renderProjectUtilizationTimeline();
  renderClosures();
  renderUsers();
  renderAuditLog();
};

const renderAuditLog = () => {
  if (!el.auditLogList) {
    return;
  }

  if (!state.auditEvents.length) {
    el.auditLogList.innerHTML = `${listHeaderHtml(['When', 'Actor', 'Method', 'Path', 'Status'])}<p>No audit events yet.</p>`;
    return;
  }

  el.auditLogList.innerHTML =
    listHeaderHtml(['When', 'Actor', 'Method', 'Path', 'Status']) +
    state.auditEvents
      .map((event) => `
        <div class="list-row list-row-users">
          <span class="list-cell meta">${escapeHtml(event.createdAt)}</span>
          <span class="list-cell">${escapeHtml(event.actor)}</span>
          <span class="list-cell meta">${escapeHtml(event.method)}</span>
          <span class="list-cell">${escapeHtml(event.path)}</span>
          <span class="list-cell meta">${escapeHtml(String(event.status))}</span>
        </div>
      `)
      .join('');
};

const initializeGoogleAuth = async () => {
  state.googleConfig = await fetchJson('/api/v1/auth/google/config', {
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'demo-user',
      'x-user-role': 'PROJECT_OWNER'
    }
  });

  if (!state.googleConfig.enabled || !window.google?.accounts?.id) {
    renderAuthStatus();
    return;
  }

  renderAuthStatus();
};

const ensureCsrfToken = async () => {
  if (state.csrfToken) {
    return state.csrfToken;
  }

  const response = await fetch('/api/v1/auth/csrf', {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    return null;
  }

  const body = await response.json();
  state.csrfToken = String(body?.token || '');
  return state.csrfToken || null;
};

const closeConflictDialog = () => {
  if (!(el.conflictDialog instanceof HTMLElement)) {
    return;
  }
  el.conflictDialog.classList.add('hidden-view');
};

const openConflictDialog = ({ message, attempted, latest }) => {
  if (!(el.conflictDialog instanceof HTMLElement)) {
    return;
  }

  if (el.conflictDialogMessage instanceof HTMLElement) {
    el.conflictDialogMessage.textContent = message;
  }
  if (el.conflictAttemptedPayload instanceof HTMLElement) {
    el.conflictAttemptedPayload.textContent = JSON.stringify(attempted ?? {}, null, 2);
  }
  if (el.conflictLatestPayload instanceof HTMLElement) {
    el.conflictLatestPayload.textContent = JSON.stringify(latest ?? {}, null, 2);
  }

  el.conflictDialog.classList.remove('hidden-view');
  if (el.conflictDialogClose instanceof HTMLButtonElement) {
    el.conflictDialogClose.focus();
  }
};

const parseAttemptedPayload = (options) => {
  const raw = options?.body;
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const fetchLatestConflictEntity = async (url) => {
  const projectMatch = url.match(/^\/api\/v1\/projects\/([^/?#]+)/i);
  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);
    const projects = await fetchJson('/api/v1/projects', { method: 'GET' });
    return projects.find((entry) => entry.id === projectId) || null;
  }

  const personMatch = url.match(/^\/api\/v1\/people\/([^/?#]+)/i);
  if (personMatch) {
    const personId = decodeURIComponent(personMatch[1]);
    const people = await fetchJson('/api/v1/people', { method: 'GET' });
    return people.find((entry) => entry.id === personId) || null;
  }

  const assignmentMatch = url.match(/^\/api\/v1\/assignments\/([^/?#]+)/i);
  if (assignmentMatch) {
    const assignmentId = decodeURIComponent(assignmentMatch[1]);
    const assignments = await fetchJson('/api/v1/assignments', { method: 'GET' });
    return assignments.find((entry) => entry.id === assignmentId) || null;
  }

  const templateMatch = url.match(/^\/api\/v1\/project-templates\/([^/?#]+)/i);
  if (templateMatch) {
    const templateId = decodeURIComponent(templateMatch[1]);
    return await fetchJson(`/api/v1/project-templates/${encodeURIComponent(templateId)}`, { method: 'GET' });
  }

  const userMatch = url.match(/^\/api\/v1\/admin\/users\/([^/?#]+)/i);
  if (userMatch) {
    const email = decodeURIComponent(userMatch[1]).toLowerCase();
    const users = await fetchJson('/api/v1/admin/users', { method: 'GET' });
    return users.find((entry) => String(entry.email || '').toLowerCase() === email) || null;
  }

  return null;
};

const explainConflict = (payload) => {
  const detail = String(payload?.detail || '').trim();
  if (detail) {
    return detail;
  }
  return 'Someone else changed this record before you saved. Your data was not overwritten.';
};

const handleConflictResponse = async (url, payload, options = {}) => {
  const message = explainConflict(payload);
  const attempted = parseAttemptedPayload(options);
  let latest = payload?.context || null;

  try {
    const fetched = await fetchLatestConflictEntity(url);
    if (fetched) {
      latest = fetched;
    }
  } catch {
    // Best effort: we still show conflict context even if latest fetch fails.
  }

  log('Conflict detected', { url, detail: message, attempted, latest });
  openConflictDialog({ message, attempted, latest });

  try {
    await refreshAll();
  } catch {
    // Ignore refresh failures; caller still receives the original conflict error.
  }
};

const buildEditKey = (kind, id) => `${kind}:${id}`;

const applyLiveEditHighlights = () => {
  const activeMap = new Map(state.liveEditing.map((entry) => [entry.key, entry]));
  document.querySelectorAll('[data-edit-key]').forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const key = String(node.dataset.editKey || '');
    const active = activeMap.get(key);
    node.classList.remove('live-edit-active', 'live-edit-remote');
    node.removeAttribute('title');

    if (!active) {
      return;
    }

    node.classList.add('live-edit-active');
    if (!active.mine) {
      node.classList.add('live-edit-remote');
    }
    node.title = `${active.actor} is editing`;
  });
};

const applyIncomingLiveEdits = (entries) => {
  state.liveEditing = Array.isArray(entries) ? entries : [];
  applyLiveEditHighlights();
};

const stopFallbackLiveEditPolling = () => {
  if (!liveEditFallbackPollTimer) {
    return;
  }

  window.clearInterval(liveEditFallbackPollTimer);
  liveEditFallbackPollTimer = null;
};

const startFallbackLiveEditPolling = () => {
  if (liveEditFallbackPollTimer) {
    return;
  }

  loadLiveEditing().catch(() => null);
  liveEditFallbackPollTimer = window.setInterval(() => {
    loadLiveEditing().catch(() => null);
  }, LIVE_EDIT_FALLBACK_POLL_MS);
};

const scheduleLiveEditSocketReconnect = () => {
  if (liveEditSocketRetryTimer) {
    return;
  }

  liveEditSocketRetryTimer = window.setTimeout(() => {
    liveEditSocketRetryTimer = null;
    connectLiveEditSocket();
  }, LIVE_EDIT_WS_RETRY_MS);
};

const connectLiveEditSocket = () => {
  if (liveEditSocket || !state.currentUser?.email) {
    return;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}/ws`;
  const socket = new WebSocket(wsUrl);
  liveEditSocket = socket;

  socket.addEventListener('open', () => {
    stopFallbackLiveEditPolling();
    if (liveEditSocketRetryTimer) {
      window.clearTimeout(liveEditSocketRetryTimer);
      liveEditSocketRetryTimer = null;
    }
  });

  socket.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(String(event.data || '{}'));
      if (payload?.type === 'live-edit:init' || payload?.type === 'live-edit:update') {
        applyIncomingLiveEdits(payload.entries || []);
      }
    } catch {
      // Ignore malformed websocket payloads.
    }
  });

  socket.addEventListener('close', () => {
    if (liveEditSocket === socket) {
      liveEditSocket = null;
    }
    startFallbackLiveEditPolling();
    scheduleLiveEditSocketReconnect();
  });

  socket.addEventListener('error', () => {
    socket.close();
  });
};

const heartbeatLocalEditingKeys = async () => {
  const keys = [...localEditingKeys.values()];
  if (!keys.length) {
    return;
  }

  await Promise.all(
    keys.map((key) =>
      fetchJson('/api/v1/collab/editing', {
        method: 'POST',
        body: JSON.stringify({ key })
      }).catch(() => null)
    )
  );
};

const loadLiveEditing = async () => {
  const entries = await fetchJson('/api/v1/collab/editing', { method: 'GET' });
  applyIncomingLiveEdits(entries);
};

const announceEditingStart = async (key) => {
  if (!key) {
    return;
  }
  localEditingKeys.add(key);
  state.liveEditing = [
    ...state.liveEditing.filter((entry) => entry.key !== key),
    {
      key,
      actor: state.currentUser?.email || 'current-user',
      label: key,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mine: true
    }
  ];
  applyLiveEditHighlights();
  await fetchJson('/api/v1/collab/editing', {
    method: 'POST',
    body: JSON.stringify({ key })
  });
};

const announceEditingStop = async (key) => {
  if (!key) {
    return;
  }
  localEditingKeys.delete(key);
  state.liveEditing = state.liveEditing.filter((entry) => entry.key !== key);
  applyLiveEditHighlights();
  await fetchJson(`/api/v1/collab/editing/${encodeURIComponent(key)}`, {
    method: 'DELETE'
  }).catch(() => null);
};

const startLiveEditingLoop = () => {
  if (liveEditHeartbeatTimer) {
    return;
  }

  loadLiveEditing().catch(() => null);
  connectLiveEditSocket();
  liveEditHeartbeatTimer = window.setInterval(() => {
    heartbeatLocalEditingKeys().catch(() => null);
  }, LIVE_EDIT_HEARTBEAT_MS);
};

const stopLiveEditingLoop = () => {
  stopFallbackLiveEditPolling();

  if (liveEditHeartbeatTimer) {
    window.clearInterval(liveEditHeartbeatTimer);
    liveEditHeartbeatTimer = null;
  }

  if (liveEditSocketRetryTimer) {
    window.clearTimeout(liveEditSocketRetryTimer);
    liveEditSocketRetryTimer = null;
  }

  if (liveEditSocket) {
    liveEditSocket.close();
    liveEditSocket = null;
  }

  localEditingKeys.clear();
  state.liveEditing = [];
  applyLiveEditHighlights();
};

const log = (label, payload) => {
  el.responseLog.textContent = `${label}\n${JSON.stringify(payload, null, 2)}`;
};

const fetchJson = async (url, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase();
  const isMutation = method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
  if (isMutation) {
    await ensureCsrfToken();
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...apiHeaders(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401) {
      state.csrfToken = null;
      redirectToLogin('expired');
    }
    if (response.status === 403 && isMutation) {
      state.csrfToken = null;
    }
    if (response.status === 409) {
      await handleConflictResponse(url, body || {}, options);
    }
    throw body || { status: response.status, detail: response.statusText };
  }

  return body;
};

const toOption = (id, label) => `<option value="${id}">${label}</option>`;

const setSelectOptions = (selectEl, items, labelFn) => {
  selectEl.innerHTML = items.map((item) => toOption(item.id, labelFn(item))).join('');
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const parseWeekValue = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/w$/i, '')
    .trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const daysToWeeks = (days) => Number((Number(days || 0) / 7).toFixed(1));
const weeksToDays = (weeks) => Math.max(0, Math.round((parseWeekValue(weeks) ?? 0) * 7));
const formatWeekInputValue = (weeks) => {
  const parsed = parseWeekValue(weeks);
  return parsed === null ? '' : `${parsed}w`;
};
const editWeekInputValue = (weeks) => {
  const parsed = parseWeekValue(weeks);
  return parsed === null ? String(weeks ?? '').trim().replace(/w$/i, '').trim() : String(parsed);
};
const wholeHours = (value) => Math.round(Number(value || 0));

let confirmDialogResolver = null;

const closeConfirmDialog = (confirmed = false) => {
  if (!(el.confirmDialog instanceof HTMLElement) || !confirmDialogResolver) {
    return false;
  }

  const resolve = confirmDialogResolver;
  confirmDialogResolver = null;
  el.confirmDialog.classList.add('hidden-view');
  resolve(Boolean(confirmed));
  return true;
};

const confirmProposedChange = (message) => {
  if (!(el.confirmDialog instanceof HTMLElement) || !(el.confirmDialogMessage instanceof HTMLElement)) {
    return Promise.resolve(window.confirm(`Confirm change:\n\n${message}`));
  }

  if (confirmDialogResolver) {
    closeConfirmDialog(false);
  }

  el.confirmDialogMessage.textContent = String(message || '').trim();
  el.confirmDialog.classList.remove('hidden-view');

  if (el.confirmChangeConfirm instanceof HTMLButtonElement) {
    el.confirmChangeConfirm.focus();
  }

  return new Promise((resolve) => {
    confirmDialogResolver = resolve;
  });
};

const addDaysIso = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatLocalDate = (isoDate) => {
  if (!isoDate) {
    return '';
  }

  const date = new Date(`${isoDate}T00:00:00Z`);
  const todayIso = new Date().toISOString().slice(0, 10);
  const daysUntil = diffDaysIso(isoDate, todayIso);
  const tone = daysUntil < 0 ? 'past' : daysUntil <= 7 ? 'soon' : 'future';
  const formatted = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC'
  }).format(date);

  return `<span class="date-visual date-${tone}">${formatted}</span>`;
};

const certificationDateFromInputs = (releaseDate, exclusiveLeadWeeks, certificationLeadWeeks) => {
  if (!releaseDate) {
    return '';
  }

  const totalLeadDays = weeksToDays(exclusiveLeadWeeks) + weeksToDays(certificationLeadWeeks);
  return addDaysIso(releaseDate, -totalLeadDays);
};

const exclusiveDateFromInputs = (releaseDate, exclusiveLeadWeeks) => {
  if (!releaseDate) {
    return '';
  }

  return addDaysIso(releaseDate, -weeksToDays(exclusiveLeadWeeks));
};

const diffDaysIso = (leftIso, rightIso) => {
  if (!leftIso || !rightIso) {
    return 0;
  }

  const left = new Date(`${leftIso}T00:00:00Z`).getTime();
  const right = new Date(`${rightIso}T00:00:00Z`).getTime();
  return Math.round((left - right) / 86400000);
};

const projectMilestones = (project) => {
  const offsets = project?.settings?.milestoneOffsets;
  const releaseDate = project.releaseDate || project.targetEndDate;
  if (!releaseDate) {
    return {
      releaseDate: project.targetEndDate,
      exclusiveDate: project.targetEndDate,
      certificationDate: project.startDate,
      productionStartDate: project.startDate,
      preProductionStartDate: project.startDate
    };
  }

  if (project.exclusiveDate && project.certificationDate && project.productionStartDate && project.preProductionStartDate) {
    return {
      releaseDate,
      exclusiveDate: project.exclusiveDate,
      certificationDate: project.certificationDate,
      productionStartDate: project.productionStartDate,
      preProductionStartDate: project.preProductionStartDate
    };
  }

  if (!offsets) {
    return {
      releaseDate,
      exclusiveDate: project.targetEndDate,
      certificationDate: project.startDate,
      productionStartDate: project.startDate,
      preProductionStartDate: project.startDate
    };
  }

  const exclusiveDate = addDaysIso(releaseDate, -offsets.exclusiveLeadDays);
  const certificationDate = addDaysIso(releaseDate, -(offsets.exclusiveLeadDays + offsets.certificationLeadDays));
  const productionStartDate = addDaysIso(certificationDate, -offsets.productionLengthDays);
  const preProductionStartDate = addDaysIso(productionStartDate, -offsets.preProductionLengthDays);

  return {
    releaseDate,
    exclusiveDate,
    certificationDate,
    productionStartDate,
    preProductionStartDate
  };
};

const listHeaderHtml = (labels) => `<div class="list-header">${labels.map((label) => `<span>${label}</span>`).join('')}</div>`;

const templateInlineEditorHtml = (template) => `
  <form class="template-inline-form subform" data-template-id="${template.id}" data-edit-key="${buildEditKey('template', template.id)}">
     <input name="expectedUpdatedAt" type="hidden" value="${escapeHtml(template.updatedAt || '')}" />
    <label>
      Name
      <input name="name" value="${escapeHtml(template.name)}" required />
    </label>
    <label>
      Description
      <input name="description" value="${escapeHtml(template.description || '')}" />
    </label>
    <label>
      Notification Profile
      <select name="notificationProfile">
        <option value="standard" ${template.settings.notificationProfile === 'standard' ? 'selected' : ''}>standard</option>
        <option value="minimal" ${template.settings.notificationProfile === 'minimal' ? 'selected' : ''}>minimal</option>
        <option value="strict" ${template.settings.notificationProfile === 'strict' ? 'selected' : ''}>strict</option>
      </select>
    </label>
    <label>
      Holiday Calendar
      <input name="holidayCalendar" value="${escapeHtml(template.settings.workWeek.holidayCalendar)}" required />
    </label>
    <label>
      Exclusive
      <input name="exclusiveLeadWeeks" type="text" inputmode="decimal" data-week-display="true" value="${formatWeekInputValue(daysToWeeks(template.settings.milestoneOffsets.exclusiveLeadDays))}" required />
    </label>
    <label>
      Certification
      <input name="certificationLeadWeeks" type="text" inputmode="decimal" data-week-display="true" value="${formatWeekInputValue(daysToWeeks(template.settings.milestoneOffsets.certificationLeadDays))}" required />
    </label>
    <label>
      Production
      <input name="productionLengthWeeks" type="text" inputmode="decimal" data-week-display="true" value="${formatWeekInputValue(daysToWeeks(template.settings.milestoneOffsets.productionLengthDays))}" required />
    </label>
    <label>
      Pre-Production
      <input name="preProductionLengthWeeks" type="text" inputmode="decimal" data-week-display="true" value="${formatWeekInputValue(daysToWeeks(template.settings.milestoneOffsets.preProductionLengthDays))}" required />
    </label>
    <div class="actions align-end template-inline-actions">
      <button type="button" data-action="cancel-template-edit">Cancel</button>
      <button class="primary" type="submit">Save Template</button>
    </div>
  </form>
`;

const templateInlineCreateHtml = () => `
  <form class="template-inline-form subform" data-new="true">
    <label>
      Name
      <input name="name" required />
    </label>
    <label>
      Description
      <input name="description" />
    </label>
    <label>
      Notification Profile
      <select name="notificationProfile">
        <option value="standard">standard</option>
        <option value="minimal">minimal</option>
        <option value="strict">strict</option>
      </select>
    </label>
    <label>
      Holiday Calendar
      <input name="holidayCalendar" value="DK" required />
    </label>
    <label>
      Exclusive
      <input name="exclusiveLeadWeeks" type="text" inputmode="decimal" data-week-display="true" value="1w" required />
    </label>
    <label>
      Certification
      <input name="certificationLeadWeeks" type="text" inputmode="decimal" data-week-display="true" value="6w" required />
    </label>
    <label>
      Production
      <input name="productionLengthWeeks" type="text" inputmode="decimal" data-week-display="true" value="12w" required />
    </label>
    <label>
      Pre-Production
      <input name="preProductionLengthWeeks" type="text" inputmode="decimal" data-week-display="true" value="4w" required />
    </label>
    <div class="actions align-end template-inline-actions">
      <button type="button" data-action="cancel-template-create">Cancel</button>
      <button class="primary" type="submit">Create Template</button>
    </div>
  </form>
`;

const renderTemplates = () => {
  const createRowHtml = state.creatingTemplateRow
    ? `<div class="list-row list-row-template editing">${templateInlineCreateHtml()}</div>`
    : '';

  if (!state.templates.length) {
    el.templatesList.innerHTML = `${listHeaderHtml(['Name', 'Description', 'Notification', 'Exclusive', 'Certification', 'Production', 'Pre-Prod', 'Actions'])}${createRowHtml}<p>No active templates.</p>`;
    applyLiveEditHighlights();
    return;
  }

  el.templatesList.innerHTML =
    listHeaderHtml(['Name', 'Description', 'Notification', 'Exclusive', 'Certification', 'Production', 'Pre-Prod', 'Actions']) +
    createRowHtml +
    state.templates
    .map(
      (template) => {
        if (state.editingTemplateId === template.id) {
          return `<div class="list-row list-row-template editing" data-edit-key="${buildEditKey('template', template.id)}">${templateInlineEditorHtml(template)}</div>`;
        }

        return `
          <div class="list-row list-row-template" data-edit-key="${buildEditKey('template', template.id)}">
            <span class="list-cell list-cell-strong">${escapeHtml(template.name)}</span>
            <span class="list-cell">${escapeHtml(template.description || 'No description')}</span>
            <span class="list-cell meta">${template.settings.notificationProfile}</span>
            <span class="list-cell meta">${daysToWeeks(template.settings.milestoneOffsets.exclusiveLeadDays)}w</span>
            <span class="list-cell meta">${daysToWeeks(template.settings.milestoneOffsets.certificationLeadDays)}w</span>
            <span class="list-cell meta">${daysToWeeks(template.settings.milestoneOffsets.productionLengthDays)}w</span>
            <span class="list-cell meta">${daysToWeeks(template.settings.milestoneOffsets.preProductionLengthDays)}w</span>
            <div class="actions">${canEditData() ? `<button data-action="edit-template" data-id="${template.id}">Edit</button><button data-action="deactivate-template" data-id="${template.id}" class="warn">Deactivate</button>` : ''}</div>
          </div>
        `;
      }
    )
    .join('');
  applyLiveEditHighlights();
};

const openTemplateEditor = (templateId) => {
  const template = state.templates.find((entry) => entry.id === templateId);
  if (!template) {
    return;
  }

  if (state.editingTemplateId && state.editingTemplateId !== templateId) {
    announceEditingStop(buildEditKey('template', state.editingTemplateId)).catch(() => null);
  }
  state.creatingTemplateRow = false;
  state.editingTemplateId = templateId;
  announceEditingStart(buildEditKey('template', templateId)).catch(() => null);
  renderTemplates();
};

const closeTemplateEditor = () => {
  const previous = state.editingTemplateId;
  state.editingTemplateId = null;
  if (previous) {
    announceEditingStop(buildEditKey('template', previous)).catch(() => null);
  }
  renderTemplates();
};

const openTemplateCreator = () => {
  if (state.editingTemplateId) {
    announceEditingStop(buildEditKey('template', state.editingTemplateId)).catch(() => null);
  }
  state.editingTemplateId = null;
  state.creatingTemplateRow = true;
  renderTemplates();
};

const closeTemplateCreator = () => {
  state.creatingTemplateRow = false;
  renderTemplates();
};

const projectInlineEditorHtml = (project) => {
  const milestones = projectMilestones(project);
  const exclusiveLeadWeeks = daysToWeeks(project.settings.milestoneOffsets.exclusiveLeadDays);
  const certificationLeadWeeks = daysToWeeks(project.settings.milestoneOffsets.certificationLeadDays);

  return `
  <form class="project-inline-form subform" data-project-id="${project.id}" data-edit-key="${buildEditKey('project', project.id)}">
     <input name="expectedUpdatedAt" type="hidden" value="${escapeHtml(project.updatedAt || '')}" />
    <label>
      Name
      <input name="name" value="${escapeHtml(project.name)}" required />
    </label>
    <label>
      Status
      <select name="status">
        <option value="active" ${project.status === 'active' ? 'selected' : ''}>active</option>
        <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>completed</option>
      </select>
    </label>
    <label>
      Comments
      <input name="comments" value="${escapeHtml(project.comments || '')}" />
    </label>
    <label>
      Release Date
      <input name="releaseDate" type="date" value="${project.releaseDate || project.targetEndDate}" required />
    </label>
    <label>
      Exclusive Date
      <input name="exclusiveDatePreview" type="date" value="${milestones.exclusiveDate}" />
      <input name="exclusiveLeadWeeks" type="hidden" value="${exclusiveLeadWeeks}" />
    </label>
    <label>
      Certification Date
      <input name="certificationDatePreview" type="date" value="${milestones.certificationDate}" />
      <input name="certificationLeadWeeks" type="hidden" value="${certificationLeadWeeks}" />
    </label>
    <label>
      Production
      <input name="productionLengthWeeks" type="text" inputmode="decimal" data-week-display="true" value="${formatWeekInputValue(daysToWeeks(project.settings.milestoneOffsets.productionLengthDays))}" required />
    </label>
    <label>
      Pre-Production
      <input name="preProductionLengthWeeks" type="text" inputmode="decimal" data-week-display="true" value="${formatWeekInputValue(daysToWeeks(project.settings.milestoneOffsets.preProductionLengthDays))}" required />
    </label>
    <div class="actions align-end project-inline-actions">
      <button type="button" data-action="cancel-project-edit">Cancel</button>
      <button class="primary" type="submit">Save Project</button>
    </div>
  </form>
`;
};

const projectInlineCreateHtml = () => `
  <form class="project-inline-form subform" data-new="true">
     <label>
      Name
      <input name="name" required />
    </label>
    <label>
      Comments
      <input name="comments" />
    </label>
    <label>
      Release Date
      <input name="releaseDate" type="date" required />
    </label>
    <label>
      Exclusive Date
      <input name="exclusiveDatePreview" type="date" value="" />
      <input name="exclusiveLeadWeeks" type="hidden" value="1" />
    </label>
    <label>
      Certification Date
      <input name="certificationDatePreview" type="date" value="" />
      <input name="certificationLeadWeeks" type="hidden" value="6" />
    </label>
    <label>
      Production
      <input name="productionLengthWeeks" type="text" inputmode="decimal" data-week-display="true" value="12w" required />
    </label>
    <label>
      Pre-Production
      <input name="preProductionLengthWeeks" type="text" inputmode="decimal" data-week-display="true" value="4w" required />
    </label>
    <div class="actions align-end project-inline-actions">
      <button type="button" data-action="cancel-project-create">Cancel</button>
      <button class="primary" type="submit">Create Project</button>
    </div>
  </form>
`;

const projectRoadmapInlineEditorHtml = (project) => {
  const exclusiveLeadWeeks = daysToWeeks(project.settings.milestoneOffsets.exclusiveLeadDays);
  const certificationLeadWeeks = daysToWeeks(project.settings.milestoneOffsets.certificationLeadDays);

  return `
  <form class="project-inline-form subform" data-project-id="${project.id}" data-edit-key="${buildEditKey('project', project.id)}">
     <input name="expectedUpdatedAt" type="hidden" value="${escapeHtml(project.updatedAt || '')}" />
    <label>
      Name
      <input name="name" value="${escapeHtml(project.name)}" required />
    </label>
    <label>
      Status
      <select name="status">
        <option value="active" ${project.status === 'active' ? 'selected' : ''}>active</option>
        <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>completed</option>
      </select>
    </label>
    <label>
      Start (Pre-Production)
      <input name="preProductionLengthWeeks" type="text" inputmode="decimal" data-week-display="true" value="${formatWeekInputValue(daysToWeeks(project.settings.milestoneOffsets.preProductionLengthDays))}" required />
    </label>
    <label>
      Start (Production)
      <input name="productionLengthWeeks" type="text" inputmode="decimal" data-week-display="true" value="${formatWeekInputValue(daysToWeeks(project.settings.milestoneOffsets.productionLengthDays))}" required />
    </label>
    <label>
      Certification Lead
      <input name="certificationLeadWeeks" type="text" inputmode="decimal" data-week-display="true" value="${formatWeekInputValue(certificationLeadWeeks)}" required />
    </label>
    <label>
      Exclusive Lead
      <input name="exclusiveLeadWeeks" type="text" inputmode="decimal" data-week-display="true" value="${formatWeekInputValue(exclusiveLeadWeeks)}" required />
    </label>
    <label>
      Live Date
      <input name="releaseDate" type="date" value="${project.releaseDate || project.targetEndDate}" required />
    </label>
    <label>
      Comments
      <input name="comments" value="${escapeHtml(project.comments || '')}" />
    </label>
    <div class="actions align-end project-inline-actions">
      <button type="button" data-action="cancel-project-edit">Cancel</button>
      <button class="primary" type="submit">Save Project</button>
    </div>
  </form>
`;
};

const updateProjectFormMilestonePreviews = (form, changedField = 'releaseDate') => {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const releaseInput = form.querySelector('input[name="releaseDate"]');
  const exclusiveInput = form.querySelector('input[name="exclusiveLeadWeeks"]');
  const certLeadInput = form.querySelector('input[name="certificationLeadWeeks"]');
  const exclusivePreviewInput = form.querySelector('input[name="exclusiveDatePreview"]');
  const certPreviewInput = form.querySelector('input[name="certificationDatePreview"]');

  if (!(releaseInput instanceof HTMLInputElement)) {
    return;
  }
  if (!(exclusiveInput instanceof HTMLInputElement)) {
    return;
  }
  if (!(certLeadInput instanceof HTMLInputElement)) {
    return;
  }
  if (!(exclusivePreviewInput instanceof HTMLInputElement)) {
    return;
  }
  if (!(certPreviewInput instanceof HTMLInputElement)) {
    return;
  }

  if (changedField === 'releaseDate') {
    exclusivePreviewInput.value = exclusiveDateFromInputs(releaseInput.value, exclusiveInput.value);
    certPreviewInput.value = certificationDateFromInputs(releaseInput.value, exclusiveInput.value, certLeadInput.value);
    return;
  }

  if (changedField === 'exclusiveDatePreview') {
    const leadDays = Math.max(0, diffDaysIso(releaseInput.value, exclusivePreviewInput.value));
    exclusiveInput.value = String(daysToWeeks(leadDays));
    certPreviewInput.value = certificationDateFromInputs(releaseInput.value, exclusiveInput.value, certLeadInput.value);
    return;
  }

  if (changedField === 'certificationDatePreview') {
    const certLeadDays = Math.max(0, diffDaysIso(exclusivePreviewInput.value, certPreviewInput.value));
    certLeadInput.value = String(daysToWeeks(certLeadDays));
    return;
  }

  exclusivePreviewInput.value = exclusiveDateFromInputs(releaseInput.value, exclusiveInput.value);
  certPreviewInput.value = certificationDateFromInputs(releaseInput.value, exclusiveInput.value, certLeadInput.value);
};

const matchesPersonnelFilter = (project) => {
  if (!state.personnelProjectFilter) {
    return true;
  }
  return state.assignments.some((a) => a.personId === state.personnelProjectFilter && a.projectId === project.id);
};

const populatePersonnelProjectFilters = () => {
  const selects = [el.heatmapPersonnelFilter, el.roadmapPersonnelFilter].filter(Boolean);
  if (!selects.length) {
    return;
  }

  const noneOption = '<option value="">\u2014 None \u2014</option>';
  const groups = state.roles
    .filter((role) => activePeople().some((p) => p.primaryRoleCode === role.code))
    .map((role) => {
      const people = activePeople()
        .filter((p) => p.primaryRoleCode === role.code)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      const options = people
        .map((p) => `<option value="${escapeHtml(p.id)}" data-role-code="${escapeHtml(role.code)}" style="${roleTintInlineStyle(role.code)}">${escapeHtml(p.name)}</option>`)
        .join('');
      return `<optgroup label="${escapeHtml(role.label)}">${options}</optgroup>`;
    });

  const html = noneOption + groups.join('');
  const currentValue = state.personnelProjectFilter;
  selects.forEach((select) => {
    select.innerHTML = html;
    select.value = currentValue;
    const selected = select.selectedOptions?.[0];
    const roleCode = selected?.dataset.roleCode || '';
    select.classList.toggle('is-role-tinted', Boolean(roleCode));
    select.style.cssText = roleCode ? roleTintInlineStyle(roleCode) : '';
  });
};

const renderProjects = () => {
  const projectColumns = [
    { key: 'name', label: 'Name', defaultWidth: 220, minWidth: 10 },
    { key: 'preprod', label: 'Pre-Prod', defaultWidth: 106, minWidth: 10 },
    { key: 'prodstart', label: 'Prod Start', defaultWidth: 106, minWidth: 10 },
    { key: 'cert', label: 'Cert', defaultWidth: 96, minWidth: 10 },
    { key: 'exclusive', label: 'Exclusive', defaultWidth: 106, minWidth: 10 },
    { key: 'release', label: 'Release', defaultWidth: 106, minWidth: 10 },
    { key: 'status', label: 'Status', defaultWidth: 84, minWidth: 10 },
    { key: 'actions', label: 'Actions', defaultWidth: 128, minWidth: 10 }
  ];
  const projectsHeader = buildResizableListHeader('projects', projectColumns, state.projectsColumnWidths, 'projects-list-header');
  const visibleProjects = state.projects.filter((project) =>
    (state.projectOverviewFilter === 'all' ? true : project.status === 'active') &&
    matchesPersonnelFilter(project)
  );

  if (!visibleProjects.length && !state.creatingProjectRow) {
    el.overviewProjectsList.innerHTML = `${projectsHeader.html}<p>No projects available.</p>`;
    applyLiveEditHighlights();
    return;
  }

  const createRowHtml = state.creatingProjectRow
    ? `<div class="list-row list-row-projects editing">${projectInlineCreateHtml()}</div>`
    : '';

  el.overviewProjectsList.innerHTML =
    projectsHeader.html +
    createRowHtml +
    visibleProjects
    .map(
      (project) => {
        const milestones = projectMilestones(project);
        if (state.editingProjectId === project.id) {
          return `
            <div class="list-row list-row-projects editing" data-edit-key="${buildEditKey('project', project.id)}">
              ${projectInlineEditorHtml(project)}
            </div>
          `;
        }

        return `
          <div class="list-row list-row-projects" data-edit-key="${buildEditKey('project', project.id)}" style="grid-template-columns: ${projectsHeader.template};">
            <span class="list-cell list-cell-strong">${escapeHtml(project.name)}</span>
            <span class="list-cell meta">${formatLocalDate(milestones.preProductionStartDate)}</span>
            <span class="list-cell meta">${formatLocalDate(milestones.productionStartDate)}</span>
            <span class="list-cell meta">${formatLocalDate(milestones.certificationDate)}</span>
            <span class="list-cell meta">${formatLocalDate(milestones.exclusiveDate)}</span>
            <span class="list-cell meta">${formatLocalDate(milestones.releaseDate)}</span>
            <span class="list-cell meta">${project.status}</span>
            <div class="actions">
              ${canEditData() ? `<button data-action="edit-project" data-id="${project.id}">Edit</button>` : ''}
            </div>
          </div>
        `;
      }
    )
    .join('');
  applyLiveEditHighlights();
};

const projectStudioLabel = (project) => {
  const comments = String(project.comments || '');
  const tagged = comments.match(/studio\s*:\s*([^;\n]+)/i);
  if (tagged?.[1]) {
    return tagged[1].trim();
  }

  const fromDescription = comments.match(/\(([^)]+)\)/);
  if (fromDescription?.[1]) {
    return fromDescription[1].trim();
  }

  return project.source?.type ? String(project.source.type) : '';
};

const projectComments = (project) => String(project.comments || '').trim();

const roadmapRoleColumns = (projects) => {
  const projectIds = new Set(projects.map((project) => project.id));
  const roleCodes = [...new Set(
    state.assignments
      .filter((assignment) => projectIds.has(assignment.projectId))
      .map((assignment) => assignment.roleCode)
      .filter(Boolean)
  )].filter((roleCode) =>
    state.assignments.some((assignment) => {
      if (!projectIds.has(assignment.projectId) || assignment.roleCode !== roleCode) {
        return false;
      }

      const personName = state.people.find((person) => person.id === assignment.personId)?.name || '';
      return personName.trim().length > 0;
    })
  );

  return roleCodes
    .map((code) => {
      const role = state.roles.find((entry) => entry.code === code);
      return {
        code,
        label: role?.label || code
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

const roadmapRoleNamesForProject = (projectId, roleCode) => {
  const names = state.assignments
    .filter((assignment) => assignment.projectId === projectId && assignment.roleCode === roleCode)
    .map((assignment) => state.people.find((person) => person.id === assignment.personId)?.name || '')
    .filter(Boolean);

  const uniqueNames = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  return uniqueNames.join(', ');
};

const openRoadmapRoleEditor = (projectId, roleCode) => {
  if (!projectId || !roleCode) {
    return;
  }

  state.creatingProjectRow = false;
  state.editingProjectId = null;
  if (state.roadmapRoleEditor) {
    announceEditingStop(buildEditKey('roadmap-role', `${state.roadmapRoleEditor.projectId}:${state.roadmapRoleEditor.roleCode}`)).catch(() => null);
  }
  state.roadmapRoleEditor = { projectId, roleCode };
  announceEditingStart(buildEditKey('roadmap-role', `${projectId}:${roleCode}`)).catch(() => null);
  renderProjects();
  renderRoadmapProjects();
};

const closeRoadmapRoleEditor = () => {
  if (state.roadmapRoleEditor) {
    announceEditingStop(buildEditKey('roadmap-role', `${state.roadmapRoleEditor.projectId}:${state.roadmapRoleEditor.roleCode}`)).catch(() => null);
  }
  state.roadmapRoleEditor = null;
  renderRoadmapProjects();
};

const defaultRoadmapPersonIdForRole = (roleCode) => {
  const candidates = activePeople();
  const preferred = candidates.find((person) => person.primaryRoleCode === roleCode)?.id;
  return preferred || candidates[0]?.id || '';
};

const renderRoadmapRoleAssignmentPanel = (projectId, roleCode) => {
  const roleLabel = state.roles.find((role) => role.code === roleCode)?.label || roleCode;
  const existing = state.assignments
    .filter((assignment) => assignment.projectId === projectId && assignment.roleCode === roleCode)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const defaults = getProjectAssignmentDefaultRange(projectId);
  const defaultPersonId = defaultRoadmapPersonIdForRole(roleCode);
  const personOptions = personOptionsForPicker(defaultPersonId);

  const existingForms = existing
    .map((assignment) => {
      const rowPersonOptions = personOptionsForPicker(assignment.personId);
      return `
        <form class="roadmap-assignment-form roadmap-assignment-existing" data-project-id="${projectId}" data-role-code="${roleCode}" data-assignment-id="${assignment.id}">
          <input name="expectedUpdatedAt" type="hidden" value="${escapeHtml(assignment.updatedAt || '')}" />
          <label>
            Person
            <select name="personId">${rowPersonOptions}</select>
          </label>
          <label>
            Allocation %
            <input name="allocationPercent" type="number" min="0.1" max="100" step="0.1" value="${assignment.allocationPercent}" required />
          </label>
          <label>
            Start
            <input name="startDate" type="date" value="${assignment.startDate}" required />
          </label>
          <label>
            End
            <input name="endDate" type="date" value="${assignment.endDate}" required />
          </label>
          <div class="actions">
            <button type="submit" class="primary">Save</button>
            <button type="button" class="warn" data-action="delete-roadmap-assignment" data-assignment-id="${assignment.id}">Remove</button>
          </div>
        </form>
      `;
    })
    .join('');

  const createForm = `
    <section class="roadmap-add-assignment-section" aria-label="Add assignment section">
      <h4>Add Assignment</h4>
      <form class="roadmap-assignment-form roadmap-assignment-create" data-project-id="${projectId}" data-role-code="${roleCode}" data-assignment-id="">
        <label>
          Add Person
          <select name="personId">${personOptions}</select>
        </label>
        <label>
          Allocation %
          <input name="allocationPercent" type="number" min="0.1" max="100" step="0.1" value="50" required />
        </label>
        <label>
          Start
          <input name="startDate" type="date" value="${defaults.startDate}" required />
        </label>
        <label>
          End
          <input name="endDate" type="date" value="${defaults.endDate}" required />
        </label>
        <div class="actions">
          <button type="submit" class="primary">Add</button>
          <button type="button" data-action="close-roadmap-role-editor">Done</button>
        </div>
      </form>
    </section>
  `;

  return `
    <div class="roadmap-role-editor-panel">
      <div class="roadmap-role-editor-head">
        <strong>${escapeHtml(roleLabel)}</strong>
        <button type="button" data-action="close-roadmap-role-editor">Close</button>
      </div>
      ${existingForms || '<p class="meta">No personnel assigned for this role yet.</p>'}
      ${createForm}
    </div>
  `;
};

const renderRoadmapProjects = () => {
  if (!el.roadmapProjectsList) {
    return;
  }

  const baseRoadmapColumns = [
    { key: 'product', label: 'Product', headClass: 'roadmap-head-product', defaultWidth: 220, minWidth: 10 },
    { key: 'studio', label: 'Studio', headClass: 'roadmap-head-studio', defaultWidth: 130, minWidth: 10 },
    { key: 'startDate', label: 'Start Date', headClass: 'roadmap-head-date', defaultWidth: 102, minWidth: 10 },
    { key: 'certDate', label: 'Cert Date', headClass: 'roadmap-head-date', defaultWidth: 102, minWidth: 10 },
    { key: 'exclDate', label: 'Excl Date', headClass: 'roadmap-head-date', defaultWidth: 102, minWidth: 10 },
    { key: 'liveDate', label: 'Live Date', headClass: 'roadmap-head-date', defaultWidth: 102, minWidth: 10 },
    { key: 'comments', label: 'Comments', headClass: 'roadmap-head-comments', defaultWidth: 240, minWidth: 10 }
  ];

  if (!state.projects.length) {
    const roadmapHeader = buildResizableListHeader('roadmap', baseRoadmapColumns, state.roadmapColumnWidths, 'roadmap-list-header');
    el.roadmapProjectsList.innerHTML = `${roadmapHeader.html}<p>No projects available.</p>`;
    applyLiveEditHighlights();
    return;
  }

  const ordered = state.projects
    .filter((project) =>
      (state.projectOverviewFilter === 'all' ? true : project.status === 'active') &&
      matchesPersonnelFilter(project)
    )
    .slice()
    .sort((a, b) => {
      const left = projectMilestones(a).releaseDate || '';
      const right = projectMilestones(b).releaseDate || '';
      return left.localeCompare(right);
    });

  if (!ordered.length) {
    const roadmapHeader = buildResizableListHeader('roadmap', baseRoadmapColumns, state.roadmapColumnWidths, 'roadmap-list-header');
    el.roadmapProjectsList.innerHTML = `${roadmapHeader.html}<p>No projects available for this filter.</p>`;
    applyLiveEditHighlights();
    return;
  }

  const roleColumns = roadmapRoleColumns(ordered);
  const roadmapColumns = [
    baseRoadmapColumns[0],
    baseRoadmapColumns[1],
    ...roleColumns.map((role) => ({
      key: `role:${role.code}`,
      label: role.label,
      headClass: 'roadmap-head-role',
      defaultWidth: 140,
      minWidth: 10
    })),
    baseRoadmapColumns[2],
    baseRoadmapColumns[3],
    baseRoadmapColumns[4],
    baseRoadmapColumns[5],
    baseRoadmapColumns[6]
  ];
  const roadmapHeader = buildResizableListHeader('roadmap', roadmapColumns, state.roadmapColumnWidths, 'roadmap-list-header');

  el.roadmapProjectsList.innerHTML =
    roadmapHeader.html +
    ordered
      .map((project) => {
        if (state.editingProjectId === project.id) {
          return `
            <div class="list-row list-row-roadmap editing" data-edit-key="${buildEditKey('project', project.id)}">
              ${projectRoadmapInlineEditorHtml(project)}
            </div>
          `;
        }

        const milestones = projectMilestones(project);
        const roleCells = roleColumns
          .map((role) => `<button type="button" class="list-cell roadmap-role-cell roadmap-role-trigger role-tint-cell" ${roleTintStyleAttr(role.code)} data-action="open-roadmap-role-editor" data-id="${project.id}" data-role-code="${role.code}" title="Edit personnel in ${escapeHtml(role.label)}">${escapeHtml(roadmapRoleNamesForProject(project.id, role.code) || '-')}</button>`)
          .join('');
        const roleEditorPanel = state.roadmapRoleEditor && state.roadmapRoleEditor.projectId === project.id
          ? `
            <div class="list-row list-row-roadmap roadmap-role-editor-row" data-edit-key="${buildEditKey('roadmap-role', `${project.id}:${state.roadmapRoleEditor.roleCode}`)}" style="grid-template-columns: ${roadmapHeader.template};">
              <div class="roadmap-role-editor-cell" style="grid-column: 1 / -1;">
                ${renderRoadmapRoleAssignmentPanel(project.id, state.roadmapRoleEditor.roleCode)}
              </div>
            </div>
          `
          : '';

        return `
          <div class="list-row list-row-roadmap" data-edit-key="${buildEditKey('project', project.id)}" style="grid-template-columns: ${roadmapHeader.template};">
            <span class="list-cell list-cell-strong roadmap-cell-product">${escapeHtml(project.name)}</span>
            <span class="list-cell roadmap-cell-studio">${escapeHtml(projectStudioLabel(project) || '-')}</span>
            ${roleCells}
            <button type="button" class="list-cell meta roadmap-cell-date roadmap-date-trigger" data-action="edit-roadmap-date" data-id="${project.id}" data-focus-field="preProductionLengthWeeks" title="Edit Pre-Production weeks">${formatLocalDate(milestones.preProductionStartDate)}</button>
            <button type="button" class="list-cell meta roadmap-cell-date roadmap-date-trigger" data-action="edit-roadmap-date" data-id="${project.id}" data-focus-field="certificationLeadWeeks" title="Edit Certification lead weeks">${formatLocalDate(milestones.certificationDate)}</button>
            <button type="button" class="list-cell meta roadmap-cell-date roadmap-date-trigger" data-action="edit-roadmap-date" data-id="${project.id}" data-focus-field="exclusiveLeadWeeks" title="Edit Exclusive lead weeks">${formatLocalDate(milestones.exclusiveDate)}</button>
            <button type="button" class="list-cell meta roadmap-cell-date roadmap-date-trigger" data-action="edit-roadmap-date" data-id="${project.id}" data-focus-field="releaseDate" title="Edit Release date">${formatLocalDate(milestones.releaseDate)}</button>
            <span class="list-cell roadmap-cell-comments">${escapeHtml(projectComments(project) || '-')}</span>
          </div>
          ${roleEditorPanel}
        `;
      })
      .join('');
  applyLiveEditHighlights();
};

const openRoadmapProjectEditorAtField = (projectId, fieldName) => {
  state.roadmapRoleEditor = null;
  openProjectEditor(projectId);
  const editForm = el.roadmapProjectsList?.querySelector(`form.project-inline-form[data-project-id="${projectId}"]`);
  if (!(editForm instanceof HTMLFormElement)) {
    return;
  }

  const field = editForm.querySelector(`[name="${fieldName}"]`);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
    field.focus();
    if (field instanceof HTMLInputElement && (field.type === 'text' || field.type === 'date')) {
      field.select?.();
    }
  }
};

const normalizeViewName = (value) => {
  if (value === 'overview') {
    return 'projects';
  }
  return APP_VIEWS.has(value) ? value : 'heatmap';
};

const getViewFromLocation = () => {
  const hash = window.location.hash.replace(/^#/, '').trim();
  return normalizeViewName(hash);
};

const writeViewToHistory = (viewName, replaceHistory = false) => {
  const hash = `#${viewName}`;
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  if (replaceHistory) {
    window.history.replaceState({ view: viewName }, '', url);
    return;
  }
  if (window.location.hash !== hash) {
    window.history.pushState({ view: viewName }, '', url);
  }
};

const setSettingsPanelOpen = (open) => {
  el.settingsPanel.classList.toggle('hidden-view', !open);
  el.settingsToggle.classList.toggle('primary', open);
};

const normalizeHeatmapDensity = (value) => (value === 'large' || value === 'medium' || value === 'compact' ? value : 'medium');
const normalizePersonnelDensity = (value) => (value === 'large' || value === 'medium' || value === 'compact' ? value : 'medium');
const normalizeProjectOverviewFilter = (value) => (value === 'all' || value === 'active' ? value : 'active');

const syncHeatmapDensityButtons = () => {
  const presetButtons = el.projectHeatmapDensityPresets?.querySelectorAll('button[data-density]') || [];
  presetButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.classList.toggle('primary', button.dataset.density === state.projectHeatmapDensity);
  });
};

const syncPersonnelDensityButtons = () => {
  const presetButtons = el.personnelHeatmapDensityPresets?.querySelectorAll('button[data-personnel-density]') || [];
  presetButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.classList.toggle('primary', button.dataset.personnelDensity === state.personnelHeatmapDensity);
  });
};

const syncProjectOverviewFilterButtons = () => {
  [el.projectOverviewStatusFilter, el.projectsOverviewStatusFilter, el.roadmapOverviewStatusFilter, el.personnelOverviewStatusFilter].forEach((filterRoot) => {
    const filterButtons = filterRoot?.querySelectorAll('button[data-project-filter]') || [];
    filterButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      button.classList.toggle('primary', button.dataset.projectFilter === state.projectOverviewFilter);
    });
  });
};

const toMondayIso = (isoDate) => {
  const source = new Date(`${isoDate}T00:00:00Z`);
  const day = source.getUTCDay() || 7;
  source.setUTCDate(source.getUTCDate() - (day - 1));
  return source.toISOString().slice(0, 10);
};

const countWeeksInclusive = (startIso, endIso) => {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const diffDays = Math.max(0, Math.floor((end - start) / 86400000));
  return Math.floor(diffDays / 7) + 1;
};

const getVisibleProjectTimelineRange = () => {
  const visibleProjects = state.projects.filter((project) =>
    (state.projectOverviewFilter === 'all' ? true : project.status === 'active') &&
    matchesPersonnelFilter(project)
  );
  if (!visibleProjects.length) {
    const todayIso = new Date().toISOString().slice(0, 10);
    return {
      weekStart: toMondayIso(todayIso),
      weeks: 12,
      rangeEnd: todayIso
    };
  }

  let minStart = null;
  let maxEnd = null;
  visibleProjects.forEach((project) => {
    if (project.startDate && (!minStart || project.startDate < minStart)) {
      minStart = project.startDate;
    }

    const endDate = project.adjustedEndDate || project.targetEndDate;
    if (endDate && (!maxEnd || endDate > maxEnd)) {
      maxEnd = endDate;
    }
  });

  if (!minStart || !maxEnd) {
    const todayIso = new Date().toISOString().slice(0, 10);
    return {
      weekStart: toMondayIso(todayIso),
      weeks: 12,
      rangeEnd: todayIso
    };
  }

  const weekStart = toMondayIso(minStart);
  return {
    weekStart,
    weeks: countWeeksInclusive(weekStart, maxEnd),
    rangeEnd: maxEnd
  };
};

const setHeatmapDensity = (density) => {
  state.projectHeatmapDensity = normalizeHeatmapDensity(density);
  localStorage.setItem(HEATMAP_DENSITY_KEY, state.projectHeatmapDensity);
  syncHeatmapDensityButtons();
  renderProjectUtilizationTimeline();
};

const setPersonnelDensity = (density) => {
  state.personnelHeatmapDensity = normalizePersonnelDensity(density);
  localStorage.setItem(PERSONNEL_DENSITY_KEY, state.personnelHeatmapDensity);
  syncPersonnelDensityButtons();
  renderUtilizationTimeline();
};

const setProjectOverviewFilter = async (filter) => {
  state.projectOverviewFilter = normalizeProjectOverviewFilter(filter);
  syncProjectOverviewFilterButtons();
  renderProjects();
  renderRoadmapProjects();

  state.overviewAnalyticsDirty = true;
  if (!viewNeedsOverviewAnalytics()) {
    return;
  }

  await refreshOverviewAnalytics();
  state.overviewAnalyticsDirty = false;
};

const refreshOverviewAnalytics = async () => {
  if (overviewAnalyticsPromise) {
    return overviewAnalyticsPromise;
  }

  const range = getVisibleProjectTimelineRange();
  const stopUtilizationTimelineOverlay = beginRefreshOverlay(el.utilizationTimeline);
  const stopProjectTimelineOverlay = beginRefreshOverlay(el.projectUtilizationTimeline);

  overviewAnalyticsPromise = Promise.all([
    loadUtilization(range.weekStart),
    loadUtilizationTimeline(range.weekStart, range.weeks),
    loadProjectUtilizationTimeline(range.weekStart, range.weeks)
  ]).finally(() => {
    stopUtilizationTimelineOverlay();
    stopProjectTimelineOverlay();
    overviewAnalyticsPromise = null;
  });

  await overviewAnalyticsPromise;
};

const openProjectEditor = (projectId) => {
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project) {
    return;
  }

  if (state.editingProjectId && state.editingProjectId !== projectId) {
    announceEditingStop(buildEditKey('project', state.editingProjectId)).catch(() => null);
  }
  if (state.roadmapRoleEditor) {
    announceEditingStop(buildEditKey('roadmap-role', `${state.roadmapRoleEditor.projectId}:${state.roadmapRoleEditor.roleCode}`)).catch(() => null);
  }
  state.creatingProjectRow = false;
  state.editingProjectId = projectId;
  state.roadmapRoleEditor = null;
  announceEditingStart(buildEditKey('project', projectId)).catch(() => null);
  renderProjects();
  renderRoadmapProjects();
};

const closeProjectEditor = () => {
  const previous = state.editingProjectId;
  if (state.roadmapRoleEditor) {
    announceEditingStop(buildEditKey('roadmap-role', `${state.roadmapRoleEditor.projectId}:${state.roadmapRoleEditor.roleCode}`)).catch(() => null);
  }
  state.editingProjectId = null;
  state.roadmapRoleEditor = null;
  if (previous) {
    announceEditingStop(buildEditKey('project', previous)).catch(() => null);
  }
  renderProjects();
  renderRoadmapProjects();
};

const openProjectCreator = () => {
  if (state.editingProjectId) {
    announceEditingStop(buildEditKey('project', state.editingProjectId)).catch(() => null);
  }
  if (state.roadmapRoleEditor) {
    announceEditingStop(buildEditKey('roadmap-role', `${state.roadmapRoleEditor.projectId}:${state.roadmapRoleEditor.roleCode}`)).catch(() => null);
  }
  state.editingProjectId = null;
  state.roadmapRoleEditor = null;
  state.creatingProjectRow = true;
  renderProjects();
  renderRoadmapProjects();
};

const closeProjectCreator = () => {
  state.creatingProjectRow = false;
  renderProjects();
  renderRoadmapProjects();
};

const personRoleOptions = (selectedCode) =>
  state.roles.map((r) => `<option value="${escapeHtml(r.code)}" ${r.code === selectedCode ? 'selected' : ''}>${escapeHtml(r.label)} (${escapeHtml(r.code)})</option>`).join('');

const personOfficeOptions = (selectedCode) =>
  state.offices.map((o) => `<option value="${escapeHtml(o.code)}" ${o.code === selectedCode ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('');

const activePeople = () => state.people;

const personDisplayName = (person) => {
  if (!person) {
    return 'Unknown Person';
  }
  return person.isActive === false ? `${person.name} (inactive)` : person.name;
};

const personOptionsForPicker = (selectedId = '') => {
  const options = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return options
    .map((person) => `<option value="${escapeHtml(person.id)}" ${person.id === selectedId ? 'selected' : ''}>${escapeHtml(personDisplayName(person))}</option>`)
    .join('');
};

const personEditFormHtml = (person) => `
  <form class="person-edit-form" data-id="${person.id}" data-edit-key="${buildEditKey('person', person.id)}">
    <input name="personId" type="hidden" value="${person.id}" />
    <input name="expectedUpdatedAt" type="hidden" value="${escapeHtml(person.updatedAt || '')}" />
    <div class="person-edit-fields">
      <label class="person-edit-field">
        <span>Name</span>
        <input name="name" class="person-row-input" value="${escapeHtml(person.name)}" required />
      </label>
      <label class="person-edit-field">
        <span>Role</span>
        <select name="primaryRoleCode" class="person-row-input" required>${personRoleOptions(person.primaryRoleCode)}</select>
      </label>
      <label class="person-edit-field">
        <span>Office</span>
        <select name="office" class="person-row-input" required>${personOfficeOptions(person.office)}</select>
      </label>
      <label class="person-edit-field">
        <span>Hrs/wk</span>
        <input name="weeklyCapacityHours" class="person-row-input" type="number" min="1" max="80" step="0.1" value="${person.weeklyCapacityHours}" required />
      </label>
      <label class="person-edit-field">
        <span>Days</span>
        <input name="workingDays" class="person-row-input" value="${person.workingDays.join(',')}" required />
      </label>
      <label class="person-edit-field">
        <span>Status</span>
        <select name="isActive" class="person-row-input" required>
          <option value="true" ${person.isActive !== false ? 'selected' : ''}>Active</option>
          <option value="false" ${person.isActive === false ? 'selected' : ''}>Inactive</option>
        </select>
      </label>
    </div>
    <div class="person-edit-actions">
      <button type="submit" class="primary">Save</button>
      <button type="button" data-action="collapse-person" data-id="${person.id}">Cancel</button>
      <button type="button" class="warn" data-action="delete-person" data-id="${person.id}">Delete</button>
    </div>
  </form>
`;

const personRowNewHtml = () => `
  <form class="person-edit-form" data-new="true">
    <div class="person-edit-fields">
      <label class="person-edit-field">
        <span>Name</span>
        <input name="name" class="person-row-input" placeholder="Name" required />
      </label>
      <label class="person-edit-field">
        <span>Role</span>
        <select name="primaryRoleCode" class="person-row-input" required>${personRoleOptions('A')}</select>
      </label>
      <label class="person-edit-field">
        <span>Office</span>
        <select name="office" class="person-row-input" required>${personOfficeOptions('Sthlm')}</select>
      </label>
      <label class="person-edit-field">
        <span>Hrs/wk</span>
        <input name="weeklyCapacityHours" class="person-row-input" type="number" min="1" max="80" step="0.1" value="40" required />
      </label>
      <label class="person-edit-field">
        <span>Days</span>
        <input name="workingDays" class="person-row-input" placeholder="1,2,3,4,5" value="1,2,3,4,5" required />
      </label>
      <label class="person-edit-field">
        <span>Status</span>
        <select name="isActive" class="person-row-input" required>
          <option value="true" selected>Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>
    </div>
    <div class="person-edit-actions">
      <button type="submit" class="primary">Save</button>
      <button type="button" data-action="cancel-new-person">Cancel</button>
    </div>
  </form>
`;

const renderPeople = () => {
  // People are now displayed in the Weekly Team Utilization timeline.
};

const lookupReferenceCount = (kind, code) => {
  if (kind === 'role') {
    const peopleCount = state.people.filter((person) => person.primaryRoleCode === code).length;
    const assignmentCount = state.assignments.filter((assignment) => assignment.roleCode === code).length;
    return peopleCount + assignmentCount;
  }

  return state.people.filter((person) => person.office === code).length;
};

const lookupRowHtml = (item, kind) => {
  const editAction = kind === 'role' ? 'edit-role' : 'edit-office';
  const deleteAction = kind === 'role' ? 'delete-role' : 'delete-office';
  const referenceCount = lookupReferenceCount(kind, item.code);
  return `
    <div class="person-row" data-kind="${kind}" data-code="${escapeHtml(item.code)}">
      <div class="person-row-view">
        <span class="person-row-name">${escapeHtml(item.label)}</span>
        <span class="person-row-meta">${escapeHtml(item.code)}</span>
        <span class="person-row-meta">${referenceCount} refs</span>
        <span></span><span></span>
        ${canEditData() ? `<button type="button" class="person-row-btn" data-action="${editAction}" data-code="${escapeHtml(item.code)}">Edit</button><button type="button" class="person-row-btn warn" data-action="${deleteAction}" data-code="${escapeHtml(item.code)}">Delete</button>` : '<span></span><span></span>'}
      </div>
      <form class="person-row-form hidden" data-kind="${kind}" data-code="${escapeHtml(item.code)}">
        <input name="label" class="person-row-input" value="${escapeHtml(item.label)}" required />
        <input name="code" type="hidden" value="${escapeHtml(item.code)}" />
        <span class="person-row-meta">${escapeHtml(item.code)}</span>
        <span class="person-row-meta">${referenceCount} refs</span>
        <span></span><span></span>
        <button type="submit" class="person-row-btn primary">Save</button>
        <button type="button" class="person-row-btn" data-action="cancel-lookup-edit">Cancel</button>
      </form>
    </div>
  `;
};

const lookupNewRowHtml = (kind) => `
  <div class="person-row" data-kind="${kind}" data-new="true">
    <form class="person-row-form" data-kind="${kind}" data-new="true">
      <input name="label" class="person-row-input" placeholder="${kind === 'role' ? 'Role label' : 'Office label'}" required />
      <input name="code" class="person-row-input" placeholder="${kind === 'role' ? 'Code (e.g. QA)' : 'Code (e.g. Remote)'}" required />
      <span class="person-row-meta">0 refs</span>
      <span></span><span></span>
      <button type="submit" class="person-row-btn primary">Save</button>
      <button type="button" class="person-row-btn" data-action="cancel-new-lookup">Cancel</button>
    </form>
  </div>
`;

const lookupHeaderHtml = () => `
  <div class="lookup-header" aria-hidden="true">
    <span>Name</span>
    <span>Code</span>
    <span>Refs</span>
    <span></span>
    <span></span>
    <span>Actions</span>
    <span></span>
  </div>
`;

const renderRoles = () => {
  if (!state.roles.length) {
    el.rolesList.innerHTML = `${lookupHeaderHtml()}<p>No role definitions.</p>`;
    return;
  }
  el.rolesList.innerHTML = lookupHeaderHtml() + state.roles.map((role) => lookupRowHtml(role, 'role')).join('');
};

const renderOffices = () => {
  if (!state.offices.length) {
    el.officesList.innerHTML = `${lookupHeaderHtml()}<p>No office definitions.</p>`;
    return;
  }
  el.officesList.innerHTML = lookupHeaderHtml() + state.offices.map((office) => lookupRowHtml(office, 'office')).join('');
};

const renderMappings = () => {
  if (!state.mappings.length) {
    el.mappingsList.innerHTML = `${listHeaderHtml(['Source', 'Target', 'Transform', 'Updated', 'Notes', 'Actions'])}<p>No mapping rules configured.</p>`;
    return;
  }

  el.mappingsList.innerHTML =
    listHeaderHtml(['Source', 'Target', 'Transform', 'Updated', 'Notes', 'Actions']) +
    state.mappings
    .map(
      (mapping) => `
        <div class="list-row list-row-mapping">
          <span class="list-cell list-cell-strong">${escapeHtml(mapping.sourceSheet)}.${escapeHtml(mapping.sourceColumn)}</span>
          <span class="list-cell">${escapeHtml(mapping.targetTable)}.${escapeHtml(mapping.targetField)}</span>
          <span class="list-cell meta">enabled=${mapping.enabled} | transform=${escapeHtml(mapping.transform || '(none)')}</span>
          <span class="list-cell meta">updated=${mapping.updatedAt} by ${escapeHtml(mapping.updatedBy)}</span>
          <span class="list-cell meta">${escapeHtml(mapping.notes || '')}</span>
          <div class="actions">
            <button data-action="edit-mapping" data-id="${mapping.id}">Edit</button>
            <button data-action="delete-mapping" data-id="${mapping.id}" class="warn">Delete</button>
          </div>
        </div>
      `
    )
    .join('');
};

const renderUsers = () => {
  if (!el.usersList) {
    return;
  }

  if (!state.users.length) {
    el.usersList.innerHTML = `${listHeaderHtml(['Email', 'Nickname', 'Access', 'Requested', 'Actions'])}<p>No users found.</p>`;
    applyLiveEditHighlights();
    return;
  }

  el.usersList.innerHTML =
    listHeaderHtml(['Email', 'Nickname', 'Access', 'Requested', 'Actions']) +
    state.users
      .map((user) => {
        const requested = user.destroyerAccessRequested ? 'Yes' : 'No';
        return `
          <div class="list-row list-row-users" data-edit-key="${buildEditKey('user', user.email.toLowerCase())}" data-email="${escapeHtml(user.email)}" data-updated-at="${escapeHtml(user.updatedAt || '')}">
            <span class="list-cell list-cell-strong">${escapeHtml(user.email)}</span>
            <span class="list-cell">
              <input data-field="nickname" type="text" value="${escapeHtml(user.nickname)}" ${hasUserManagementAccess() ? '' : 'disabled'} />
            </span>
            <span class="list-cell">
              <select data-field="accessLevel" ${hasUserManagementAccess() ? '' : 'disabled'}>
                <option value="VOYEUR" ${user.accessLevel === 'VOYEUR' ? 'selected' : ''}>Voyeur</option>
                <option value="DESTROYER" ${user.accessLevel === 'DESTROYER' ? 'selected' : ''}>Destroyer</option>
                <option value="ADMIN" ${user.accessLevel === 'ADMIN' ? 'selected' : ''}>Admin</option>
              </select>
            </span>
            <span class="list-cell meta">${requested}</span>
            <div class="actions">
              ${user.destroyerAccessRequested ? `<button data-action="knight-destroyer" data-email="${escapeHtml(user.email)}" class="primary">Knight Destoyer</button>` : ''}
              <button data-action="save-user" data-email="${escapeHtml(user.email)}" ${hasUserManagementAccess() ? '' : 'disabled'}>Save</button>
            </div>
          </div>
        `;
      })
      .join('');
  applyLiveEditHighlights();
};

const renderMappingTableOptions = () => {
  if (!state.mappingTables.length) {
    el.mappingTargetTable.innerHTML = '<option value="">(no tables)</option>';
    return;
  }

  el.mappingTargetTable.innerHTML = state.mappingTables.map((table) => `<option value="${table}">${table}</option>`).join('');
};

const openMappingEditor = (mappingId) => {
  const mapping = state.mappings.find((entry) => entry.id === mappingId);
  if (!mapping) {
    return;
  }

  state.editingMappingId = mapping.id;
  el.mappingForm.elements.mappingId.value = mapping.id;
  el.mappingForm.elements.sourceSheet.value = mapping.sourceSheet;
  el.mappingForm.elements.sourceColumn.value = mapping.sourceColumn;
  el.mappingForm.elements.targetTable.value = mapping.targetTable;
  el.mappingForm.elements.targetField.value = mapping.targetField;
  el.mappingForm.elements.transform.value = mapping.transform || '';
  el.mappingForm.elements.notes.value = mapping.notes || '';
  el.mappingForm.elements.enabled.value = String(Boolean(mapping.enabled));
};

const resetMappingEditor = () => {
  state.editingMappingId = null;
  el.mappingForm.reset();
  el.mappingForm.elements.mappingId.value = '';
  if (state.mappingTables.length) {
    el.mappingForm.elements.targetTable.value = state.mappingTables[0];
  }
  el.mappingForm.elements.enabled.value = 'true';
};

const setActiveView = (viewName, options = {}) => {
  const requestedView = normalizeViewName(viewName);
  const requestedAdminSubView = requestedView === 'mappings'
    ? 'mapping-list'
    : requestedView === 'users'
      ? 'users'
      : null;
  const planningRequested = requestedView === 'planning' || Boolean(requestedAdminSubView);
  const planningDenied = planningRequested && !(canEditData() || hasMappingAccess() || hasUserManagementAccess());
  const nextView = planningDenied ? 'heatmap' : planningRequested ? 'planning' : requestedView;
  state.activeView = nextView;
  const heatmapVisible = nextView === 'heatmap';
  const roadmapVisible = nextView === 'roadmap';
  const projectsVisible = nextView === 'projects';
  const personnelVisible = nextView === 'personnel';
  const planningVisible = nextView === 'planning';
  el.heatmapView.classList.toggle('hidden-view', !heatmapVisible);
  el.roadmapView.classList.toggle('hidden-view', !roadmapVisible);
  el.projectsView.classList.toggle('hidden-view', !projectsVisible);
  el.personnelView.classList.toggle('hidden-view', !personnelVisible);
  el.planningView.classList.toggle('hidden-view', !planningVisible);
  el.showHeatmapView.classList.toggle('primary', heatmapVisible);
  el.showRoadmapView.classList.toggle('primary', roadmapVisible);
  el.showProjectsView.classList.toggle('primary', projectsVisible);
  el.showPersonnelView.classList.toggle('primary', personnelVisible);
  el.showPlanningView.classList.toggle('primary', planningVisible);

  if (planningVisible) {
    setActiveAdminSubView(requestedAdminSubView || state.activeAdminSubView || 'templates');
  }

  if (options.updateHistory) {
    writeViewToHistory(nextView, Boolean(options.replaceHistory));
  }

  if ((heatmapVisible || personnelVisible) && state.overviewAnalyticsDirty) {
    refreshOverviewAnalytics()
      .then(() => {
        state.overviewAnalyticsDirty = false;
      })
      .catch((error) => {
        log('Refresh overview analytics failed', error);
      });
  }
};

const renderClosures = () => {
  if (!state.globalClosures.length) {
    state.editingClosureId = null;
    el.closuresList.innerHTML = `${listHeaderHtml(['Label', 'Date Range', 'Created By', 'Actions'])}<p>No global closures configured.</p>`;
    return;
  }

  if (!state.globalClosures.some((closure) => closure.id === state.editingClosureId)) {
    state.editingClosureId = null;
  }

  el.closuresList.innerHTML =
    listHeaderHtml(['Label', 'Date Range', 'Created By', 'Actions']) +
    state.globalClosures
    .map(
      (closure) => {
        const isEditing = canEditData() && state.editingClosureId === closure.id;
        if (isEditing) {
          return `
            <div class="list-row list-row-closure editing" data-closure-id="${closure.id}">
              <form class="closure-inline-form" data-closure-id="${closure.id}">
                <label>
                  Label
                  <input name="label" required value="${escapeHtml(closure.label)}" />
                </label>
                <label>
                  Start Date
                  <input type="date" name="startDate" required value="${closure.startDate}" />
                </label>
                <label>
                  End Date
                  <input type="date" name="endDate" required value="${closure.endDate}" />
                </label>
                <div class="actions closure-inline-actions">
                  <button type="submit" data-action="save-closure" data-id="${closure.id}" class="primary">Save</button>
                  <button type="button" data-action="cancel-edit-closure" data-id="${closure.id}">Cancel</button>
                </div>
              </form>
            </div>
          `;
        }

        return `
          <div class="list-row list-row-closure" data-closure-id="${closure.id}">
            <span class="list-cell list-cell-strong">${escapeHtml(closure.label)}</span>
            <span class="list-cell meta">${formatLocalDate(closure.startDate)} -> ${formatLocalDate(closure.endDate)}</span>
            <span class="list-cell meta">${escapeHtml(closure.createdBy)}</span>
            <div class="actions">
              ${canEditData() ? `<button data-action="edit-closure" data-id="${closure.id}">Edit</button>` : ''}
              ${canEditData() ? `<button data-action="delete-closure" data-id="${closure.id}" class="warn">Delete</button>` : ''}
            </div>
          </div>
        `;
      }
    )
    .join('');
};

const renderUtilization = () => {
  const snapshot = state.utilization;
  if (!snapshot) {
    el.utilizationSummary.textContent = 'Load a week to see utilization.';
    el.utilizationTimeline.innerHTML = '';
    return;
  }

  el.utilizationSummary.textContent = `week ${snapshot.weekStart} -> ${snapshot.weekEnd} | closure windows=${snapshot.globalClosureDaysInWeek}`;
};

const utilizationTone = (percent) => {
  if (percent > 100) {
    return 'over';
  }
  if (percent >= 85) {
    return 'high';
  }
  if (percent >= 50) {
    return 'mid';
  }
  if (percent > 0) {
    return 'low';
  }
  return 'zero';
};

const renderUtilizationTimeline = () => {
  const timeline = state.utilizationTimeline;
  if (!timeline) {
    el.utilizationTimeline.innerHTML = '';
    el.projectTimelineSummary.textContent = '';
    el.projectUtilizationTimeline.innerHTML = '';
    applyLiveEditHighlights();
    return;
  }

  const headers = timeline.rows[0]?.weeks ?? [];
  if (!headers.length) {
    el.utilizationTimeline.innerHTML = '<p>No timeline data available.</p>';
    applyLiveEditHighlights();
    return;
  }

  const todayWeekStart = toMondayIso(new Date().toISOString().slice(0, 10));
  const headerHtml = headers
    .map((week) => `<div class="timeline-head-cell${week.weekStart === todayWeekStart ? ' current-week' : ''}">${week.weekStart.slice(5)}</div>`)
    .join('');

  const closureWeeks = headers.filter((week) => week.closureDays > 0).length;
  const closureDaysInRange = headers.reduce((sum, week) => sum + week.closureDays, 0);
  el.projectTimelineSummary.textContent =
    closureWeeks > 0
      ? `global closures in range: ${closureWeeks}/${headers.length} weeks (${closureDaysInRange} closed day${closureDaysInRange === 1 ? '' : 's'})`
      : 'no global closures in visible range';

  const pinnedLeadColumnWidth = 140;
  const utilizationCellWidth = HEATMAP_DENSITY_WIDTH[state.personnelHeatmapDensity] || HEATMAP_DENSITY_WIDTH.medium;

  const visibleRows = timeline.rows.filter((row) => {
    if (state.projectOverviewFilter === 'all') {
      return true;
    }

    const person = state.people.find((entry) => entry.id === row.personId);
    return person?.isActive !== false;
  }).slice().sort((leftRow, rightRow) => {
    const leftPerson = state.people.find((entry) => entry.id === leftRow.personId);
    const rightPerson = state.people.find((entry) => entry.id === rightRow.personId);
    const leftRoleLabel = state.roles.find((entry) => entry.code === leftPerson?.primaryRoleCode)?.label || leftPerson?.primaryRoleCode || '';
    const rightRoleLabel = state.roles.find((entry) => entry.code === rightPerson?.primaryRoleCode)?.label || rightPerson?.primaryRoleCode || '';
    const roleCompare = leftRoleLabel.localeCompare(rightRoleLabel);
    if (roleCompare !== 0) {
      return roleCompare;
    }

    return leftRow.personName.localeCompare(rightRow.personName);
  });

  const rowsHtml = visibleRows
    .map((row) => {
      const expanded = state.expandedPersonIds.includes(row.personId);
      const person = state.people.find((entry) => entry.id === row.personId);
      if (expanded && person) {
        return `
          <div class="utilization-edit-row">
            ${personEditFormHtml(person)}
          </div>
        `;
      }

      const cells = row.weeks
        .map((week) => {
          const tone = utilizationTone(week.utilizationPercent);
          const closureBadge = week.closureDays > 0 ? ` | closure ${week.closureDays}d` : '';
          const currentWeekClass = week.weekStart === todayWeekStart ? ' current-week' : '';
          return `<button class="timeline-cell ${tone}${currentWeekClass}" data-timeline="person" data-person-id="${row.personId}" data-label="${escapeHtml(row.personName)}" data-week-start="${week.weekStart}" title="${row.personName}: ${week.utilizationPercent}% on ${week.weekStart}${closureBadge}">${week.utilizationPercent}%</button>`;
        })
        .join('');
      const roleCode = person?.primaryRoleCode || '';

      return `
        <div class="utilization-data-row" data-edit-key="${buildEditKey('person', row.personId)}">
          <div class="timeline-row-label person-label utilization-fixed-cell">
            <button class="row-toggle${expanded ? ' active' : ''}" data-action="expand-person" data-id="${row.personId}" title="${expanded ? 'Collapse' : 'Edit person'}">✎</button>
            <span class="person-label-text role-tint-pill" ${roleTintStyleAttr(roleCode)}>${escapeHtml(row.personName)}${roleCode ? ` ${escapeHtml(`(${roleCode})`)}` : ''}</span>
          </div>
          <div class="utilization-scroll-slave">
            <div class="utilization-week-strip" data-role="utilization-timeline-slave-strip" style="grid-template-columns: repeat(${headers.length}, ${utilizationCellWidth}px);">
              ${cells}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  el.utilizationTimeline.innerHTML = `
    <div class="utilization-board" style="--utilization-lead-col-width: ${pinnedLeadColumnWidth}px;">
      <div class="utilization-header-row">
        <div class="timeline-corner utilization-fixed-corner">Person / Week</div>
        <div class="utilization-scroll-master" data-role="utilization-timeline-master">
          <div class="utilization-week-strip" style="grid-template-columns: repeat(${headers.length}, ${utilizationCellWidth}px);">
            ${headerHtml}
          </div>
        </div>
      </div>
      ${rowsHtml}
    </div>
  `;

  const masterScroll = el.utilizationTimeline.querySelector('[data-role="utilization-timeline-master"]');
  const timelineBoard = el.utilizationTimeline.querySelector('.utilization-board');
  const slaveStrips = [...el.utilizationTimeline.querySelectorAll('[data-role="utilization-timeline-slave-strip"]')];

  const syncUtilizationTimelineScroll = () => {
    if (!(masterScroll instanceof HTMLElement)) {
      return;
    }

    slaveStrips.forEach((strip) => {
      if (!(strip instanceof HTMLElement)) {
        return;
      }
      strip.style.transform = `translateX(-${masterScroll.scrollLeft}px)`;
    });
  };

  if (masterScroll instanceof HTMLElement) {
    masterScroll.addEventListener('scroll', syncUtilizationTimelineScroll, { passive: true });
  }

  if (timelineBoard instanceof HTMLElement && masterScroll instanceof HTMLElement) {
    timelineBoard.addEventListener(
      'wheel',
      (event) => {
        const horizontalDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0;
        if (horizontalDelta === 0) {
          return;
        }

        masterScroll.scrollLeft += horizontalDelta;
        syncUtilizationTimelineScroll();
        event.preventDefault();
      },
      { passive: false }
    );
  }

  syncUtilizationTimelineScroll();
  applyLiveEditHighlights();
};

const projectWeekPeakAllocation = (projectId, weekStart) => {
  let peakAllocation = 0;
  state.assignments.forEach((assignment) => {
    if (assignment.projectId !== projectId) {
      return;
    }
    const allocation = assignmentWeekAllocation(assignment, weekStart);
    if (allocation > peakAllocation) {
      peakAllocation = allocation;
    }
  });
  return peakAllocation;
};

const projectWeekTone = (projectId, week) => {
  const peakAllocation = projectWeekPeakAllocation(projectId, week.weekStart);
  if (peakAllocation > 0) {
    return utilizationTone(peakAllocation);
  }

  return week.scheduled ? 'scheduled-empty' : 'zero';
};

const isProjectRowExpanded = (projectId) => state.expandedProjectIds.includes(projectId);

const toggleProjectRowExpanded = (projectId) => {
  if (isProjectRowExpanded(projectId)) {
    state.expandedProjectIds = state.expandedProjectIds.filter((id) => id !== projectId);
  } else {
    state.expandedProjectIds = [...state.expandedProjectIds, projectId];
  }

  renderProjectUtilizationTimeline({ preservePosition: true });
};

const togglePersonExpanded = (personId) => {
  if (state.expandedPersonIds.includes(personId)) {
    state.expandedPersonIds = state.expandedPersonIds.filter((id) => id !== personId);
    announceEditingStop(buildEditKey('person', personId)).catch(() => null);
  } else {
    state.expandedPersonIds = [...state.expandedPersonIds, personId];
    announceEditingStart(buildEditKey('person', personId)).catch(() => null);
  }
  renderUtilizationTimeline();
};

const getWeekEndIso = (weekStart) => {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return end.toISOString().slice(0, 10);
};

const assignmentWeekAllocation = (assignment, weekStart) => {
  const weekEnd = getWeekEndIso(weekStart);
  return assignment.startDate <= weekEnd && assignment.endDate >= weekStart ? assignment.allocationPercent : 0;
};

const getProjectIdsForPersonWeek = (personId, weekStart) => {
  const weekEnd = getWeekEndIso(weekStart);
  const projectIds = state.assignments
    .filter((assignment) => assignment.personId === personId)
    .filter((assignment) => assignment.allocationPercent > 0)
    .filter((assignment) => assignment.startDate <= weekEnd && assignment.endDate >= weekStart)
    .map((assignment) => assignment.projectId);

  return [...new Set(projectIds)];
};

const getProjectAssignmentDefaultRange = (projectId) => {
  const project = state.projects.find((entry) => entry.id === projectId);
  const milestones = project ? projectMilestones(project) : null;

  return {
    startDate: milestones?.preProductionStartDate || project?.startDate || '',
    endDate: milestones?.certificationDate || project?.targetEndDate || ''
  };
};

const syncProjectAssignmentEditorFromForm = (projectId, assignmentId = null) => {
  if (!state.projectAssignmentEditor || state.projectAssignmentEditor.projectId !== projectId) {
    return;
  }

  const selector = `.project-assignment-form[data-project-id="${projectId}"][data-assignment-id="${assignmentId || ''}"]`;
  const form = el.projectUtilizationTimeline.querySelector(selector);
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const formData = new FormData(form);
  state.projectAssignmentEditor.personId = String(formData.get('personId') || state.projectAssignmentEditor.personId);
  state.projectAssignmentEditor.roleCode = String(formData.get('roleCode') || state.projectAssignmentEditor.roleCode);
  state.projectAssignmentEditor.allocationPercent = Number(formData.get('allocationPercent') || state.projectAssignmentEditor.allocationPercent);
  state.projectAssignmentEditor.startDate = String(formData.get('startDate') || state.projectAssignmentEditor.startDate);
  state.projectAssignmentEditor.endDate = String(formData.get('endDate') || state.projectAssignmentEditor.endDate);
  state.projectAssignmentEditor.expectedUpdatedAt = String(formData.get('expectedUpdatedAt') || state.projectAssignmentEditor.expectedUpdatedAt || '');
};

const applyWeekToSelectedAssignmentDate = (projectId, weekStart, weekEnd) => {
  const selection = state.projectAssignmentDateSelection;
  const editor = state.projectAssignmentEditor;
  if (!selection || !editor) {
    return false;
  }

  if (selection.projectId !== projectId || editor.projectId !== projectId) {
    return false;
  }

  if (selection.assignmentId !== (editor.assignmentId || null)) {
    return false;
  }

  syncProjectAssignmentEditorFromForm(projectId, selection.assignmentId);
  editor[selection.fieldName] = selection.fieldName === 'endDate' ? weekEnd : weekStart;
  renderProjectUtilizationTimeline({ preservePosition: true });
  return true;
};

const openProjectAssignmentEditor = (projectId, assignmentId = null, seedRange = null) => {
  const existing = assignmentId ? state.assignments.find((entry) => entry.id === assignmentId) : null;
  const defaults = getProjectAssignmentDefaultRange(projectId);
  const fallbackWeek = state.projectUtilizationTimeline?.rows[0]?.weeks?.[0]?.weekStart || '';
  const defaultStart = seedRange?.weekStart || defaults.startDate || fallbackWeek;
  const defaultEnd = seedRange?.weekEnd || defaults.endDate || (defaultStart ? getWeekEndIso(defaultStart) : '');

  const defaultPersonId = existing?.personId || activePeople()[0]?.id || '';
  const defaultPerson = state.people.find((p) => p.id === defaultPersonId);
  const defaultRoleCode = existing?.roleCode || defaultPerson?.primaryRoleCode || '';

  state.projectAssignmentEditor = {
    projectId,
    assignmentId,
    expectedUpdatedAt: existing?.updatedAt || '',
    personId: defaultPersonId,
    roleCode: defaultRoleCode,
    allocationPercent: existing?.allocationPercent || 50,
    startDate: existing?.startDate || defaultStart,
    endDate: existing?.endDate || defaultEnd
  };

  state.projectAssignmentDateSelection = {
    projectId,
    assignmentId,
    fieldName: 'startDate'
  };

  if (assignmentId) {
    announceEditingStart(buildEditKey('assignment', assignmentId)).catch(() => null);
  }

  renderProjectUtilizationTimeline({ preservePosition: true });
};

const closeProjectAssignmentEditor = () => {
  if (state.projectAssignmentEditor?.assignmentId) {
    announceEditingStop(buildEditKey('assignment', state.projectAssignmentEditor.assignmentId)).catch(() => null);
  }
  state.projectAssignmentEditor = null;
  state.projectAssignmentDateSelection = null;
  renderProjectUtilizationTimeline({ preservePosition: true });
};

// When the person select changes, auto-reset the role select to that person's primary role.
// Called inline via onchange — no full re-render needed.
const onAssignmentPersonChange = (selectEl) => {
  const personId = selectEl.value;
  const person = state.people.find((p) => p.id === personId);
  if (!person) return;
  const form = selectEl.closest('form.project-assignment-form');
  if (!form) return;
  const roleSelect = form.querySelector('select[name="roleCode"]');
  if (roleSelect) roleSelect.value = person.primaryRoleCode;
  if (state.projectAssignmentEditor) {
    state.projectAssignmentEditor.personId = personId;
    state.projectAssignmentEditor.roleCode = person.primaryRoleCode;
  }
};

const renderProjectAssignmentEditor = (projectId, assignmentId = null) => {
  const editor = state.projectAssignmentEditor;
  const isCreateEditor = !assignmentId;
  const matchesProject = editor && editor.projectId === projectId;
  const matchesAssignment = assignmentId ? editor?.assignmentId === assignmentId : !editor?.assignmentId;
  if (!matchesProject || !matchesAssignment) {
    return '';
  }

  const personOptions = personOptionsForPicker(editor.personId);

  return `
    <form class="project-assignment-form grid three" data-project-id="${projectId}" data-assignment-id="${editor.assignmentId || ''}" data-editor-mode="${isCreateEditor ? 'create' : 'edit'}">
      <input name="expectedUpdatedAt" type="hidden" value="${escapeHtml(editor.expectedUpdatedAt || '')}" />
      <label>
        Person
        <select name="personId" onchange="onAssignmentPersonChange(this)">${personOptions}</select>
      </label>
      <label>
        Role
        <select name="roleCode" required>${personRoleOptions(editor.roleCode)}</select>
      </label>
      <label>
        Allocation %
        <input name="allocationPercent" type="number" min="0.1" max="100" step="0.1" value="${editor.allocationPercent}" required />
      </label>
      <label>
        Start Date
        <input name="startDate" type="date" value="${editor.startDate}" required />
      </label>
      <label>
        End Date
        <input name="endDate" type="date" value="${editor.endDate}" required />
      </label>
      <div class="actions align-end">
        <button type="button" data-action="cancel-project-assignment-editor">Cancel</button>
        <button type="button" class="primary" data-action="save-project-assignment">Save</button>
      </div>
    </form>
  `;
};

const renderProjectAssignmentToolbar = (projectId) => {
  const createEditor = renderProjectAssignmentEditor(projectId);
  if (createEditor) {
    return `<div class="project-assignment-toolbar">${createEditor}</div>`;
  }

  if (!canEditData()) {
    return '';
  }

  return `<div class="actions project-assignment-toolbar"><button data-action="open-project-assignment-editor" data-project-id="${projectId}">+ Add Personnel</button></div>`;
};

const renderProjectPersonnelDetails = (projectId, weeks, projectCellWidth) => {
  const projectAssignments = state.assignments.filter((assignment) => assignment.projectId === projectId);
  const assignmentRows = projectAssignments.length
    ? projectAssignments
    .map((assignment) => {
      const person = state.people.find((entry) => entry.id === assignment.personId);
      const personTodayWeekStart = toMondayIso(new Date().toISOString().slice(0, 10));
      const weekCells = weeks
        .map((week) => {
          const allocation = assignmentWeekAllocation(assignment, week.weekStart);
          const cwClass = week.weekStart === personTodayWeekStart ? ' current-week' : '';
          return `<span class="person-week-cell ${allocation > 0 ? 'active' : ''}${cwClass}">${allocation > 0 ? `${Math.round(allocation)}%` : ''}</span>`;
        })
        .join('');

      const inlineEditor = renderProjectAssignmentEditor(projectId, assignment.id);
      if (inlineEditor) {
        return `<div class="project-person-row project-person-editor-row">${inlineEditor}</div>`;
      }

      return `<div class="project-person-row" data-edit-key="${buildEditKey('assignment', assignment.id)}"><div class="project-person-head"><strong class="role-tint-pill" ${roleTintStyleAttr(assignment.roleCode)}>${escapeHtml(personDisplayName(person))}</strong><span class="meta">${escapeHtml(state.roles.find((r) => r.code === assignment.roleCode)?.label ?? assignment.roleCode)} | ${formatLocalDate(assignment.startDate)} -> ${formatLocalDate(assignment.endDate)}</span><div class="actions">${canEditData() ? `<button data-action="edit-project-assignment" data-assignment-id="${assignment.id}" data-project-id="${projectId}">Edit</button><button data-action="delete-project-assignment" data-assignment-id="${assignment.id}" class="warn">Remove</button>` : ''}</div></div><div class="project-person-timeline-wrap"><div class="project-person-timeline" data-role="project-timeline-slave-strip" style="grid-template-columns: repeat(${weeks.length}, ${projectCellWidth}px);">${weekCells}</div></div></div>`;
    })
    .join('')
    : '<p class="meta">No personnel assignments attached to this project.</p>';

  return `${renderProjectAssignmentToolbar(projectId)}${assignmentRows}`;
};

const renderProjectUtilizationTimeline = (options = {}) => {
  const preservePosition = Boolean(options.preservePosition);
  const previousScrollTop = preservePosition ? el.projectUtilizationTimeline.scrollTop : 0;
  const previousMaster = preservePosition ? el.projectUtilizationTimeline.querySelector('[data-role="project-timeline-master"]') : null;
  const previousScrollLeft = previousMaster instanceof HTMLElement ? previousMaster.scrollLeft : 0;

  const timeline = state.projectUtilizationTimeline;
  if (!timeline) {
    el.projectTimelineSummary.textContent = '';
    el.projectUtilizationTimeline.innerHTML = '';
    applyLiveEditHighlights();
    return;
  }

  const visibleRows = timeline.rows.filter((row) => {
    const project = state.projects.find((entry) => entry.id === row.projectId);
    if (!project) {
      return false;
    }

    return (state.projectOverviewFilter === 'all' ? true : project.status === 'active') &&
      matchesPersonnelFilter(project);
  });

  const firstRowWeeks = visibleRows[0]?.weeks ?? [];
  const headers = firstRowWeeks;
  if (!headers.length) {
    el.projectUtilizationTimeline.innerHTML = `<p>No ${state.projectOverviewFilter === 'all' ? '' : 'active '}projects available for timeline view.</p>`;
    applyLiveEditHighlights();
    return;
  }

  const todayWeekStart = toMondayIso(new Date().toISOString().slice(0, 10));
  const headerHtml = headers
    .map((week) => `<div class="timeline-head-cell${week.weekStart === todayWeekStart ? ' current-week' : ''}">${week.weekStart.slice(5)}</div>`)
    .join('');

  const pinnedLeadColumnWidth = state.projectTimelineLeadWidth || 192;
  const projectCellWidth = HEATMAP_DENSITY_WIDTH[state.projectHeatmapDensity] || HEATMAP_DENSITY_WIDTH.medium;

  const rowsHtml = visibleRows
    .map((row) => {
      const expanded = isProjectRowExpanded(row.projectId);
      const project = state.projects.find((entry) => entry.id === row.projectId);
      const milestones = project ? projectMilestones(project) : null;
      const releaseDate = project?.releaseDate || project?.targetEndDate || row.adjustedEndDate;
      const releaseWeekStart = releaseDate ? toMondayIso(releaseDate) : '';
      const certificationDate = milestones?.certificationDate || '';
      const certificationWeekStart = certificationDate ? toMondayIso(certificationDate) : '';
      const exclusiveDate = milestones?.exclusiveDate || '';
      const exclusiveWeekStart = exclusiveDate ? toMondayIso(exclusiveDate) : '';
      const showExclusiveMarker = Number(project?.settings?.milestoneOffsets?.exclusiveLeadDays || 0) > 0;
      const productionDate = milestones?.productionStartDate || '';
      const productionWeekStart = productionDate ? toMondayIso(productionDate) : '';
      const cells = row.weeks
        .map((week) => {
          const peakAllocation = projectWeekPeakAllocation(row.projectId, week.weekStart);
          const tone = projectWeekTone(row.projectId, week);
          const closureBadge = week.closureDays > 0 ? ` | closure ${week.closureDays}d` : '';
          const closureClass = week.closureDays > 0 ? 'closure-week' : '';
          const closureStrength = week.closureDays > 0 ? Math.min(1, week.closureDays / 7) : 0;
          const closureStyle = week.closureDays > 0 ? ` style="--closure-strength:${closureStrength.toFixed(3)}"` : '';
          const scheduleBadge = week.scheduled ? ' | scheduled' : '';
          const peakBadge = peakAllocation > 0 ? ` | peak person ${peakAllocation}%` : '';
          const hoursWhole = wholeHours(week.assignedHours);
          const cellLabel = hoursWhole > 0 ? `${hoursWhole}h` : '';
          const exclusiveMarker = showExclusiveMarker && exclusiveWeekStart === week.weekStart
            ? `<span class="project-milestone-marker exclusive" title="Exclusive ${exclusiveDate}">E</span>`
            : '';
          const productionMarker = productionWeekStart === week.weekStart
            ? `<span class="project-milestone-marker production" title="Production ${productionDate}">P</span>`
            : '';
          const certMarker = certificationWeekStart === week.weekStart
            ? `<span class="project-milestone-marker cert" title="Certification ${certificationDate}">C</span>`
            : '';
          const releaseMarker = releaseWeekStart === week.weekStart
            ? `<span class="project-milestone-marker release" draggable="true" data-action="drag-project-release" data-project-id="${row.projectId}" data-release-date="${releaseDate}" data-release-week-start="${releaseWeekStart}" title="Release ${releaseDate}. Drag this anchor to another week to move release date.">⚓</span>`
            : '';
          const milestoneMarkers = exclusiveMarker || productionMarker || certMarker || releaseMarker
            ? `<span class="project-cell-milestones">${exclusiveMarker}${productionMarker}${certMarker}${releaseMarker}</span>`
            : '';
          const currentWeekClass = week.weekStart === todayWeekStart ? ' current-week' : '';
          return `<button class="timeline-cell ${tone} ${closureClass}${currentWeekClass}"${closureStyle} data-timeline="project" data-project-id="${row.projectId}" data-label="${escapeHtml(row.projectName)}" data-week-start="${week.weekStart}" data-release-drop="true" title="${row.projectName}: ${hoursWhole}h, ${week.assignedPeopleCount} people on ${week.weekStart}${peakBadge}${scheduleBadge}${closureBadge}"><span class="project-cell-hours">${cellLabel}</span>${milestoneMarkers}</button>`;
        })
        .join('');

      return `
        <div class="project-timeline-data-row">
          <div class="timeline-row-label project-fixed-cell">
            <div class="project-expand-cell">
              <button class="row-toggle" data-action="toggle-project-row" data-project-id="${row.projectId}" title="Toggle personnel details">${expanded ? '-' : '+'}</button>
            </div>
            <div class="project-row-label project-name-cell">
              <strong>${escapeHtml(row.projectName)}</strong>
            </div>
          </div>
          <div class="project-timeline-scroll-slave">
            <div class="project-timeline-week-strip" data-role="project-timeline-slave-strip" style="grid-template-columns: repeat(${headers.length}, ${projectCellWidth}px);">
              ${cells}
            </div>
          </div>
        </div>
        ${
          expanded
            ? `<div class="project-timeline-detail-grid"><div class="project-detail-spacer"></div><div class="project-detail-row"><div class="project-detail-content">${renderProjectPersonnelDetails(row.projectId, headers, projectCellWidth)}</div></div></div>`
            : ''
        }
      `;
    })
    .join('');

  el.projectUtilizationTimeline.innerHTML = `
    <div class="project-timeline-board" style="--project-lead-col-width: ${pinnedLeadColumnWidth}px;">
      <div class="project-timeline-header-row">
        <div class="timeline-corner project-fixed-corner">
          <span class="project-expand-head">+</span>
          <span class="project-corner-label">Project</span>
          <button
            type="button"
            class="col-resize-handle project-lead-resize-handle"
            data-resize-target="project-timeline-lead"
            aria-label="Resize project overview name column"
            title="Drag to resize project name column"
          >${RESIZE_HANDLE_ICON}</button>
        </div>
        <div class="project-timeline-scroll-master" data-role="project-timeline-master">
          <div class="project-timeline-week-strip" style="grid-template-columns: repeat(${headers.length}, ${projectCellWidth}px);">
            ${headerHtml}
          </div>
        </div>
      </div>
      ${rowsHtml}
    </div>
  `;

  const masterScroll = el.projectUtilizationTimeline.querySelector('[data-role="project-timeline-master"]');
  const timelineBoard = el.projectUtilizationTimeline.querySelector('.project-timeline-board');
  const slaveStrips = [...el.projectUtilizationTimeline.querySelectorAll('[data-role="project-timeline-slave-strip"]')];

  const syncProjectTimelineScroll = () => {
    if (!(masterScroll instanceof HTMLElement)) {
      return;
    }

    slaveStrips.forEach((strip) => {
      if (!(strip instanceof HTMLElement)) {
        return;
      }
      strip.style.transform = `translateX(-${masterScroll.scrollLeft}px)`;
    });
  };

  const applyReleaseDrop = async (projectId, weekStart, sourceReleaseDate, sourceWeekStart) => {
    const sourceDate = sourceReleaseDate || '';
    const sourceWeek = sourceWeekStart || (sourceDate ? toMondayIso(sourceDate) : '');
    const targetWeek = weekStart;
    if (!sourceDate || !sourceWeek || !targetWeek) {
      return;
    }

    const sourceWeekTime = new Date(`${sourceWeek}T00:00:00Z`).getTime();
    const targetWeekTime = new Date(`${targetWeek}T00:00:00Z`).getTime();
    const weekShift = Math.round((targetWeekTime - sourceWeekTime) / (7 * 86400000));
    const shiftedReleaseDate = addDaysIso(sourceDate, weekShift * 7);
    const shiftDays = weekShift * 7;
    if (!weekShift) {
      return;
    }

    const projectName = state.projects.find((entry) => entry.id === projectId)?.name || projectId;
    const assignmentsForProject = state.assignments.filter((assignment) => assignment.projectId === projectId);
    const confirmed = await confirmProposedChange(
      `Move release for ${projectName}\nFrom: ${sourceDate}\nTo: ${shiftedReleaseDate}\nShift: ${weekShift > 0 ? '+' : ''}${weekShift} week(s)\nAlso shift ${assignmentsForProject.length} assignment date range(s) by ${shiftDays > 0 ? '+' : ''}${shiftDays} day(s).`
    );
    if (!confirmed) {
      return;
    }

    try {
      await fetchJson(`/api/v1/projects/${projectId}/shift-release`, {
        method: 'POST',
        body: JSON.stringify({ weekShift })
      });
      await Promise.all([loadProjects(), loadAssignments(), refreshOverviewAnalytics()]);
      log('Project release date moved with assignments', {
        projectId,
        releaseDate: shiftedReleaseDate,
        weekShift,
        shiftedAssignments: assignmentsForProject.length
      });
    } catch (error) {
      log('Move project release date failed', error);
    }
  };

  el.projectUtilizationTimeline.querySelectorAll('[data-action="drag-project-release"]').forEach((node) => {
    node.addEventListener('dragstart', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const projectId = target.dataset.projectId;
      if (!projectId || !event.dataTransfer) {
        return;
      }

      event.dataTransfer.setData('text/project-id', projectId);
      event.dataTransfer.setData('text/release-date', target.dataset.releaseDate || '');
      event.dataTransfer.setData('text/release-week-start', target.dataset.releaseWeekStart || '');
      event.dataTransfer.effectAllowed = 'move';
    });
  });

  el.projectUtilizationTimeline.querySelectorAll('[data-release-drop="true"]').forEach((node) => {
    node.addEventListener('dragover', (event) => {
      const dragEvent = event;
      dragEvent.preventDefault();
    });

    node.addEventListener('drop', (event) => {
      const target = event.currentTarget;
      const dropEvent = event;
      dropEvent.preventDefault();
      if (!(target instanceof HTMLElement) || !dropEvent.dataTransfer) {
        return;
      }

      const projectId = dropEvent.dataTransfer.getData('text/project-id');
      const sourceReleaseDate = dropEvent.dataTransfer.getData('text/release-date');
      const sourceWeekStart = dropEvent.dataTransfer.getData('text/release-week-start');
      const weekStart = target.dataset.weekStart;
      if (!projectId || !weekStart) {
        return;
      }

      applyReleaseDrop(projectId, weekStart, sourceReleaseDate, sourceWeekStart);
    });
  });

  if (masterScroll instanceof HTMLElement) {
    masterScroll.addEventListener('scroll', syncProjectTimelineScroll, { passive: true });
  }

  if (timelineBoard instanceof HTMLElement && masterScroll instanceof HTMLElement) {
    timelineBoard.addEventListener(
      'wheel',
      (event) => {
        const horizontalDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0;
        if (horizontalDelta === 0) {
          return;
        }

        masterScroll.scrollLeft += horizontalDelta;
        syncProjectTimelineScroll();
        event.preventDefault();
      },
      { passive: false }
    );
  }

  if (preservePosition && masterScroll instanceof HTMLElement) {
    masterScroll.scrollLeft = previousScrollLeft;
    el.projectUtilizationTimeline.scrollTop = previousScrollTop;
    syncProjectTimelineScroll();
    applyLiveEditHighlights();
    return;
  }

  syncProjectTimelineScroll();
  applyLiveEditHighlights();

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentWeekIndex = headers.findIndex((week) => {
    const weekEnd = getWeekEndIso(week.weekStart);
    return week.weekStart <= todayIso && weekEnd >= todayIso;
  });

  if (currentWeekIndex >= 0) {
    requestAnimationFrame(() => {
      if (!(masterScroll instanceof HTMLElement)) {
        return;
      }

      const scrollTarget = currentWeekIndex * projectCellWidth + projectCellWidth / 2 - masterScroll.clientWidth / 2;
      masterScroll.scrollLeft = Math.max(0, scrollTarget);
      syncProjectTimelineScroll();
    });
  }
};

const loadTemplates = async () => {
  state.templates = await fetchJson('/api/v1/project-templates');
  renderTemplates();
};

const loadProjects = async () => {
  state.projects = await fetchJson('/api/v1/projects');
  renderProjects();
  renderRoadmapProjects();
};

const loadPeople = async () => {
  state.people = await fetchJson('/api/v1/people');
  renderPeople();
  renderRoadmapProjects();
  populatePersonnelProjectFilters();
};

const loadRoles = async () => {
  state.roles = await fetchJson('/api/v1/roles');
  renderRoles();
  renderRoadmapProjects();
  populatePersonnelProjectFilters();
};

const loadOffices = async () => {
  state.offices = await fetchJson('/api/v1/offices');
  renderOffices();
};

const loadAssignments = async () => {
  state.assignments = await fetchJson('/api/v1/assignments');
  renderRoadmapProjects();
};

const loadMappingTables = async () => {
  state.mappingTables = await fetchJson('/api/v1/mappings/meta/tables');
  renderMappingTableOptions();
};

const loadMappings = async () => {
  state.mappings = await fetchJson('/api/v1/mappings');
  renderMappings();
};

const loadCurrentUser = async () => {
  state.currentUser = await fetchJson('/api/v1/users/me');
  state.csrfToken = null;
  await ensureCsrfToken();
  renderAuthStatus();
  syncRoleEchoFields();
  syncAccessRequestButton();
  syncPlanningVisibility();
  syncEditingVisibility();
};

const loadUsers = async () => {
  if (!hasUserManagementAccess()) {
    state.users = [];
    state.auditEvents = [];
    renderUsers();
    renderAuditLog();
    return;
  }

  state.users = await fetchJson('/api/v1/admin/users');
  renderUsers();
};

const loadAuditLog = async () => {
  if (!hasUserManagementAccess()) {
    state.auditEvents = [];
    renderAuditLog();
    return;
  }

  state.auditEvents = await fetchJson('/api/v1/admin/audit-log?limit=200');
  renderAuditLog();
};

const loadUtilization = async (weekStart) => {
  if (!weekStart) {
    state.utilization = null;
    renderUtilization();
    renderUtilizationTimeline();
    return;
  }

  state.utilization = await fetchJson(`/api/v1/utilization?weekStart=${encodeURIComponent(weekStart)}`);
  renderUtilization();
};

const loadUtilizationTimeline = async (weekStart, weeks) => {
  if (!weekStart) {
    state.utilizationTimeline = null;
    renderUtilizationTimeline();
    return;
  }

  state.utilizationTimeline = await fetchJson(
    `/api/v1/utilization/timeline?weekStart=${encodeURIComponent(weekStart)}&weeks=${encodeURIComponent(weeks)}`
  );
  renderUtilizationTimeline();
};

const loadProjectUtilizationTimeline = async (weekStart, weeks) => {
  if (!weekStart) {
    state.projectUtilizationTimeline = null;
    renderProjectUtilizationTimeline();
    return;
  }

  state.projectUtilizationTimeline = await fetchJson(
    `/api/v1/utilization/projects/timeline?weekStart=${encodeURIComponent(weekStart)}&weeks=${encodeURIComponent(weeks)}`
  );
  renderProjectUtilizationTimeline();
};

const loadClosures = async () => {
  state.globalClosures = await fetchJson('/api/v1/global-closures');
  if (!state.globalClosures.some((closure) => closure.id === state.editingClosureId)) {
    state.editingClosureId = null;
  }
  renderClosures();
};

const refreshAll = async () => {
  try {
    await loadCurrentUser();

    await Promise.all([
      loadTemplates(),
      loadProjects(),
      loadPeople(),
      loadRoles(),
      loadOffices(),
      loadAssignments(),
      loadClosures(),
      ...(hasMappingAccess() ? [loadMappingTables(), loadMappings()] : [])
    ]);

    if (hasUserManagementAccess()) {
      await Promise.all([loadUsers(), loadAuditLog()]);
    } else {
      state.users = [];
      state.auditEvents = [];
      renderUsers();
      renderAuditLog();
    }

    await refreshOverviewAnalytics();
    startLiveEditingLoop();
    log('Loaded data', {
      currentUser: state.currentUser?.email,
      accessLevel: state.currentUser?.accessLevel,
      templates: state.templates.length,
      projects: state.projects.length,
      people: state.people.length,
      assignments: state.assignments.length,
      globalClosures: state.globalClosures.length,
      mappings: state.mappings.length
    });
  } catch (error) {
    log('Failed to load data', error);
  }
};

const getWorkingDays = (value) =>
  value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 7);

const bindForms = () => {
  const onWeekDisplayFocus = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.weekDisplay !== 'true') {
      return;
    }

    target.value = editWeekInputValue(target.value);
  };

  const onWeekDisplayBlur = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.weekDisplay !== 'true') {
      return;
    }

    const parsed = parseWeekValue(target.value);
    target.value = parsed === null ? '' : formatWeekInputValue(parsed);
  };

  el.templatesList.addEventListener('focusin', onWeekDisplayFocus);
  el.templatesList.addEventListener('focusout', onWeekDisplayBlur);
  el.overviewProjectsList.addEventListener('focusin', onWeekDisplayFocus);
  el.overviewProjectsList.addEventListener('focusout', onWeekDisplayBlur);
  el.roadmapProjectsList?.addEventListener('focusin', onWeekDisplayFocus);
  el.roadmapProjectsList?.addEventListener('focusout', onWeekDisplayBlur);

  const selectProjectAssignmentDateInput = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'date') {
      return;
    }

    if (target.name !== 'startDate' && target.name !== 'endDate') {
      return;
    }

    const form = target.closest('.project-assignment-form');
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    state.projectAssignmentDateSelection = {
      projectId: String(form.dataset.projectId || ''),
      assignmentId: form.dataset.assignmentId ? String(form.dataset.assignmentId) : null,
      fieldName: target.name
    };
  };

  el.projectUtilizationTimeline.addEventListener('focusin', selectProjectAssignmentDateInput);
  el.projectUtilizationTimeline.addEventListener('click', selectProjectAssignmentDateInput);

  el.projectUtilizationTimeline.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }

    const form = target.closest('.project-assignment-form');
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const projectId = String(form.dataset.projectId || '');
    const assignmentId = form.dataset.assignmentId ? String(form.dataset.assignmentId) : null;
    syncProjectAssignmentEditorFromForm(projectId, assignmentId);

    if (target instanceof HTMLInputElement && target.type === 'date' && (target.name === 'startDate' || target.name === 'endDate')) {
      state.projectAssignmentDateSelection = {
        projectId,
        assignmentId,
        fieldName: target.name
      };
    }
  });

  el.createClosureForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!ensureEditable()) {
      return;
    }
    const form = new FormData(el.createClosureForm);

    const payload = {
      label: String(form.get('label') || '').trim(),
      startDate: String(form.get('startDate') || ''),
      endDate: String(form.get('endDate') || '')
    };

    try {
      const data = await fetchJson('/api/v1/global-closures', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      log('Global closure created', data);
      await Promise.all([
        loadClosures(),
        loadProjects(),
        refreshOverviewAnalytics()
      ]);
      el.createClosureForm.reset();
    } catch (error) {
      log('Create global closure failed', error);
    }
  });

  el.mappingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!ensureEditable()) {
      return;
    }
    const form = new FormData(el.mappingForm);
    const mappingId = String(form.get('mappingId') || '');

    const payload = {
      sourceSheet: String(form.get('sourceSheet') || '').trim(),
      sourceColumn: String(form.get('sourceColumn') || '').trim(),
      targetTable: String(form.get('targetTable') || '').trim(),
      targetField: String(form.get('targetField') || '').trim(),
      transform: String(form.get('transform') || ''),
      notes: String(form.get('notes') || ''),
      enabled: String(form.get('enabled') || 'true') === 'true'
    };

    try {
      const data = mappingId
        ? await fetchJson(`/api/v1/mappings/${mappingId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await fetchJson('/api/v1/mappings', { method: 'POST', body: JSON.stringify(payload) });

      log(mappingId ? 'Mapping updated' : 'Mapping created', data);
      await loadMappings();
      resetMappingEditor();
    } catch (error) {
      log(mappingId ? 'Update mapping failed' : 'Create mapping failed', error);
    }
  });
};

const bindButtons = () => {
  el.userRole.addEventListener('change', syncRoleEchoFields);
  el.userRole.addEventListener('input', syncRoleEchoFields);

  if (el.confirmChangeCancel instanceof HTMLButtonElement) {
    el.confirmChangeCancel.addEventListener('click', () => {
      closeConfirmDialog(false);
    });
  }

  if (el.confirmChangeConfirm instanceof HTMLButtonElement) {
    el.confirmChangeConfirm.addEventListener('click', () => {
      closeConfirmDialog(true);
    });
  }

  if (el.confirmDialog instanceof HTMLElement) {
    el.confirmDialog.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.dataset.action === 'cancel-confirm-change') {
        closeConfirmDialog(false);
      }
    });
  }

  if (el.conflictDialogClose instanceof HTMLButtonElement) {
    el.conflictDialogClose.addEventListener('click', () => {
      closeConflictDialog();
    });
  }

  if (el.conflictDialog instanceof HTMLElement) {
    el.conflictDialog.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.dataset.action === 'close-conflict-dialog') {
        closeConflictDialog();
      }
    });
  }

  const onListColumnResizePointerDown = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.classList.contains('col-resize-handle')) {
      return;
    }

    if (target.dataset.resizeTarget === 'project-timeline-lead') {
      event.preventDefault();
      const measuredWidth = target.closest('.project-fixed-corner')?.getBoundingClientRect().width || state.projectTimelineLeadWidth || 192;
      startProjectTimelineLeadResize(event.clientX, measuredWidth);
      return;
    }

    const listType = target.dataset.listType;
    const columnKey = target.dataset.colKey;
    if (!listType || !columnKey) {
      return;
    }

    event.preventDefault();
    const widthMap = listType === 'projects' ? state.projectsColumnWidths : state.roadmapColumnWidths;
    const measuredWidth = target.closest('.resizable-head-cell')?.getBoundingClientRect().width || 120;
    const currentWidth = resolveColumnWidth(widthMap, columnKey, measuredWidth);
    startColumnResize(listType, columnKey, event.clientX, currentWidth);
  };

  el.overviewProjectsList?.addEventListener('pointerdown', onListColumnResizePointerDown);
  el.roadmapProjectsList?.addEventListener('pointerdown', onListColumnResizePointerDown);
  el.projectUtilizationTimeline?.addEventListener('pointerdown', onListColumnResizePointerDown);

  el.settingsToggle.addEventListener('click', () => {
    const open = el.settingsPanel.classList.contains('hidden-view');
    setSettingsPanelOpen(open);
  });
  el.closeSettingsPanel.addEventListener('click', () => {
    setSettingsPanelOpen(false);
  });
  el.showHeatmapView.addEventListener('click', () => setActiveView('heatmap', { updateHistory: true }));
  el.showRoadmapView.addEventListener('click', () => setActiveView('roadmap', { updateHistory: true }));
  el.showProjectsView.addEventListener('click', () => setActiveView('projects', { updateHistory: true }));
  el.showPersonnelView.addEventListener('click', () => setActiveView('personnel', { updateHistory: true }));
  el.showPlanningView.addEventListener('click', () => setActiveView('planning', { updateHistory: true }));
  el.adminSubtabs?.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest('button[data-admin-subtab]') : null;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    const subView = target.dataset.adminSubtab || 'templates';
    if (state.activeView !== 'planning') {
      setActiveView('planning', { updateHistory: true });
    }
    setActiveAdminSubView(subView);
  });
  el.refreshAll.addEventListener('click', refreshAll);
  if (el.themeToggle) {
    el.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || resolvedTheme(normalizeThemeMode(localStorage.getItem(THEME_MODE_KEY)));
      applyThemeMode(current === 'dark' ? 'light' : 'dark');
    });
  }
  el.googleSignOut.addEventListener('click', async () => {
    try {
      await fetchJson('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors; redirecting to login is still safe.
    }
    state.csrfToken = null;
    redirectToLogin('signedout');
  });

  el.requestDestroyerAccess?.addEventListener('click', async () => {
    if (getCurrentAccessLevel() !== 'VOYEUR' || state.currentUser?.destroyerAccessRequested) {
      return;
    }

    const confirmed = await confirmProposedChange('Request Destroyer Access from an admin?');
    if (!confirmed) {
      return;
    }

    try {
      const user = await fetchJson('/api/v1/users/me/request-destroyer-access', { method: 'POST' });
      state.currentUser = user;
      syncAccessRequestButton();
      renderAuthStatus();
      log('Destroyer access requested', { email: user.email });
    } catch (error) {
      log('Request destroyer access failed', error);
    }
  });

  el.loadUsers?.addEventListener('click', async () => {
    try {
      await Promise.all([loadUsers(), loadAuditLog()]);
      log('Users reloaded', { count: state.users.length, auditEvents: state.auditEvents.length });
    } catch (error) {
      log('Reload users failed', error);
    }
  });

  el.loadAuditLog?.addEventListener('click', async () => {
    try {
      await loadAuditLog();
      log('Audit log reloaded', { count: state.auditEvents.length });
    } catch (error) {
      log('Reload audit log failed', error);
    }
  });
  el.loadProjectsOverview.addEventListener('click', async () => {
    try {
      await Promise.all([loadProjects(), refreshOverviewAnalytics()]);
      log('Overview reloaded', { projects: state.projects.length });
    } catch (error) {
      log('Reload overview failed', error);
    }
  });
  el.loadTemplates.addEventListener('click', async () => {
    try {
      await loadTemplates();
      log('Templates reloaded', { count: state.templates.length });
    } catch (error) {
      log('Reload templates failed', error);
    }
  });

  el.addTemplateRow.addEventListener('click', () => {
    if (!ensureEditable()) {
      return;
    }
    if (state.creatingTemplateRow) {
      return;
    }
    openTemplateCreator();
  });

  el.addProjectRow.addEventListener('click', () => {
    if (!ensureEditable()) {
      return;
    }
    if (state.creatingProjectRow) {
      return;
    }
    openProjectCreator();
    const createForm = el.overviewProjectsList.querySelector('form.project-inline-form[data-new="true"]');
    if (createForm instanceof HTMLFormElement) {
      updateProjectFormMilestonePreviews(createForm);
    }
  });

  el.addPersonRow.addEventListener('click', () => {
    if (!ensureEditable()) {
      return;
    }
    if (el.newPersonArea.querySelector('.person-edit-form[data-new]')) {
      return;
    }
    const newRow = document.createElement('div');
    newRow.className = 'person-row';
    newRow.innerHTML = personRowNewHtml();
    el.newPersonArea.append(newRow);
    newRow.querySelector('input[name="name"]')?.focus();
  });

  el.addRoleRow.addEventListener('click', () => {
    if (!ensureEditable()) {
      return;
    }
    if (el.rolesList.querySelector('.person-row[data-new="true"]')) {
      return;
    }
    el.rolesList.insertAdjacentHTML('afterbegin', lookupNewRowHtml('role'));
    el.rolesList.querySelector('.person-row[data-new="true"] input[name="label"]')?.focus();
  });

  el.addOfficeRow.addEventListener('click', () => {
    if (!ensureEditable()) {
      return;
    }
    if (el.officesList.querySelector('.person-row[data-new="true"]')) {
      return;
    }
    el.officesList.insertAdjacentHTML('afterbegin', lookupNewRowHtml('office'));
    el.officesList.querySelector('.person-row[data-new="true"] input[name="label"]')?.focus();
  });

  el.loadUtilization.addEventListener('click', async () => {
    try {
      await refreshOverviewAnalytics();
      const range = getActiveProjectTimelineRange();
      log('Utilization loaded', {
        weekStart: range.weekStart,
        weekCount: range.weeks,
        rangeEnd: range.rangeEnd
      });
    } catch (error) {
      log('Load utilization failed', error);
    }
  });

  el.loadClosures.addEventListener('click', async () => {
    try {
      await loadClosures();
      log('Closures reloaded', { count: state.globalClosures.length });
    } catch (error) {
      log('Reload closures failed', error);
    }
  });

  el.loadMappings.addEventListener('click', async () => {
    try {
      await Promise.all([loadMappingTables(), loadMappings()]);
      resetMappingEditor();
      log('Mappings reloaded', { count: state.mappings.length });
    } catch (error) {
      log('Reload mappings failed', error);
    }
  });

  el.cancelMappingEdit.addEventListener('click', resetMappingEditor);

  el.projectHeatmapDensityPresets?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.density) {
      return;
    }

    try {
      setHeatmapDensity(target.dataset.density);
      log('Project heatmap size updated', { density: state.projectHeatmapDensity });
    } catch (error) {
      log('Update project heatmap size failed', error);
    }
  });

  el.personnelHeatmapDensityPresets?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.personnelDensity) {
      return;
    }

    try {
      setPersonnelDensity(target.dataset.personnelDensity);
      log('Personnel timeline size updated', { density: state.personnelHeatmapDensity });
    } catch (error) {
      log('Update personnel timeline size failed', error);
    }
  });

  el.projectOverviewStatusFilter?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.projectFilter) {
      return;
    }

    try {
      await setProjectOverviewFilter(target.dataset.projectFilter);
      log('Project overview filter updated', { filter: state.projectOverviewFilter });
    } catch (error) {
      log('Update project overview filter failed', error);
    }
  });

  el.projectsOverviewStatusFilter?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.projectFilter) {
      return;
    }

    try {
      await setProjectOverviewFilter(target.dataset.projectFilter);
      log('Project overview filter updated', { filter: state.projectOverviewFilter });
    } catch (error) {
      log('Update project overview filter failed', error);
    }
  });

  el.roadmapOverviewStatusFilter?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.projectFilter) {
      return;
    }

    try {
      await setProjectOverviewFilter(target.dataset.projectFilter);
      log('Project overview filter updated', { filter: state.projectOverviewFilter });
    } catch (error) {
      log('Update project overview filter failed', error);
    }
  });

  el.personnelOverviewStatusFilter?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.projectFilter) {
      return;
    }

    try {
      await setProjectOverviewFilter(target.dataset.projectFilter);
      log('Project overview filter updated', { filter: state.projectOverviewFilter });
    } catch (error) {
      log('Update project overview filter failed', error);
    }
  });

  const onPersonnelProjectFilterChange = async (event) => {
    state.personnelProjectFilter = event.target instanceof HTMLSelectElement ? event.target.value : '';
    [el.heatmapPersonnelFilter, el.roadmapPersonnelFilter].forEach((select) => {
      if (!select) {
        return;
      }
      if (select !== event.target) {
        select.value = state.personnelProjectFilter;
      }

      const selected = select.selectedOptions?.[0];
      const roleCode = selected?.dataset.roleCode || '';
      select.classList.toggle('is-role-tinted', Boolean(roleCode));
      select.style.cssText = roleCode ? roleTintInlineStyle(roleCode) : '';
    });
    renderProjects();
    renderRoadmapProjects();
    state.overviewAnalyticsDirty = true;
    if (!viewNeedsOverviewAnalytics()) {
      return;
    }
    try {
      await refreshOverviewAnalytics();
      state.overviewAnalyticsDirty = false;
    } catch (error) {
      log('Personnel project filter analytics refresh failed', error);
    }
  };

  el.heatmapPersonnelFilter?.addEventListener('change', onPersonnelProjectFilterChange);
  el.roadmapPersonnelFilter?.addEventListener('change', onPersonnelProjectFilterChange);

  el.templatesList.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (target.dataset.action === 'edit-template' && target.dataset.id) {
      if (!ensureEditable()) {
        return;
      }
      openTemplateEditor(target.dataset.id);
      return;
    }

    if (target.dataset.action === 'cancel-template-edit') {
      closeTemplateEditor();
      return;
    }

    if (target.dataset.action === 'cancel-template-create') {
      closeTemplateCreator();
      return;
    }

    if (target.dataset.action === 'deactivate-template' && target.dataset.id) {
      if (!ensureEditable()) {
        return;
      }
      const templateName = target.closest('.list-row')?.querySelector('.list-cell-strong')?.textContent?.trim() || target.dataset.id;
      const confirmed = await confirmProposedChange(`Deactivate template ${templateName}.`);
      if (!confirmed) {
        return;
      }

      try {
        await fetchJson(`/api/v1/project-templates/${target.dataset.id}`, { method: 'DELETE' });
        log('Template deactivated', { templateId: target.dataset.id });
        await loadTemplates();
      } catch (error) {
        log('Deactivate template failed', error);
      }
    }
  });

  el.templatesList.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('template-inline-form')) {
      return;
    }

    event.preventDefault();
    if (!ensureEditable()) {
      return;
    }

    const formData = new FormData(form);
    const isNew = form.dataset.new === 'true';
    const payload = {
      name: String(formData.get('name') || '').trim(),
      description: String(formData.get('description') || ''),
      settings: {
        defaultCapacityHoursPerDay: 8,
        notificationProfile: String(formData.get('notificationProfile') || 'standard'),
        workWeek: {
          timezone: 'Europe/Copenhagen',
          workingDays: [1, 2, 3, 4, 5],
          dailyHours: 8,
          holidayCalendar: String(formData.get('holidayCalendar') || '')
        },
        milestoneOffsets: {
          exclusiveLeadDays: weeksToDays(formData.get('exclusiveLeadWeeks')),
          certificationLeadDays: weeksToDays(formData.get('certificationLeadWeeks')),
          productionLengthDays: Math.max(1, weeksToDays(formData.get('productionLengthWeeks'))),
          preProductionLengthDays: weeksToDays(formData.get('preProductionLengthWeeks'))
        }
      }
    };

    try {
      if (isNew) {
        const data = await fetchJson('/api/v1/project-templates', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        log('Template created', data);
      } else {
        const templateId = String(form.dataset.templateId || '');
        const data = await fetchJson(`/api/v1/project-templates/${templateId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...payload,
            expectedUpdatedAt: String(formData.get('expectedUpdatedAt') || '') || undefined
          })
        });
        log('Template updated', data);
      }

      await loadTemplates();
      closeTemplateCreator();
      closeTemplateEditor();
    } catch (error) {
      log(isNew ? 'Create template failed' : 'Update template failed', error);
    }
  });

  el.closuresList.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (target.dataset.action === 'edit-closure' && target.dataset.id) {
      if (!ensureEditable()) {
        return;
      }
      state.editingClosureId = target.dataset.id;
      renderClosures();
      const editingForm = el.closuresList.querySelector('.closure-inline-form');
      editingForm?.querySelector('input[name="label"]')?.focus();
      return;
    }

    if (target.dataset.action === 'cancel-edit-closure') {
      state.editingClosureId = null;
      renderClosures();
      return;
    }

    if (target.dataset.action === 'save-closure' && target.dataset.id) {
      if (!ensureEditable()) {
        return;
      }
      const form = target.closest('form');
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      const formData = new FormData(form);
      const payload = {
        label: String(formData.get('label') || '').trim(),
        startDate: String(formData.get('startDate') || ''),
        endDate: String(formData.get('endDate') || '')
      };

      try {
        const data = await fetchJson(`/api/v1/global-closures/${target.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        state.editingClosureId = null;
        log('Global closure updated', data);
        await Promise.all([
          loadClosures(),
          loadProjects(),
          refreshOverviewAnalytics()
        ]);
      } catch (error) {
        log('Update closure failed', error);
      }
      return;
    }

    if (target.dataset.action === 'delete-closure' && target.dataset.id) {
      if (!ensureEditable()) {
        return;
      }
      const row = target.closest('.list-row');
      const label = row?.querySelector('.list-cell-strong')?.textContent?.trim() || target.dataset.id;
      const dates = [...(row?.querySelectorAll('.list-cell.meta') || [])].map((node) => node.textContent?.trim()).filter(Boolean);
      const confirmed = await confirmProposedChange(`Delete closure ${label}${dates.length ? `\n${dates.join(' -> ')}` : ''}.`);
      if (!confirmed) {
        return;
      }

      try {
        await fetchJson(`/api/v1/global-closures/${target.dataset.id}`, { method: 'DELETE' });
        log('Global closure deleted', { closureId: target.dataset.id });
        await Promise.all([
          loadClosures(),
          loadProjects(),
          refreshOverviewAnalytics()
        ]);
      } catch (error) {
        log('Delete closure failed', error);
      }
    }
  });

  el.closuresList.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('closure-inline-form')) {
      return;
    }

    event.preventDefault();
    const submitButton = form.querySelector('button[data-action="save-closure"]');
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.click();
    }
  });

  el.newPersonArea.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    if (target.dataset.action === 'cancel-new-person') {
      target.closest('.person-row')?.remove();
    }
  });

  const onLookupListClick = async (event, kind) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (target.dataset.action === 'cancel-new-lookup') {
      target.closest('.person-row')?.remove();
      return;
    }

    if (target.dataset.action === 'cancel-lookup-edit') {
      const row = target.closest('.person-row');
      if (!row) {
        return;
      }
      const code = String(row.dataset.code || '');
      const keyPrefix = kind === 'role' ? 'role-def' : 'office-def';
      if (code) {
        announceEditingStop(buildEditKey(keyPrefix, code)).catch(() => null);
      }
      row.querySelector('.person-row-view')?.classList.remove('hidden');
      row.querySelector('.person-row-form')?.classList.add('hidden');
      return;
    }

    if ((kind === 'role' && target.dataset.action === 'edit-role') || (kind === 'office' && target.dataset.action === 'edit-office')) {
      if (!ensureEditable()) {
        return;
      }
      const row = target.closest('.person-row');
      if (!row) {
        return;
      }
      const code = String(row.dataset.code || '');
      const keyPrefix = kind === 'role' ? 'role-def' : 'office-def';
      if (code) {
        announceEditingStart(buildEditKey(keyPrefix, code)).catch(() => null);
      }
      row.querySelector('.person-row-view')?.classList.add('hidden');
      row.querySelector('.person-row-form')?.classList.remove('hidden');
      row.querySelector('input[name="label"]')?.focus();
      return;
    }

    if ((kind === 'role' && target.dataset.action === 'delete-role' && target.dataset.code) || (kind === 'office' && target.dataset.action === 'delete-office' && target.dataset.code)) {
      if (!ensureEditable()) {
        return;
      }
      const entity = kind === 'role' ? 'role' : 'office';
      const code = target.dataset.code;
      const confirmed = await confirmProposedChange(`Delete ${entity.toUpperCase()} ${code}.`);
      if (!confirmed) {
        return;
      }

      try {
        const basePath = kind === 'role' ? '/api/v1/roles' : '/api/v1/offices';
        await fetchJson(`${basePath}/${encodeURIComponent(code)}`, { method: 'DELETE' });
        if (kind === 'role') {
          await Promise.all([loadRoles(), refreshOverviewAnalytics()]);
        } else {
          await Promise.all([loadOffices(), refreshOverviewAnalytics()]);
        }
        renderUtilizationTimeline();
        log(kind === 'role' ? 'Role deleted' : 'Office deleted', { code: target.dataset.code });
      } catch (error) {
        log(kind === 'role' ? 'Delete role failed' : 'Delete office failed', error);
      }
    }
  };

  el.rolesList.addEventListener('click', (event) => onLookupListClick(event, 'role'));
  el.officesList.addEventListener('click', (event) => onLookupListClick(event, 'office'));

  const onLookupListSubmit = async (event, kind) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('person-row-form')) {
      return;
    }
    event.preventDefault();
    if (!ensureEditable()) {
      return;
    }
    const data = new FormData(form);
    const code = String(data.get('code') || '').trim();
    const label = String(data.get('label') || '').trim();
    const payload = { code, label };
    const isNew = form.dataset.new === 'true';
    const basePath = kind === 'role' ? '/api/v1/roles' : '/api/v1/offices';

    try {
      if (isNew) {
        await fetchJson(basePath, { method: 'POST', body: JSON.stringify(payload) });
      } else {
        const currentCode = String(form.dataset.code || '');
        await fetchJson(`${basePath}/${encodeURIComponent(currentCode)}`, {
          method: 'PATCH',
          body: JSON.stringify({ label })
        });
        const keyPrefix = kind === 'role' ? 'role-def' : 'office-def';
        announceEditingStop(buildEditKey(keyPrefix, currentCode)).catch(() => null);
      }

      if (kind === 'role') {
        await Promise.all([loadRoles(), refreshOverviewAnalytics()]);
      } else {
        await Promise.all([loadOffices(), refreshOverviewAnalytics()]);
      }
      renderUtilizationTimeline();
      log(kind === 'role' ? (isNew ? 'Role created' : 'Role updated') : (isNew ? 'Office created' : 'Office updated'), payload);
    } catch (error) {
      log(kind === 'role' ? (isNew ? 'Create role failed' : 'Update role failed') : (isNew ? 'Create office failed' : 'Update office failed'), error);
    }
  };

  el.rolesList.addEventListener('submit', (event) => onLookupListSubmit(event, 'role'));
  el.officesList.addEventListener('submit', (event) => onLookupListSubmit(event, 'office'));

  el.newPersonArea.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('person-edit-form')) {
      return;
    }
    event.preventDefault();
    if (!ensureEditable()) {
      return;
    }
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') || '').trim(),
      primaryRoleCode: String(data.get('primaryRoleCode') || '').trim(),
      office: String(data.get('office') || '').trim(),
      weeklyCapacityHours: Number(data.get('weeklyCapacityHours')),
      workingDays: getWorkingDays(String(data.get('workingDays') || '')),
      isActive: String(data.get('isActive') || 'true') === 'true',
      expectedUpdatedAt: String(data.get('expectedUpdatedAt') || '') || undefined
    };
    try {
      const result = await fetchJson('/api/v1/people', { method: 'POST', body: JSON.stringify(payload) });
      log('Person created', result);
      form.closest('.person-row')?.remove();
      await Promise.all([loadPeople(), refreshOverviewAnalytics()]);
    } catch (error) {
      log('Create person failed', error);
    }
  });

  el.utilizationTimeline.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('person-edit-form')) {
      return;
    }
    event.preventDefault();
    if (!ensureEditable()) {
      return;
    }
    const data = new FormData(form);
    const personId = String(data.get('personId') || '');
    if (!personId) {
      return;
    }
    const payload = {
      name: String(data.get('name') || '').trim(),
      primaryRoleCode: String(data.get('primaryRoleCode') || '').trim(),
      office: String(data.get('office') || '').trim(),
      weeklyCapacityHours: Number(data.get('weeklyCapacityHours')),
      workingDays: getWorkingDays(String(data.get('workingDays') || '')),
      isActive: String(data.get('isActive') || 'true') === 'true',
      expectedUpdatedAt: String(data.get('expectedUpdatedAt') || '') || undefined
    };
    try {
      const result = await fetchJson(`/api/v1/people/${personId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      log('Person updated', result);
      state.expandedPersonIds = state.expandedPersonIds.filter((id) => id !== personId);
      announceEditingStop(buildEditKey('person', personId)).catch(() => null);
      await Promise.all([loadPeople(), refreshOverviewAnalytics()]);
    } catch (error) {
      log('Update person failed', error);
    }
  });

  el.overviewProjectsList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (target.dataset.action === 'edit-project' && target.dataset.id) {
      if (!ensureEditable()) {
        return;
      }
      openProjectEditor(target.dataset.id);
      const editForm = el.overviewProjectsList.querySelector(`form.project-inline-form[data-project-id="${target.dataset.id}"]`);
      if (editForm instanceof HTMLFormElement) {
        updateProjectFormMilestonePreviews(editForm);
      }
      return;
    }

    if (target.dataset.action === 'cancel-project-edit') {
      closeProjectEditor();
      return;
    }

    if (target.dataset.action === 'cancel-project-create') {
      closeProjectCreator();
    }
  });

  el.roadmapProjectsList?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest('button');
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    if (button.dataset.action === 'edit-roadmap-date' && button.dataset.id) {
      if (!ensureEditable()) {
        return;
      }

      openRoadmapProjectEditorAtField(button.dataset.id, button.dataset.focusField || 'releaseDate');
      return;
    }

    if (button.dataset.action === 'open-roadmap-role-editor' && button.dataset.id && button.dataset.roleCode) {
      if (!ensureEditable()) {
        return;
      }

      openRoadmapRoleEditor(button.dataset.id, button.dataset.roleCode);
      return;
    }

    if (button.dataset.action === 'close-roadmap-role-editor') {
      closeRoadmapRoleEditor();
      return;
    }

    if (button.dataset.action === 'delete-roadmap-assignment' && button.dataset.assignmentId) {
      if (!ensureEditable()) {
        return;
      }

      fetchJson(`/api/v1/assignments/${button.dataset.assignmentId}`, { method: 'DELETE' })
        .then(() => Promise.all([loadAssignments(), refreshOverviewAnalytics()]))
        .then(() => {
          renderRoadmapProjects();
          log('Roadmap assignment removed', { assignmentId: button.dataset.assignmentId });
        })
        .catch((error) => log('Remove roadmap assignment failed', error));
      return;
    }

    if (button.dataset.action === 'edit-project' && button.dataset.id) {
      if (!ensureEditable()) {
        return;
      }
      openProjectEditor(button.dataset.id);
      const editForm = el.roadmapProjectsList.querySelector(`form.project-inline-form[data-project-id="${button.dataset.id}"]`);
      if (editForm instanceof HTMLFormElement) {
        updateProjectFormMilestonePreviews(editForm);
      }
      return;
    }

    if (button.dataset.action === 'cancel-project-edit') {
      closeProjectEditor();
      return;
    }
  });

  el.roadmapProjectsList?.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('roadmap-assignment-form')) {
      return;
    }

    event.preventDefault();
    if (!ensureEditable()) {
      return;
    }

    const formData = new FormData(form);
    const assignmentId = String(form.dataset.assignmentId || '');
    const payload = {
      personId: String(formData.get('personId') || ''),
      projectId: String(form.dataset.projectId || ''),
      roleCode: String(form.dataset.roleCode || ''),
      allocationPercent: Number(formData.get('allocationPercent')),
      startDate: String(formData.get('startDate') || ''),
      endDate: String(formData.get('endDate') || ''),
      expectedUpdatedAt: String(formData.get('expectedUpdatedAt') || '') || undefined
    };

    try {
      if (assignmentId) {
        await fetchJson(`/api/v1/assignments/${assignmentId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await fetchJson('/api/v1/assignments', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      await Promise.all([loadAssignments(), refreshOverviewAnalytics()]);
      renderRoadmapProjects();
      log(assignmentId ? 'Roadmap assignment updated' : 'Roadmap assignment created', payload);
    } catch (error) {
      log(assignmentId ? 'Update roadmap assignment failed' : 'Create roadmap assignment failed', error);
    }
  });

  el.overviewProjectsList.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const form = target.closest('form.project-inline-form');
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const changedField = target instanceof HTMLInputElement ? target.name : 'releaseDate';
    updateProjectFormMilestonePreviews(form, changedField);
  });

  el.roadmapProjectsList?.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const form = target.closest('form.project-inline-form');
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const changedField = target instanceof HTMLInputElement ? target.name : 'releaseDate';
    updateProjectFormMilestonePreviews(form, changedField);
  });

  el.overviewProjectsList.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('project-inline-form')) {
      return;
    }

    event.preventDefault();
    if (!ensureEditable()) {
      return;
    }
    const formData = new FormData(form);
    const isNew = form.dataset.new === 'true';

    try {
      let data;
      if (isNew) {
        const payload = {
          mode: 'blank',
          name: String(formData.get('name') || '').trim(),
          comments: String(formData.get('comments') || ''),
          releaseDate: String(formData.get('releaseDate') || ''),
          settingsOverride: {
            milestoneOffsets: {
              exclusiveLeadDays: weeksToDays(formData.get('exclusiveLeadWeeks')),
              certificationLeadDays: weeksToDays(formData.get('certificationLeadWeeks')),
              productionLengthDays: Math.max(1, weeksToDays(formData.get('productionLengthWeeks'))),
              preProductionLengthDays: weeksToDays(formData.get('preProductionLengthWeeks'))
            }
          }
        };
        data = await fetchJson('/api/v1/projects', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        log('Project created', data);
      } else {
        const projectId = String(form.dataset.projectId || '');
        const payload = {
          name: String(formData.get('name') || '').trim(),
          comments: String(formData.get('comments') || ''),
          releaseDate: String(formData.get('releaseDate') || ''),
          milestoneOffsetsDays: {
            exclusiveLeadDays: weeksToDays(formData.get('exclusiveLeadWeeks')),
            certificationLeadDays: weeksToDays(formData.get('certificationLeadWeeks')),
            productionLengthDays: Math.max(1, weeksToDays(formData.get('productionLengthWeeks'))),
            preProductionLengthDays: weeksToDays(formData.get('preProductionLengthWeeks'))
          },
          status: String(formData.get('status') || 'active'),
          expectedUpdatedAt: String(formData.get('expectedUpdatedAt') || '') || undefined
        };
        data = await fetchJson(`/api/v1/projects/${projectId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        log('Project updated', data);
      }

      await Promise.all([
        loadProjects(),
        loadAssignments(),
        refreshOverviewAnalytics()
      ]);
      closeProjectCreator();
      closeProjectEditor();
    } catch (error) {
      log(isNew ? 'Create project failed' : 'Update project failed', error);
    }
  });

  el.roadmapProjectsList?.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('project-inline-form')) {
      return;
    }

    event.preventDefault();
    if (!ensureEditable()) {
      return;
    }
    const formData = new FormData(form);
    const projectId = String(form.dataset.projectId || '');
    if (!projectId) {
      return;
    }

    try {
      const payload = {
        name: String(formData.get('name') || '').trim(),
        comments: String(formData.get('comments') || ''),
        releaseDate: String(formData.get('releaseDate') || ''),
        milestoneOffsetsDays: {
          exclusiveLeadDays: weeksToDays(formData.get('exclusiveLeadWeeks')),
          certificationLeadDays: weeksToDays(formData.get('certificationLeadWeeks')),
          productionLengthDays: Math.max(1, weeksToDays(formData.get('productionLengthWeeks'))),
          preProductionLengthDays: weeksToDays(formData.get('preProductionLengthWeeks'))
        },
        status: String(formData.get('status') || 'active'),
        expectedUpdatedAt: String(formData.get('expectedUpdatedAt') || '') || undefined
      };
      const data = await fetchJson(`/api/v1/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      log('Project updated', data);

      await Promise.all([
        loadProjects(),
        loadAssignments(),
        refreshOverviewAnalytics()
      ]);
      closeProjectEditor();
    } catch (error) {
      log('Update project failed', error);
    }
  });

  el.mappingsList.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (target.dataset.action === 'edit-mapping' && target.dataset.id) {
      if (!ensureEditable()) {
        return;
      }
      openMappingEditor(target.dataset.id);
      return;
    }

    if (target.dataset.action === 'delete-mapping' && target.dataset.id) {
      if (!ensureEditable()) {
        return;
      }
      const row = target.closest('.list-row');
      const sourceSheet = row?.querySelector('.list-cell')?.textContent?.trim() || target.dataset.id;
      const confirmed = await confirmProposedChange(`Delete mapping for source sheet ${sourceSheet}.`);
      if (!confirmed) {
        return;
      }

      try {
        await fetchJson(`/api/v1/mappings/${target.dataset.id}`, { method: 'DELETE' });
        log('Mapping deleted', { mappingId: target.dataset.id });
        await loadMappings();
        if (state.editingMappingId === target.dataset.id) {
          resetMappingEditor();
        }
      } catch (error) {
        log('Delete mapping failed', error);
      }
    }
  });

  el.usersList?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (target.dataset.action === 'knight-destroyer' && target.dataset.email) {
      const row = target.closest('.list-row-users');
      const expectedUpdatedAt = row instanceof HTMLElement ? String(row.dataset.updatedAt || '') : '';
      const confirmed = await confirmProposedChange(`Knight Destroyer for ${target.dataset.email}?`);
      if (!confirmed) {
        return;
      }

      try {
        await fetchJson(`/api/v1/admin/users/${encodeURIComponent(target.dataset.email)}/knight-destroyer`, {
          method: 'POST',
          body: JSON.stringify({ expectedUpdatedAt: expectedUpdatedAt || undefined })
        });
        announceEditingStop(buildEditKey('user', String(target.dataset.email || '').toLowerCase())).catch(() => null);
        await Promise.all([loadUsers(), loadAuditLog(), loadCurrentUser()]);
        log('User upgraded to Destroyer', { email: target.dataset.email });
      } catch (error) {
        log('Knight Destroyer failed', error);
      }
      return;
    }

    if (target.dataset.action === 'save-user' && target.dataset.email) {
      const row = target.closest('.list-row-users');
      if (!(row instanceof HTMLElement)) {
        return;
      }

      const nicknameInput = row.querySelector('input[data-field="nickname"]');
      const accessSelect = row.querySelector('select[data-field="accessLevel"]');
      if (!(nicknameInput instanceof HTMLInputElement) || !(accessSelect instanceof HTMLSelectElement)) {
        return;
      }

      const payload = {
        nickname: nicknameInput.value.trim(),
        accessLevel: accessSelect.value,
        expectedUpdatedAt: String(row.dataset.updatedAt || '') || undefined
      };

      try {
        await fetchJson(`/api/v1/admin/users/${encodeURIComponent(target.dataset.email)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        announceEditingStop(buildEditKey('user', String(target.dataset.email || '').toLowerCase())).catch(() => null);
        await Promise.all([loadUsers(), loadAuditLog(), loadCurrentUser()]);
        log('User updated', { email: target.dataset.email, ...payload });
      } catch (error) {
        log('Update user failed', error);
      }
    }
  });

  el.usersList?.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const row = target.closest('.list-row-users');
    if (!(row instanceof HTMLElement)) {
      return;
    }

    const email = String(row.dataset.email || '').toLowerCase();
    if (!email) {
      return;
    }

    announceEditingStart(buildEditKey('user', email)).catch(() => null);
  });

  el.usersList?.addEventListener('focusout', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const row = target.closest('.list-row-users');
    if (!(row instanceof HTMLElement)) {
      return;
    }

    const email = String(row.dataset.email || '').toLowerCase();
    if (!email) {
      return;
    }

    window.setTimeout(() => {
      if (row.contains(document.activeElement)) {
        return;
      }
      announceEditingStop(buildEditKey('user', email)).catch(() => null);
    }, 0);
  });

  const onTimelineClick = async (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof Element)) {
      return;
    }

    const target = rawTarget.closest('button');
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (target.dataset.action === 'expand-person' && target.dataset.id) {
      togglePersonExpanded(target.dataset.id);
      return;
    }

    if (target.dataset.action === 'collapse-person' && target.dataset.id) {
      togglePersonExpanded(target.dataset.id);
      return;
    }

    if (target.dataset.action === 'delete-person' && target.dataset.id) {
      if (!ensureEditable()) {
        return;
      }
      const personId = target.dataset.id;
      const person = state.people.find((p) => p.id === personId);
      const name = person?.name ?? 'this person';
      if (!confirm(`Delete ${name}? This cannot be undone. Remove all their project assignments first.`)) {
        return;
      }
      fetchJson(`/api/v1/people/${personId}`, { method: 'DELETE' })
        .then(() => {
          state.expandedPersonIds = state.expandedPersonIds.filter((id) => id !== personId);
          announceEditingStop(buildEditKey('person', personId)).catch(() => null);
          return Promise.all([loadPeople(), refreshOverviewAnalytics()]);
        })
        .catch((error) => log('Delete person failed', error));
      return;
    }

    if (target.dataset.action === 'toggle-project-row' && target.dataset.projectId) {
      toggleProjectRowExpanded(target.dataset.projectId);
      return;
    }

    if (target.dataset.action === 'open-project-assignment-editor' && target.dataset.projectId) {
      if (!ensureEditable()) {
        return;
      }
      openProjectAssignmentEditor(target.dataset.projectId);
      return;
    }

    if (target.dataset.action === 'cancel-project-assignment-editor') {
      closeProjectAssignmentEditor();
      return;
    }

    if (target.dataset.action === 'edit-project-assignment' && target.dataset.assignmentId && target.dataset.projectId) {
      if (!ensureEditable()) {
        return;
      }
      openProjectAssignmentEditor(target.dataset.projectId, target.dataset.assignmentId);
      return;
    }

    if (target.dataset.action === 'delete-project-assignment' && target.dataset.assignmentId) {
      if (!ensureEditable()) {
        return;
      }
      const row = target.closest('.project-person-row');
      const personName = row?.querySelector('strong')?.textContent?.trim() || target.dataset.assignmentId;
      const projectId = target.dataset.projectId || target.closest('.project-assignment-form')?.dataset.projectId || '';
      const confirmed = await confirmProposedChange(`Remove assignment for ${personName}${projectId ? `\nProject: ${projectId}` : ''}.`);
      if (!confirmed) {
        return;
      }

      try {
        await fetchJson(`/api/v1/assignments/${target.dataset.assignmentId}`, { method: 'DELETE' });
        await Promise.all([
          loadAssignments(),
          refreshOverviewAnalytics()
        ]);
        log('Assignment removed from expanded project', { assignmentId: target.dataset.assignmentId });
      } catch (error) {
        log('Remove expanded project assignment failed', error);
      }
      return;
    }

    if (target.dataset.action === 'save-project-assignment') {
      if (!ensureEditable()) {
        return;
      }
      const form = target.closest('.project-assignment-form');
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      const formData = new FormData(form);
      const assignmentId = String(form.dataset.assignmentId || '');
      const payload = {
        personId: String(formData.get('personId') || ''),
        projectId: String(form.dataset.projectId || ''),
        roleCode: String(formData.get('roleCode') || '').trim(),
        allocationPercent: Number(formData.get('allocationPercent')),
        startDate: String(formData.get('startDate') || ''),
        endDate: String(formData.get('endDate') || ''),
        expectedUpdatedAt: String(formData.get('expectedUpdatedAt') || '') || undefined
      };

      try {
        if (assignmentId) {
          await fetchJson(`/api/v1/assignments/${assignmentId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
          });
        } else {
          await fetchJson('/api/v1/assignments', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }

        await Promise.all([
          loadAssignments(),
          refreshOverviewAnalytics()
        ]);
        closeProjectAssignmentEditor();
        log(assignmentId ? 'Assignment updated in expanded project' : 'Assignment created in expanded project', payload);
      } catch (error) {
        log(assignmentId ? 'Update expanded project assignment failed' : 'Create expanded project assignment failed', error);
      }

      return;
    }

    const weekStart = target.dataset.weekStart;
    if (!weekStart) {
      return;
    }

    const start = new Date(`${weekStart}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const weekEnd = end.toISOString().slice(0, 10);

    if (target.dataset.timeline === 'person' && target.dataset.personId) {
      const personId = target.dataset.personId;
      const projectIds = getProjectIdsForPersonWeek(personId, weekStart);
      if (!projectIds.length) {
        return;
      }

      state.expandedProjectIds = projectIds;
      state.projectAssignmentEditor = null;
      state.projectAssignmentDateSelection = null;
      setActiveView('heatmap', { updateHistory: true });
      renderProjectUtilizationTimeline({ preservePosition: true });
      log('Opened project overview from personnel week', {
        personId,
        weekStart,
        expandedProjects: projectIds.length
      });
      return;
    }

    if (target.dataset.timeline === 'project' && target.dataset.projectId) {
      const projectId = target.dataset.projectId;
      if (applyWeekToSelectedAssignmentDate(projectId, weekStart, weekEnd)) {
        log('Project week applied to selected date field', {
          projectId,
          weekStart,
          weekEnd,
          fieldName: state.projectAssignmentDateSelection?.fieldName || ''
        });
      }
      return;
    }
  };

  el.utilizationTimeline.addEventListener('click', onTimelineClick);
  el.projectUtilizationTimeline.addEventListener('click', onTimelineClick);

  window.addEventListener('beforeunload', () => {
    [...localEditingKeys.values()].forEach((key) => {
      fetch(`/api/v1/collab/editing/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          ...(state.csrfToken ? { 'x-csrf-token': state.csrfToken } : {})
        },
        keepalive: true
      });
    });
  });

  window.addEventListener('popstate', () => {
    setActiveView(getViewFromLocation(), { updateHistory: false });
  });
  window.addEventListener('hashchange', () => {
    setActiveView(getViewFromLocation(), { updateHistory: false });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (closeConfirmDialog(false)) {
        return;
      }
      closeConflictDialog();
      setSettingsPanelOpen(false);
    }
  });
};

initializeThemeMode();
setHeatmapDensity(localStorage.getItem(HEATMAP_DENSITY_KEY));
setPersonnelDensity(localStorage.getItem(PERSONNEL_DENSITY_KEY));
syncProjectOverviewFilterButtons();
syncPlanningVisibility();
syncAccessRequestButton();
syncEditingVisibility();

bindForms();
bindButtons();
setActiveView(getViewFromLocation(), { updateHistory: true, replaceHistory: true });
resetMappingEditor();
initializeGoogleAuth().then(refreshAll).catch((error) => {
  log('Google auth init failed', error);
  clearDataViews();
  redirectToLogin('required');
});
