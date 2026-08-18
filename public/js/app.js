let loadingToastId = null;

function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    
    const container = document.getElementById('toast-container');
    if (!container) {
        return null;
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    var icon = '';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    else if (type === 'error') icon = '<i class="fas fa-exclamation-circle"></i>';
    else if (type === 'warning') icon = '<i class="fas fa-exclamation-triangle"></i>';
    else if (type === 'loading') icon = '<i class="fas fa-spinner fa-spin"></i>';
    else icon = '<i class="fas fa-info-circle"></i>';
    
    toast.innerHTML = '<span>' + icon + '</span> ' + message;
    
    if (type !== 'loading') {
        container.appendChild(toast);
        setTimeout(function() {
            if (toast.parentNode) toast.remove();
        }, duration);
    } else {
        toast.style.animation = 'pulse 1s ease-in-out infinite';
        container.appendChild(toast);
    }
    
    return toast;
}

function showLoadingToast(message) {
    message = message || 'Loading...';
    hideLoadingToast();
    var toast = showToast(message, 'loading', 999999);
    loadingToastId = toast;
    return toast;
}

function hideLoadingToast() {
    if (loadingToastId && loadingToastId.parentNode) {
        loadingToastId.remove();
        loadingToastId = null;
    }
}

var style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;
document.head.appendChild(style);

var INACTIVITY_TIMEOUT = 10 * 60 * 1000;
var WARNING_TIMEOUT = 60 * 1000;
var inactivityTimer = null;
var warningTimer = null;
var warningShown = false;
var lastActivityTime = Date.now();

function resetInactivityTimer() {
    lastActivityTime = Date.now();
    warningShown = false;
    
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    if (warningTimer) {
        clearTimeout(warningTimer);
        warningTimer = null;
    }
    
    removeWarningBanner();
    startInactivityTimer();
}

function startInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    
    inactivityTimer = setTimeout(function() {
        var timeSinceLastActivity = Date.now() - lastActivityTime;
        
        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
            performLogout('Session expired due to inactivity');
        } else if (timeSinceLastActivity >= INACTIVITY_TIMEOUT - WARNING_TIMEOUT && !warningShown) {
            showWarningBanner();
            warningShown = true;
            warningTimer = setTimeout(function() {
                performLogout('Session expired due to inactivity');
            }, WARNING_TIMEOUT);
        } else {
            startInactivityTimer();
        }
    }, 30000);
}

function showWarningBanner() {
    var banner = document.getElementById('inactivity-warning');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'inactivity-warning';
        banner.className = 'visible';
        banner.innerHTML = `
            <span>
                <i class="fas fa-exclamation-triangle"></i>
                You will be logged out due to inactivity in <strong id="logout-countdown">60</strong> seconds.
            </span>
            <div style="display:flex;gap:10px;">
                <button onclick="resetInactivityTimer()" style="background:#fff;color:#dc3545;border:none;padding:6px 18px;border-radius:4px;font-weight:700;font-size:13px;cursor:pointer;">
                    <i class="fas fa-mouse-pointer"></i> Stay Active
                </button>
                <button onclick="performLogout('User initiated logout')" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);padding:6px 14px;border-radius:4px;font-weight:600;font-size:13px;cursor:pointer;">
                    <i class="fas fa-sign-out-alt"></i> Logout Now
                </button>
            </div>
        `;
        document.body.appendChild(banner);
    }
    
    banner.className = 'visible';
    
    var countdown = 60;
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
    window.countdownInterval = setInterval(function() {
        countdown--;
        var el = document.getElementById('logout-countdown');
        if (el) {
            el.textContent = countdown;
        }
        if (countdown <= 0) {
            clearInterval(window.countdownInterval);
            window.countdownInterval = null;
        }
    }, 1000);
}

function removeWarningBanner() {
    var banner = document.getElementById('inactivity-warning');
    if (banner) {
        banner.className = '';
    }
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }
    warningShown = false;
}

function performLogout(reason) {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    if (warningTimer) {
        clearTimeout(warningTimer);
        warningTimer = null;
    }
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }
    removeWarningBanner();
    
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_user');
    showToast('Session expired due to inactivity. Please login again.', 'warning');
    setTimeout(function() {
        window.location.href = '/login';
    }, 1500);
}

function trackUserActivity() {
    resetInactivityTimer();
}

function setupActivityListeners() {
    var events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel', 'focus'];
    events.forEach(function(event) {
        document.addEventListener(event, trackUserActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            trackUserActivity();
        }
    });
}

function initAutoLogout() {
    var token = localStorage.getItem('hrms_token');
    if (!token) {
        return;
    }
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    resetInactivityTimer();
    setupActivityListeners();
}

function checkAuth() {
    var token = localStorage.getItem('hrms_token');
    if (!token) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

function getAuthToken() {
    return localStorage.getItem('hrms_token');
}

async function api(method, url, body, showLoading) {
    showLoading = (showLoading !== undefined) ? showLoading : true;
    
    if (isViewer()) {
        var restrictedEndpoints = ['/api/employees', '/api/periods', '/api/report'];
        var restrictedMethods = ['POST', 'PUT', 'DELETE'];
        
        if (url === '/api/employees/light' && method === 'GET') {
        } else if (restrictedEndpoints.some(function(e) { return url.indexOf(e) !== -1; })) {
            if (restrictedMethods.indexOf(method) !== -1) {
                showToast('Access denied', 'error');
                throw new Error('Access denied');
            }
            if (url === '/api/employees' && method === 'GET') {
            }
        }
    }
    
    var token = getAuthToken();
    var opts = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    };
    if (body) opts.body = JSON.stringify(body);
    
    var loadingToast = null;
    if (showLoading) {
        loadingToast = showLoadingToast('Loading...');
    }
    
    try {
        var res = await fetch(url, opts);
        
        if (res.status === 401) {
            var errorData = await res.json().catch(function() { return {}; });
            if (errorData.error && errorData.error.includes('logged in on another device')) {
                showToast('You have been logged out because you logged in on another device.', 'warning');
            }
            localStorage.removeItem('hrms_token');
            localStorage.removeItem('hrms_user');
            window.location.href = '/login';
            throw new Error('Session expired');
        }
        
        var contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            var data = await res.json();
            if (loadingToast) hideLoadingToast();
            return data;
        } else {
            if (loadingToast) hideLoadingToast();
            return res;
        }
    } catch (err) {
        if (loadingToast) hideLoadingToast();
        throw err;
    }
}

async function verifyAuth() {
    var token = getAuthToken();
    if (!token) return false;
    
    try {
        var response = await fetch('/api/verify', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (response.ok) {
            var data = await response.json();
            return data.valid;
        }
        return false;
    } catch (error) {
        return false;
    }
}

function getUserRole() {
    var userStr = localStorage.getItem('hrms_user');
    if (!userStr) return null;
    var user = JSON.parse(userStr);
    return user.role;
}

function getCurrentUser() {
    var userStr = localStorage.getItem('hrms_user');
    if (!userStr) return null;
    return JSON.parse(userStr);
}

function isViewer() {
    return getUserRole() === 'Viewer';
}

function hasFullAccess() {
    var role = getUserRole();
    return ['IT Specialist', 'System Admin', 'Supervisor'].indexOf(role) !== -1;
}

function isDeveloper() {
    return getUserRole() === 'IT Specialist';
}

function displayUserInfo() {
    var userStr = localStorage.getItem('hrms_user');
    if (!userStr) return;
    
    var user = JSON.parse(userStr);
    
    var avatar = document.getElementById('header-avatar');
    var username = document.getElementById('header-username');
    var profileName = document.getElementById('profile-name');
    var profileRole = document.getElementById('profile-role');
    var profileDept = document.getElementById('profile-dept');
    
    if (avatar) avatar.textContent = user.name.charAt(0);
    if (username) username.textContent = user.name;
    if (profileName) profileName.textContent = user.name;
    if (profileRole) profileRole.textContent = user.role || 'No role';
    if (profileDept) profileDept.textContent = user.department || 'No department';
}

window.logout = async function() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    if (warningTimer) {
        clearTimeout(warningTimer);
        warningTimer = null;
    }
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }
    removeWarningBanner();
    
    try {
        var token = getAuthToken();
        await fetch('/api/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
    } catch (e) {
    }
    
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_user');
    window.location.href = '/login';
};

var authStyles = document.createElement('style');
authStyles.textContent = `
    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 12px;
        background: var(--gray-100);
        border-radius: 30px;
        margin-left: 10px;
    }
    .user-avatar {
        width: 32px;
        height: 32px;
        background: var(--gold);
        color: var(--navy-dark);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
    }
    .user-details {
        display: flex;
        flex-direction: column;
    }
    .user-name {
        font-size: 12px;
        font-weight: 600;
        color: var(--navy);
    }
    .user-role {
        font-size: 9px;
        color: var(--gray-600);
        text-transform: uppercase;
    }
    .logout-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        padding: 4px;
        border-radius: 50%;
        transition: background 0.2s;
        color: var(--gray-600);
    }
    .logout-btn:hover {
        background: rgba(0,0,0,0.05);
        color: var(--danger);
    }
`;
document.head.appendChild(authStyles);

var DEPARTMENTS = [
    'Admin & Accounts',
    'Front Office',
    'Food & Beverage',
    'Housekeeping & Laundry',
    'Maintenance',
    'Attachment',
    'Security'
];

var STATUS_OPTIONS = ['', 'P', 'A', 'S', 'L', 'O'];
var STATUS_LABELS = { P: 'Present', A: 'Absent', S: 'Sick', L: 'Leave', O: 'Off' };

var allEmployees = [];
var currentAttendance = {};
var currentPeriod = '';
var deleteTargetId = '';
var saveTimeout = null;
var allUsers = [];
var currentSummaryData = [];
var selectedEmployeeId = null;

var PAGE_META = {
    dashboard:  { title: 'Dashboard', subtitle: 'Overview of current payroll period' },
    attendance: { title: 'Attendance Register', subtitle: 'Daily attendance tracking · Auto-saves on change' },
    employees:  { title: 'Employee Management', subtitle: 'Add, edit, or remove staff members' },
    reports:    { title: 'Reports', subtitle: 'Download protected Excel attendance reports' },
    signin:     { title: 'Sign-In Sheet', subtitle: 'Daily attendance sign-in register with time tracking' },
    activitylogs: { title: 'Activity Logs', subtitle: 'Audit trail of all user actions' },
    security:   { title: 'User Management', subtitle: 'Manage system users and roles' },
    profile:    { title: 'My Profile', subtitle: 'View and manage your profile' },
    summary:    { title: 'Employee Summary', subtitle: 'View P-S-A-L-O totals by employee' }
};

