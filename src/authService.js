import insforge from './insforge';

/**
 * Authentication Service
 * Uses official @insforge/sdk auth API.
 */
export const authService = {
  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    return await insforge.auth.getCurrentUser();
  },

  /**
   * Sign in with email and password
   */
  async signIn(email, password) {
    return await insforge.auth.signInWithPassword({ email, password });
  },

  /**
   * Sign up new user
   */
  async signUp(email, password, name, redirectTo = window.location.origin) {
    return await insforge.auth.signUp({ email, password, name, redirectTo });
  },

  /**
   * Sign out current user
   */
  async signOut() {
    if (typeof insforge.auth.signOut === 'function') {
      return await insforge.auth.signOut();
    }
  },
};

export default authService;
