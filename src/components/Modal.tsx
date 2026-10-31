// src/components/Modal.tsx
import * as Dialog from '@radix-ui/react-dialog';
import { IoMdClose } from 'react-icons/io';
import { twMerge } from 'tailwind-merge';

interface ModalProps {
  isOpen: boolean;
  onChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  hideCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onChange,
  title,
  description,
  children,
  hideCloseButton = false,
  className,
  bodyClassName
}) => {
  return (
    <Dialog.Root open={isOpen} defaultOpen={isOpen} onOpenChange={onChange}>
      <Dialog.Portal>
        {/* 1. OVERLAY (Blurred Dark Backdrop) */}
        <Dialog.Overlay 
          className="
            fixed 
            inset-0 
            bg-black/80 
            backdrop-blur-md 
            z-[100] 
            animate-overlay-in
          " 
        />
        
        {/* 2. CONTENT (Modern Rounded Glassmorphic Box) */}
        <Dialog.Content 
          className={twMerge(`
            fixed 
            top-1/2 
            left-1/2 
            -translate-x-1/2 
            -translate-y-1/2 
            w-[92vw] 
            max-w-[480px] 
            max-h-[88vh] 
            flex 
            flex-col 
            rounded-2xl 
            bg-zinc-900/95 
            border 
            border-zinc-800 
            backdrop-blur-xl 
            shadow-2xl 
            shadow-purple-950/20 
            p-5 sm:p-6 
            focus:outline-none 
            z-[100] 
            overflow-hidden 
            animate-modal-in
          `, className)}
        >
          {/* Accessible Dialog Title & Description (Required by Radix UI) */}
          {title ? (
            <div className="flex-shrink-0 mb-4 text-center">
              <Dialog.Title className="text-xl font-bold text-white tracking-tight font-sans">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1.5 text-xs sm:text-sm text-neutral-400 leading-normal font-sans">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  Dialog description
                </Dialog.Description>
              )}
            </div>
          ) : (
            <>
              <Dialog.Title className="sr-only">
                Modal Dialog
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Modal content and actions
              </Dialog.Description>
            </>
          )}
          
          <div className={twMerge("flex-1 min-h-0 flex flex-col scrollbar-hide", bodyClassName)}>
            {children}
          </div>

          {!hideCloseButton && (
            <Dialog.Close asChild>
              <button
                aria-label="Close modal"
                className="
                  text-neutral-400 
                  hover:text-white 
                  hover:bg-zinc-800 
                  active:scale-95 
                  transition-colors 
                  absolute 
                  top-4 
                  right-4 
                  z-20
                  inline-flex 
                  h-8 
                  w-8 
                  appearance-none 
                  items-center 
                  justify-center 
                  rounded-full 
                  focus:outline-none
                  cursor-pointer
                "
              >
                <IoMdClose size={18} />
              </button>
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