function navigate(page) {
    var pageSection = document.getElementById('page-' + page);
    if (!pageSection) {
        return;
    }
    
    var restrictedPages = ['employees', 'attendance', 'reports', 'summary'];
    var developerOnlyPages = ['activitylogs'];
    
    if (isViewer() && restrictedPages.indexOf(page) !== -1) {
    }
    
    if (page === 'activitylogs') {
        if (!isDeveloper()) {
            showToast('Access denied', 'error');
            return;
        }
        if (typeof ActivityLogs !== 'undefined' && ActivityLogs.init) {
            setTimeout(function() { ActivityLogs.init(); }, 100);
        }
    }
    
    if (page === 'security') {
        var role = getUserRole();
        if (role !== 'IT Specialist' && role !== 'System Admin' && role !== 'Supervisor') {
            showToast('Access denied', 'error');
            return;
        }
        if (typeof Security !== 'undefined' && Security.init) {
            setTimeout(function() { Security.init(); }, 100);
        } else {
            loadUsers();
        }
    }
    
    document.querySelectorAll('.page-section').forEach(function(s) { 
        s.classList.remove('active'); 
    });
    document.querySelectorAll('.nav-item').forEach(function(n) { 
        n.classList.remove('active'); 
    });
    
    pageSection.classList.add('active');
    
    var navItem = document.querySelector('[data-page="' + page + '"]');
    if (navItem) {
        navItem.classList.add('active');
    }
    
    var meta = PAGE_META[page];
    if (meta) {
        var titleEl = document.getElementById('page-title');
        var subtitleEl = document.getElementById('page-subtitle');
        if (titleEl) titleEl.textContent = meta.title;
        if (subtitleEl) subtitleEl.textContent = meta.subtitle;
    }
    
    if (page === 'dashboard') loadDashboard();
    if (page === 'employees') loadEmployees();
    if (page === 'reports') loadReportPeriods();
    if (page === 'profile') loadProfile();
    if (page === 'summary') loadSummaryPage();
    if (page === 'signin') {
        var datePicker = document.getElementById('signin-date-picker');
        if (datePicker && !datePicker.value) {
            datePicker.value = new Date().toISOString().split('T')[0];
        }
    }
    
    updateNavigationVisibility();
}

function updateNavigationVisibility() {
    var navItems = document.querySelectorAll('.nav-item');
    var restrictedItems = ['employees', 'attendance', 'reports'];
    var developerOnlyItems = ['activitylogs'];
    var role = getUserRole();
    
    navItems.forEach(function(item) {
        var page = item.dataset.page;
        
        if (isViewer() && restrictedItems.indexOf(page) !== -1) {
            item.style.display = 'flex';
        } else if (developerOnlyItems.indexOf(page) !== -1 && role !== 'IT Specialist') {
            item.style.display = 'none';
        } else if (page === 'security' && role !== 'IT Specialist' && role !== 'System Admin' && role !== 'Supervisor') {
            item.style.display = 'none';
        } else {
            item.style.display = 'flex';
        }
    });
    
    var summaryItem = document.querySelector('[data-page="summary"]');
    if (summaryItem) {
        summaryItem.style.display = 'flex';
    }
}

function initMobileMegaMenu() {
    var menuItems = document.querySelectorAll('.menu > li');
    
    menuItems.forEach(function(item) {
        var link = item.querySelector('a');
        var mega = item.querySelector('.mega');
        
        if (link && mega) {
            link.addEventListener('click', function(e) {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    menuItems.forEach(function(other) {
                        if (other !== item) {
                            other.classList.remove('active');
                        }
                    });
                    item.classList.toggle('active');
                }
            });
        }
    });
}

window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        document.querySelectorAll('.menu > li.active').forEach(function(el) {
            el.classList.remove('active');
        });
    }
});

function getPeriodLabel(period) {
    if (!period) return '';
    var parts = period.split('-').map(Number);
    var year = parts[0];
    var month = parts[1];
    var prevMonth = month === 1 ? 12 : month - 1;
    var prevYear = month === 1 ? year - 1 : year;
    var pm = new Date(prevYear, prevMonth - 1).toLocaleString('default', { month: 'short' });
    var cm = new Date(year, month - 1).toLocaleString('default', { month: 'short' });
    return '27 ' + pm + ' ' + prevYear + ' – 26 ' + cm + ' ' + year;
}

function getPeriodDates(period) {
    var parts = period.split('-').map(Number);
    var year = parts[0];
    var month = parts[1];
    var prevMonth = month === 1 ? 12 : month - 1;
    var prevYear = month === 1 ? year - 1 : year;
    var daysInPrev = new Date(prevYear, prevMonth, 0).getDate();
    var daysInCurr = new Date(year, month, 0).getDate();
    var dates = [];
    for (var d = 27; d <= daysInPrev; d++) {
        var ds = prevYear + '-' + String(prevMonth).padStart(2,'0') + '-' + String(d).padStart(2,'0');
        var dayOfWeek = new Date(ds).toLocaleDateString('default', { weekday: 'short' });
        dates.push({ date: ds, label: prevMonth + '/' + d, day: dayOfWeek });
    }
    for (var d2 = 1; d2 <= 26 && d2 <= daysInCurr; d2++) {
        var ds2 = year + '-' + String(month).padStart(2,'0') + '-' + String(d2).padStart(2,'0');
        var dayOfWeek2 = new Date(ds2).toLocaleDateString('default', { weekday: 'short' });
        dates.push({ date: ds2, label: month + '/' + d2, day: dayOfWeek2 });
    }
    return dates;
}

function getCurrentPeriod() {
    var now = new Date();
    var day = now.getDate();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    if (day >= 27) {
        month++;
        if (month > 12) { month = 1; year++; }
    }
    return year + '-' + String(month).padStart(2,'0');
}

async function loadEmployees() {
    showLoadingToast('Loading employees...');
    try {
        var data = await api('GET', '/api/employees', null, false);
        allEmployees = data || [];
        renderEmployees(allEmployees);
        
        var megaEmpCount = document.getElementById('mega-emp-count');
        var megaDeptCount = document.getElementById('mega-dept-count');
        if (megaEmpCount) megaEmpCount.textContent = allEmployees.length + ' Employees';
        if (megaDeptCount) {
            var depts = new Set(allEmployees.map(function(e) { return e.department; }));
            megaDeptCount.textContent = depts.size + ' Departments';
        }
        
        hideLoadingToast();
        return data;
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to load employees', 'error');
        throw err;
    }
}

function renderEmployees(emps) {
    var tbody = document.getElementById('emp-table-body');
    var countEl = document.getElementById('emp-count');
    if (countEl) countEl.textContent = emps.length + ' employee' + (emps.length !== 1 ? 's' : '');

    if (!emps.length) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon"><i class="fas fa-users"></i></div><h3>No employees found</h3><p>Add your first employee to get started</p></div></td></tr>';
        return;
    }

    var isViewerRole = isViewer();

    tbody.innerHTML = emps.map(function(e, i) {
        var dayOff = e.day_off || '';
        var actionsHtml = '';
        if (!isViewerRole) {
            actionsHtml = `
                <button class="btn btn-outline btn-sm" onclick="editEmployee('${e._id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" style="margin-left:4px;" onclick="deleteEmployee('${e._id}','${e.name.replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i></button>
            `;
        } else {
            actionsHtml = '<span style="color:var(--gray-400);font-size:11px;">View only</span>';
        }
        
        return `
            <tr>
                <td style="color:var(--gray-400);font-size:12px;">${i+1}</td>
                <td><code style="background:var(--gray-100);padding:2px 7px;border-radius:4px;font-size:12px;">${e.employee_no || '—'}</code></td>
                <td><strong>${e.name}</strong></td>
                <td><span class="dept-badge">${e.department}</span></td>
                <td style="color:var(--gray-600);">${e.position}</td>
                <td style="color:var(--gray-400);font-size:12px;">${e.join_date ? formatDate(e.join_date) : '—'}</td>
                <td><span class="dayoff-badge ${dayOff ? dayOff.toLowerCase() : 'none'}">${dayOff || '—'}</span></td>
                <td style="text-align:center;">${actionsHtml}</td>
            </tr>
        `;
    }).join('');
}

function filterEmployees() {
    var q = document.getElementById('emp-search').value.toLowerCase();
    var dept = document.getElementById('emp-dept-filter').value;
    var dayOffFilter = document.getElementById('emp-dayoff-filter').value;
    
    var filtered = allEmployees.filter(function(e) {
        var matchQ = !q || e.name.toLowerCase().indexOf(q) !== -1 || (e.employee_no || '').toLowerCase().indexOf(q) !== -1 || e.position.toLowerCase().indexOf(q) !== -1;
        var matchD = !dept || e.department === dept;
        var matchDayOff = !dayOffFilter || (e.day_off || '') === dayOffFilter;
        return matchQ && matchD && matchDayOff;
    });
    renderEmployees(filtered);
}

function openAddEmployee() {
    if (isViewer()) {
        showToast('You don\'t have permission to add employees', 'error');
        return;
    }
    document.getElementById('emp-modal-title').textContent = 'Add New Employee';
    document.getElementById('emp-id').value = '';
    document.getElementById('emp-no').value = '';
    document.getElementById('emp-name').value = '';
    document.getElementById('emp-dept').value = '';
    document.getElementById('emp-position').value = '';
    document.getElementById('emp-join').value = '';
    document.getElementById('emp-dayoff').value = '';
    openModal('emp-modal');
}

function editEmployee(id) {
    if (isViewer()) {
        showToast('You don\'t have permission to edit employees', 'error');
        return;
    }
    var e = allEmployees.find(function(x) { return x._id === id; });
    if (!e) return;
    document.getElementById('emp-modal-title').textContent = 'Edit Employee';
    document.getElementById('emp-id').value = e._id;
    document.getElementById('emp-no').value = e.employee_no || '';
    document.getElementById('emp-name').value = e.name;
    document.getElementById('emp-dept').value = e.department;
    document.getElementById('emp-position').value = e.position;
    document.getElementById('emp-join').value = e.join_date || '';
    document.getElementById('emp-dayoff').value = e.day_off || '';
    openModal('emp-modal');
}

