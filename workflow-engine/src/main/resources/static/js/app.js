// ===== STATE =====
const API = '/api';
let currentUser = null;
let currentPage = 'execute';
let workflowsData = { content: [], totalPages: 0, totalElements: 0, currentPage: 0 };
let searchTimeout = null;
let _stepCounter = 0;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    const stored = sessionStorage.getItem('wf_user');
    if (stored) { try { currentUser = JSON.parse(stored); } catch(e) { currentUser = null; } }
    renderApp();
    navigate(currentUser ? 'dashboard' : 'execute');
});

function isAdmin() { return currentUser && currentUser.role === 'admin'; }

function doLogout() {
    currentUser = null;
    sessionStorage.removeItem('wf_user');
    renderApp();
    navigate('execute');
}

async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    if (!username || !password) { errEl.innerHTML = alertHtml('error', 'Please enter credentials.'); return; }
    try {
        const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: jsonH(), body: JSON.stringify({ username, password }) });
        const data = await res.json();
        if (data.success) {
            currentUser = data;
            sessionStorage.setItem('wf_user', JSON.stringify(data));
            closeModal('login-modal');
            renderApp();
            navigate('dashboard');
        } else {
            errEl.innerHTML = alertHtml('error', data.message || 'Invalid credentials.');
        }
    } catch (e) { errEl.innerHTML = alertHtml('error', 'Unable to connect to server.'); }
}

function openLoginModal() {
    showModal('login-modal', `
        <div class="modal-header"><h3>Admin Login</h3><button class="modal-close" onclick="closeModal('login-modal')">&times;</button></div>
        <div class="modal-body">
            <div id="login-error"></div>
            <div class="form-group"><label class="form-label">Username <span class="required">*</span></label>
                <input class="form-control" id="login-username" placeholder="admin" autocomplete="username" /></div>
            <div class="form-group"><label class="form-label">Password <span class="required">*</span></label>
                <input class="form-control" id="login-password" type="password" placeholder="admin123" autocomplete="current-password" /></div>
            <div class="hint-box">Default credentials: <strong>admin</strong> / <strong>admin123</strong></div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal('login-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="doLogin()">Sign In</button>
        </div>`, 'modal-sm');
    setTimeout(() => {
        const pw = document.getElementById('login-password');
        if (pw) pw.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    }, 80);
}

// ===== SHELL =====
function renderApp() {
    const navItems = isAdmin()
        ? [{ page:'dashboard',label:'Dashboard',ico:'grid' },{ page:'workflows',label:'Workflows',ico:'workflow' },{ page:'execute',label:'Execute',ico:'play' },{ page:'audit',label:'Audit Log',ico:'log' }]
        : [{ page:'execute',label:'Execute',ico:'play' }];

    document.getElementById('root').innerHTML = `
        <div class="app-layout">
            <aside class="sidebar">
                <div class="sidebar-logo"><div class="logo-title">WorkflowEngine</div><div class="logo-sub">Halleyx Platform</div></div>
                <nav class="sidebar-nav">
                    ${navItems.map(n => `<a class="nav-item" data-page="${n.page}" onclick="navigate('${n.page}')">${icon(n.ico)}<span>${n.label}</span></a>`).join('')}
                </nav>
                <div class="sidebar-footer">
                    ${isAdmin() ? `<div class="admin-badge">${icon('shield')}<span>Admin</span></div>` : ''}
                    ${isAdmin()
                        ? `<a class="nav-item danger-nav" onclick="doLogout()">${icon('logout')}<span>Logout</span></a>`
                        : `<a class="nav-item" onclick="openLoginModal()">${icon('shield')}<span>Admin Login</span></a>`}
                </div>
            </aside>
            <div class="main-content">
                <div class="topbar">
                    <span class="topbar-title" id="topbar-title">Execute Workflow</span>
                    <div class="topbar-actions">
                        ${isAdmin() ? `<button class="btn btn-primary btn-sm" onclick="navigate('workflows');setTimeout(()=>openCreateWorkflowModal(),200)">${icon('plus')} New Workflow</button>` : ''}
                        <span class="user-chip">${isAdmin() ? `${esc(currentUser.username)} <span class="chip-role">Admin</span>` : 'Guest'}</span>
                    </div>
                </div>
                <div class="page-content" id="page-content"></div>
            </div>
        </div>`;
}

