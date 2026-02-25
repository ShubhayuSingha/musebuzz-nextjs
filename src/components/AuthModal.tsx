'use client';

import { useEffect } from 'react'; // 🟢 1. Import useEffect
import { useRouter } from 'next/navigation'; // 🟢 2. Import useRouter
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Modal from './Modal';
import useAuthModalStore from '@/stores/useAuthModalStore';

const AuthModal = () => {
  const supabaseClient = useSupabaseClient();
  const router = useRouter(); // 🟢 3. Initialize router
  const { isOpen, onClose, view } = useAuthModalStore();

  // 🟢 4. ADD THIS: The Auth Event Listener
  useEffect(() => {
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        onClose();        // Close the modal automatically
        router.refresh(); // Instantly update the page to show the logged-in UI
      }
    });

    // Cleanup the listener when the component unmounts
    return () => subscription.unsubscribe();
  }, [supabaseClient, onClose, router]);

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
        magicLink={false}
        showLinks={true}
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