async function saveEmployee() {
    if (isViewer()) {
        showToast('You don\'t have permission to save employees', 'error');
        return;
    }
    
    var id = document.getElementById('emp-id').value;
    var name = document.getElementById('emp-name').value.trim();
    var department = document.getElementById('emp-dept').value;
    var position = document.getElementById('emp-position').value.trim();
    var dayOff = document.getElementById('emp-dayoff').value;

    if (!name || !department || !position) { showToast('Please fill in all required fields', 'error'); return; }

    var payload = {
        name: name,
        department: department,
        position: position,
        employeeNo: document.getElementById('emp-no').value.trim(),
        joinDate: document.getElementById('emp-join').value,
        day_off: dayOff
    };

    showLoadingToast(id ? 'Updating employee...' : 'Adding employee...');

    try {
        if (id) {
            await api('PUT', '/api/employees/' + id, payload);
            showToast('Employee updated successfully', 'success');
        } else {
            await api('POST', '/api/employees', payload);
            showToast('Employee added successfully', 'success');
        }
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to save employee', 'error');
        return;
    }

    hideLoadingToast();
    closeModal('emp-modal');
    await loadEmployees();
}

function deleteEmployee(id, name) {
    if (isViewer()) {
        showToast('You don\'t have permission to delete employees', 'error');
        return;
    }
    deleteTargetId = id;
    document.getElementById('del-emp-name').textContent = name;
    openModal('del-modal');
}

async function confirmDelete() {
    if (isViewer()) {
        showToast('You don\'t have permission to delete employees', 'error');
        return;
    }
    
    showLoadingToast('Deleting employee...');
    try {
        await api('DELETE', '/api/employees/' + deleteTargetId);
        hideLoadingToast();
        closeModal('del-modal');
        showToast('Employee removed successfully', 'success');
        await loadEmployees();
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to delete employee', 'error');
    }
}

function showAttendanceSkeleton() {
    var container = document.getElementById('att-table-container');
    if (!container) return;
    
    var skeletonHtml = `
        <div class="skeleton-wrapper" style="padding: 10px;">
            <div class="skeleton-header" style="display:flex; gap:8px; margin-bottom:12px;">
                <div class="skeleton-box" style="width:40px;height:30px;border-radius:4px;"></div>
                <div class="skeleton-box" style="width:160px;height:30px;border-radius:4px;"></div>
                <div class="skeleton-box" style="width:100px;height:30px;border-radius:4px;"></div>
                <div class="skeleton-box" style="flex:1;height:30px;border-radius:4px;"></div>
                <div class="skeleton-box" style="width:40px;height:30px;border-radius:4px;"></div>
                <div class="skeleton-box" style="width:40px;height:30px;border-radius:4px;"></div>
                <div class="skeleton-box" style="width:40px;height:30px;border-radius:4px;"></div>
                <div class="skeleton-box" style="width:40px;height:30px;border-radius:4px;"></div>
                <div class="skeleton-box" style="width:40px;height:30px;border-radius:4px;"></div>
            </div>
            <div class="skeleton-body">
                ${Array(8).fill(0).map(function() {
                    return `
                        <div style="display:flex; gap:8px; margin-bottom:6px; align-items:center;">
                            <div class="skeleton-box" style="width:40px;height:28px;border-radius:4px;animation-delay:0s;"></div>
                            <div class="skeleton-box" style="width:160px;height:28px;border-radius:4px;animation-delay:0.1s;"></div>
                            <div class="skeleton-box" style="width:100px;height:28px;border-radius:4px;animation-delay:0.2s;"></div>
                            ${Array(31).fill(0).map(function(_, idx) {
                                return `<div class="skeleton-box" style="width:32px;height:28px;border-radius:4px;animation-delay:${(idx % 10) * 0.05}s;"></div>`;
                            }).join('')}
                            <div class="skeleton-box" style="width:32px;height:28px;border-radius:4px;animation-delay:0.3s;"></div>
                            <div class="skeleton-box" style="width:32px;height:28px;border-radius:4px;animation-delay:0.4s;"></div>
                            <div class="skeleton-box" style="width:32px;height:28px;border-radius:4px;animation-delay:0.5s;"></div>
                            <div class="skeleton-box" style="width:32px;height:28px;border-radius:4px;animation-delay:0.6s;"></div>
                            <div class="skeleton-box" style="width:32px;height:28px;border-radius:4px;animation-delay:0.7s;"></div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = skeletonHtml;
}

