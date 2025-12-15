// SHAKEMOI - Authentication Logic

// DOM Elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const toggleBtns = document.querySelectorAll('.toggle-btn');
const switchLinks = document.querySelectorAll('.switch-link');
const colorBtns = document.querySelectorAll('.color-btn');

let selectedColor = '#B4A7D6'; // Default color

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
  // Toggle buttons (Login/Signup)
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      switchMode(mode);
    });
  });

  // Switch links
  switchLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const mode = link.dataset.mode;
      switchMode(mode);
    });
  });

  // Color selection
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedColor = btn.dataset.color;
    });
  });

  // Form submissions
  loginForm.addEventListener('submit', handleLogin);
  signupForm.addEventListener('submit', handleSignup);
}

// Switch between Login and Signup
function switchMode(mode) {
  toggleBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  if (mode === 'login') {
    loginForm.classList.add('active');
    signupForm.classList.remove('active');
  } else {
    loginForm.classList.remove('active');
    signupForm.classList.add('active');
  }
}

// Check if user is already logged in
async function checkAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      // User is logged in, redirect to app
      window.location.href = 'app.html';
    }
  } catch (error) {
    console.error('Error checking auth:', error);
  }
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  const submitBtn = loginForm.querySelector('.submit-btn');

  // Clear previous errors
  errorDiv.textContent = '';

  // Validation
  if (!email || !password) {
    errorDiv.textContent = 'Veuillez remplir tous les champs';
    return;
  }

  // Disable button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Connexion...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Success - redirect to app
    window.location.href = 'app.html';

  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = error.message || 'Identifiants incorrects';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';
  }
}

// Handle Signup
async function handleSignup(e) {
  e.preventDefault();

  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errorDiv = document.getElementById('signup-error');
  const submitBtn = signupForm.querySelector('.submit-btn');

  // Clear previous errors
  errorDiv.textContent = '';

  // Validation
  if (!username || !email || !password) {
    errorDiv.textContent = 'Veuillez remplir tous les champs';
    return;
  }

  if (username.length < 3 || username.length > 20) {
    errorDiv.textContent = 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères';
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errorDiv.textContent = 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et _';
    return;
  }

  if (password.length < 6) {
    errorDiv.textContent = 'Le mot de passe doit contenir au moins 6 caractères';
    return;
  }

  // Disable button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Inscription...';

  try {
    // 1. Check if username already exists
    const { data: existingUser } = await supabase
      .from('users_profile')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      throw new Error('Ce nom d\'utilisateur est déjà pris');
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) throw authError;

    if (!authData.user) {
      throw new Error('Erreur lors de la création du compte');
    }

    // 3. Create user profile
    const { error: profileError } = await supabase
      .from('users_profile')
      .insert([{
        id: authData.user.id,
        username: username,
        email: email,
        color: selectedColor,
        feels_count: 0,
        feelings_count: 0
      }]);

    if (profileError) {
      console.error('Profile creation error:', profileError);
      throw new Error('Erreur lors de la création du profil');
    }

    // Success - redirect to app
    alert('Compte créé avec succès ! Bienvenue sur SHAKEMOI 🎵');
    window.location.href = 'app.html';

  } catch (error) {
    console.error('Signup error:', error);
    errorDiv.textContent = error.message || 'Erreur lors de l\'inscription';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Créer mon compte';
  }
}
