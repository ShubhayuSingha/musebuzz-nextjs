// src/providers/ModalProvider.tsx
'use client';

import { useEffect, useState } from 'react';
import AuthModal from '@/components/AuthModal';
import UpdateModal from '@/components/UpdateModal'; // 1. Import the new modal
import AddToPlaylistModal from "@/components/AddToPlaylistModal";

const ModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  // This ensures the modal is only ever rendered on the client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <AuthModal />
      <UpdateModal /> {/* 2. Add the update modal here */}
      <AddToPlaylistModal />
    </>
  );
};

export default ModalProvider;