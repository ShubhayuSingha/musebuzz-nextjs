// src/components/AuthModal.tsx
'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Modal from './Modal';
import useAuthModalStore from '@/stores/useAuthModalStore';

const AuthModal = () => {
  const supabaseClient = useSupabaseClient();
  const { isOpen, onClose, view } = useAuthModalStore();

  const onChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Modal
      title={view === 'sign_in' ? 'Welcome back' : 'Create an account'}
      description={view === 'sign_in' ? 'Login to your account' : 'Enter your details'}
      isOpen={isOpen}
      onChange={onChange}
    >
      <Auth
        view={view}
        theme="dark" 
        magicLink
        showLinks={false}
        providers={['google']}
        supabaseClient={supabaseClient}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#4A004A',
                brandAccent: '#6A006A',
              },
              fonts: {
                bodyFontFamily: `var(--font-inter)`,
                buttonFontFamily: `var(--font-inter)`,
                inputFontFamily: `var(--font-inter)`,
                labelFontFamily: `var(--font-inter)`,
              },
              radii: {
                buttonBorderRadius: '12px',
                inputBorderRadius: '12px',
              }
            }
          }
        }}
      />
    </Modal>
  );
};

export default AuthModal;