function navigate(page) {
    if (!isAdmin() && page !== 'execute') page = 'execute';
    currentPage = page;
    document.querySelectorAll('.nav-item[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    const titles = { dashboard:'Dashboard', workflows:'Workflows', execute:'Execute Workflow', audit:'Audit Log' };
    const el = document.getElementById('topbar-title');
    if (el) el.textContent = titles[page] || page;
    const pages = { dashboard:renderDashboard, workflows:renderWorkflows, execute:renderExecutePage, audit:renderAuditLog };
    if (pages[page]) pages[page]();
}

// ===== DASHBOARD =====
async function renderDashboard() {
    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="loading-text">Loading...</div>';
    try {
        const [wfRes, exRes] = await Promise.all([fetch(`${API}/workflows?size=5`), fetch(`${API}/executions?size=5`)]);
        const wfData = await wfRes.json();
        const exData = await exRes.json();
        const wfs = wfData.content || [];
        const exs = exData.content || [];
        content.innerHTML = `
            <div class="stats-row">
                <div class="stat-card"><div class="stat-label">Total Workflows</div><div class="stat-value">${wfData.totalElements||0}</div><div class="stat-sub">All versions</div></div>
                <div class="stat-card"><div class="stat-label">Active</div><div class="stat-value" style="color:#16a34a">${wfs.filter(w=>w.isActive).length}</div><div class="stat-sub">Enabled</div></div>
                <div class="stat-card"><div class="stat-label">Total Executions</div><div class="stat-value">${exData.totalElements||0}</div><div class="stat-sub">All time</div></div>
                <div class="stat-card"><div class="stat-label">Completed</div><div class="stat-value" style="color:#2563eb">${exs.filter(e=>e.status==='completed').length}</div><div class="stat-sub">Recent 5</div></div>
            </div>
            <div class="two-col-grid">
                <div class="card">
                    <div class="card-header"><h2>Recent Workflows</h2><a class="btn btn-ghost btn-sm" onclick="navigate('workflows')">View All</a></div>
                    <div class="table-container"><table><thead><tr><th>Name</th><th>Version</th><th>Status</th></tr></thead><tbody>
                        ${wfs.length ? wfs.map(w=>`<tr><td><strong>${esc(w.name)}</strong></td><td>v${w.version}</td><td><span class="badge badge-${w.isActive?'active':'inactive'}">${w.isActive?'Active':'Inactive'}</span></td></tr>`).join('') : '<tr><td colspan="3" class="empty-cell">No workflows</td></tr>'}
                    </tbody></table></div>
                </div>
                <div class="card">
                    <div class="card-header"><h2>Recent Executions</h2><a class="btn btn-ghost btn-sm" onclick="navigate('audit')">View All</a></div>
                    <div class="table-container"><table><thead><tr><th>Workflow</th><th>Status</th><th>By</th></tr></thead><tbody>
                        ${exs.length ? exs.map(e=>`<tr><td><strong>${esc(e.workflowName||'')}</strong></td><td><span class="badge badge-${e.status}">${e.status}</span></td><td class="text-muted">${esc(e.triggeredBy||'')}</td></tr>`).join('') : '<tr><td colspan="3" class="empty-cell">No executions</td></tr>'}
                    </tbody></table></div>
                </div>
            </div>`;
    } catch(e) { content.innerHTML = alertHtml('error','Failed to load dashboard.'); }
}

// ===== WORKFLOWS PAGE =====
async function renderWorkflows(page=0, search='') {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="page-header">
            <div><h1>Workflows</h1><p>Manage and configure workflow definitions</p></div>
            <button class="btn btn-primary" onclick="openCreateWorkflowModal()">${icon('plus')} Create Workflow</button>
        </div>
        <div class="card">
            <div class="card-body" style="padding-bottom:0">
                <div class="search-bar">
                    <div class="search-input-wrap">${icon('search')}<input class="form-control" id="wf-search" placeholder="Search workflows..." value="${esc(search)}" oninput="debounceSearch(this.value)" /></div>
                </div>
            </div>
            <div class="table-container" id="wf-table-container"><div class="loading-text" style="padding:20px">Loading...</div></div>
            <div id="wf-pagination"></div>
        </div>`;
    await loadWorkflowsTable(page, search);
}

async function loadWorkflowsTable(page=0, search='') {
    try {
        const params = new URLSearchParams({ page, size:10 });
        if (search) params.append('search', search);
        const data = await fetchJSON(`${API}/workflows?${params}`);
        workflowsData = data;
        const wfs = data.content || [];
        const container = document.getElementById('wf-table-container');
        if (!container) return;
        if (!wfs.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('workflow')}</div><h3>No workflows found</h3><p>Create your first workflow to get started.</p></div>`;
            document.getElementById('wf-pagination').innerHTML = '';
            return;
        }
        container.innerHTML = `<table><thead><tr><th>Name</th><th>Steps</th><th>Version</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            ${wfs.map(w=>`<tr>
                <td><strong>${esc(w.name)}</strong></td>
                <td class="text-muted">${(w.steps||[]).length}</td>
                <td class="text-muted">v${w.version}</td>
                <td><span class="badge badge-${w.isActive?'active':'inactive'}">${w.isActive?'Active':'Inactive'}</span></td>
                <td><div class="action-btns">
                    <button class="btn btn-secondary btn-sm" onclick="openViewWorkflow('${w.id}')">${icon('eye')} View</button>
                    <button class="btn btn-secondary btn-sm" onclick="openEditWorkflowModal('${w.id}')">${icon('edit')} Edit</button>
                    <button class="btn btn-${w.isActive?'warning':'success'} btn-sm" onclick="toggleWorkflow('${w.id}',${!w.isActive})">${w.isActive?'Deactivate':'Activate'}</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDelete('${w.id}','${esc(w.name)}')">${icon('trash')}</button>
                    <button class="btn btn-primary btn-sm" onclick="navigate('execute');setTimeout(()=>selectWorkflowForExecution('${w.id}'),200)">${icon('play')} Execute</button>
                </div></td>
            </tr>`).join('')}
        </tbody></table>`;
        renderPagination('wf-pagination', page, data.totalPages, data.totalElements, p => loadWorkflowsTable(p, search));
    } catch(e) {
        const c = document.getElementById('wf-table-container');
        if (c) c.innerHTML = alertHtml('error','Failed to load workflows.','margin:16px');
    }
}

function debounceSearch(val) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadWorkflowsTable(0, val), 300);
}

// ===== CREATE WORKFLOW =====
function openCreateWorkflowModal() {
    _stepCounter = 0;
    showModal('create-wf-modal', `
        <div class="modal-header">
            <h3>Create Workflow</h3>
            <button class="modal-close" onclick="closeModal('create-wf-modal')">&times;</button>
        </div>
        <div class="modal-body">
            <div id="cwf-alert"></div>

            <div class="cwf-section">
                <div class="cwf-section-label">
                    <span class="cwf-step-num">1</span>
                    <strong>Workflow Name</strong>
                    <span class="cwf-section-hint">Give your workflow a clear descriptive name</span>
                </div>
                <div class="form-group" style="margin:0">
                    <input class="form-control" id="cwf-name" placeholder="e.g. Expense Approval" value="Expense Approval" />
                </div>
            </div>

            <div class="cwf-section">
                <div class="cwf-section-label">
                    <span class="cwf-step-num">2</span>
                    <strong>Input Fields</strong>
                    <span class="cwf-section-hint">What data will users enter when running this workflow?</span>
                </div>
                <div class="cwf-tip-box">
                    <strong>Tip:</strong> Field names must match what you use in rules exactly.
                    If you name a field <code>amount</code>, write <code>amount >= 1000</code> in your rules.
                    <strong>Allowed Values</strong> (optional) creates a dropdown for the user — leave blank for free text input.
                </div>
                <div class="schema-header-row">
                    <span>Field Name</span><span>Type</span><span>Required?</span><span>Allowed Values (comma-separated, optional)</span><span></span>
                </div>
                <div id="schema-fields-list"></div>
                <button class="btn btn-secondary btn-sm" style="margin-top:6px" onclick="addSchemaField(null,'schema-fields-list')">${icon('plus')} Add Field</button>
            </div>

            <div class="cwf-section" style="border-bottom:none;padding-bottom:0">
                <div class="cwf-section-label">
                    <span class="cwf-step-num">3</span>
                    <strong>Steps &amp; Rules</strong>
                    <span class="cwf-section-hint">Define what happens and how the workflow moves forward</span>
                </div>
                <div class="cwf-tip-box">
                    <strong>How rules work:</strong>
                    Rules in each step are evaluated <strong>top to bottom</strong>. The first rule that matches decides the next step.
                    Always add a <code>DEFAULT</code> rule at the bottom as a fallback catch-all.
                    Set <em>Next Step</em> to a step name to go there, or leave it blank to <strong>end the workflow</strong>.
                    <br><br>
                    <strong>Condition examples:</strong>
                    &nbsp;<code>amount >= 1000</code>
                    &nbsp;<code>department == 'HR'</code>
                    &nbsp;<code>amount > 500 &amp;&amp; priority == 'High'</code>
                    &nbsp;<code>DEFAULT</code>
                </div>
                <div id="cwf-steps-list"></div>
                <button class="btn btn-secondary btn-sm" style="margin-top:6px" onclick="addStepRow()">${icon('plus')} Add Step</button>
            </div>
        </div>
        <div class="modal-footer">
            <span style="font-size:12px;color:var(--gray-400);flex:1">All steps and rules are saved together when you click Create.</span>
            <button class="btn btn-secondary" onclick="closeModal('create-wf-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="submitCreateWorkflow()">${icon('plus')} Create Workflow</button>
        </div>`, 'modal-xl');

    // Pre-fill realistic example fields
    addSchemaField({ name:'amount',     type:'number', required:true  }, 'schema-fields-list');
    addSchemaField({ name:'department', type:'string', required:true,  allowed_values:['HR','Finance','Engineering','Marketing'] }, 'schema-fields-list');
    addSchemaField({ name:'priority',   type:'string', required:false, allowed_values:['High','Medium','Low'] }, 'schema-fields-list');

    // Pre-fill 2 example steps
    addStepRow({ name:'Manager Approval', stepType:'approval', rules:[
        { conditionExpr:'amount >= 1000', nextUid:'sr_2' },
        { conditionExpr:'DEFAULT',        nextUid:'' }
    ]});
    addStepRow({ name:'Finance Review', stepType:'notification', rules:[
        { conditionExpr:'DEFAULT', nextUid:'' }
    ]});
}

