import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}

interface ConfirmDialogContextType {
  confirm: (message: string, options?: Partial<ConfirmDialogConfig>) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmDialogConfig>({
    title: '',
    message: '',
    confirmText: 'Confirmer',
    cancelText: 'Annuler',
    variant: 'default'
  });
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = (message: string, options?: Partial<ConfirmDialogConfig>): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfig({
        title: options?.title || 'Confirmation',
        message,
        confirmText: options?.confirmText || 'Confirmer',
        cancelText: options?.cancelText || 'Annuler',
        variant: options?.variant || 'default'
      });
      setResolveRef(() => resolve);
      setIsOpen(true);
    });
  };

  const handleConfirm = () => {
    resolveRef?.(true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    resolveRef?.(false);
    setIsOpen(false);
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">{config.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-600">
              {config.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} className="rounded-full">
              {config.cancelText}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={`rounded-full ${
                config.variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {config.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  }
  return context;
}

