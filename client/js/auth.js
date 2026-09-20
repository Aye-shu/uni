/* =====================================================
   UNIBUS - Auth Page JavaScript
===================================================== */

// ---------- Animation Timings ----------
const time_to_show_login = 400;
const time_to_hidden_login = 200;
const time_to_show_sign_up = 100;
const time_to_hidden_sign_up = 400;
const time_to_hidden_all = 500;

// ---------- Switch to Login View ----------
function change_to_login() {
  document.querySelector('.cont_forms').className = 'cont_forms cont_forms_active_login';
  document.querySelector('.cont_form_login').style.display = 'block';
  document.querySelector('.cont_form_sign_up').style.opacity = '0';

  setTimeout(() => {
    document.querySelector('.cont_form_login').style.opacity = '1';
  }, time_to_show_login);

  setTimeout(() => {
    document.querySelector('.cont_form_sign_up').style.display = 'none';
  }, time_to_hidden_login);
}

// ---------- Switch to Signup View ----------
function change_to_sign_up() {
  document.querySelector('.cont_forms').className = 'cont_forms cont_forms_active_sign_up';
  document.querySelector('.cont_form_sign_up').style.display = 'block';
  document.querySelector('.cont_form_login').style.opacity = '0';

  setTimeout(() => {
    document.querySelector('.cont_form_sign_up').style.opacity = '1';
  }, time_to_show_sign_up);

  setTimeout(() => {
    document.querySelector('.cont_form_login').style.display = 'none';
  }, time_to_hidden_sign_up);
}

// ---------- Collapse Both ----------
function hidden_login_and_sign_up() {
  document.querySelector('.cont_forms').className = 'cont_forms';
  document.querySelector('.cont_form_sign_up').style.opacity = '0';
  document.querySelector('.cont_form_login').style.opacity = '0';

  setTimeout(() => {
    document.querySelector('.cont_form_sign_up').style.display = 'none';
    document.querySelector('.cont_form_login').style.display = 'none';
  }, time_to_hidden_all);
}

// ---------- Messages ----------
function showMessage(elementId, message, type = 'error') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = 'form-message ' + type;
}

function hideMessage(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = 'form-message';
  el.textContent = '';
}

// ---------- Role Selector ----------
// Only "student" is self-signup. Admin accounts must be created by DB / seed.
// Driver accounts must be created by an admin in the dashboard.
window.selectRole = function (role) {
  document.querySelectorAll('.role-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.role === role);
  });

  const studentForm = document.getElementById('signupFormStudent');
  const adminForm   = document.getElementById('signupFormAdmin');
  const notice      = document.getElementById('restrictedNotice');

  if (role === 'student') {
    studentForm.style.display = 'block';
    if (adminForm) adminForm.style.display = 'none';
    if (notice) notice.style.display = 'none';
  } else {
    // Any non-student role shows the restricted notice
    studentForm.style.display = 'none';
    if (adminForm) adminForm.style.display = 'none';
    if (notice) {
      notice.style.display = 'block';
      notice.innerHTML = role === 'admin'
        ? '<i class="fas fa-lock"></i> Admin accounts are created by the system administrator. Contact your transport office.'
        : '<i class="fas fa-lock"></i> Driver accounts are created by the admin. Please contact your transport office.';
    }
  }
};

// ---------- LOGIN ----------
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');

  hideMessage('loginMessage');

  if (!email || !password) {
    showMessage('loginMessage', 'Please fill in all fields.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'LOGGING IN...';

  try {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.error || 'Invalid email or password');
    }

    showMessage('loginMessage', '✅ Login successful! Redirecting...', 'success');

    const role = data.user?.role || 'student';

    setTimeout(() => {
      if (role === 'admin')       window.location.href = '/admin/dashboard.html';
      else if (role === 'driver') window.location.href = '/driver/dashboard.html';
      else                        window.location.href = '/student/dashboard.html';
    }, 900);

  } catch (err) {
    showMessage('loginMessage', '❌ ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'LOGIN';
  }
}

// ---------- STUDENT SIGNUP ----------
async function handleStudentSignup(e) {
  e.preventDefault();

  const name       = document.getElementById('studentName').value.trim();
  const email      = document.getElementById('studentEmail').value.trim();
  const studentId  = document.getElementById('studentId').value.trim();
  const phone      = document.getElementById('studentPhone').value.trim();
  const department = document.getElementById('studentDepartment').value;
  const password   = document.getElementById('studentPassword').value;
  const confirm    = document.getElementById('studentConfirm').value;
  const terms      = document.getElementById('studentTerms').checked;
  const btn        = document.getElementById('studentSignupBtn');

  hideMessage('studentMessage');

  if (!name || !email || !studentId || !department || !password || !confirm) {
    showMessage('studentMessage', 'Please fill in all required fields.', 'error');
    return;
  }
  if (password.length < 8) {
    showMessage('studentMessage', 'Password must be at least 8 characters.', 'error');
    return;
  }
  if (password !== confirm) {
    showMessage('studentMessage', 'Passwords do not match.', 'error');
    return;
  }
  if (!terms) {
    showMessage('studentMessage', 'Please agree to the Terms & Conditions.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'CREATING...';

  try {
    // NOTE: "role" is intentionally NOT sent — Better Auth ignores it anyway
    // and defaults to "student". Sending it doesn't hurt but it's noise.
    const res = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name,
        email,
        password,
        studentId,
        department,
        phone: phone || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Signup failed');

    showMessage('studentMessage', '✅ Account created! Switching to login...', 'success');
    setTimeout(() => {
      document.getElementById('signupFormStudent').reset();
      change_to_login();
      hideMessage('studentMessage');
      document.getElementById('loginEmail').value = email;
      document.getElementById('loginPassword').focus();
    }, 1400);

  } catch (err) {
    showMessage('studentMessage', '❌ ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'SIGN UP';
  }
}

// ---------- On Page Load ----------
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const studentForm = document.getElementById('signupFormStudent');

  if (loginForm)   loginForm.addEventListener('submit', handleLogin);
  if (studentForm) studentForm.addEventListener('submit', handleStudentSignup);

  if (window.location.pathname.endsWith('signup.html')) {
    setTimeout(() => change_to_sign_up(), 100);
  }
});