'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/app/firebase';
import { useAuth } from '@/hooks/useauth';
import { getLiteEvent } from '@/lib/liteEventStore';
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
import { LogOut, Menu, Moon, Sun, UserRound } from 'lucide-react';

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

function LiveClock() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span suppressHydrationWarning={true} className="tabular-nums text-surface-light text-sm font-semibold font-arial">
      {now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

const liteNavItems = [
  { label: 'Lite Home', href: '/lite' },
  { label: 'Create', href: '/lite/create' },
];

export default function LiteNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'signup'>('login');
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [postingScheduleEnabled, setPostingScheduleEnabled] = useState(true);
  const isDispatch = !!(pathname && /^\/lite\/events\/[^/]+\/dispatch(?:$|\/|\?)/.test(pathname));
  const liteDispatchEventId = pathname?.match(/^\/lite\/events\/([^/?#]+)\/dispatch(?:$|[/?#])/)?.[1] ?? null;

  const isActive = (href: string) => pathname === href;
  const showPostingSchedule = isDispatch && postingScheduleEnabled;
  const wrapperHeightClass = 'h-14 md:h-14';
  const containerWidthClass = isDispatch ? 'max-w-none' : 'max-w-[1280px]';
  const logoWidthClass = 'w-20';
  const desktopNavGapClass = 'gap-2 pl-3';
  const menuOffsetClass = 'top-14 h-[calc(100dvh-3.5rem)]';

  useEffect(() => {
    const root = document.documentElement;
    const hasDarkClass = root.classList.contains('dark');
    setIsDarkTheme(hasDarkClass);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextIsDark = !isDarkTheme;
    const root = document.documentElement;

    root.classList.toggle('dark', nextIsDark);
    root.setAttribute('data-theme', nextIsDark ? 'dark' : 'light');

    try {
      localStorage.setItem('ccad-theme', nextIsDark ? 'dark' : 'light');
    } catch {
      // Ignore localStorage failures (private mode / restricted storage).
    }

    setIsDarkTheme(nextIsDark);
  }, [isDarkTheme]);

  useEffect(() => {
    let cancelled = false;

    const loadPostingScheduleConfig = async () => {
      if (!isDispatch || !liteDispatchEventId) {
        setPostingScheduleEnabled(true);
        return;
      }

      const event = await getLiteEvent(decodeURIComponent(liteDispatchEventId));
      if (cancelled) return;

      setPostingScheduleEnabled(
        event?.postingScheduleEnabled ?? (event?.postingTimes?.length ?? 0) > 0
      );
    };

    void loadPostingScheduleConfig();

    return () => {
      cancelled = true;
    };
  }, [isDispatch, liteDispatchEventId]);

  const openPostingSchedule = () => {
    window.dispatchEvent(new CustomEvent('open-posting-schedule'));
  };

  const triggerClearEvent = () => {
    window.dispatchEvent(new CustomEvent('open-lite-clear-event'));
  };

  const triggerExportSummary = () => {
    window.dispatchEvent(new CustomEvent('open-lite-export-summary'));
  };

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
          base: `sticky top-0 z-[300] ${isDispatch ? 'bg-surface-deep' : 'bg-surface-deepest/70'} backdrop-blur-md`,
          wrapper:
            `${wrapperHeightClass} px-4 sm:px-6 md:px-6 lg:px-6 xl:px-6 2xl:px-6 flex items-center`,
          item: 'text-[18px] leading-6',
          content: 'items-center',
          toggle: 'lg:hidden',
          menu:
            `fixed inset-x-0 ${menuOffsetClass} z-[350] bg-surface-deep/95 backdrop-blur supports-[backdrop-filter]:bg-opacity-90 ` +
            'overflow-y-auto pt-2 pb-6 border-t border-base-200',
          menuItem: 'justify-center text-surface-light',
        }}
      >
        <div className={`flex w-full items-center justify-between ${containerWidthClass} mx-auto`}>
          <div className="relative z-[30] min-w-0 flex items-center gap-2 sm:gap-4 md:gap-6">
            <NavbarBrand>
              <button onClick={() => router.push("/")} className="flex items-center">
                <Image
                  src={isDarkTheme ? '/logo.svg' : '/logo-dark.svg'}
                  alt="Logo"
                  width={118}
                  height={30}
                  priority
                  sizes="(max-width: 600px) 7rem, (max-width: 800px) 8rem, 110px"
                  className={`cursor-pointer h-auto shrink-0 ${logoWidthClass}`}
                />
              </button>

              {isDispatch && (
                <div className="ml-3 sm:ml-4 md:ml-6">
                  <LiveClock />
                </div>
                
              )}
            </NavbarBrand>

          <NavbarContent
            className={`hidden lg:flex flex-none ${desktopNavGapClass}`}
            justify="start"
          >
            {isDispatch ? (
              <>
                {showPostingSchedule && (
                  <NavbarItem>
                    <button
                      onClick={openPostingSchedule}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition text-surface-light hover:text-accent"
                    >
                      Posting Schedule
                    </button>
                  </NavbarItem>
                )}

                <NavbarItem>
                  <Dropdown placement="bottom-start">
                    <DropdownTrigger>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition text-surface-light hover:text-accent"
                      >
                        End Event
                      </button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Lite end event actions">
                      <DropdownItem
                        key="clear-event"
                        className="text-status-red"
                        onPress={triggerClearEvent}
                      >
                        Clear Event
                      </DropdownItem>
                      <DropdownItem key="export-summary" onPress={triggerExportSummary}>
                        Export Summary
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </NavbarItem>
              </>
            ) : (
              liteNavItems.map(({ label, href }) => (
                <NavbarItem key={href} isActive={isActive(href)}>
                  <Link
                    href={href}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                      isActive(href) ? 'text-surface-light' : 'text-surface-faint hover:text-accent'
                    }`}
                  >
                    {label}
                  </Link>
                </NavbarItem>
              ))
            )}
          </NavbarContent>
          </div>

          <NavbarContent justify="end" className="gap-2 sm:gap-3 md:gap-4">
            <div className="lg:hidden">
              <NavbarMenuToggle
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                className="text-surface-light"
                icon={(open) => (
                  <Menu className={`size-6 transition ${open ? 'rotate-90' : ''} text-surface-light`} />
                )}
              />
            </div>

            <NavbarItem>
              <Button
                isIconOnly
                variant="flat"
                aria-label={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
                className="h-8 w-8 min-w-8 rounded-full bg-surface-deeper/70 text-surface-light hover:bg-surface-deeper"
                onPress={toggleTheme}
              >
                {isDarkTheme ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </NavbarItem>

            {!ready ? (
              <NavbarItem>
                <div className="w-10 h-10" />
              </NavbarItem>
            ) : !user ? (
              <NavbarItem>
                <Button
                  size="sm"
                  variant="bordered"
                  className="h-8 rounded-full border-surface-liner bg-transparent px-3 text-surface-light font-semibold"
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
                        className="relative rounded-full p-0.5 bg-gradient-to-br from-accent/70 to-[rgba(240,28,28,0.4)] cursor-pointer"
                      >
                        <Avatar
                          showFallback
                          name={initialsFromUser(user)}
                          classNames={{
                            base: "bg-surface-base border-surface-liner",
                            name: "text-surface-light text-sm font-bold",
                          }}
                          className="h-7 w-7 border-surface-liner"
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
          {isDispatch ? (
            <>
              {showPostingSchedule && (
                <NavbarMenuItem>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      openPostingSchedule();
                    }}
                    className="block w-full text-left text-[18px] px-2 py-2"
                  >
                    Posting Schedule
                  </button>
                </NavbarMenuItem>
              )}
              <NavbarMenuItem>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    triggerClearEvent();
                  }}
                  className="block w-full text-left text-[18px] px-2 py-2 text-status-red"
                >
                  Clear Event
                </button>
              </NavbarMenuItem>
              <NavbarMenuItem>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    triggerExportSummary();
                  }}
                  className="block w-full text-left text-[18px] px-2 py-2"
                >
                  Export Summary
                </button>
              </NavbarMenuItem>
            </>
          ) : (
            liteNavItems.map(({ label, href }) => (
              <NavbarMenuItem key={href}>
                <Link
                  href={href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block w-full rounded-md px-2 py-2 text-left text-sm font-medium transition ${
                    isActive(href) ? 'text-surface-light' : 'text-surface-faint hover:text-accent'
                  }`}
                >
                  {label}
                </Link>
              </NavbarMenuItem>
            ))
          )}

          <div className="my-2 border-t border-surface-liner" />

          <NavbarMenuItem className="mt-1">
            <button
              className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium transition text-surface-light hover:text-accent"
              onClick={() => {
                toggleTheme();
                setIsMenuOpen(false);
              }}
            >
              {isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
          </NavbarMenuItem>

          {!user ? (
            <>
              <NavbarMenuItem className="mt-1">
                <button
                  className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium transition text-surface-light hover:text-accent"
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
                  className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium transition text-surface-light hover:text-accent"
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
                  className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium transition text-surface-light hover:text-accent"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profile
                </Link>
              </NavbarMenuItem>
              <NavbarMenuItem>
                <button
                  className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium transition text-status-red hover:text-status-red/80"
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
