'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/services';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from '@heroui/react';

interface LoginModalProps {
  open: boolean;
  mode: 'login' | 'signup';
  onClose: () => void;
  setMode: (mode: 'login' | 'signup') => void;
  initialError?: string | null;
}

export default function LoginModal({
  open,
  mode,
  onClose,
  setMode,
  initialError,
}: LoginModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open && initialError) {
      setError(initialError);
    } else if (!open) {
      setError(null);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    }
  }, [open, initialError]);

  // Reset fields when switching modes
  useEffect(() => {
    setError(null);
    setPassword('');
    setConfirmPassword('');
  }, [mode]);

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);

      if (mode === 'login') {
        await authService.signIn(email, password);
      } else {
        await authService.signUp(email, password);
      }

      document.cookie = 'ccad_auth=1; Max-Age=604800; Path=/; SameSite=Lax';

      router.refresh();
      onClose();

      const redirectPath = sessionStorage.getItem('redirectPath');
      if (redirectPath) {
        sessionStorage.removeItem('redirectPath');
        router.push(redirectPath);
      } else {
        router.push('/venues/selection');
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled =
    submitting ||
    !email ||
    !password ||
    (mode === 'signup' && !confirmPassword);

  const inputClassNames = {
    label: 'text-surface-light mb-1',
    inputWrapper: 'rounded-2xl px-4 hover:bg-surface-deep',
    input:
      'text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none',
  } as const;

  return (
    <Modal
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      placement="center"
      backdrop="opaque"
      hideCloseButton
      radius="lg"
      classNames={{
        base: 'rounded-2xl bg-surface-deepest text-surface-light',
        header: 'pb-0',
        body: 'py-4',
        footer: 'pt-0',
      }}
    >
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader className="text-2xl font-bold text-surface">
              {mode === 'login' ? 'Login' : 'Create an Account'}
            </ModalHeader>

            <ModalBody>
              <Input
                label="Email Address"
                labelPlacement="inside"
                variant="bordered"
                size="lg"
                radius="lg"
                type="email"
                classNames={inputClassNames}
                value={email}
                onValueChange={setEmail}
                aria-label="Email Address"
              />

              <Input
                label="Password"
                labelPlacement="inside"
                variant="bordered"
                size="lg"
                radius="lg"
                type="password"
                classNames={inputClassNames}
                value={password}
                onValueChange={setPassword}
                aria-label="Password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && mode === 'login') handleSubmit();
                }}
              />

              {mode === 'signup' && (
                <Input
                  label="Confirm Password"
                  labelPlacement="inside"
                  variant="bordered"
                  size="lg"
                  radius="lg"
                  type="password"
                  classNames={inputClassNames}
                  value={confirmPassword}
                  onValueChange={setConfirmPassword}
                  aria-label="Confirm Password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                  }}
                />
              )}

              {error && (
                <p className="text-sm text-status-red">{error}</p>
              )}

              <p className="mt-1 text-sm text-surface-light">
                {mode === 'login' ? (
                  <>
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="text-status-blue hover:underline"
                    >
                      Sign Up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-status-blue hover:underline"
                    >
                      Log in
                    </button>
                  </>
                )}
              </p>
            </ModalBody>

            <ModalFooter className="flex justify-end gap-2">
              <Button
                onPress={() => {
                  close();
                  onClose();
                }}
                className="px-4 py-2 hover:bg-status-red/10 border border-status-red text-status-red"
                variant="bordered"
                radius="lg"
              >
                Cancel
              </Button>
              <Button
                onPress={handleSubmit}
                radius="lg"
                className="px-4 py-2 bg-accent hover:bg-accent/90 text-surface-light"
                isDisabled={isSubmitDisabled}
                isLoading={submitting}
              >
                {mode === 'login' ? 'Login' : 'Sign Up'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
