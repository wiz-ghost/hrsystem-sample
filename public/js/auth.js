function showToast(message, type) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${type === 'error' ? '#dc3545' : '#28a745'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    margin-top: 10px;
    animation: slideIn 0.3s ease;
    font-family: Arial, sans-serif;
  `;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}


async function handleLogin(event) {
  event.preventDefault();
  console.log('Login clicked');
  
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  
  if (!username || !password) {
    showToast('Please enter username and password', 'error');
    return;
  }
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '⏳ Logging in...';
  submitBtn.disabled = true;
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {

      localStorage.setItem('hrms_token', data.token);
      localStorage.setItem('hrms_user', JSON.stringify(data.user));
      
      showToast(`Welcome, ${data.user.name}!`, 'success');
      

      setTimeout(() => {
        window.location.href = '/app';
      }, 500);
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Cannot connect to server. Make sure server is running on port 3000', 'error');
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

if (window.location.pathname === '/' || window.location.pathname === '/login.html' || window.location.pathname === '/login') {
  const token = localStorage.getItem('hrms_token');
  if (token) {
    fetch('/api/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (res.ok) {
        window.location.href = '/app';
      } else {
        localStorage.removeItem('hrms_token');
        localStorage.removeItem('hrms_user');
      }
    })
    .catch(() => {
      console.log('Server not reachable');
    });
  }
}
if (document.getElementById('login-form')) {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}