function addSchemaField(existing, listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'schema-field-row';
    div.innerHTML = `
        <input class="form-control sf-name" placeholder="e.g. amount" />
        <select class="form-control sf-type">
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
        </select>
        <select class="form-control sf-required">
            <option value="true">required</option>
            <option value="false">optional</option>
        </select>
        <input class="form-control sf-values" placeholder="e.g. High,Medium,Low" />
        <button type="button" class="btn btn-ghost btn-sm icon-btn-danger" onclick="this.closest('.schema-field-row').remove()">${icon('trash')}</button>`;
    list.appendChild(div);
    // Set values programmatically AFTER append so browser reflects them in .value
    if (existing) {
        div.querySelector('.sf-name').value        = existing.name        || '';
        div.querySelector('.sf-type').value        = existing.type        || 'string';
        div.querySelector('.sf-required').value    = existing.required === false ? 'false' : 'true';
        div.querySelector('.sf-values').value      = existing.allowed_values ? existing.allowed_values.join(',') : '';
    }
}

function readSchema(listId) {
    const schema = {};
    document.querySelectorAll(`#${listId} .schema-field-row`).forEach(row => {
        const name = row.querySelector('.sf-name')?.value.trim();
        if (!name) return;
        const type = row.querySelector('.sf-type')?.value || 'string';
        const required = row.querySelector('.sf-required')?.value === 'true';
        const vals = row.querySelector('.sf-values')?.value.trim();
        const fd = { type, required };
        if (vals) fd.allowed_values = vals.split(',').map(v=>v.trim()).filter(Boolean);
        schema[name] = fd;
    });
    return schema;
}

// Each step row holds its own ID in data-step-uid for next-step dropdowns
function addStepRow(existing) {
    _stepCounter++;
    const uid = 'sr_' + _stepCounter;
    const list = document.getElementById('cwf-steps-list');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'step-builder-row';
    div.dataset.uid = uid;
    div.innerHTML = `
        <div class="step-builder-header">
            <div class="step-uid-badge">Step #${_stepCounter} <span class="step-uid-text">ID: ${uid}</span></div>
            <button type="button" class="btn btn-ghost btn-sm icon-btn-danger" onclick="removeStepRow('${uid}')">${icon('trash')} Remove</button>
        </div>
        <div class="step-builder-fields">
            <div class="form-group" style="flex:2;margin:0">
                <label class="form-label">Step Name <span class="required">*</span></label>
                <input class="form-control step-name-input" placeholder="e.g. Manager Approval"
                    oninput="refreshNextStepDropdowns()" />
            </div>
            <div class="form-group" style="width:160px;margin:0">
                <label class="form-label">Type</label>
                <select class="form-control step-type-input">
                    <option value="approval">Approval</option>
                    <option value="notification">Notification</option>
                    <option value="task">Task</option>
                </select>
            </div>
        </div>
        <div class="step-rules-section">
            <div class="step-rules-header">
                <span class="step-rules-label">Rules</span>
                <button type="button" class="btn btn-ghost btn-sm" onclick="addRuleToStep('${uid}')">${icon('plus')} Add Rule</button>
            </div>
            <div class="rule-cols-header">
                <span>Condition (e.g. <code>amount >= 100</code> or <code>DEFAULT</code>)</span>
                <span>Next Step (blank = END)</span>
                <span></span>
            </div>
            <div class="step-rules-list" id="rules_${uid}"></div>
        </div>`;
    list.appendChild(div);
    // Set values programmatically AFTER append so browser .value reflects them
    if (existing) {
        div.querySelector('.step-name-input').value = existing.name     || '';
        div.querySelector('.step-type-input').value = existing.stepType || 'approval';
    }
    if (existing && existing.rules) {
        existing.rules.forEach(r => addRuleToStep(uid, r));
    }
    refreshNextStepDropdowns();
    // After refresh, restore any pre-fill nextUid selections
    if (existing && existing.rules) {
        const ruleRows = document.querySelectorAll('#rules_' + uid + ' .rule-input-row');
        existing.rules.forEach((r, i) => {
            if (r.nextUid && ruleRows[i]) {
                const sel = ruleRows[i].querySelector('.rule-next-step-select');
                if (sel) sel.value = r.nextUid;
            }
        });
    }
}

function removeStepRow(uid) {
    const el = document.querySelector(`[data-uid="${uid}"]`);
    if (el) el.remove();
    refreshNextStepDropdowns();
}

// Rebuild all next-step dropdowns whenever steps change
function refreshNextStepDropdowns() {
    const steps = [];
    document.querySelectorAll('#cwf-steps-list .step-builder-row').forEach(row => {
        const uid = row.dataset.uid;
        const name = row.querySelector('.step-name-input')?.value.trim() || '(unnamed)';
        steps.push({ uid, name });
    });
    document.querySelectorAll('.rule-next-step-select').forEach(sel => {
        const prev = sel.value;
        sel.innerHTML = `<option value="">— END (finish workflow) —</option>` +
            steps.map(s=>`<option value="${s.uid}" ${prev===s.uid?'selected':''}>${esc(s.name)}</option>`).join('');
    });
}

function addRuleToStep(uid, existing) {
    const list = document.getElementById('rules_' + uid);
    if (!list) return;
    const steps = [];
    document.querySelectorAll('#cwf-steps-list .step-builder-row').forEach(row => {
        const rUid = row.dataset.uid;
        const name = row.querySelector('.step-name-input')?.value.trim() || '(unnamed)';
        steps.push({ uid: rUid, name });
    });
    const div = document.createElement('div');
    div.className = 'rule-input-row';
    div.innerHTML = `
        <input class="form-control rule-condition-input" placeholder='e.g.  amount >= 100   or   DEFAULT' />
        <select class="form-control rule-next-step-select">
            <option value="">— END (finish workflow) —</option>
            ${steps.map(s=>`<option value="${s.uid}">${esc(s.name)}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-ghost btn-sm icon-btn-danger" onclick="this.closest('.rule-input-row').remove()">${icon('trash')}</button>`;
    list.appendChild(div);
    // Set condition value programmatically after append
    if (existing) {
        div.querySelector('.rule-condition-input').value = existing.conditionExpr || '';
    }
}

