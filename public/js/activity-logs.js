var ActivityLogs = {
    currentPage: 0,
    pageSize: 50,
    totalLogs: 0,
    filters: {},
    logsData: [],
    isDeveloper: false,
    currentUser: null,
    
    init: function() {
        var role = getUserRole();
        this.isDeveloper = (role === 'IT Specialist');
        this.currentUser = getCurrentUser();
        this.loadLogs();
        this.setupEventListeners();
        this.loadFilterOptions();
    },
    
    setupEventListeners: function() {
        var self = this;
        
        var applyBtn = document.getElementById('apply-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', function() {
                self.applyFilters();
            });
        }
        
        var clearBtn = document.getElementById('clear-filters');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                self.clearFilters();
            });
        }
        
        var refreshBtn = document.getElementById('refresh-logs');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                self.loadLogs();
            });
        }
        
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-log')) {
                var logId = e.target.dataset.logId;
                self.deleteLog(logId);
            }
        });
        
        var clearAllBtn = document.getElementById('clear-all-logs');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', function() {
                self.clearAllLogs();
            });
        }
        
        var prevBtn = document.getElementById('prev-page');
        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                if (self.currentPage > 0) {
                    self.currentPage--;
                    self.loadLogs();
                }
            });
        }
        
        var nextBtn = document.getElementById('next-page');
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                if ((self.currentPage + 1) * self.pageSize < self.totalLogs) {
                    self.currentPage++;
                    self.loadLogs();
                }
            });
        }
    },
    
    loadFilterOptions: function() {
        var self = this;
        var token = getAuthToken();
        
        fetch('/api/activity-logs?limit=1', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success && data.filters) {
                var actionSelect = document.getElementById('filter-action');
                var userSelect = document.getElementById('filter-user');
                
                if (actionSelect && data.filters.actions) {
                    actionSelect.innerHTML = '<option value="">All Actions</option>';
                    data.filters.actions.forEach(function(action) {
                        var option = document.createElement('option');
                        option.value = action;
                        option.textContent = action.replace(/_/g, ' ');
                        actionSelect.appendChild(option);
                    });
                }
                
                if (userSelect) {
                    if (self.isDeveloper && data.filters.users) {
                        userSelect.style.display = 'block';
                        userSelect.innerHTML = '<option value="">All Users</option>';
                        data.filters.users.forEach(function(user) {
                            var option = document.createElement('option');
                            option.value = user;
                            option.textContent = user;
                            userSelect.appendChild(option);
                        });
                    } else {
                        userSelect.style.display = 'none';
                    }
                }
            }
        })
        .catch(function(err) {
            console.error('Error loading filter options:', err);
        });
    },
    
    loadLogs: function() {
        var self = this;
        var token = getAuthToken();
        var params = new URLSearchParams({
            limit: self.pageSize,
            skip: self.currentPage * self.pageSize
        });
        
        if (self.filters.action) params.append('action', self.filters.action);
        
        if (self.isDeveloper && self.filters.username) {
            params.append('username', self.filters.username);
        } else {
            if (self.currentUser && self.currentUser.username) {
                params.append('username', self.currentUser.username);
            }
        }
        
        if (self.filters.date_from) params.append('date_from', self.filters.date_from);
        if (self.filters.date_to) params.append('date_to', self.filters.date_to);
        
        showLoadingToast('Loading activity logs...');
        
        fetch('/api/activity-logs?' + params.toString(), {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            hideLoadingToast();
            if (data.success) {
                self.logsData = data.logs;
                self.totalLogs = data.total;
                self.renderLogs();
                self.updatePagination();
            } else {
                showToast('Failed to load activity logs', 'error');
            }
        })
        .catch(function(err) {
            hideLoadingToast();
            console.error('Error loading logs:', err);
            showToast('Failed to load activity logs', 'error');
        });
    },
    
    renderLogs: function() {
        var container = document.getElementById('logs-container');
        if (!container) return;
        
        if (!this.logsData || this.logsData.length === 0) {
            container.innerHTML = 
                '<div class="empty-state">' +
                    '<div class="empty-icon"><i class="fas fa-clipboard-list"></i></div>' +
                    '<h3>No Activity Logs</h3>' +
                    '<p>' + (this.isDeveloper ? 'No logs match your current filters' : 'You have no activity logs yet') + '</p>' +
                '</div>';
            return;
        }
        
        var html = '<table class="logs-table">' +
            '<thead><tr>' +
                '<th>Timestamp</th>' +
                '<th>User</th>' +
                '<th>Action</th>' +
                '<th>Details</th>' +
                '<th>IP Address</th>' +
                '<th>Status</th>';
        
        if (this.isDeveloper) {
            html += '<th style="text-align:center;">Actions</th>';
        }
        
        html += '</tr></thead><tbody>';
        
        var self = this;
        this.logsData.forEach(function(log) {
            var statusClass = log.success ? 'status-success' : 'status-failed';
            var statusText = log.success ? 'Success' : 'Failed';
            
            html += '<tr>' +
                '<td style="font-size:11px;color:var(--gray-600);">' + self.formatTimestamp(log.timestamp) + '</td>' +
                '<td><strong>' + self.escapeHtml(log.username) + '</strong><br><span style="font-size:10px;color:var(--gray-400);">' + self.escapeHtml(log.user_role) + '</span></td>' +
                '<td><span class="action-badge">' + self.escapeHtml(log.action.replace(/_/g, ' ')) + '</span></td>' +
                '<td style="font-size:12px;">' + self.formatDetails(log.details) + '</td>' +
                '<td style="font-size:11px;color:var(--gray-600);">' + self.escapeHtml(log.ip_address || 'N/A') + '</td>' +
                '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>';
            
            if (self.isDeveloper) {
                html += '<td style="text-align:center;">' +
                    '<button class="btn btn-danger btn-sm delete-log" data-log-id="' + log._id + '" style="padding:4px 10px;font-size:11px;">Delete</button>' +
                '</td>';
            }
            
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    },
    
    updatePagination: function() {
        var totalPages = Math.ceil(this.totalLogs / this.pageSize);
        var pageInfo = document.getElementById('page-info');
        var prevBtn = document.getElementById('prev-page');
        var nextBtn = document.getElementById('next-page');
        
        if (pageInfo) {
            pageInfo.textContent = 'Page ' + (this.currentPage + 1) + ' of ' + (totalPages || 1);
        }
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages - 1;
        }
    },
    
    applyFilters: function() {
        this.filters = {
            action: document.getElementById('filter-action') ? document.getElementById('filter-action').value || '' : '',
            username: this.isDeveloper && document.getElementById('filter-user') ? document.getElementById('filter-user').value || '' : '',
            date_from: document.getElementById('filter-date-from') ? document.getElementById('filter-date-from').value || '' : '',
            date_to: document.getElementById('filter-date-to') ? document.getElementById('filter-date-to').value || '' : ''
        };
        
        this.currentPage = 0;
        this.loadLogs();
    },
    
    clearFilters: function() {
        var actionSelect = document.getElementById('filter-action');
        var userSelect = document.getElementById('filter-user');
        var dateFrom = document.getElementById('filter-date-from');
        var dateTo = document.getElementById('filter-date-to');
        
        if (actionSelect) actionSelect.value = '';
        if (userSelect) userSelect.value = '';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        
        this.filters = {};
        this.currentPage = 0;
        this.loadLogs();
    },
    
    deleteLog: function(logId) {
        if (!this.isDeveloper) {
            showToast('You don\'t have permission to delete logs', 'error');
            return;
        }
        if (!confirm('Are you sure you want to delete this log entry?')) return;
        
        var token = getAuthToken();
        showLoadingToast('Deleting log...');
        
        fetch('/api/activity-logs/' + logId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            hideLoadingToast();
            if (data.success) {
                showToast('Log deleted successfully', 'success');
                ActivityLogs.loadLogs();
            } else {
                showToast('Failed to delete log', 'error');
            }
        })
        .catch(function(err) {
            hideLoadingToast();
            console.error('Error deleting log:', err);
            showToast('Failed to delete log', 'error');
        });
    },
    
    clearAllLogs: function() {
        if (!this.isDeveloper) {
            showToast('You don\'t have permission to clear logs', 'error');
            return;
        }
        var total = this.totalLogs;
        if (!confirm('Are you sure you want to delete ALL ' + total + ' activity logs? This action cannot be undone!')) return;
        
        var token = getAuthToken();
        showLoadingToast('Clearing all logs...');
        
        fetch('/api/activity-logs/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                confirm: true,
                filters: {}
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            hideLoadingToast();
            if (data.success) {
                showToast('Cleared ' + data.deleted_count + ' logs', 'success');
                ActivityLogs.loadLogs();
            } else {
                showToast('Failed to clear logs: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(function(err) {
            hideLoadingToast();
            console.error('Error clearing logs:', err);
            showToast('Failed to clear logs', 'error');
        });
    },
    
    formatTimestamp: function(timestamp) {
        if (!timestamp) return 'N/A';
        var date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },
    
    formatDetails: function(details) {
        if (!details || typeof details !== 'object') return '—';
        var parts = [];
        for (var key in details) {
            if (details.hasOwnProperty(key)) {
                var value = details[key];
                if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                parts.push(key + ': ' + this.escapeHtml(value));
            }
        }
        return parts.join('<br>') || '—';
    },
    
    escapeHtml: function(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.ActivityLogs = ActivityLogs;
