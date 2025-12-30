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
} from "@heroui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth"; // Import the hook

// ... (Keep your MusicIcon component here) ...

export const Navbar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Use the shared Auth state
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const navLinks = useMemo(
    () => [
      { key: "/", href: "/", title: "Home" },
      { key: "/create", href: "/create", title: "Create With AI" },
    ],
    []
  );

  const currentTab = navLinks.find((l) => pathname === l.href)?.key || "/";

  const handleNav = (href: string) => {
    navigate(href);
    setIsMenuOpen(false);
  };

  // Helper to get avatar URL safely
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
      <NavbarContent>
        <NavbarBrand
          className="gap-3 cursor-pointer"
          onClick={() => handleNav("/")}
        >
          <p className="font-bold text-white text-lg tracking-tight">
            Spotify PlaylistGen
          </p>
        </NavbarBrand>
      </NavbarContent>

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

      <NavbarContent justify="end">
        {isLoading ? (
          <NavbarItem>
            <Skeleton className="rounded-full w-10 h-10 bg-zinc-800" />
          </NavbarItem>
        ) : isAuthenticated && user ? (
          // --- LOGGED IN DROPDOWN ---
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
            <DropdownMenu aria-label="Profile Actions" variant="flat">
              <DropdownItem
                key="profile_info"
                className="h-14 gap-2 text-white"
                textValue="Signed in as"
              >
                <p className="font-semibold">Signed in as</p>
                <p className="font-semibold text-[#6A6BB5]">{user.email}</p>
              </DropdownItem>
              <DropdownItem
                key="settings"
                href="/profile"
                className="text-white"
              >
                My Profile
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
              onClick={() => handleNav("/login")}
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

      <NavbarMenu className="bg-black pt-6">
        {navLinks.map((item, index) => (
          // ... (Mobile menu items remain similar)
          <NavbarMenuItem key={index}>{/*...*/}</NavbarMenuItem>
        ))}
        {/* Mobile Auth */}
        <div className="border-t border-zinc-800 mt-6 pt-6 flex flex-col gap-4">
          {isAuthenticated ? (
            <>
              <div className="px-2 flex items-center gap-3 mb-2">
                <Avatar src={avatarUrl} size="sm" />
                <span className="text-zinc-400">{user?.display_name}</span>
              </div>
              <NavbarMenuItem>
                <button
                  onClick={() => handleNav("/profile")}
                  className="text-xl text-white"
                >
                  Profile
                </button>
              </NavbarMenuItem>
              <NavbarMenuItem>
                <button onClick={logout} className="text-xl text-red-500">
                  Log Out
                </button>
              </NavbarMenuItem>
            </>
          ) : (
            // ... Login Button
            <NavbarMenuItem>Login...</NavbarMenuItem>
          )}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