async function submitCreateWorkflow() {
    const name = document.getElementById('cwf-name').value.trim();
    const alertEl = document.getElementById('cwf-alert');
    alertEl.innerHTML = '';
    if (!name) { alertEl.innerHTML = alertHtml('error','Workflow name is required.'); return; }

    const schema = readSchema('schema-fields-list');
    let wf;
    try {
        const res = await fetch(`${API}/workflows`, { method:'POST', headers:jsonH(), body:JSON.stringify({ name, inputSchema:JSON.stringify(schema) }) });
        if (!res.ok) { const e = await res.json().catch(()=>{}); alertEl.innerHTML = alertHtml('error', e?.error || e?.message || `Server error (${res.status}): ${res.statusText}`); return; }
        wf = await res.json();
    } catch(e) { alertEl.innerHTML = alertHtml('error',`Network error: ${e.message}`); return; }

    // Create steps — collect uid→step mapping
    const uidToStep = {};
    const stepRows = document.querySelectorAll('#cwf-steps-list .step-builder-row');
    let order = 1;
    for (const row of stepRows) {
        const uid = row.dataset.uid;
        const stepName = row.querySelector('.step-name-input')?.value.trim();
        const stepType = row.querySelector('.step-type-input')?.value || 'task';
        if (!stepName) continue;
        try {
            const res = await fetch(`${API}/workflows/${wf.id}/steps`, { method:'POST', headers:jsonH(), body:JSON.stringify({ name:stepName, stepType, stepOrder:order++ }) });
            if (!res.ok) continue;
            const step = await res.json();
            uidToStep[uid] = step;
        } catch(e) { /* skip */ }
    }

    // Create rules — resolve uid → real step ID
    for (const row of stepRows) {
        const uid = row.dataset.uid;
        const step = uidToStep[uid];
        if (!step) continue;
        let priority = 1;
        for (const ruleRow of row.querySelectorAll('.rule-input-row')) {
            const cond = ruleRow.querySelector('.rule-condition-input')?.value.trim();
            const nextUid = ruleRow.querySelector('.rule-next-step-select')?.value || '';
            if (!cond) continue;
            const nextStepId = nextUid && uidToStep[nextUid] ? uidToStep[nextUid].id : null;
            try {
                await fetch(`${API}/steps/${step.id}/rules`, { method:'POST', headers:jsonH(), body:JSON.stringify({ conditionExpr:cond, nextStepId, priority:priority++ }) });
            } catch(e) { /* skip */ }
        }
    }

    closeModal('create-wf-modal');
    showToast('Workflow created successfully!');
    loadWorkflowsTable(0, '');
}

// ===== VIEW WORKFLOW =====
async function openViewWorkflow(id) {
    try {
        const wf = await fetchJSON(`${API}/workflows/${id}`);
        const steps = wf.steps || [];
        const stepMap = {};
        steps.forEach(s => { stepMap[s.id] = s.name; });

        let schemaHtml = '';
        try {
            const schema = JSON.parse(wf.inputSchema || '{}');
            const entries = Object.entries(schema);
            if (entries.length) {
                schemaHtml = `<label class="form-label" style="margin-bottom:8px">Input Schema</label>
                <table class="info-table" style="margin-bottom:16px">
                    <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Allowed Values</th></tr></thead>
                    <tbody>${entries.map(([k,v])=>`<tr>
                        <td><strong>${esc(k)}</strong></td><td>${esc(v.type||'')}</td>
                        <td>${v.required?'<span style="color:#16a34a">Yes</span>':'No'}</td>
                        <td>${v.allowed_values?v.allowed_values.join(', '):'—'}</td>
                    </tr>`).join('')}</tbody>
                </table>`;
            }
        } catch(e) {}

        showModal('view-wf-modal', `
            <div class="modal-header"><h3>${esc(wf.name)}</h3><button class="modal-close" onclick="closeModal('view-wf-modal')">&times;</button></div>
            <div class="modal-body">
                <div class="wf-meta-row">
                    <span class="tag">v${wf.version}</span>
                    <span class="badge badge-${wf.isActive?'active':'inactive'}">${wf.isActive?'Active':'Inactive'}</span>
                    <span class="text-muted">${steps.length} step(s)</span>
                </div>
                ${schemaHtml}
                <label class="form-label">Steps &amp; Rules</label>
                ${steps.length ? steps.map((s,i)=>`
                    <div class="view-step-card">
                        <div class="view-step-header">
                            <span style="font-weight:600">${i+1}. ${esc(s.name)}</span>
                            <span class="badge badge-${s.stepType}">${s.stepType}</span>
                            <span class="step-id-chip" title="Step ID">${s.id}</span>
                        </div>
                        ${(s.rules||[]).length ? `
                        <table class="info-table">
                            <thead><tr><th style="width:50px">#</th><th>Condition</th><th>Next Step</th></tr></thead>
                            <tbody>${s.rules.map(r=>`<tr>
                                <td>${r.priority}</td>
                                <td><code>${esc(r.conditionExpr)}</code></td>
                                <td>${r.nextStepId
                                    ? (stepMap[r.nextStepId]
                                        ? `<span class="next-step-link">→ ${esc(stepMap[r.nextStepId])}</span>`
                                        : `<span class="text-muted">${r.nextStepId.substring(0,8)}…</span>`)
                                    : '<span class="end-badge">END</span>'}</td>
                            </tr>`).join('')}</tbody>
                        </table>` : '<p class="text-muted" style="padding:8px 12px;font-size:12px">No rules defined</p>'}
                    </div>`).join('') : '<p class="text-muted">No steps defined.</p>'}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('view-wf-modal');openEditWorkflowModal('${wf.id}')">${icon('edit')} Edit</button>
                <button class="btn btn-primary" onclick="closeModal('view-wf-modal');navigate('execute');setTimeout(()=>selectWorkflowForExecution('${wf.id}'),200)">${icon('play')} Execute</button>
            </div>`, 'modal-lg');
    } catch(e) { showToast('Failed to load workflow.','error'); }
}

// ===== EDIT WORKFLOW =====
async function openEditWorkflowModal(id) {
    try {
        const wf = await fetchJSON(`${API}/workflows/${id}`);
        let schemaFields = [];
        try { const s = JSON.parse(wf.inputSchema||'{}'); schemaFields = Object.entries(s).map(([k,v])=>({ name:k, type:v.type||'string', required:v.required!==false, allowed_values:v.allowed_values||null })); } catch(e) {}

        showModal('edit-wf-modal', `
            <div class="modal-header"><h3>Edit Workflow</h3><button class="modal-close" onclick="closeModal('edit-wf-modal')">&times;</button></div>
            <div class="modal-body">
                <div id="ewf-alert"></div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Workflow Name <span class="required">*</span></label>
                        <input class="form-control" id="ewf-name" value="${esc(wf.name)}" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select class="form-control" id="ewf-active">
                            <option value="true" ${wf.isActive?'selected':''}>Active</option>
                            <option value="false" ${!wf.isActive?'selected':''}>Inactive</option>
                        </select>
                    </div>
                </div>
                <hr class="divider"/>
                <div class="section-header">
                    <strong>Input Schema Fields</strong>
                    <button class="btn btn-secondary btn-sm" onclick="addSchemaField(null,'edit-schema-list')">${icon('plus')} Add Field</button>
                </div>
                <div class="schema-header-row"><span>Field Name</span><span>Type</span><span>Required?</span><span>Allowed Values</span><span></span></div>
                <div id="edit-schema-list">
                    ${schemaFields.map(f=>`
                    <div class="schema-field-row">
                        <input class="form-control sf-name" value="${esc(f.name)}" />
                        <select class="form-control sf-type">
                            <option value="string" ${f.type==='string'?'selected':''}>string</option>
                            <option value="number" ${f.type==='number'?'selected':''}>number</option>
                            <option value="boolean" ${f.type==='boolean'?'selected':''}>boolean</option>
                        </select>
                        <select class="form-control sf-required">
                            <option value="true" ${f.required!==false?'selected':''}>required</option>
                            <option value="false" ${f.required===false?'selected':''}>optional</option>
                        </select>
                        <input class="form-control sf-values" value="${f.allowed_values?f.allowed_values.join(','):''}" placeholder="a,b,c" />
                        <button type="button" class="btn btn-ghost btn-sm icon-btn-danger" onclick="this.closest('.schema-field-row').remove()">${icon('trash')}</button>
                    </div>`).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('edit-wf-modal')">Cancel</button>
                <button class="btn btn-secondary" onclick="closeModal('edit-wf-modal');openStepsEditor('${wf.id}','${esc(wf.name)}')">${icon('workflow')} Manage Steps</button>
                <button class="btn btn-primary" onclick="submitEditWorkflow('${wf.id}')">Save Changes</button>
            </div>`);
    } catch(e) { showToast('Failed to load workflow.','error'); }
}