async function loadAttendanceFast() {
    var container = document.getElementById('att-table-container');
    if (!container) return;
    
    currentPeriod = document.getElementById('att-period-select')?.value || getCurrentPeriod();
    if (!currentPeriod) {
        return;
    }
    updatePeriodBadge();
    
    container.innerHTML = `
        <div style="padding:30px 20px; text-align:center;">
            <div style="display:inline-block; position:relative; width:100%; max-width:400px;">
                <div style="height:6px; background:var(--gray-200); border-radius:3px; overflow:hidden;">
                    <div id="att-load-progress" style="height:100%; width:0%; background:linear-gradient(90deg, var(--gold), #f0d080); border-radius:3px; transition:width 0.3s ease;"></div>
                </div>
                <div style="margin-top:12px; font-size:14px; color:var(--gray-600);">
                    <i class="fas fa-spinner fa-spin"></i> Loading attendance...
                    <span id="att-load-status" style="font-size:12px; color:var(--gray-400); display:block; margin-top:4px;">Preparing data</span>
                </div>
            </div>
        </div>
    `;
    
    var progress = 0;
    var progressInterval = setInterval(function() {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        var bar = document.getElementById('att-load-progress');
        var status = document.getElementById('att-load-status');
        if (bar) bar.style.width = progress + '%';
        if (status) {
            if (progress < 30) status.textContent = 'Fetching attendance records...';
            else if (progress < 60) status.textContent = 'Processing data...';
            else if (progress < 80) status.textContent = 'Formatting table...';
            else status.textContent = 'Almost done...';
        }
    }, 200);
    
    try {
        var token = getAuthToken();
        var response = await fetch('/api/attendance/' + currentPeriod, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load attendance (Status: ' + response.status + ')');
        }
        
        var data = await response.json();
        currentAttendance = data || {};
        
        clearInterval(progressInterval);
        var bar = document.getElementById('att-load-progress');
        var status = document.getElementById('att-load-status');
        if (bar) bar.style.width = '100%';
        if (status) status.textContent = 'Load complete!';
        
        await new Promise(function(resolve) { setTimeout(resolve, 300); });
        renderAttendanceTable();
        
    } catch (err) {
        clearInterval(progressInterval);
        showToast('Failed to load attendance. Please try again.', 'error');
        
        container.innerHTML = `
            <div class="empty-state" style="padding:40px 20px;">
                <div class="empty-icon"><i class="fas fa-exclamation-triangle" style="color:var(--warning);font-size:40px;"></i></div>
                <h3>Failed to load attendance</h3>
                <p>${err.message || 'Please try again'}</p>
                <button class="btn btn-primary" onclick="loadAttendanceFast()" style="margin-top:12px;">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
}

async function initAttendance() {
    showLoadingToast('Loading periods...');
    try {
        var periods = await api('GET', '/api/periods', null, false);
        
        var sel = document.getElementById('att-period-select');
        var expSel = document.getElementById('report-period-select');

        var curr = getCurrentPeriod();
        
        if (!periods || periods.length === 0) {
            periods = [curr];
            try {
                await api('POST', '/api/attendance', { 
                    period: curr, 
                    employeeId: '__init__', 
                    date: curr, 
                    status: '' 
                }, false);
            } catch (e) {}
        } else if (periods.indexOf(curr) === -1) {
            periods.unshift(curr);
        }

        if (sel) {
            sel.innerHTML = periods.map(function(p) { 
                return '<option value="' + p + '">' + getPeriodLabel(p) + '</option>'; 
            }).join('');
        }
        if (expSel) {
            expSel.innerHTML = periods.map(function(p) { 
                return '<option value="' + p + '">' + getPeriodLabel(p) + '</option>'; 
            }).join('');
        }

        currentPeriod = periods[0] || curr;
        if (sel) sel.value = currentPeriod;

        updatePeriodBadge();
        await loadAttendanceFast();
        hideLoadingToast();
        
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to load periods. Using current period.', 'warning');
        var curr = getCurrentPeriod();
        var sel = document.getElementById('att-period-select');
        if (sel) {
            sel.innerHTML = '<option value="' + curr + '">' + getPeriodLabel(curr) + ' (Current)</option>';
        }
        currentPeriod = curr;
        await loadAttendanceFast();
    }
}

function updatePeriodBadge() {
    var period = document.getElementById('att-period-select')?.value || getCurrentPeriod();
    var badge = document.getElementById('current-period-badge');
    var qiPeriod = document.getElementById('qi-period');
    if (badge) badge.textContent = getPeriodLabel(period);
    if (qiPeriod) qiPeriod.textContent = getPeriodLabel(period);
}

async function markDayOffs() {
    if (isViewer()) {
        showToast('You don\'t have permission to mark day-offs', 'error');
        return;
    }
    
    var period = document.getElementById('att-period-select')?.value || getCurrentPeriod();
    if (!period) {
        showToast('Please select a period first', 'error');
        return;
    }
    
    showLoadingToast('Marking day-offs for ' + getPeriodLabel(period) + '...');
    
    try {
        var token = getAuthToken();
        var response = await fetch('/api/attendance/mark-dayoffs/' + period, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        var data = await response.json();
        
        hideLoadingToast();
        
        if (data.success) {
            if (data.marked_count > 0) {
                showToast('Marked ' + data.marked_count + ' day-off records for ' + getPeriodLabel(period), 'success');
            } else {
                showToast('No new day-offs to mark. All day-offs are already recorded.', 'info');
            }
            await loadAttendanceFast();
        } else {
            showToast('Failed to mark day-offs: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to mark day-offs', 'error');
    }
}

async function loadAttendance() {
    currentPeriod = document.getElementById('att-period-select')?.value || getCurrentPeriod();
    if (!currentPeriod) {
        return;
    }
    updatePeriodBadge();
    
    showLoadingToast('Loading attendance for ' + getPeriodLabel(currentPeriod) + '...');
    try {
        currentAttendance = await api('GET', '/api/attendance/' + currentPeriod, null, false);
        renderAttendanceTable();
        hideLoadingToast();
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to load attendance. Please try again.', 'error');
        var container = document.getElementById('att-table-container');
        if (container) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div><h3>Failed to load attendance</h3><p>Please try refreshing or creating a new period</p></div>';
        }
    }
}

function renderAttendanceTable() {
    var container = document.getElementById('att-table-container');
    if (!container) return;
    
    var employees = allEmployees || [];
    if (!currentPeriod) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fas fa-calendar-alt"></i></div><h3>No Period Selected</h3><p>Please select a payroll period above</p></div>';
        return;
    }
    
    var dates = getPeriodDates(currentPeriod);

    if (!employees.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fas fa-users"></i></div><h3>No employees found</h3><p>Add employees first to track attendance</p></div>';
        return;
    }

    var today = new Date().toISOString().split('T')[0];
    var isViewerRole = isViewer();

    var html = '<div class="att-table-wrap"><table class="att-table" id="att-table"><thead><tr>' +
        '<th class="no-col" style="min-width:36px;max-width:36px;">#</th>' +
        '<th class="emp-col" style="min-width:160px;max-width:180px;">Employee Name</th>' +
        '<th class="pos-col" style="min-width:100px;max-width:120px;">Position</th>';
    
    dates.forEach(function(d) {
        var isToday = d.date === today;
        var isWeekend = d.day === 'Sat' || d.day === 'Sun';
        html += '<th style="min-width:34px;' + (isToday?'background:var(--gold);color:var(--navy-dark);':'') + ' ' + (isWeekend?'opacity:0.7':'') + '">' +
            '<div>' + d.label.split('/')[1] + '</div>' +
            '<div style="font-size:8px;font-weight:400;opacity:0.8;">' + d.day + '</div>' +
            '</th>';
    });
    
    html += '<th style="background:var(--success);min-width:38px;" title="Present">P</th>' +
        '<th style="background:var(--danger);min-width:38px;" title="Absent">A</th>' +
        '<th style="background:var(--sick);min-width:38px;" title="Sick">S</th>' +
        '<th style="background:var(--warning);min-width:38px;" title="Leave">L</th>' +
        '<th style="background:var(--off);min-width:38px;" title="Day Off">O</th>' +
        '</tr></thead><tbody>';

    var deptOrder = ['Admin & Accounts', 'Front Office', 'Food & Beverage', 
                     'Housekeeping & Laundry', 'Maintenance', 'Attachment', 'Security'];

    deptOrder.forEach(function(dept) {
        var deptEmps = employees.filter(function(e) { return e.department === dept; });
        if (!deptEmps.length) return;

        html += '<tr class="dept-row">' +
            '<td class="no-col"></td>' +
            '<td class="emp-col" colspan="2" style="text-align:left;padding-left:12px;">' + dept + '</td>' +
            '<td colspan="' + (dates.length + 5) + '"></td>' +
            '</tr>';

        var dP=0,dA=0,dS=0,dL=0,dO=0;

        deptEmps.forEach(function(emp, idx) {
            var empAtt = currentAttendance[emp._id] || {};
            var p=0,a=0,s=0,l=0,o=0;
            dates.forEach(function(d) {
                var st = empAtt[d.date] || '';
                if (st==='P') p++; else if (st==='A') a++;
                else if (st==='S') s++; else if (st==='L') l++; else if (st==='O') o++;
            });
            dP+=p;dA+=a;dS+=s;dL+=l;dO+=o;

            html += '<tr data-emp="' + emp._id + '">' +
                '<td class="no-col" style="color:var(--gray-400);font-size:11px;text-align:center;">' + (idx+1) + '</td>' +
                '<td class="emp-col">' + emp.name + '</td>' +
                '<td class="pos-col" style="font-size:10px;color:var(--gray-600);">' + emp.position + '</td>';
            
            dates.forEach(function(d) {
                var st = empAtt[d.date] || '';
                var isToday = d.date === today;
                var disabledAttr = isViewerRole ? 'disabled' : '';
                html += '<td style="' + (isToday?'background:rgba(201,168,76,0.08);':'') + '">' +
                    '<select class="att-select status-' + st + '" data-emp="' + emp._id + '" data-date="' + d.date + '" onchange="updateAttendance(this)" ' + disabledAttr + '>' +
                    STATUS_OPTIONS.map(function(s) { return '<option value="' + s + '" ' + (s===st?'selected':'') + '>' + (s || '·') + '</option>'; }).join('') +
                    '</select></td>';
            });
            
            html += '<td><span class="total-badge total-P">' + p + '</span></td>' +
                '<td><span class="total-badge total-A">' + a + '</span></td>' +
                '<td><span class="total-badge total-S">' + s + '</span></td>' +
                '<td><span class="total-badge total-L">' + l + '</span></td>' +
                '<td><span class="total-badge total-O">' + o + '</span></td>' +
                '</tr>';
        });

        html += '<tr class="totals-row">' +
            '<td class="no-col"></td>' +
            '<td class="emp-col" colspan="2" style="text-align:left;padding-left:12px;">Subtotal — ' + dept + '</td>' +
            dates.map(function() { return '<td></td>'; }).join('') +
            '<td>' + dP + '</td><td>' + dA + '</td><td>' + dS + '</td><td>' + dL + '</td><td>' + dO + '</td>' +
            '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function updateAttendance(sel) {
    if (isViewer()) {
        showToast('You don\'t have permission to update attendance', 'error');
        return;
    }
    
    var empId = sel.dataset.emp;
    var date = sel.dataset.date;
    var status = sel.value;

    sel.className = 'att-select' + (status ? ' status-' + status : '');

    if (!currentAttendance[empId]) currentAttendance[empId] = {};
    currentAttendance[empId][date] = status;

    recalcRowTotals(empId);

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async function() {
        try {
            var result = await api('POST', '/api/attendance', { 
                period: currentPeriod, 
                employeeId: empId, 
                date: date, 
                status: status 
            }, false);
        } catch (err) {
            showToast('Failed to save attendance', 'error');
        }
    }, 600);
}

function recalcRowTotals(empId) {
    var row = document.querySelector('tr[data-emp="' + empId + '"]');
    if (!row) return;
    var empAtt = currentAttendance[empId] || {};
    var dates = getPeriodDates(currentPeriod);
    var p=0,a=0,s=0,l=0,o=0;
    dates.forEach(function(d) {
        var st = empAtt[d.date] || '';
        if (st==='P') p++; else if (st==='A') a++;
        else if (st==='S') s++; else if (st==='L') l++; else if (st==='O') o++;
    });
    var tds = row.querySelectorAll('.total-badge');
    if (tds[0]) tds[0].textContent = p;
    if (tds[1]) tds[1].textContent = a;
    if (tds[2]) tds[2].textContent = s;
    if (tds[3]) tds[3].textContent = l;
    if (tds[4]) tds[4].textContent = o;
}

function openNewPeriod() {
    if (isViewer()) {
        showToast('You don\'t have permission to create periods', 'error');
        return;
    }
    var curr = getCurrentPeriod();
    document.getElementById('new-period-input').value = curr;
    updatePeriodPreview();
    openModal('period-modal');
}

function updatePeriodPreview() {
    var val = document.getElementById('new-period-input').value;
    var preview = document.getElementById('period-preview');
    if (val && preview) {
        preview.style.display = 'block';
        preview.textContent = ' Period: ' + getPeriodLabel(val);
    } else if (preview) {
        preview.style.display = 'none';
    }
}

async function createPeriod() {
    if (isViewer()) {
        showToast('You don\'t have permission to create periods', 'error');
        return;
    }
    
    var val = document.getElementById('new-period-input').value;
    if (!val) { showToast('Please select a month', 'error'); return; }
    
    showLoadingToast('Creating period...');
    try {
        await api('POST', '/api/attendance', { period: val, employeeId: '__init__', date: val, status: '' });
        closeModal('period-modal');
        hideLoadingToast();
        showToast('Period ' + getPeriodLabel(val) + ' created', 'success');
        await initAttendance();
        var sel = document.getElementById('att-period-select');
        if (sel) sel.value = val;
        await loadAttendanceFast();
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to create period', 'error');
    }
}

async function loadSummaryPage() {
    await loadEmployees();
    populateEmployeeDropdown();
    
    var period = document.getElementById('summary-period-select')?.value || getCurrentPeriod();
    if (document.getElementById('summary-period-select')) {
        try {
            var periods = await api('GET', '/api/periods', null, false);
            var sel = document.getElementById('summary-period-select');
            var curr = getCurrentPeriod();
            var all = periods && periods.length > 0 ? periods : [curr];
            if (all.indexOf(curr) === -1) all.unshift(curr);
            if (sel) {
                sel.innerHTML = all.map(function(p) { 
                    return '<option value="' + p + '">' + getPeriodLabel(p) + '</option>'; 
                }).join('');
                sel.value = period;
            }
        } catch (e) {}
    }
    
    var today = new Date();
    var oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    if (document.getElementById('summary-start-date')) {
        document.getElementById('summary-start-date').value = oneMonthAgo.toISOString().split('T')[0];
    }
    if (document.getElementById('summary-end-date')) {
        document.getElementById('summary-end-date').value = today.toISOString().split('T')[0];
    }
    
    loadSummaryData();
}

function populateEmployeeDropdown() {
    var dropdown = document.getElementById('summary-employee-select');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="all">All Employees</option>';
    
    var sortedEmployees = allEmployees.slice().sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    
    sortedEmployees.forEach(function(emp) {
        var option = document.createElement('option');
        option.value = emp._id;
        option.textContent = emp.name + ' (' + emp.employee_no + ') - ' + emp.department;
        dropdown.appendChild(option);
    });
}

async function loadSummaryData() {
    var period = document.getElementById('summary-period-select')?.value;
    var viewType = document.querySelector('input[name="summary-view"]:checked')?.value || 'period';
    var employeeId = document.getElementById('summary-employee-select')?.value || 'all';
    
    showLoadingToast('Loading summary data...');
    
    try {
        var data;
        if (viewType === 'period' && period) {
            var response = await fetch('/api/employee-summary/' + period, {
                headers: { 'Authorization': 'Bearer ' + getAuthToken() }
            });
            data = await response.json();
        } else {
            var startDate = document.getElementById('summary-start-date')?.value;
            var endDate = document.getElementById('summary-end-date')?.value;
            
            if (!startDate || !endDate) {
                showToast('Please select start and end dates', 'error');
                hideLoadingToast();
                return;
            }
            
            var response = await fetch('/api/employee-summary-range', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getAuthToken()
                },
                body: JSON.stringify({ start_date: startDate, end_date: endDate })
            });
            data = await response.json();
        }
        
        hideLoadingToast();
        
        if (data.success) {
            currentSummaryData = data.summary || [];
            
            var filteredData = currentSummaryData;
            if (employeeId !== 'all') {
                filteredData = currentSummaryData.filter(function(emp) {
                    return emp.employee_id === employeeId;
                });
            }
            
            renderSummaryTable(filteredData, viewType, employeeId);
            updateSummaryStats(filteredData);
            
            var countEl = document.getElementById('summary-record-count');
            if (countEl) {
                countEl.textContent = filteredData.length + ' employee' + (filteredData.length !== 1 ? 's' : '');
            }
        } else {
            showToast('Failed to load summary data', 'error');
        }
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to load summary data', 'error');
    }
}

function renderSummaryTable(summary, viewType, employeeId) {
    var container = document.getElementById('summary-table-container');
    if (!container) return;
    
    if (!summary || summary.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-chart-bar"></i></div>
                <h3>No data available</h3>
                <p>No attendance records found for the selected period</p>
            </div>
        `;
        return;
    }
    
    var deptOrder = ['Admin & Accounts', 'Front Office', 'Food & Beverage', 
                     'Housekeeping & Laundry', 'Maintenance', 'Attachment', 'Security'];
    
    if (employeeId !== 'all') {
        var emp = summary[0];
        if (emp) {
            var p = emp.present || 0;
            var a = emp.absent || 0;
            var s = emp.sick || 0;
            var l = emp.leave || 0;
            var o = emp.off || 0;
            var total = p + a + s + l + o;
            
            var html = `
                <div style="padding:10px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;background:var(--gray-100);padding:20px;border-radius:8px;">
                        <div>
                            <strong>Employee:</strong> ${emp.name}<br>
                            <strong>Employee No:</strong> ${emp.employee_no || '—'}<br>
                            <strong>Department:</strong> ${emp.department || '—'}<br>
                            <strong>Position:</strong> ${emp.position || '—'}
                        </div>
                        <div>
                            <strong>Join Date:</strong> ${emp.join_date ? formatDate(emp.join_date) : '—'}<br>
                            <strong>Total Days:</strong> ${total}<br>
                            <strong>Period:</strong> ${viewType === 'period' ? document.getElementById('summary-period-select')?.value || 'N/A' : document.getElementById('summary-start-date')?.value + ' to ' + document.getElementById('summary-end-date')?.value}
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;">
                        <div style="background:var(--success-light);padding:16px;border-radius:8px;text-align:center;">
                            <div style="font-size:32px;font-weight:800;color:var(--success);">${p}</div>
                            <div style="font-size:12px;color:var(--gray-600);">Present</div>
                        </div>
                        <div style="background:var(--danger-light);padding:16px;border-radius:8px;text-align:center;">
                            <div style="font-size:32px;font-weight:800;color:var(--danger);">${a}</div>
                            <div style="font-size:12px;color:var(--gray-600);">Absent</div>
                        </div>
                        <div style="background:var(--sick-light);padding:16px;border-radius:8px;text-align:center;">
                            <div style="font-size:32px;font-weight:800;color:var(--sick);">${s}</div>
                            <div style="font-size:12px;color:var(--gray-600);">Sick</div>
                        </div>
                        <div style="background:var(--warning-light);padding:16px;border-radius:8px;text-align:center;">
                            <div style="font-size:32px;font-weight:800;color:var(--warning);">${l}</div>
                            <div style="font-size:12px;color:var(--gray-600);">Leave</div>
                        </div>
                        <div style="background:var(--off-light);padding:16px;border-radius:8px;text-align:center;">
                            <div style="font-size:32px;font-weight:800;color:var(--off);">${o}</div>
                            <div style="font-size:12px;color:var(--gray-600);">Day Off</div>
                        </div>
                    </div>
                    <div style="text-align:center;padding:12px;background:var(--gray-100);border-radius:8px;">
                        <strong>Total Days:</strong> ${total}
                    </div>
                </div>
            `;
            container.innerHTML = html;
            return;
        }
    }
    
    var grouped = {};
    summary.forEach(function(emp) {
        var dept = emp.department || 'Other';
        if (!grouped[dept]) grouped[dept] = [];
        grouped[dept].push(emp);
    });
    
    var html = `
        <div style="overflow-x:auto;">
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Emp No.</th>
                        <th>Employee Name</th>
                        <th>Department</th>
                        <th>Position</th>
                        <th style="text-align:center;background:var(--success-light);color:var(--success);">P</th>
                        <th style="text-align:center;background:var(--danger-light);color:var(--danger);">A</th>
                        <th style="text-align:center;background:var(--sick-light);color:var(--sick);">S</th>
                        <th style="text-align:center;background:var(--warning-light);color:var(--warning);">L</th>
                        <th style="text-align:center;background:var(--off-light);color:var(--off);">O</th>
                        <th style="text-align:center;font-weight:700;">Total</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    var grandP = 0, grandA = 0, grandS = 0, grandL = 0, grandO = 0;
    var grandTotal = 0;
    
    deptOrder.forEach(function(dept) {
        var deptEmps = grouped[dept] || [];
        if (deptEmps.length === 0) return;
        
        html += `
            <tr class="dept-header-row">
                <td colspan="11"><strong>${dept}</strong> (${deptEmps.length} employees)</td>
            </tr>
        `;
        
        var deptP = 0, deptA = 0, deptS = 0, deptL = 0, deptO = 0;
        
        deptEmps.forEach(function(emp, idx) {
            var p = emp.present || 0;
            var a = emp.absent || 0;
            var s = emp.sick || 0;
            var l = emp.leave || 0;
            var o = emp.off || 0;
            var total = p + a + s + l + o;
            
            deptP += p;
            deptA += a;
            deptS += s;
            deptL += l;
            deptO += o;
            
            html += `
                <tr onclick="selectEmployee('${emp.employee_id}')" style="cursor:pointer;">
                    <td>${idx + 1}</td>
                    <td><code style="background:var(--gray-100);padding:2px 7px;border-radius:4px;font-size:11px;">${emp.employee_no || '—'}</code></td>
                    <td><strong>${emp.name}</strong></td>
                    <td><span class="dept-badge">${emp.department || '—'}</span></td>
                    <td style="color:var(--gray-600);font-size:12px;">${emp.position || '—'}</td>
                    <td style="text-align:center;"><span class="total-badge total-P">${p}</span></td>
                    <td style="text-align:center;"><span class="total-badge total-A">${a}</span></td>
                    <td style="text-align:center;"><span class="total-badge total-S">${s}</span></td>
                    <td style="text-align:center;"><span class="total-badge total-L">${l}</span></td>
                    <td style="text-align:center;"><span class="total-badge total-O">${o}</span></td>
                    <td style="text-align:center;font-weight:700;">${total}</td>
                </tr>
            `;
        });
        
        grandP += deptP;
        grandA += deptA;
        grandS += deptS;
        grandL += deptL;
        grandO += deptO;
        var deptTotal = deptP + deptA + deptS + deptL + deptO;
        grandTotal += deptTotal;
        
        html += `
            <tr class="subtotal-row">
                <td colspan="5" style="text-align:right;font-weight:700;">Subtotal — ${dept}</td>
                <td style="text-align:center;font-weight:700;">${deptP}</td>
                <td style="text-align:center;font-weight:700;">${deptA}</td>
                <td style="text-align:center;font-weight:700;">${deptS}</td>
                <td style="text-align:center;font-weight:700;">${deptL}</td>
                <td style="text-align:center;font-weight:700;">${deptO}</td>
                <td style="text-align:center;font-weight:700;">${deptTotal}</td>
            </tr>
        `;
    });
    
    Object.keys(grouped).forEach(function(dept) {
        if (deptOrder.indexOf(dept) === -1) {
            var deptEmps = grouped[dept];
            html += `
                <tr class="dept-header-row">
                    <td colspan="11"><strong>${dept}</strong> (${deptEmps.length} employees)</td>
                </tr>
            `;
            
            var deptP = 0, deptA = 0, deptS = 0, deptL = 0, deptO = 0;
            
            deptEmps.forEach(function(emp, idx) {
                var p = emp.present || 0;
                var a = emp.absent || 0;
                var s = emp.sick || 0;
                var l = emp.leave || 0;
                var o = emp.off || 0;
                var total = p + a + s + l + o;
                
                deptP += p;
                deptA += a;
                deptS += s;
                deptL += l;
                deptO += o;
                
                html += `
                    <tr onclick="selectEmployee('${emp.employee_id}')" style="cursor:pointer;">
                        <td>${idx + 1}</td>
                        <td><code style="background:var(--gray-100);padding:2px 7px;border-radius:4px;font-size:11px;">${emp.employee_no || '—'}</code></td>
                        <td><strong>${emp.name}</strong></td>
                        <td><span class="dept-badge">${emp.department || '—'}</span></td>
                        <td style="color:var(--gray-600);font-size:12px;">${emp.position || '—'}</td>
                        <td style="text-align:center;"><span class="total-badge total-P">${p}</span></td>
                        <td style="text-align:center;"><span class="total-badge total-A">${a}</span></td>
                        <td style="text-align:center;"><span class="total-badge total-S">${s}</span></td>
                        <td style="text-align:center;"><span class="total-badge total-L">${l}</span></td>
                        <td style="text-align:center;"><span class="total-badge total-O">${o}</span></td>
                        <td style="text-align:center;font-weight:700;">${total}</td>
                    </tr>
                `;
            });
            
            grandP += deptP;
            grandA += deptA;
            grandS += deptS;
            grandL += deptL;
            grandO += deptO;
            var deptTotal = deptP + deptA + deptS + deptL + deptO;
            grandTotal += deptTotal;
            
            html += `
                <tr class="subtotal-row">
                    <td colspan="5" style="text-align:right;font-weight:700;">Subtotal — ${dept}</td>
                    <td style="text-align:center;font-weight:700;">${deptP}</td>
                    <td style="text-align:center;font-weight:700;">${deptA}</td>
                    <td style="text-align:center;font-weight:700;">${deptS}</td>
                    <td style="text-align:center;font-weight:700;">${deptL}</td>
                    <td style="text-align:center;font-weight:700;">${deptO}</td>
                    <td style="text-align:center;font-weight:700;">${deptTotal}</td>
                </tr>
            `;
        }
    });
    
    html += `
            <tr class="grand-total-row">
                <td colspan="5" style="text-align:right;font-weight:700;">GRAND TOTALS</td>
                <td style="text-align:center;font-weight:700;">${grandP}</td>
                <td style="text-align:center;font-weight:700;">${grandA}</td>
                <td style="text-align:center;font-weight:700;">${grandS}</td>
                <td style="text-align:center;font-weight:700;">${grandL}</td>
                <td style="text-align:center;font-weight:700;">${grandO}</td>
                <td style="text-align:center;font-weight:700;">${grandTotal}</td>
            </tr>
        </tbody>
    </table>
    </div>
    `;
    
    container.innerHTML = html;
}

function selectEmployee(employeeId) {
    var dropdown = document.getElementById('summary-employee-select');
    if (dropdown) {
        dropdown.value = employeeId;
        loadSummaryData();
    }
}

function updateSummaryStats(summary) {
    var totalP = 0, totalA = 0, totalS = 0, totalL = 0, totalO = 0;
    var totalEmployees = summary.length;
    
    summary.forEach(function(emp) {
        totalP += emp.present || 0;
        totalA += emp.absent || 0;
        totalS += emp.sick || 0;
        totalL += emp.leave || 0;
        totalO += emp.off || 0;
    });
    
    var container = document.getElementById('summary-stats');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;">
            <div style="background:var(--success-light);padding:12px;border-radius:8px;text-align:center;">
                <div style="font-size:24px;font-weight:800;color:var(--success);">${totalP}</div>
                <div style="font-size:11px;color:var(--gray-600);">Total Present</div>
            </div>
            <div style="background:var(--danger-light);padding:12px;border-radius:8px;text-align:center;">
                <div style="font-size:24px;font-weight:800;color:var(--danger);">${totalA}</div>
                <div style="font-size:11px;color:var(--gray-600);">Total Absent</div>
            </div>
            <div style="background:var(--sick-light);padding:12px;border-radius:8px;text-align:center;">
                <div style="font-size:24px;font-weight:800;color:var(--sick);">${totalS}</div>
                <div style="font-size:11px;color:var(--gray-600);">Total Sick</div>
            </div>
            <div style="background:var(--warning-light);padding:12px;border-radius:8px;text-align:center;">
                <div style="font-size:24px;font-weight:800;color:var(--warning);">${totalL}</div>
                <div style="font-size:11px;color:var(--gray-600);">Total Leave</div>
            </div>
            <div style="background:var(--off-light);padding:12px;border-radius:8px;text-align:center;">
                <div style="font-size:24px;font-weight:800;color:var(--off);">${totalO}</div>
                <div style="font-size:11px;color:var(--gray-600);">Total Day Off</div>
            </div>
            <div style="background:var(--gray-100);padding:12px;border-radius:8px;text-align:center;">
                <div style="font-size:20px;font-weight:800;color:var(--navy);">${totalEmployees}</div>
                <div style="font-size:11px;color:var(--gray-600);">Employees</div>
            </div>
        </div>
    `;
}

