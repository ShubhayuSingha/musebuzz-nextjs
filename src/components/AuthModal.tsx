// src/components/AuthModal.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Modal from './Modal';
import useAuthModalStore from '@/stores/useAuthModalStore';

const AuthModal = () => {
  const supabaseClient = useSupabaseClient();
  const router = useRouter();
  const { isOpen, onClose, view, setView } = useAuthModalStore();

  useEffect(() => {
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        onClose();        // Close the modal automatically
        router.refresh(); // Instantly update the page to show the logged-in UI
      }
    });

    return () => subscription.unsubscribe();
  }, [supabaseClient, onClose, router]);

  const onChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const isSignIn = view === 'sign_in';
  const isForgotPassword = view === 'forgotten_password';

  return (
    <Modal
      isOpen={isOpen}
      onChange={onChange}
      className="max-w-[430px] min-h-[490px] sm:min-h-[500px] p-5 sm:p-6"
      bodyClassName="overflow-y-auto scrollbar-hide"
    >
      <div className="flex flex-col justify-between h-full min-h-[440px] font-sans">
        <div>
          {/* Centered Capsule Toggle with 80px+ clearance from the close button */}
          {!isForgotPassword ? (
            <div className="flex justify-center mb-4">
              <div className="flex items-center p-1 bg-zinc-950/80 rounded-full border border-zinc-800 w-full max-w-[250px]">
                <button
                  type="button"
                  onClick={() => setView('sign_in')}
                  className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold font-sans transition-all duration-200 active:scale-95 cursor-pointer text-center ${
                    isSignIn
                      ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => setView('sign_up')}
                  className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold font-sans transition-all duration-200 active:scale-95 cursor-pointer text-center ${
                    !isSignIn
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Create account
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setView('sign_in')}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition font-medium cursor-pointer"
              >
                <span>←</span>
                <span>Back to log in</span>
              </button>
            </div>
          )}

          {/* Clean Header */}
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-white tracking-tight font-sans">
              {isForgotPassword 
                ? 'Reset your password' 
                : isSignIn 
                  ? 'Log in to your account' 
                  : 'Create your free account'}
            </h2>
            <p className="mt-1 text-xs text-neutral-400 font-sans">
              {isForgotPassword 
                ? "Enter your email and we'll send a recovery link" 
                : isSignIn 
                  ? 'Access your library, playlists, and synced queue' 
                  : 'Save favorites, build playlists, and listen offline'}
            </p>
          </div>

          {/* Supabase Auth Form */}
          <Auth
            key={view}
            view={view}
            theme="dark" 
            magicLink={false}
            showLinks={false}
            providers={['google']}
            redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined}
            supabaseClient={supabaseClient}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#9333ea',
                    brandAccent: '#7e22ce',
                    brandButtonText: '#ffffff',
                    defaultButtonBackground: '#18181b',
                    defaultButtonBackgroundHover: '#27272a',
                    defaultButtonBorder: '#3f3f46',
                    defaultButtonText: '#ffffff',
                    dividerBackground: '#27272a',
                    inputBackground: '#121215',
                    inputBorder: '#27272a',
                    inputBorderFocus: '#a855f7',
                    inputBorderHover: '#3f3f46',
                    inputLabelText: '#d4d4d8',
                    inputPlaceholder: '#71717a',
                    inputText: '#ffffff',
                    anchorTextColor: '#c084fc',
                    anchorTextHoverColor: '#e9d5ff',
                  },
                  fonts: {
                    bodyFontFamily: 'var(--font-figtree), Figtree, ui-sans-serif, system-ui, sans-serif',
                    buttonFontFamily: 'var(--font-figtree), Figtree, ui-sans-serif, system-ui, sans-serif',
                    inputFontFamily: 'var(--font-figtree), Figtree, ui-sans-serif, system-ui, sans-serif',
                    labelFontFamily: 'var(--font-figtree), Figtree, ui-sans-serif, system-ui, sans-serif',
                  },
                  space: {
                    buttonPadding: '9px 16px',
                    inputPadding: '9px 14px',
                    spaceSmall: '4px',
                    spaceMedium: '8px',
                    spaceLarge: '12px',
                    labelBottomMargin: '4px',
                    anchorBottomMargin: '4px',
                    emailInputSpacing: '8px',
                    socialAuthSpacing: '8px',
                  },
                  radii: {
                    buttonBorderRadius: '9999px',
                    inputBorderRadius: '10px',
                  }
                }
              },
              className: {
                button: 'font-sans font-semibold text-sm transition-all active:scale-[0.98] shadow-sm',
                input: 'font-sans text-sm transition-colors placeholder:text-neutral-500 font-normal focus:ring-1 focus:ring-purple-500',
                label: 'font-sans text-xs font-medium text-neutral-300 tracking-wide block mb-1',
                divider: 'my-2.5 text-neutral-500 text-xs font-sans',
              }
            }}
          />
        </div>

        {/* Bottom Links (Constant height across modes to prevent vertical layout shifts) */}
        {!isForgotPassword ? (
          <div className="flex flex-col items-center justify-center gap-1.5 mt-3 pt-2 text-xs font-sans min-h-[44px]">
            {isSignIn ? (
              <button
                type="button"
                onClick={() => setView('forgotten_password')}
                className="text-neutral-400 hover:text-purple-300 font-medium transition cursor-pointer text-xs"
              >
                Forgot your password?
              </button>
            ) : (
              /* Invisible spacer maintaining exact identical vertical height in Create Account mode */
              <div className="h-[18px] opacity-0 pointer-events-none select-none" aria-hidden="true">
                &nbsp;
              </div>
            )}
            <p className="text-neutral-400 text-xs font-sans">
              {isSignIn ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => setView(isSignIn ? 'sign_up' : 'sign_in')}
                className="text-white hover:text-purple-400 font-semibold underline underline-offset-2 transition cursor-pointer ml-1.5"
              >
                {isSignIn ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        ) : (
          <div className="flex justify-center mt-3 pt-2 text-xs font-sans min-h-[44px]">
            <button
              type="button"
              onClick={() => setView('sign_in')}
              className="text-purple-400 hover:text-purple-300 font-semibold transition cursor-pointer"
            >
              ← Back to Log in
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AuthModal;