async function submitEditWorkflow(id) {
    const name = document.getElementById('ewf-name').value.trim();
    const isActive = document.getElementById('ewf-active').value === 'true';
    const alertEl = document.getElementById('ewf-alert');
    if (!name) { alertEl.innerHTML = alertHtml('error','Name is required.'); return; }
    const inputSchema = JSON.stringify(readSchema('edit-schema-list'));
    try {
        const res = await fetch(`${API}/workflows/${id}`, { method:'PUT', headers:jsonH(), body:JSON.stringify({ name, isActive, inputSchema }) });
        if (!res.ok) throw new Error('Update failed');
        closeModal('edit-wf-modal');
        showToast('Workflow updated.');
        loadWorkflowsTable(workflowsData.currentPage||0, '');
    } catch(e) { alertEl.innerHTML = alertHtml('error','Update failed.'); }
}

// ===== STEPS EDITOR =====
async function openStepsEditor(workflowId, workflowName) {
    try {
        const steps = await fetchJSON(`${API}/workflows/${workflowId}/steps`);
        renderStepsEditorModal(workflowId, workflowName, steps);
    } catch(e) { showToast('Failed to load steps.','error'); }
}

function renderStepsEditorModal(workflowId, workflowName, steps) {
    showModal('steps-editor-modal', `
        <div class="modal-header"><h3>Manage Steps: ${esc(workflowName)}</h3><button class="modal-close" onclick="closeModal('steps-editor-modal')">&times;</button></div>
        <div class="modal-body">
            <p class="section-hint" style="margin-bottom:12px">Click <strong>Rules</strong> on any step to add/edit rules and set the next step using the dropdown.</p>
            <div id="steps-list">
                ${steps.length ? steps.map(s=>renderStepEditorRow(s, workflowId, workflowName, steps)).join('') : '<p class="text-muted">No steps yet.</p>'}
            </div>
            <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="openAddStepForm()">${icon('plus')} Add Step</button>
            <div id="add-step-form" class="hidden" style="margin-top:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px">
                <div class="form-row">
                    <div class="form-group" style="margin-bottom:8px"><label class="form-label">Step Name</label><input class="form-control" id="ns-name" placeholder="Step name" /></div>
                    <div class="form-group" style="margin-bottom:8px"><label class="form-label">Type</label>
                        <select class="form-control" id="ns-type"><option value="approval">Approval</option><option value="notification">Notification</option><option value="task">Task</option></select></div>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-primary btn-sm" onclick="submitAddStep('${workflowId}','${esc(workflowName)}')">Add Step</button>
                    <button class="btn btn-secondary btn-sm" onclick="document.getElementById('add-step-form').classList.add('hidden')">Cancel</button>
                </div>
            </div>
        </div>`, 'modal-lg');
}

function renderStepEditorRow(s, workflowId, workflowName, allSteps) {
    return `<div id="step-row-${s.id}" class="step-editor-row">
        <div class="step-editor-info">
            <strong>${esc(s.name)}</strong>
            <span class="badge badge-${s.stepType}">${s.stepType}</span>
            <span class="step-id-chip" title="Step ID — use this in rules">${s.id}</span>
        </div>
        <div class="action-btns">
            <button class="btn btn-secondary btn-sm" onclick="openRulesEditor('${s.id}','${esc(s.name)}','${workflowId}')">${icon('rule')} Rules (${(s.rules||[]).length})</button>
            <button class="btn btn-danger btn-sm" onclick="deleteStep('${s.id}')">${icon('trash')}</button>
        </div>
    </div>`;
}

function openAddStepForm() { document.getElementById('add-step-form').classList.remove('hidden'); }

async function submitAddStep(workflowId, workflowName) {
    const name = document.getElementById('ns-name').value.trim();
    const type = document.getElementById('ns-type').value;
    if (!name) { showToast('Step name is required.','error'); return; }
    try {
        const res = await fetch(`${API}/workflows/${workflowId}/steps`, { method:'POST', headers:jsonH(), body:JSON.stringify({ name, stepType:type, stepOrder:99 }) });
        if (!res.ok) throw new Error('Failed');
        showToast('Step added.');
        const steps = await fetchJSON(`${API}/workflows/${workflowId}/steps`);
        renderStepsEditorModal(workflowId, workflowName, steps);
    } catch(e) { showToast('Failed to add step.','error'); }
}

async function deleteStep(stepId) {
    if (!confirm('Delete this step and all its rules?')) return;
    try {
        await fetch(`${API}/steps/${stepId}`, { method:'DELETE' });
        const row = document.getElementById(`step-row-${stepId}`);
        if (row) row.remove();
        showToast('Step deleted.');
    } catch(e) { showToast('Failed to delete step.','error'); }
}

// ===== RULES EDITOR — key fix: dropdown of all workflow steps =====
async function openRulesEditor(stepId, stepName, workflowId) {
    try {
        const [rules, allSteps] = await Promise.all([
            fetchJSON(`${API}/steps/${stepId}/rules`),
            fetchJSON(`${API}/workflows/${workflowId}/steps`)
        ]);
        renderRulesEditorModal(stepId, stepName, workflowId, rules, allSteps);
    } catch(e) { showToast('Failed to load rules.','error'); }
}

