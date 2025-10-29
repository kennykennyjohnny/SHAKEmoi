// Module d'authentification - Login, Signup, Logout

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.currentProfile = null;
  }

  // Initialisation : vérifier si un utilisateur est déjà connecté
  async init() {
    try {
      const user = await getCurrentUser();

      if (user) {
        this.currentUser = user;
        this.currentProfile = await getUserProfile(user.id);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erreur d\'initialisation auth:', error);
      return false;
    }
  }

  // Inscription d'un nouvel utilisateur
  async signup(username, email, password, color) {
    try {
      // Vérifier si le username existe déjà
      const { data: existingUser, error: checkError } = await supabaseClient
        .from('users_profile')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        throw new Error('Ce nom d\'utilisateur est déjà pris');
      }

      // Créer le compte auth
      const { data: authData, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('Erreur lors de la création du compte');
      }

      // Créer le profil utilisateur
      const { error: profileError } = await supabaseClient
        .from('users_profile')
        .insert([
          {
            id: authData.user.id,
            username: username,
            email: email,
            color: color,
            feels_count: 0,
            feelings_count: 0
          }
        ]);

      if (profileError) {
        // Si erreur de création de profil, supprimer le compte auth
        console.error('Erreur création profil:', profileError);
        throw new Error('Erreur lors de la création du profil');
      }

      this.currentUser = authData.user;
      this.currentProfile = await getUserProfile(authData.user.id);

      return { success: true };
    } catch (error) {
      console.error('Erreur signup:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'inscription'
      };
    }
  }

  // Connexion d'un utilisateur existant
  async login(email, password) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('Identifiants incorrects');
      }

      this.currentUser = data.user;
      this.currentProfile = await getUserProfile(data.user.id);

      return { success: true };
    } catch (error) {
      console.error('Erreur login:', error);
      return {
        success: false,
        error: error.message || 'Email ou mot de passe incorrect'
      };
    }
  }

  // Déconnexion
  async logout() {
    try {
      const { error } = await supabaseClient.auth.signOut();

      if (error) throw error;

      this.currentUser = null;
      this.currentProfile = null;

      return { success: true };
    } catch (error) {
      console.error('Erreur logout:', error);
      return {
        success: false,
        error: 'Erreur lors de la déconnexion'
      };
    }
  }

  // Récupérer les données de l'utilisateur courant
  getUser() {
    return this.currentUser;
  }

  getProfile() {
    return this.currentProfile;
  }

  // Rafraîchir le profil
  async refreshProfile() {
    if (this.currentUser) {
      this.currentProfile = await getUserProfile(this.currentUser.id);
      return this.currentProfile;
    }
    return null;
  }
}

// Initialisation du manager d'auth
window.authManager = new AuthManager();
