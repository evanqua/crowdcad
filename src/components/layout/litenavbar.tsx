'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/app/firebase';
import { useAuth } from '@/hooks/useauth';
import {
  Avatar,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from '@heroui/react';
import { LogOut, Menu, UserRound } from 'lucide-react';

const LoginModalLazy = dynamic(() => import('@/components/modals/auth/loginmodal'), {
  ssr: false,
});

function initialsFromUser(u?: { displayName?: string | null; email?: string | null }) {
  const fromName =
    u?.displayName
      ?.trim()
      .split(/\s+/)
      .map((segment) => segment[0]?.toUpperCase())
      .join('') ?? '';
  if (fromName) return fromName.slice(0, 2);
  return (u?.email?.[0] ?? 'U').toUpperCase();
}

const liteNavItems = [
  { label: 'Lite Home', href: '/lite' },
  { label: 'Create', href: '/lite/create' },
  { label: 'Cloud Home', href: '/' },
];

export default function LiteNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'signup'>('login');

  const isActive = (href: string) => pathname === href;
  const initials = initialsFromUser(user ?? undefined);

  const onLogout = async () => {
    await signOut(auth);
    document.cookie = 'ccad_auth=0; Max-Age=0; Path=/; SameSite=Lax';
    router.refresh();
    router.push('/');
  };

  return (
    <>
      <Navbar
        isBlurred
        position="sticky"
        maxWidth="full"
        isMenuOpen={isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
        classNames={{
          base: 'sticky top-0 z-[300] bg-surface-deepest/70 backdrop-blur-md',
          wrapper:
            'h-16 md:h-16 px-4 sm:px-6 md:px-6 lg:px-6 xl:px-6 2xl:px-6 flex items-center',
          item: 'text-[18px] leading-6',
          content: 'items-center',
          toggle: 'lg:hidden',
          menu:
            'fixed inset-x-0 top-16 z-[350] bg-surface-deep/95 backdrop-blur supports-[backdrop-filter]:bg-opacity-90 ' +
            'h-[calc(100dvh-4rem)] overflow-y-auto pt-2 pb-6 border-t border-base-200',
          menuItem: 'justify-center text-surface-light',
        }}
      >
        <div className="relative flex items-center justify-between w-full max-w-[1200px] mx-auto">
          <NavbarContent justify="start" className="min-w-0">
            <NavbarBrand>
              <button onClick={() => router.push('/lite')} className="flex items-center">
                <Image
                  src="/logo.svg"
                  alt="Logo"
                  width={140}
                  height={30}
                  priority
                  sizes="(max-width: 600px) 7rem, (max-width: 800px) 8rem, 110px"
                  className="cursor-pointer w-24 h-auto"
                />
              </button>
            </NavbarBrand>
          </NavbarContent>

          <NavbarContent
            className="hidden lg:flex gap-8 absolute left-1/2 -translate-x-1/2"
            justify="center"
          >
            {liteNavItems.map(({ label, href }) => (
              <NavbarItem key={href} isActive={isActive(href)}>
                <Link
                  href={href}
                  className={`text-lg font-medium transition ${
                    isActive(href) ? 'text-surface-light' : 'text-surface-faint hover:text-accent'
                  }`}
                >
                  {label}
                </Link>
              </NavbarItem>
            ))}
          </NavbarContent>

          <NavbarContent justify="end" className="gap-2 sm:gap-3 md:gap-4">
            <div className="lg:hidden">
              <NavbarMenuToggle
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                className="text-white"
                icon={(open) => (
                  <Menu className={`size-6 transition ${open ? 'rotate-90' : ''}`} color="white" />
                )}
              />
            </div>

            {!ready ? (
              <NavbarItem>
                <div className="w-10 h-10" />
              </NavbarItem>
            ) : !user ? (
              <NavbarItem>
                <Button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setLoginOpen(true);
                  }}
                >
                  Log in
                </Button>
              </NavbarItem>
            ) : (
              <NavbarItem className="hidden lg:flex">
                <Dropdown placement="bottom-end">
                  <DropdownTrigger>
                    <button
                      aria-label="Open profile menu"
                      className="relative p-0.5 rounded-full bg-gradient-to-br from-accent/70 to-[rgba(240,28,28,0.4)] cursor-pointer"
                    >
                      <Avatar
                        isBordered
                        showFallback
                        name={initials}
                        classNames={{
                          base: 'bg-surface-base',
                          name: 'text-surface-light text-xs',
                        }}
                        className="w-8 h-8"
                      />
                    </button>
                  </DropdownTrigger>

                  <DropdownMenu
                    aria-label="Profile menu"
                    className="min-w-40 flex flex-col space-y-1 origin-top-right transform-gpu transition-all duration-150"
                  >
                    <DropdownItem
                      key="profile"
                      startContent={<UserRound className="size-4" />}
                      className="transition-colors"
                      onPress={() => router.push('/profile')}
                    >
                      Profile
                    </DropdownItem>
                    <DropdownItem
                      key="logout"
                      className="text-status-red"
                      startContent={<LogOut className="size-4" />}
                      onPress={onLogout}
                    >
                      Logout
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </NavbarItem>
            )}
          </NavbarContent>
        </div>

        <NavbarMenu className="bg-surface-deep border-t border-surface-liner pt-6">
          {liteNavItems.map(({ label, href }) => (
            <NavbarMenuItem key={href}>
              <Link
                href={href}
                onClick={() => setIsMenuOpen(false)}
                className={`w-full text-lg font-medium transition ${
                  isActive(href) ? 'text-surface-light' : 'text-surface-faint hover:text-accent'
                }`}
              >
                {label}
              </Link>
            </NavbarMenuItem>
          ))}

          <div className="my-2 border-t border-surface-liner" />

          {!user ? (
            <>
              <NavbarMenuItem className="mt-1">
                <button
                  className="block w-full text-left text-[18px] px-2 py-2 rounded-md"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setLoginMode('login');
                    setLoginOpen(true);
                  }}
                >
                  Log in
                </button>
              </NavbarMenuItem>
              <NavbarMenuItem className="mt-1">
                <button
                  className="block w-full text-left text-[18px] px-2 py-2 rounded-md"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setLoginMode('signup');
                    setLoginOpen(true);
                  }}
                >
                  Sign up
                </button>
              </NavbarMenuItem>
            </>
          ) : (
            <>
              <NavbarMenuItem>
                <Link
                  href="/profile"
                  className="w-full text-lg font-medium transition text-surface-faint hover:text-accent"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profile
                </Link>
              </NavbarMenuItem>
              <NavbarMenuItem>
                <button
                  className="w-full text-left text-lg font-medium transition text-status-red hover:opacity-80"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                >
                  Logout
                </button>
              </NavbarMenuItem>
            </>
          )}
        </NavbarMenu>
      </Navbar>

      {loginOpen && (
        <LoginModalLazy
          open={loginOpen}
          mode={loginMode}
          onClose={() => setLoginOpen(false)}
          setMode={setLoginMode}
        />
      )}
    </>
  );
}