function renderRulesEditorModal(stepId, stepName, workflowId, rules, allSteps) {
    // Other steps (not this one) available as next-step targets
    const otherSteps = allSteps.filter(s => s.id !== stepId);

    showModal('rules-editor-modal', `
        <div class="modal-header"><h3>Rules: ${esc(stepName)}</h3><button class="modal-close" onclick="closeModal('rules-editor-modal')">&times;</button></div>
        <div class="modal-body">
            <div class="info-box">
                <strong>How rules work:</strong> Evaluated by priority (lowest first). First match wins.
                Use <code>DEFAULT</code> as a catch-all fallback rule.<br>
                Operators: <code>==</code> <code>!=</code> <code>&lt;</code> <code>&gt;</code> <code>&lt;=</code> <code>&gt;=</code> <code>&amp;&amp;</code> <code>||</code> <code>contains(field,'x')</code>
            </div>

            <div id="rules-list" style="margin-bottom:16px">
                ${rules.length ? `
                <table class="info-table">
                    <thead><tr><th style="width:46px">#</th><th>Condition</th><th style="width:200px">Next Step</th><th style="width:40px"></th></tr></thead>
                    <tbody>${rules.map(r=>`
                        <tr id="rule-row-${r.id}">
                            <td>${r.priority}</td>
                            <td><code>${esc(r.conditionExpr)}</code></td>
                            <td>${r.nextStepId
                                ? (() => { const s = allSteps.find(x=>x.id===r.nextStepId); return s ? `<span class="next-step-link">→ ${esc(s.name)}</span>` : `<span class="text-muted">${r.nextStepId.substring(0,10)}…</span>`; })()
                                : '<span class="end-badge">END</span>'}</td>
                            <td><button class="btn btn-danger btn-sm" onclick="deleteRule('${r.id}','${stepId}','${esc(stepName)}','${workflowId}')">${icon('trash')}</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>` : '<p class="text-muted">No rules yet. Add your first rule below.</p>'}
            </div>

            <div class="add-rule-box">
                <strong style="font-size:13px;display:block;margin-bottom:10px">Add Rule</strong>
                <div class="form-row">
                    <div class="form-group" style="margin-bottom:8px">
                        <label class="form-label">Condition <span class="required">*</span></label>
                        <input class="form-control" id="nr-condition" placeholder="e.g.  amount >= 1000  or  DEFAULT" />
                    </div>
                    <div class="form-group" style="margin-bottom:8px">
                        <label class="form-label">Next Step <span class="hint-label">(blank = END workflow)</span></label>
                        <select class="form-control" id="nr-next">
                            <option value="">— END (finish workflow) —</option>
                            ${otherSteps.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group" style="max-width:110px;margin-bottom:12px">
                    <label class="form-label">Priority</label>
                    <input class="form-control" id="nr-priority" type="number" min="1" value="${rules.length+1}" />
                </div>
                <button class="btn btn-primary btn-sm" onclick="submitAddRule('${stepId}','${esc(stepName)}','${workflowId}')">${icon('plus')} Add Rule</button>
            </div>
        </div>`);
}

async function submitAddRule(stepId, stepName, workflowId) {
    const cond = document.getElementById('nr-condition').value.trim();
    const nextStepId = document.getElementById('nr-next').value.trim() || null;
    const priority = parseInt(document.getElementById('nr-priority').value) || 1;
    if (!cond) { showToast('Condition is required.','error'); return; }
    try {
        const res = await fetch(`${API}/steps/${stepId}/rules`, { method:'POST', headers:jsonH(), body:JSON.stringify({ conditionExpr:cond, nextStepId, priority }) });
        if (!res.ok) throw new Error('Failed');
        showToast('Rule added.');
        const [rules, allSteps] = await Promise.all([fetchJSON(`${API}/steps/${stepId}/rules`), fetchJSON(`${API}/workflows/${workflowId}/steps`)]);
        renderRulesEditorModal(stepId, stepName, workflowId, rules, allSteps);
    } catch(e) { showToast('Failed to add rule.','error'); }
}

async function deleteRule(ruleId, stepId, stepName, workflowId) {
    if (!confirm('Delete this rule?')) return;
    try {
        await fetch(`${API}/rules/${ruleId}`, { method:'DELETE' });
        showToast('Rule deleted.');
        const [rules, allSteps] = await Promise.all([fetchJSON(`${API}/steps/${stepId}/rules`), fetchJSON(`${API}/workflows/${workflowId}/steps`)]);
        renderRulesEditorModal(stepId, stepName, workflowId, rules, allSteps);
    } catch(e) { showToast('Failed to delete rule.','error'); }
}

// ===== TOGGLE / DELETE =====
async function toggleWorkflow(id, isActive) {
    try {
        await fetch(`${API}/workflows/${id}/toggle`, { method:'PATCH', headers:jsonH(), body:JSON.stringify({ isActive }) });
        showToast(`Workflow ${isActive?'activated':'deactivated'}.`);
        loadWorkflowsTable(workflowsData.currentPage||0, '');
    } catch(e) { showToast('Failed to update status.','error'); }
}
function confirmDelete(id, name) { if (confirm(`Delete workflow "${name}"? This cannot be undone.`)) deleteWorkflow(id); }
async function deleteWorkflow(id) {
    try {
        await fetch(`${API}/workflows/${id}`, { method:'DELETE' });
        showToast('Workflow deleted.');
        loadWorkflowsTable(0, '');
    } catch(e) { showToast('Failed to delete workflow.','error'); }
}

// ===== EXECUTE PAGE =====
async function renderExecutePage() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="page-header">
            <div><h1>Execute Workflow</h1><p>Select an active workflow and provide inputs to run it</p></div>
        </div>
        <div class="execute-layout">
            <div class="card exec-sidebar">
                <div class="card-header"><h2>Active Workflows</h2></div>
                <div class="card-body" style="padding:10px"><div id="exec-workflow-list"><div class="loading-text">Loading...</div></div></div>
            </div>
            <div id="exec-right-panel" class="exec-main">
                <div class="card"><div class="card-body">
                    <div class="empty-state">
                        <div class="empty-state-icon">${icon('play')}</div>
                        <h3>Select a workflow</h3>
                        <p>Choose a workflow from the left panel to execute it.</p>
                    </div>
                </div></div>
            </div>
        </div>`;
    await loadWorkflowListForExec();
}

async function loadWorkflowListForExec() {
    try {
        const data = await fetchJSON(`${API}/workflows?size=100`);
        const wfs = (data.content||[]).filter(w=>w.isActive);
        const list = document.getElementById('exec-workflow-list');
        if (!list) return;
        if (!wfs.length) { list.innerHTML = '<p class="text-muted">No active workflows.</p>'; return; }
        list.innerHTML = wfs.map(w=>`
            <div class="exec-wf-item" id="ewf-${w.id}" onclick="selectWorkflowForExecution('${w.id}')">
                <div class="exec-wf-name">${esc(w.name)}</div>
                <div class="exec-wf-meta">v${w.version} &bull; ${(w.steps||[]).length} steps</div>
            </div>`).join('');
    } catch(e) {
        const list = document.getElementById('exec-workflow-list');
        if (list) list.innerHTML = alertHtml('error','Failed to load.');
    }
}

async function selectWorkflowForExecution(wfId) {
    document.querySelectorAll('.exec-wf-item').forEach(el => {
        el.classList.toggle('selected', el.id === `ewf-${wfId}`);
    });
    try {
        const wf = await fetchJSON(`${API}/workflows/${wfId}`);
        const steps = wf.steps || [];
        let schemaFields = [];
        try {
            const schema = JSON.parse(wf.inputSchema||'{}');
            schemaFields = Object.entries(schema).map(([k,v]) => ({
                key:k, type:v.type||'string', required:v.required!==false, allowed_values:v.allowed_values||null
            }));
        } catch(e) {}

        const panel = document.getElementById('exec-right-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="card" style="margin-bottom:16px">
                <div class="card-header">
                    <div><h2>${esc(wf.name)}</h2><span class="text-muted">v${wf.version} &bull; ${steps.length} steps</span></div>
                    <span class="badge badge-active">Active</span>
                </div>
                <div class="card-body">
                    <div id="exec-alert"></div>
                    ${schemaFields.length
                        ? `<p class="section-hint" style="margin-bottom:12px">Fill in the fields below, then click <strong>Start Execution</strong>.</p>
                           ${schemaFields.map(f=>`
                            <div class="form-group">
                                <label class="form-label">
                                    ${esc(f.key)}
                                    ${f.required ? '<span class="required">*</span>' : '<span class="optional-tag">(optional)</span>'}
                                    <span class="type-tag">${esc(f.type)}</span>
                                </label>
                                ${f.allowed_values && f.allowed_values.length
                                    ? `<select class="form-control exec-input-field" data-key="${esc(f.key)}" data-type="${esc(f.type)}" data-required="${f.required}">
                                        ${f.required ? '' : '<option value="">— Select —</option>'}
                                        ${f.allowed_values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}
                                       </select>`
                                    : `<input class="form-control exec-input-field"
                                        data-key="${esc(f.key)}" data-type="${esc(f.type)}" data-required="${f.required}"
                                        type="${f.type==='number'?'number':'text'}"
                                        placeholder="${f.required?'Required':'Optional'}" />`}
                            </div>`).join('')}`
                        : `<div class="alert alert-info" style="margin-bottom:12px">No input schema defined. This workflow runs with no inputs.</div>`}
                    <button class="btn btn-primary btn-lg" onclick="runExecution('${wfId}')">${icon('play')} Start Execution</button>
                </div>
            </div>
            ${steps.length ? `
            <div class="card" id="exec-flow-card" style="display:none;margin-bottom:16px">
                <div class="card-header"><h2>Step Progress</h2></div>
                <div class="card-body">
                    <div class="steps-flow" id="exec-steps-flow">
                        ${steps.map((s,i)=>`
                            <div class="step-box" id="sf-${s.id}">
                                <div class="step-signal"></div>
                                <span>${esc(s.name)}</span>
                            </div>
                            ${i<steps.length-1?'<div class="step-arrow">&#8594;</div>':''}`).join('')}
                    </div>
                </div>
            </div>` : ''}
            <div class="card" id="exec-logs-card" style="display:none">
                <div class="card-header"><h2>Execution Logs</h2></div>
                <div class="card-body"><div class="log-container" id="exec-log-output"></div></div>
            </div>`;
    } catch(e) { showToast('Failed to load workflow.','error'); }
}

async function runExecution(wfId) {
    const alertEl = document.getElementById('exec-alert');
    if (alertEl) alertEl.innerHTML = '';

    // Collect and validate inputs
    const inputData = {};
    let error = null;
    document.querySelectorAll('.exec-input-field').forEach(el => {
        if (error) return;
        const key = el.dataset.key;
        const type = el.dataset.type;
        const required = el.dataset.required === 'true';
        const raw = el.value.trim();

        el.classList.remove('input-error');
        if (!raw) {
            if (required) { error = `"${key}" is required.`; el.classList.add('input-error'); el.focus(); }
            return;
        }
        if (type === 'number') {
            const n = parseFloat(raw);
            if (isNaN(n)) { error = `"${key}" must be a number.`; el.classList.add('input-error'); el.focus(); return; }
            inputData[key] = n;
        } else if (type === 'boolean') {
            inputData[key] = raw === 'true' || raw === '1';
        } else {
            inputData[key] = raw;
        }
    });

    if (error) { if (alertEl) alertEl.innerHTML = alertHtml('error', error); return; }

    const flowCard = document.getElementById('exec-flow-card');
    const logsCard = document.getElementById('exec-logs-card');
    if (flowCard) flowCard.style.display = '';
    if (logsCard) logsCard.style.display = '';
    document.querySelectorAll('.step-box').forEach(b => b.classList.remove('completed','failed','active'));

    const logOutput = document.getElementById('exec-log-output');
    if (logOutput) logOutput.innerHTML = `<span class="log-meta">Starting with input: ${esc(JSON.stringify(inputData))}...</span>`;

    try {
        const res = await fetch(`${API}/workflows/${wfId}/execute`, {
            method:'POST', headers:jsonH(),
            body:JSON.stringify({ data:inputData, triggeredBy:isAdmin()?currentUser.username:'guest' })
        });
        const result = await res.json();

        if (!res.ok || result.error) {
            const msg = result.error || result.message || 'Execution failed.';
            if (alertEl) alertEl.innerHTML = alertHtml('error', msg);
            if (logOutput) logOutput.innerHTML = `<span class="log-rule-fail">✗ Error: ${esc(msg)}</span>`;
            return;
        }

        renderStepSignals(result);
        renderExecutionLogs(result);
    } catch(e) {
        if (alertEl) alertEl.innerHTML = alertHtml('error', `Execution error: ${e.message}`);
    }
}

function renderStepSignals(execution) {
    let logs = [];
    try { logs = typeof execution.logs === 'string' ? JSON.parse(execution.logs||'[]') : (execution.logs||[]); } catch(e) {}
    logs.forEach(log => {
        document.querySelectorAll('.step-box').forEach(box => {
            const nameEl = box.querySelector('span');
            if (nameEl && nameEl.textContent.trim() === (log.step_name||'').trim()) {
                box.classList.remove('active','failed','completed');
                box.classList.add(log.status==='failed'?'failed':'completed');
            }
        });
    });
    const flowDiv = document.getElementById('exec-steps-flow');
    if (!flowDiv) return;
    flowDiv.querySelectorAll('.exec-status-banner').forEach(e=>e.remove());
    const banner = document.createElement('div');
    banner.className = 'exec-status-banner';
    banner.innerHTML = `
        <span>Final Status:</span>
        <span class="badge badge-${execution.status}">${(execution.status||'').toUpperCase()}</span>
        ${execution.status==='completed' ? '<span class="log-rule-pass">✓ Completed successfully</span>' : ''}
        ${execution.status==='failed'    ? '<span class="log-rule-fail">✗ Execution failed</span>' : ''}`;
    flowDiv.appendChild(banner);
}

function renderExecutionLogs(execution) {
    let logs = [];
    try { logs = typeof execution.logs === 'string' ? JSON.parse(execution.logs||'[]') : (execution.logs||[]); } catch(e) {}
    const output = document.getElementById('exec-log-output');
    if (!output) return;
    let html = `<span class="log-meta">Execution ID: ${esc(execution.id||'')}</span>\n`;
    html += `<span class="log-meta">Status: </span><span class="log-status-${execution.status||'pending'}">${execution.status||''}</span>\n`;
    if (execution.inputData) { try { html += `<span class="log-meta">Input: ${esc(JSON.stringify(JSON.parse(execution.inputData)))}</span>\n`; } catch(e){} }
    if (!logs.length) { html += `\n<span class="log-warn">No step logs recorded.</span>\n`; }
    logs.forEach((log, i) => {
        html += `\n<span class="log-step-header">[Step ${i+1}] ${esc(log.step_name||'')} — ${esc(log.step_type||'')}</span>\n`;
        (log.evaluated_rules||[]).forEach(r => {
            html += `  <span class="${r.result?'log-rule-pass':'log-rule-fail'}">${r.result?'✓':'✗'} ${esc(r.rule)} → ${r.result?'MATCH':'no match'}${r.error?' [ERR:'+esc(r.error)+']':''}</span>\n`;
        });
        if (log.selected_next_step) html += `  <span class="log-next">→ Next: ${esc(log.selected_next_step)}</span>\n`;
        html += `  <span class="log-status-${log.status||'completed'}">Status: ${esc(log.status||'completed')}</span>`;
        if (log.error_message) html += `\n  <span class="log-rule-fail">Error: ${esc(log.error_message)}</span>`;
        html += '\n';
    });
    output.innerHTML = html;
}

// ===== AUDIT LOG =====
async function renderAuditLog(page=0) {
    if (!isAdmin()) { navigate('execute'); return; }
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="page-header"><div><h1>Audit Log</h1><p>All workflow execution history</p></div></div>
        <div class="card">
            <div class="table-container" id="audit-table-container"><div class="loading-text" style="padding:20px">Loading...</div></div>
            <div id="audit-pagination"></div>
        </div>`;
    await loadAuditTable(page);
}

async function loadAuditTable(page=0) {
    try {
        const data = await fetchJSON(`${API}/executions?page=${page}&size=15`);
        const exs = data.content || [];
        const container = document.getElementById('audit-table-container');
        if (!container) return;
        if (!exs.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('log')}</div><h3>No executions found</h3><p>Execute a workflow to see history here.</p></div>`;
            return;
        }
        container.innerHTML = `<table><thead><tr>
            <th>ID</th><th>Workflow</th><th>Version</th><th>Status</th><th>By</th><th>Started</th><th>Ended</th><th>Actions</th>
        </tr></thead><tbody>
            ${exs.map(e=>`<tr>
                <td class="text-mono" title="${esc(e.id)}">${e.id?e.id.substring(0,8)+'…':''}</td>
                <td><strong>${esc(e.workflowName||'')}</strong></td>
                <td class="text-muted">v${e.workflowVersion||1}</td>
                <td><span class="badge badge-${e.status}">${e.status}</span></td>
                <td class="text-muted">${esc(e.triggeredBy||'')}</td>
                <td class="text-muted">${formatDate(e.startedAt)}</td>
                <td class="text-muted">${e.endedAt?formatDate(e.endedAt):'—'}</td>
                <td><div class="action-btns">
                    <button class="btn btn-secondary btn-sm" onclick="viewExecLogs('${e.id}')">${icon('log')} Logs</button>
                    ${e.status==='in_progress'?`<button class="btn btn-warning btn-sm" onclick="cancelExec('${e.id}')">Cancel</button>`:''}
                    ${e.status==='failed'?`<button class="btn btn-primary btn-sm" onclick="retryExec('${e.id}')">Retry</button>`:''}
                </div></td>
            </tr>`).join('')}
        </tbody></table>`;
        renderPagination('audit-pagination', page, data.totalPages, data.totalElements, loadAuditTable);
    } catch(e) {
        const c = document.getElementById('audit-table-container');
        if (c) c.innerHTML = alertHtml('error','Failed to load logs.','margin:16px');
    }
}

async function viewExecLogs(execId) {
    try {
        const execution = await fetchJSON(`${API}/executions/${execId}`);
        let logs = [];
        try { logs = typeof execution.logs === 'string' ? JSON.parse(execution.logs||'[]') : (execution.logs||[]); } catch(e) {}
        let html = `<span class="log-meta">Execution: ${esc(execution.id)}</span>\n`;
        html += `<span class="log-meta">Status: </span><span class="log-status-${execution.status}">${execution.status}</span>\n`;
        if (execution.inputData) { try { html += `<span class="log-meta">Input: ${esc(JSON.stringify(JSON.parse(execution.inputData)))}</span>\n`; } catch(e){} }
        logs.forEach((log,i)=>{
            html += `\n<span class="log-step-header">[Step ${i+1}] ${esc(log.step_name||'')} — ${esc(log.step_type||'')}</span>\n`;
            (log.evaluated_rules||[]).forEach(r=>{
                html += `  <span class="${r.result?'log-rule-pass':'log-rule-fail'}">${r.result?'✓':'✗'} ${esc(r.rule)} → ${r.result?'MATCH':'no match'}</span>\n`;
            });
            if (log.selected_next_step) html += `  <span class="log-next">→ Next: ${esc(log.selected_next_step)}</span>\n`;
            html += `  <span class="log-status-${log.status||'completed'}">Status: ${esc(log.status||'completed')}</span>`;
            if (log.error_message) html += `\n  <span class="log-rule-fail">Error: ${esc(log.error_message)}</span>`;
            html += '\n';
        });
        showModal('logs-modal',`
            <div class="modal-header"><h3>Execution Logs</h3><button class="modal-close" onclick="closeModal('logs-modal')">&times;</button></div>
            <div class="modal-body">
                <div class="wf-meta-row" style="margin-bottom:12px">
                    <span class="badge badge-${execution.status}">${execution.status}</span>
                    <span class="text-muted">${esc(execution.workflowName||'')} v${execution.workflowVersion||1}</span>
                    <span class="text-muted">by ${esc(execution.triggeredBy||'')}</span>
                </div>
                <div class="log-container">${html}</div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('logs-modal')">Close</button></div>`, 'modal-lg');
    } catch(e) { showToast('Failed to load logs.','error'); }
}

async function cancelExec(id) {
    try { await fetch(`${API}/executions/${id}/cancel`,{method:'POST'}); showToast('Canceled.'); loadAuditTable(0); }
    catch(e) { showToast('Cancel failed.','error'); }
}
async function retryExec(id) {
    try { await fetch(`${API}/executions/${id}/retry`,{method:'POST'}); showToast('Retry initiated.'); loadAuditTable(0); }
    catch(e) { showToast('Retry failed.','error'); }
}

// ===== HELPERS =====
function showModal(id, html, extraClass='') {
    closeModal(id);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = `overlay-${id}`;
    overlay.innerHTML = `<div class="modal ${extraClass}" id="${id}">${html}</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(id); });
    document.body.appendChild(overlay);
}
function closeModal(id) { document.getElementById(`overlay-${id}`)?.remove(); }

function showToast(msg, type='success') {
    document.getElementById('toast')?.remove();
    const t = document.createElement('div');
    t.id = 'toast';
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 3000);
}

function renderPagination(containerId, currentPg, totalPages, totalElements, onPage) {
    const c = document.getElementById(containerId);
    if (!c || totalPages<=1) { if(c) c.innerHTML=''; return; }
    let pages='';
    for(let i=0;i<totalPages;i++) pages+=`<button class="page-btn ${i===currentPg?'active':''}" onclick="(${onPage.toString()})(${i})">${i+1}</button>`;
    c.innerHTML=`<div class="pagination"><span>${totalElements} total</span><div class="pagination-pages">
        <button class="page-btn" onclick="(${onPage.toString()})(${currentPg-1})" ${currentPg===0?'disabled':''}>Prev</button>
        ${pages}
        <button class="page-btn" onclick="(${onPage.toString()})(${currentPg+1})" ${currentPg>=totalPages-1?'disabled':''}>Next</button>
    </div></div>`;
}

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}
function jsonH() { return { 'Content-Type':'application/json' }; }
function alertHtml(type, msg, style='') { return `<div class="alert alert-${type}"${style?` style="${style}"`:''} >${esc(msg)}</div>`; }
function formatDate(dt) { if (!dt) return '—'; try { return new Date(dt).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'}); } catch(e){ return String(dt); } }
function esc(str) {
    if (str===null||str===undefined) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function icon(name) {
    const icons = {
        grid:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
        workflow:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 12h6l4-5M13 12l4 5"/></svg>`,
        play:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
        log:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
        plus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        edit:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        trash:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
        eye:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
        search:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        shield:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        logout:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
        rule:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`
    };
    return icons[name]||'';
}
