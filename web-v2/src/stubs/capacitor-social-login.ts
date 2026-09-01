/** Web/Vercel build stub — real plugin is used only in Capacitor native shells.
 *  On web, Google sign-in goes through Google Identity Services instead. */
export const SocialLogin = {
  async initialize(_opts: unknown): Promise<void> {},
  async login(_opts: unknown): Promise<{ result?: { idToken?: string } }> {
    return {};
  },
  async logout(_opts: unknown): Promise<void> {},
};