function exportSummaryCSV() {
    if (!currentSummaryData || currentSummaryData.length === 0) {
        showToast('No data to export', 'error');
        return;
    }
    
    var employeeId = document.getElementById('summary-employee-select')?.value || 'all';
    var filteredData = currentSummaryData;
    if (employeeId !== 'all') {
        filteredData = currentSummaryData.filter(function(emp) {
            return emp.employee_id === employeeId;
        });
    }
    
    var headers = ['Employee No', 'Name', 'Department', 'Position', 'Present', 'Absent', 'Sick', 'Leave', 'Day Off', 'Total Days'];
    var rows = [headers];
    
    filteredData.forEach(function(emp) {
        rows.push([
            emp.employee_no || '',
            emp.name || '',
            emp.department || '',
            emp.position || '',
            emp.present || 0,
            emp.absent || 0,
            emp.sick || 0,
            emp.leave || 0,
            emp.off || 0,
            (emp.present || 0) + (emp.absent || 0) + (emp.sick || 0) + (emp.leave || 0) + (emp.off || 0)
        ]);
    });
    
    var csvContent = rows.map(function(row) {
        return row.join(',');
    }).join('\n');
    
    var blob = new Blob([csvContent], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'employee_summary.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Summary exported successfully!', 'success');
}

async function generateSignInSheet() {
    var datePicker = document.getElementById('signin-date-picker');
    var selectedDate = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];
    
    if (!selectedDate) {
        selectedDate = new Date().toISOString().split('T')[0];
    }
    
    var dateDisplay = document.getElementById('signin-date');
    if (dateDisplay) {
        dateDisplay.textContent = 'Date: ' + formatDateForDisplay(selectedDate);
    }
    
    showLoadingToast('Generating sign-in sheet...');
    
    try {
        var token = getAuthToken();
        var response = await fetch('/api/employees/light', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        var employees = await response.json();
        
        if (!employees || !employees.length) {
            document.getElementById('signin-sheet-container').innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-users"></i></div>
                    <h3>No Employees Found</h3>
                    <p>Please add employees first</p>
                </div>
            `;
            hideLoadingToast();
            return;
        }
        
        var deptOrder = ['Admin & Accounts', 'Front Office', 'Food & Beverage', 
                          'Housekeeping & Laundry', 'Maintenance', 'Attachment', 'Security'];
        
        var departments = {};
        employees.forEach(function(emp) {
            if (!departments[emp.department]) {
                departments[emp.department] = [];
            }
            departments[emp.department].push(emp);
        });
        
        var html = `
            <style>
                @media print {
                    body { background: white !important; }
                    .no-print { display: none !important; }
                    .btn, .toolbar, .topbar, .sidebar, .card-header, .period-selector { display: none !important; }
                }
                .signin-sheet {
                    font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif;
                    width: 100%;
                    border-collapse: collapse;
                    background: white;
                    color: black;
                    font-size: 11px;
                }
                .signin-sheet th {
                    background: white !important;
                    color: black !important;
                    padding: 10px 6px;
                    text-align: center;
                    border: 1px solid black;
                    font-weight: bold;
                    font-size: 11px;
                }
                .signin-sheet td {
                    padding: 8px 6px;
                    border: 1px solid black;
                    vertical-align: middle;
                    font-size: 11px;
                    color: black;
                    background: white !important;
                }
                .signin-sheet .dept-header td {
                    background: #f0f0f0 !important;
                    color: black !important;
                    font-weight: bold;
                    font-size: 13px;
                    border: 1px solid black;
                }
                .time-field {
                    text-align: center;
                    font-family: 'Courier New', monospace;
                    font-size: 10px;
                    letter-spacing: 1px;
                }
                .sheet-header {
                    text-align: center;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid black;
                }
                .sheet-header .logo-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    margin-bottom: 10px;
                }
                .sheet-header .logo-container img {
                    height: 60px;
                    width: auto;
                }
                .sheet-header .title-text {
                    text-align: center;
                }
                .sheet-header .title-text h1 {
                    font-size: 22px;
                    margin: 0;
                    letter-spacing: 2px;
                    font-weight: bold;
                }
                .sheet-header .title-text h3 {
                    font-size: 14px;
                    margin: 5px 0 0 0;
                    font-weight: normal;
                }
                .instructions {
                    margin-top: 15px;
                    padding: 8px;
                    border: 1px solid black;
                    font-size: 9px;
                    background: white;
                }
            </style>
            
            <div class="sheet-header">
                <div class="logo-container">
                    <img src="/assets/logo.png" alt="Silver Sands Salima Logo" onerror="this.style.display='none'">
                    <div class="title-text">
                        <h1>SILVER SANDS SALIMA</h1>
                        <h3>DAILY ATTENDANCE REGISTER</h3>
                    </div>
                </div>
                <p>Date: ${formatDateForDisplay(selectedDate)}</p>
            </div>
            
            <table class="signin-sheet" id="printable-sheet">
                <thead>
                    <tr>
                        <th style="width:30px;">#</th>
                        <th style="width:200px;">Employee Name</th>
                        <th style="width:150px;">Position</th>
                        <th style="width:140px;">Department</th>
                        <th colspan="2">MORNING SESSION</th>
                        <th colspan="2">AFTERNOON SESSION</th>
                        <th style="width:140px;">Signature</th>
                    </tr>
                    <tr>
                        <th>No.</th>
                        <th>Name</th>
                        <th>Position</th>
                        <th>Dept</th>
                        <th>Time In</th>
                        <th>Time Out</th>
                        <th>Time In</th>
                        <th>Time Out</th>
                        <th>Sign</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (var dIdx = 0; dIdx < deptOrder.length; dIdx++) {
            var deptName = deptOrder[dIdx];
            var deptEmployees = departments[deptName] || [];
            if (!deptEmployees.length) continue;
            
            html += `
                <tr class="dept-header">
                    <td colspan="9"><strong>${deptName.toUpperCase()}</strong></td>
                </tr>
            `;
            
            deptEmployees.forEach(function(emp, index) {
                html += `
                    <tr>
                        <td style="text-align:center;">${index + 1}</td>
                        <td>${emp.name}</td>
                        <td>${emp.position}</td>
                        <td>${emp.department}</td>
                        <td style="text-align:center;"><div class="time-field"></div></td>
                        <td style="text-align:center;"><div class="time-field"></div></td>
                        <td style="text-align:center;"><div class="time-field"></div></td>
                        <td style="text-align:center;"><div class="time-field"></div></td>
                        <td style="text-align:center;"></td>
                    </tr>
                `;
            });
        }
        
        html += `
                </tbody>
            </table>
            
            <div class="instructions">
                <p><strong>INSTRUCTIONS:</strong></p>
                <p>1. Fill in time in 24-hour format (e.g., 0830, 1300, 1700)</p>
                <p>2. Sign to confirm your attendance for the day</p>
                <p>3. Late arrivals must indicate arrival time and reason on back of sheet</p>
            </div>
        `;
        
        var container = document.getElementById('signin-sheet-container');
        if (container) {
            container.innerHTML = html;
        }
        hideLoadingToast();
        showToast('Sign-in sheet generated!', 'success');
        
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to generate sign-in sheet', 'error');
    }
}

