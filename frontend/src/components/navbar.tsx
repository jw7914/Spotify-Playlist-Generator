import {
  Navbar as HeroUINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Tabs,
  Tab,
  Skeleton,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
  Image,
} from "@heroui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Navbar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const navLinks = useMemo(
    () => [
      { key: "/", href: "/", title: "Home" },
      { key: "/create", href: "/create", title: "Create With AI" },
      { key: "/search", href: "/search", title: "Search" },
    ],
    []
  );

  const currentTab = navLinks.find((l) => pathname === l.href)?.key || "";

  const handleNav = (href: string) => {
    navigate(href);
    setIsMenuOpen(false);
  };

  const avatarUrl = user?.images?.[0]?.url;

  return (
    <HeroUINavbar
      shouldHideOnScroll
      isBordered
      className="bg-black/90 backdrop-blur-md border-b-zinc-800"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      maxWidth="xl"
    >
      {/* --- Left: Logo & Brand --- */}
      <NavbarContent>
        <NavbarBrand
          className="gap-3 cursor-pointer group"
          onClick={() => handleNav("/")}
        >
          {/* Responsive Fix: 
            1. Use 'h-8 sm:h-10' to control height responsively.
            2. 'w-auto' maintains aspect ratio.
            3. 'flex-shrink-0' ensures it doesn't squash.
          */}
          <div className="relative flex items-center justify-center flex-shrink-0">
            <Image
              alt="Logo"
              src="web_logo.svg"
              radius="none"
              // Remove wrapper styling that conflicts with flex layouts
              removeWrapper
              className="h-8 w-auto sm:h-10 object-contain transition-transform duration-500 group-hover:scale-110"
            />
          </div>

          <p className="font-bold text-white text-base sm:text-lg tracking-tight truncate">
            Spotify PlaylistGen
          </p>
        </NavbarBrand>
      </NavbarContent>

      {/* --- Center: Desktop Tabs --- */}
      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        <Tabs
          aria-label="Navigation"
          selectedKey={currentTab}
          onSelectionChange={(key) => handleNav(key.toString())}
          variant="light"
          radius="full"
          color="secondary"
          classNames={{
            cursor: "bg-[#6A6BB5]/20",
            tabContent:
              "group-data-[selected=true]:text-[#6A6BB5] text-zinc-400 font-medium",
          }}
        >
          {navLinks.map((item) => (
            <Tab key={item.key} title={item.title} />
          ))}
        </Tabs>
      </NavbarContent>

      {/* --- Right: User Actions --- */}
      <NavbarContent justify="end">
        {isLoading ? (
          <NavbarItem>
            <Skeleton className="rounded-full w-10 h-10 bg-zinc-800" />
          </NavbarItem>
        ) : isAuthenticated && user ? (
          <Dropdown
            placement="bottom-end"
            className="dark bg-zinc-900 border border-zinc-800"
          >
            <NavbarItem>
              <DropdownTrigger>
                <Avatar
                  isBordered
                  as="button"
                  className="transition-transform"
                  color="secondary"
                  name={user.display_name || "User"}
                  size="sm"
                  src={avatarUrl}
                />
              </DropdownTrigger>
            </NavbarItem>

            <DropdownMenu
              aria-label="Profile Actions"
              variant="flat"
              disabledKeys={["profile_info"]}
            >
              <DropdownItem
                key="profile_info"
                className="h-14 gap-2 text-white opacity-100 cursor-default"
                textValue="Signed in as"
              >
                <p className="font-semibold">Signed in as</p>
                <p className="font-semibold text-[#6A6BB5]">{user.email}</p>
              </DropdownItem>
              <DropdownItem
                key="settings"
                onPress={() => navigate("/profile")}
                className="text-white hover:bg-zinc-800"
              >
                My Profile
              </DropdownItem>
               <DropdownItem
                key="stats"
                onPress={() => navigate("/stats")}
                className="text-white hover:bg-zinc-800"
              >
                My Stats
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                onPress={logout}
                className="text-danger"
              >
                Log Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        ) : (
          <NavbarItem>
            <Button
              onPress={() => handleNav("/login")}
              className="bg-[#6A6BB5] text-white font-semibold"
              radius="full"
              variant="flat"
            >
              Login
            </Button>
          </NavbarItem>
        )}

        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="sm:hidden text-white"
        />
      </NavbarContent>

      {/* --- Mobile Menu --- */}
      <NavbarMenu className="bg-black/95 pt-8 px-6">
        <div className="flex flex-col gap-6">
          {navLinks.map((item, index) => (
            <NavbarMenuItem key={`${item.key}-${index}`}>
              <button
                className={`w-full text-left text-2xl font-semibold transition-colors py-2
                  ${pathname === item.href ? "text-[#6A6BB5]" : "text-white hover:text-zinc-300"}
                `}
                onClick={() => handleNav(item.href)}
              >
                {item.title}
              </button>
            </NavbarMenuItem>
          ))}
        </div>

        <div className="border-t border-zinc-800 mt-8 pt-6 flex flex-col gap-4">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-4 mb-4 p-2 rounded-xl bg-zinc-900/50">
                <Avatar
                  src={avatarUrl}
                  size="md"
                  isBordered
                  color="secondary"
                />
                <div className="flex flex-col">
                  <span className="text-white font-semibold">
                    {user?.display_name}
                  </span>
                  <span className="text-zinc-500 text-xs">{user?.email}</span>
                </div>
              </div>
              <NavbarMenuItem>
                <button
                  onClick={() => handleNav("/profile")}
                  className="w-full text-left text-lg text-zinc-300 hover:text-white"
                >
                  Profile Settings
                </button>
              </NavbarMenuItem>
              <NavbarMenuItem>
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left text-lg text-red-500 hover:text-red-400 font-medium"
                >
                  Log Out
                </button>
              </NavbarMenuItem>
            </>
          ) : (
            <NavbarMenuItem>
              <Button
                fullWidth
                onPress={() => handleNav("/login")}
                className="bg-[#6A6BB5] text-white font-bold text-lg h-12"
              >
                Login
              </Button>
            </NavbarMenuItem>
          )}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
