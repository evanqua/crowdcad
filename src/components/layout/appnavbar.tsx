"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { authService } from "@/lib/services";
import { useAuth } from "@/hooks/useauth";

import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";

import { Menu, Moon, UserRound, LogOut, Sun } from "lucide-react";

const LoginModalLazy = dynamic(() => import("@/components/modals/auth/loginmodal"), { ssr: false });

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

export default function AppNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<"login" | "signup">("login");
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const hasDarkClass = root.classList.contains("dark");
    setIsDarkTheme(hasDarkClass);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextIsDark = !isDarkTheme;
    const root = document.documentElement;

    root.classList.toggle("dark", nextIsDark);
    root.setAttribute("data-theme", nextIsDark ? "dark" : "light");

    try {
      localStorage.setItem("ccad-theme", nextIsDark ? "dark" : "light");
    } catch {
      // Ignore localStorage failures (private mode / restricted storage).
    }

    setIsDarkTheme(nextIsDark);
  }, [isDarkTheme]);

  const isDispatch = !!(pathname && /^\/events\/[^/]+\/dispatch(?:$|\/|\?)/.test(pathname));

  const navItems = [
    { label: "Venues", href: "/venues/selection" },
  ];

   const dispatchItems = [
    { 
      label: "Venue Map", 
      onClick: () => window.dispatchEvent(new CustomEvent('open-venue-map'))
    },
    { 
      label: "Posting Schedule", 
      onClick: () => window.dispatchEvent(new CustomEvent('open-posting-schedule'))
    },
    { 
      label: "End Event", 
      onClick: () => window.dispatchEvent(new CustomEvent('open-end-event'))
    },
    { 
      label: "Venues", 
      onClick: () => router.push('/venues/selection'),
      isActive: pathname === '/venues/selection'
    },
  ];

  const isActive = (href: string) => pathname === href;
  const wrapperHeightClass = 'h-14 md:h-14';
  const containerWidthClass = isDispatch ? 'max-w-none' : 'max-w-[1280px]';
  const logoWidthClass = 'w-20';
  const desktopNavGapClass = 'gap-1 pl-2';

  // Optional: You can add logic here to check if the user is actually an admin
  // const isAdmin = user?.email === "admin@yourdomain.com"; 

  const onLogout = async () => {
    await authService.signOut();
    document.cookie = "ccad_auth=0; Max-Age=0; Path=/; SameSite=Lax";
    router.refresh();
    router.push("/");
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
          base:
            `sticky top-0 z-[300] ${isDispatch ? 'bg-surface-deep' : 'bg-surface-deepest/70'} backdrop-blur-md`,
          wrapper:
            `${wrapperHeightClass} px-4 sm:px-6 md:px-6 lg:px-6 xl:px-6 2xl:px-6 flex items-center`,
          item: "text-[16px] leading-6",
          content: "items-center",
          toggle: "lg:hidden",
          menu:
            `fixed inset-x-0 top-14 h-[calc(100dvh-3.5rem)] z-[350] bg-surface-deep/95 backdrop-blur supports-[backdrop-filter]:bg-opacity-90 ` +
            'overflow-y-auto pt-2 pb-6 border-t border-base-200',
          menuItem: "justify-center text-surface-light",
        }}
      >
        <div className={`flex w-full items-center justify-between ${containerWidthClass} mx-auto`}>
          <div className="relative z-[30] min-w-0 flex items-center gap-2 sm:gap-4 md:gap-6">
            <NavbarBrand>
              <button onClick={() => router.push("/")} className="flex items-center">
                <Image
                  src={isDarkTheme ? "/logo.svg" : "/logo-dark.svg"}
                  alt="Logo"
                  width={118}
                  height={30}
                  priority
                  sizes="(max-width: 600px) 7rem, (max-width: 800px) 8rem, 110px"
                  className={`cursor-pointer h-auto shrink-0 ${logoWidthClass}`}
                />
              </button>
              {/* LiveClock next to logo when on dispatch page */}
              {isDispatch && (
                <div className="ml-3 sm:ml-4 md:ml-6">
                  <LiveClock />
                </div>
              )}
            </NavbarBrand>
            {/* Organization selector removed — use Profile > Affiliations instead */}

            {/* Desktop nav links */}
          <NavbarContent 
            className={`hidden lg:flex flex-none ${desktopNavGapClass}`}
            justify="start"
          >
            {isDispatch ? (
              // Dispatch page navigation
              dispatchItems.map(({ label, onClick, isActive: itemActive }) => (
                <NavbarItem key={label}>
                  <button
                    onClick={onClick}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                      itemActive ? "text-surface-light" : "text-surface-light hover:text-accent"
                    }`}
                  >
                    {label}
                  </button>
                </NavbarItem>
              ))
            ) : (
              navItems.map(({ label, href }) => (
                <NavbarItem key={href} isActive={isActive(href)}>
                  <Link
                    href={href}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition ${
                      isActive(href) ? "text-surface-light" : "text-surface-faint hover:text-accent"
                    }`}
                  >
                    {label}
                  </Link>
                </NavbarItem>
              ))
            )}
          </NavbarContent>
          </div>

          {/* RIGHT: auth + mobile toggle */}
          <NavbarContent justify="end" className="gap-1 sm:gap-2 md:gap-2">
            {/* Mobile toggle */}
            <div className="lg:hidden">
              <NavbarMenuToggle
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                className="text-surface-light"
                icon={(open) => (
                  <Menu className={`size-6 transition ${open ? "rotate-90" : ""} text-surface-light`} />
                )}
              />
            </div>

            <NavbarItem>
              <Button
                isIconOnly
                variant="flat"
                aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
                className="h-8 w-8 min-w-8 rounded-full bg-surface-deeper/70 text-surface-light hover:bg-surface-deeper"
                onPress={toggleTheme}
              >
                {isDarkTheme ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </NavbarItem>

            {/* Show nothing while loading */}
            {!ready ? (
              <NavbarItem>
                <div className="w-10 h-10" /> {/* Placeholder to prevent layout shift */}
              </NavbarItem>
            ) : !user ? (
              <NavbarItem>
                <Button
                  variant="bordered"
                  aria-label="Log in"
                  className="h-8 min-w-8 rounded-full border-surface-liner px-3 text-surface-light hover:bg-surface-deeper"
                  onPress={() => {
                    setIsMenuOpen(false);
                    setLoginMode("login");
                    setLoginOpen(true);
                  }}
                >
                  Log In
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
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-surface-liner bg-surface-base text-surface-light">
                          <UserRound className="size-4" />
                        </span>
                      </button>
                  </DropdownTrigger>


                  {/* ✅ Fixed: solid background + correct hover styles */}
                  <DropdownMenu
                    aria-label="Profile menu"
                    className="min-w-40 flex flex-col space-y-1 origin-top-right transform-gpu transition-all duration-150"
                  >
                    <DropdownItem
                      key="profile"
                      startContent={<UserRound className="size-4" />}
                      className="transition-colors"
                      onPress={() => router.push("/profile")}
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

        {/* MOBILE MENU */}
        <NavbarMenu className="bg-surface-deep border-t border-surface-liner pt-6">
          {isDispatch ? (
            dispatchItems.map(({ label, onClick}) => (
              <NavbarMenuItem key={label}>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onClick();
                  }}
                  className="block w-full text-left text-[18px] px-2 py-2 hover:opacity-80"
                >
                  {label}
                </button>
              </NavbarMenuItem>
            ))
          ) : (
            navItems.map(({ label, href }) => (
              <NavbarMenuItem key={href}>
                <Link
                  href={href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block w-full rounded-md px-2 py-2 text-left text-sm font-medium transition ${
                    isActive(href) ? "text-surface-light" : "text-surface-faint hover:text-accent"
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
              {isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
            </button>
          </NavbarMenuItem>

          {!user ? (
            <>
              <NavbarMenuItem className="mt-1">
                <button
                  className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium transition text-surface-light hover:text-accent"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setLoginMode("login");
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
                    setLoginMode("signup");
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