function formatDateForDisplay(dateStr) {
    var date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function printSignInSheet() {
    var sheetContent = document.getElementById('signin-sheet-container').innerHTML;
    var selectedDate = document.getElementById('signin-date-picker') ? document.getElementById('signin-date-picker').value : new Date().toISOString().split('T')[0];
    
    var printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SILVER SANDS SALIMA</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif; padding: 15px; background: white; color: black; }
                .print-container { max-width: 1200px; margin: 0 auto; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th { background: white !important; color: black !important; padding: 8px 5px; text-align: center; border: 1px solid black; font-weight: bold; font-size: 10px; }
                td { padding: 6px 5px; border: 1px solid black; vertical-align: middle; font-size: 10px; color: black; background: white !important; }
                .dept-header td { background: #e0e0e0 !important; font-weight: bold; font-size: 12px; border: 1px solid black; }
                .time-field { text-align: center; font-family: 'Courier New', monospace; font-size: 10px; }
                .sheet-header { text-align: center; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid black; }
                .sheet-header .logo-container { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 10px; }
                .sheet-header .logo-container img { height: 50px; width: auto; }
                .sheet-header .title-text h1 { font-size: 18px; margin: 0; letter-spacing: 2px; }
                .sheet-header .title-text h3 { font-size: 12px; margin: 3px 0 0 0; font-weight: normal; }
                .instructions { margin-top: 15px; padding: 8px; border: 1px solid black; font-size: 9px; background: white; }
                @media print { body { padding: 0; margin: 0; } .print-container { margin: 0; padding: 0; } button, .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="print-container">
                ${sheetContent}
            </div>
            <script>
                window.onload = function() { window.print(); };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

async function loadDashboard() {
    showLoadingToast('Loading dashboard...');
    try {
        await loadEmployees();
        var period = getCurrentPeriod();
        var att = await api('GET', '/api/attendance/' + period, null, false);
        var dates = getPeriodDates(period);

        var totP=0,totA=0,totS=0,totL=0,totO=0;
        var deptSummary = {};
        DEPARTMENTS.forEach(function(d) { deptSummary[d] = { staff:0, P:0, A:0, S:0, L:0, O:0 }; });

        allEmployees.forEach(function(emp) {
            var dept = emp.department;
            if (deptSummary[dept]) deptSummary[dept].staff++;
            var empAtt = att[emp._id] || {};
            dates.forEach(function(d) {
                var st = empAtt[d.date] || '';
                if (st==='P'){totP++;if(deptSummary[dept])deptSummary[dept].P++;}
                else if(st==='A'){totA++;if(deptSummary[dept])deptSummary[dept].A++;}
                else if(st==='S'){totS++;if(deptSummary[dept])deptSummary[dept].S++;}
                else if(st==='L'){totL++;if(deptSummary[dept])deptSummary[dept].L++;}
                else if(st==='O'){totO++;if(deptSummary[dept])deptSummary[dept].O++;}
            });
        });

        var presentEl = document.getElementById('dash-present');
        var absentEl = document.getElementById('dash-absent');
        var sickEl = document.getElementById('dash-sick');
        var leaveEl = document.getElementById('dash-leave');
        var offEl = document.getElementById('dash-off');
        if (presentEl) presentEl.textContent = totP;
        if (absentEl) absentEl.textContent = totA;
        if (sickEl) sickEl.textContent = totS;
        if (leaveEl) leaveEl.textContent = totL;
        if (offEl) offEl.textContent = totO;
        
        var totalEmp = document.getElementById('qi-total-emp');
        var daysEl = document.getElementById('qi-days');
        var periodEl = document.getElementById('qi-period');
        var badgeEl = document.getElementById('current-period-badge');
        if (totalEmp) totalEmp.textContent = allEmployees.length;
        if (daysEl) daysEl.textContent = dates.length;
        if (periodEl) periodEl.textContent = getPeriodLabel(period);
        if (badgeEl) badgeEl.textContent = getPeriodLabel(period);
        
        var deptsEl = document.getElementById('qi-depts');
        if (deptsEl) {
            var activeDepts = new Set(allEmployees.map(function(e) { return e.department; }));
            deptsEl.textContent = activeDepts.size || 0;
        }

        var tbody = document.getElementById('dept-summary-body');
        if (tbody) {
            var activeDeptsList = DEPARTMENTS.filter(function(d) { return deptSummary[d] && deptSummary[d].staff > 0; });
            if (!activeDeptsList.length) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray-400)">No employees added yet</td></tr>';
            } else {
                tbody.innerHTML = activeDeptsList.map(function(d) {
                    var s = deptSummary[d];
                    return '<tr>' +
                        '<td><span class="dept-badge">' + d + '</span></td>' +
                        '<td style="text-align:center;font-weight:700;">' + s.staff + '</td>' +
                        '<td style="text-align:center;"><span class="total-badge total-P">' + s.P + '</span></td>' +
                        '<td style="text-align:center;"><span class="total-badge total-A">' + s.A + '</span></td>' +
                        '<td style="text-align:center;"><span class="total-badge total-S">' + s.S + '</span></td>' +
                        '<td style="text-align:center;"><span class="total-badge total-L">' + s.L + '</span></td>' +
                        '<td style="text-align:center;"><span class="total-badge total-O">' + s.O + '</span></td>' +
                        '</tr>';
                }).join('');
            }
        }
        hideLoadingToast();
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to load dashboard', 'error');
    }
}

async function loadReportPeriods() {
    try {
        var periods = await api('GET', '/api/periods', null, false);
        var sel = document.getElementById('report-period-select');
        var curr = getCurrentPeriod();
        var all = periods && periods.length > 0 ? periods : [curr];
        if (all.indexOf(curr) === -1) all.unshift(curr);
        if (sel) {
            sel.innerHTML = all.map(function(p) { return '<option value="' + p + '">' + getPeriodLabel(p) + '</option>'; }).join('');
            if (all.length > 0) {
                loadReportStats(all[0]);
            }
        }
    } catch (err) {}
}

async function loadReportStats(period) {
    if (isViewer()) {
        var container = document.getElementById('report-stats');
        if (container) {
            container.innerHTML = `
                <div class="empty-state" style="padding:24px 0;">
                    <div class="empty-icon"><i class="fas fa-lock"></i></div>
                    <p>Viewers cannot access statistics</p>
                </div>
            `;
        }
        return;
    }
    
    try {
        var response = await fetch('/api/report/stats/' + period, {
            headers: { 'Authorization': 'Bearer ' + getAuthToken() }
        });
        var data = await response.json();
        
        if (data.success) {
            var stats = data.stats;
            var container = document.getElementById('report-stats');
            if (container) {
                container.innerHTML = `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
                        <div style="background:var(--success-light);padding:12px;border-radius:8px;text-align:center;">
                            <div style="font-size:24px;font-weight:800;color:var(--success);">${stats.present}</div>
                            <div style="font-size:11px;color:var(--gray-600);">Present</div>
                        </div>
                        <div style="background:var(--danger-light);padding:12px;border-radius:8px;text-align:center;">
                            <div style="font-size:24px;font-weight:800;color:var(--danger);">${stats.absent}</div>
                            <div style="font-size:11px;color:var(--gray-600);">Absent</div>
                        </div>
                        <div style="background:var(--sick-light);padding:12px;border-radius:8px;text-align:center;">
                            <div style="font-size:24px;font-weight:800;color:var(--sick);">${stats.sick}</div>
                            <div style="font-size:11px;color:var(--gray-600);">Sick</div>
                        </div>
                        <div style="background:var(--warning-light);padding:12px;border-radius:8px;text-align:center;">
                            <div style="font-size:24px;font-weight:800;color:var(--warning);">${stats.leave}</div>
                            <div style="font-size:11px;color:var(--gray-600);">Leave</div>
                        </div>
                        <div style="background:var(--off-light);padding:12px;border-radius:8px;text-align:center;grid-column:span 2;">
                            <div style="font-size:24px;font-weight:800;color:var(--off);">${stats.off}</div>
                            <div style="font-size:11px;color:var(--gray-600);">Day Off</div>
                        </div>
                        <div style="background:var(--gray-100);padding:12px;border-radius:8px;text-align:center;grid-column:span 2;">
                            <div style="font-size:20px;font-weight:800;color:var(--navy);">${stats.total}</div>
                            <div style="font-size:11px;color:var(--gray-600);">Total Records</div>
                        </div>
                    </div>
                `;
            }
        }
    } catch (err) {}
}

async function generateReport() {
    if (isViewer()) {
        showToast('You don\'t have permission to generate reports', 'error');
        return;
    }
    
    var period = document.getElementById('report-period-select')?.value;
    if (!period) { showToast('Please select a period', 'error'); return; }
    
    showLoadingToast('Generating report...');
    try {
        var token = getAuthToken();
        var res = await fetch('/api/report/' + period, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        var blob = await res.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'Report_' + period + '.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        hideLoadingToast();
        showToast('Report downloaded!', 'success');
        
        loadReportStats(period);
    } catch (err) {
        hideLoadingToast();
        showToast('Report generation failed. Please try again.', 'error');
    }
}

async function loadUsers() {
    var role = getUserRole();
    if (role !== 'IT Specialist' && role !== 'System Admin' && role !== 'Supervisor') {
        showToast('Access denied', 'error');
        return;
    }
    
    showLoadingToast('Loading users...');
    try {
        var token = getAuthToken();
        var response = await fetch('/api/users', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        var data = await response.json();
        
        if (Array.isArray(data)) {
            allUsers = data;
            renderUsers(data);
            hideLoadingToast();
        } else {
            hideLoadingToast();
            showToast('Failed to load users', 'error');
        }
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to load users', 'error');
    }
}

function renderUsers(users) {
    var container = document.getElementById('users-container');
    if (!container) return;
    
    var currentUser = getCurrentUser();
    var isDev = isDeveloper();
    
    var createBtn = document.getElementById('create-account-btn');
    if (createBtn) {
        createBtn.style.display = (isDev || getUserRole() === 'Supervisor') ? 'inline-flex' : 'none';
    }
    
    if (!users || users.length === 0) {
        container.innerHTML = 
            '<div class="empty-state">' +
                '<div class="empty-icon"><i class="fas fa-users"></i></div>' +
                '<h3>No Users Found</h3>' +
                '<p>No users have been created yet</p>' +
            '</div>';
        return;
    }
    
    var filteredUsers = users;
    if (!isDev) {
        filteredUsers = users.filter(function(u) {
            return u.username !== 'developer' && u.role !== 'IT Specialist';
        });
    }
    
    var html = '<table class="users-table">' +
        '<thead><tr>' +
            '<th>Username</th>' +
            '<th>Name</th>' +
            '<th>Role</th>' +
            '<th>Department</th>' +
            '<th>Created</th>';
    
    if (isDev) {
        html += '<th style="text-align:center;">Actions</th>';
    }
    
    html += '</tr></thead><tbody>';
    
    filteredUsers.forEach(function(user) {
        var isSelf = currentUser && user.username === currentUser.username;
        var roleClass = 'role-badge';
        if (user.role === 'IT Specialist') roleClass += ' developer';
        else if (user.role === 'System Admin') roleClass += ' admin';
        else if (user.role === 'Supervisor') roleClass += ' supervisor';
        else if (user.role === 'Viewer') roleClass += ' viewer';
        
        html += '<tr>' +
            '<td><strong>' + user.username + (isSelf ? ' <span style="font-size:10px;color:var(--gold);">(you)</span>' : '') + '</strong></td>' +
            '<td>' + user.name + '</td>' +
            '<td><span class="' + roleClass + '">' + user.role + '</span></td>' +
            '<td>' + (user.department || '—') + '</td>' +
            '<td style="font-size:11px;color:var(--gray-600);">' + formatDate(user.created_at) + '</td>';
        
        if (isDev) {
            html += '<td style="text-align:center;">' +
                '<button class="btn btn-primary btn-sm edit-user" data-user-id="' + user._id + '" onclick="editUser(\'' + user._id + '\')" style="margin-right:4px;"><i class="fas fa-edit"></i></button>';
            
            if (!isSelf) {
                html += '<button class="btn btn-danger btn-sm delete-user" data-user-id="' + user._id + '" onclick="deleteUser(\'' + user._id + '\', \'' + user.username + '\')"><i class="fas fa-trash"></i></button>';
            }
            
            html += '</td>';
        }
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openCreateAccount() {
    var role = getUserRole();
    if (role !== 'IT Specialist' && role !== 'Supervisor') {
        showToast('You don\'t have permission to create accounts', 'error');
        return;
    }
    
    document.getElementById('create-account-username').value = '';
    document.getElementById('create-account-name').value = '';
    document.getElementById('create-account-password').value = '';
    document.getElementById('create-account-confirm-password').value = '';
    document.getElementById('create-account-role').value = 'Viewer';
    document.getElementById('create-account-department').value = '';
    
    openModal('create-account-modal');
}

async function createAccount() {
    var role = getUserRole();
    if (role !== 'IT Specialist' && role !== 'Supervisor') {
        showToast('You don\'t have permission to create accounts', 'error');
        return;
    }
    
    var username = document.getElementById('create-account-username').value.trim();
    var name = document.getElementById('create-account-name').value.trim();
    var password = document.getElementById('create-account-password').value;
    var confirmPassword = document.getElementById('create-account-confirm-password').value;
    var accountRole = document.getElementById('create-account-role').value;
    var department = document.getElementById('create-account-department').value;
    
    if (!username) {
        showToast('Username is required', 'error');
        return;
    }
    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
    }
    if (!name) {
        showToast('Full name is required', 'error');
        return;
    }
    if (!password) {
        showToast('Password is required', 'error');
        return;
    }
    if (password.length < 4) {
        showToast('Password must be at least 4 characters', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    if (!accountRole) {
        showToast('Role is required', 'error');
        return;
    }
    
    showLoadingToast('Creating account...');
    
    try {
        var token = getAuthToken();
        var response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                username: username,
                name: name,
                password: password,
                role: accountRole,
                department: department
            })
        });
        var data = await response.json();
        
        hideLoadingToast();
        
        if (data.success) {
            closeModal('create-account-modal');
            showToast('Account created successfully for ' + name, 'success');
            loadUsers();
        } else {
            showToast('Failed to create account: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to create account', 'error');
    }
}

function editUser(userId) {
    if (!isDeveloper()) {
        showToast('Only IT Specialist can edit users', 'error');
        return;
    }
    
    var user = allUsers.find(function(u) { return u._id === userId; });
    if (!user) return;
    
    document.getElementById('edit-user-id').value = user._id;
    document.getElementById('edit-username').value = user.username;
    document.getElementById('edit-name').value = user.name;
    document.getElementById('edit-role').value = user.role;
    document.getElementById('edit-department').value = user.department || '';
    
    openModal('user-modal');
}

async function saveUser() {
    if (!isDeveloper()) {
        showToast('Only IT Specialist can update users', 'error');
        return;
    }
    
    var userId = document.getElementById('edit-user-id').value;
    var name = document.getElementById('edit-name').value.trim();
    var role = document.getElementById('edit-role').value;
    var department = document.getElementById('edit-department').value;
    
    if (!name || !role) {
        showToast('Name and role are required', 'error');
        return;
    }
    
    showLoadingToast('Updating user...');
    try {
        var token = getAuthToken();
        var response = await fetch('/api/users/' + userId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ name: name, role: role, department: department })
        });
        var data = await response.json();
        
        if (data.success) {
            hideLoadingToast();
            closeModal('user-modal');
            showToast('User updated successfully', 'success');
            loadUsers();
        } else {
            hideLoadingToast();
            showToast('Failed to update user: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to update user', 'error');
    }
}

function deleteUser(userId, username) {
    if (!isDeveloper()) {
        showToast('Only IT Specialist can delete users', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to delete user "' + username + '"? This action cannot be undone!')) return;
    
    showLoadingToast('Deleting user...');
    try {
        var token = getAuthToken();
        fetch('/api/users/' + userId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            hideLoadingToast();
            if (data.success) {
                showToast('User deleted successfully', 'success');
                loadUsers();
            } else {
                showToast('Failed to delete user: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(function(err) {
            hideLoadingToast();
            showToast('Failed to delete user', 'error');
        });
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to delete user', 'error');
    }
}

function loadProfile() {
    var userStr = localStorage.getItem('hrms_user');
    if (!userStr) return;
    var user = JSON.parse(userStr);
    
    var avatar = document.getElementById('profile-avatar');
    var fullName = document.getElementById('profile-full-name');
    var username = document.getElementById('profile-username');
    var role = document.getElementById('profile-user-role');
    var dept = document.getElementById('profile-user-dept');
    
    if (avatar) avatar.textContent = user.name.charAt(0);
    if (fullName) fullName.textContent = user.name;
    if (username) username.textContent = user.username;
    if (role) role.textContent = user.role || 'No role';
    if (dept) dept.textContent = user.department || 'No department';
    
    var editUsername = document.getElementById('edit-profile-username');
    var editName = document.getElementById('edit-profile-name');
    if (editUsername) editUsername.value = user.username;
    if (editName) editName.value = user.name;
}

async function updateProfile() {
    var username = document.getElementById('edit-profile-username').value.trim();
    var name = document.getElementById('edit-profile-name').value.trim();
    var currentPassword = document.getElementById('edit-profile-current-password').value;
    var newPassword = document.getElementById('edit-profile-new-password').value;
    var confirmPassword = document.getElementById('edit-profile-confirm-password').value;
    
    if (!name) {
        showToast('Name is required', 'error');
        return;
    }
    
    var updateData = {
        name: name,
        username: username
    };
    
    if (newPassword) {
        if (!currentPassword) {
            showToast('Current password is required to change password', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }
        if (newPassword.length < 4) {
            showToast('New password must be at least 4 characters', 'error');
            return;
        }
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
    }
    
    showLoadingToast('Updating profile...');
    
    try {
        var token = getAuthToken();
        var response = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(updateData)
        });
        var data = await response.json();
        
        hideLoadingToast();
        
        if (data.success) {
            var user = JSON.parse(localStorage.getItem('hrms_user'));
            user.name = data.user.name;
            user.username = data.user.username;
            localStorage.setItem('hrms_user', JSON.stringify(user));
            
            closeModal('profile-edit-modal');
            showToast('Profile updated successfully!', 'success');
            displayUserInfo();
            loadProfile();
            
            document.getElementById('edit-profile-current-password').value = '';
            document.getElementById('edit-profile-new-password').value = '';
            document.getElementById('edit-profile-confirm-password').value = '';
        } else {
            showToast('Failed to update profile: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (err) {
        hideLoadingToast();
        showToast('Failed to update profile', 'error');
    }
}

function openProfileEdit() {
    var user = getCurrentUser();
    if (!user) return;
    
    document.getElementById('edit-profile-username').value = user.username;
    document.getElementById('edit-profile-name').value = user.name;
    document.getElementById('edit-profile-current-password').value = '';
    document.getElementById('edit-profile-new-password').value = '';
    document.getElementById('edit-profile-confirm-password').value = '';
    
    openModal('profile-edit-modal');
}

function toggleDarkMode() {
    var body = document.body;
    var headerIcon = document.getElementById('header-dark-icon');
    var profileIcon = document.getElementById('profile-dark-icon');
    var profileText = document.getElementById('profile-dark-text');
    
    body.classList.toggle('dark-mode');
    
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('darkMode', 'enabled');
        if (headerIcon) headerIcon.className = 'fas fa-sun';
        if (profileIcon) profileIcon.className = 'fas fa-sun';
        if (profileText) profileText.textContent = 'Light Mode';
    } else {
        localStorage.setItem('darkMode', 'disabled');
        if (headerIcon) headerIcon.className = 'fas fa-moon';
        if (profileIcon) profileIcon.className = 'fas fa-moon';
        if (profileText) profileText.textContent = 'Dark Mode';
    }
}

function loadDarkModePreference() {
    var darkMode = localStorage.getItem('darkMode');
    var headerIcon = document.getElementById('header-dark-icon');
    var profileIcon = document.getElementById('profile-dark-icon');
    var profileText = document.getElementById('profile-dark-text');
    
    if (darkMode === 'enabled') {
        document.body.classList.add('dark-mode');
        if (headerIcon) headerIcon.className = 'fas fa-sun';
        if (profileIcon) profileIcon.className = 'fas fa-sun';
        if (profileText) profileText.textContent = 'Light Mode';
    } else {
        document.body.classList.remove('dark-mode');
        if (headerIcon) headerIcon.className = 'fas fa-moon';
        if (profileIcon) profileIcon.className = 'fas fa-moon';
        if (profileText) profileText.textContent = 'Dark Mode';
    }
}

function openModal(id) { 
    var el = document.getElementById(id);
    if (el) el.classList.add('open'); 
}

function closeModal(id) { 
    var el = document.getElementById(id);
    if (el) el.classList.remove('open'); 
}

document.querySelectorAll('.modal-overlay').forEach(function(m) {
    m.addEventListener('click', function(e) { 
        if (e.target === m) m.classList.remove('open'); 
    });
});

function toast(msg, type) {
    showToast(msg, type);
}

function formatDate(d) {
    if (!d) return '—';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) {
        dt = new Date(d + 'T00:00:00');
        if (isNaN(dt.getTime())) return '—';
    }
    return dt.toLocaleDateString('default', { day: '2-digit', month: 'short', year: 'numeric' });
}

if (document.getElementById('new-period-input')) {
    document.getElementById('new-period-input').addEventListener('input', updatePeriodPreview);
}

function setupSecretDeveloperButton() {
    var devName = document.querySelector('.developer-name');
    if (devName) {
        devName.addEventListener('click', function(e) {
            var role = getUserRole();
            if (role === 'IT Specialist') {
                navigate('activitylogs');
            }
        });
    }
}

async function init() {
    try {
        var isAuth = await verifyAuth();
        if (!isAuth) {
            window.location.href = '/login';
            return;
        }
        
        displayUserInfo();
        loadDarkModePreference();
        updateNavigationVisibility();
        setupSecretDeveloperButton();
        initAutoLogout();
        initMobileMegaMenu();
        
        await loadEmployees();
        await initAttendance();
        await loadDashboard();
        
        if (document.getElementById('page-security')?.classList.contains('active')) {
            loadUsers();
        }
        
        if (document.getElementById('page-summary')?.classList.contains('active')) {
            loadSummaryPage();
        }
        
    } catch (err) {
        showToast('Failed to initialize system. Please refresh.', 'error');
    }
}

init();