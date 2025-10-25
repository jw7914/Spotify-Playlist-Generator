import {
  Navbar as HeroUINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  // --- Add new imports for the mobile menu ---
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from "@heroui/react";
import { Tabs, Tab } from "@heroui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname || "/";

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  // --- Add state for the mobile menu ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch("/api/auth/status");
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(data.authenticated);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Failed to fetch auth status:", error);
        setIsAuthenticated(false);
      }
    };

    checkAuthStatus();
  }, []);

  const tabItems = useMemo(() => {
    const baseItems = [
      { key: "/", href: "/", title: "Home" },
      { key: "/create", href: "/create", title: "Create With AI" },
    ];

    if (isAuthenticated === true) {
      baseItems.push({ key: "/profile", href: "/profile", title: "Profile" });
    } else if (isAuthenticated === false) {
      baseItems.push({ key: "/login", href: "/login", title: "Login" });
    }

    return baseItems;
  }, [isAuthenticated]);

  const selectedKey =
    tabItems
      .slice()
      .sort((a, b) => b.href.length - a.href.length)
      .find((t) => pathname.startsWith(t.href))?.key ?? tabItems[0].key;

  const handleMenuNavigate = (href: string) => {
    navigate(href);
    setIsMenuOpen(false); // Close menu after navigation
  };

  return (
    <HeroUINavbar
      shouldHideOnScroll
      className="bg-black"
      // --- Control the mobile menu state ---
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
    >
      <NavbarBrand>
        <p className="font-bold text-white">Spotify Playlist Generator</p>
        <img />
      </NavbarBrand>

      {/* --- Desktop Tabs (hidden on small screens) --- */}
      <NavbarContent justify="end" className="hidden sm:flex">
        <NavbarItem>
          <div className="dark">
            <Tabs
              aria-label="Navigation Tabs"
              selectedKey={selectedKey}
              size="lg"
              radius="full"
              onSelectionChange={(key) => {
                navigate(key.toString());
              }}
              classNames={{
                cursor: "bg-transparent",
              }}
            >
              {tabItems.map((item) => (
                <Tab
                  key={item.key}
                  title={item.title}
                  className={`mx-2 px-3
                    data-[selected=true]:text-white
                    ${
                      item.key === "/login" || item.key === "/profile"
                        ? "data-[selected=true]:bg-[#6A6BB5]"
                        : "data-[selected=true]:bg-zinc-700"
                    }
                  `}
                />
              ))}
              {isAuthenticated === null && (
                <Tab
                  key="loading-placeholder"
                  title="\u00A0"
                  isDisabled
                  className="mx-2 px-3"
                />
              )}
            </Tabs>
          </div>
        </NavbarItem>
      </NavbarContent>

      {/* --- Mobile Menu Toggle (visible only on small screens) --- */}
      <NavbarContent justify="end" className="text-white sm:hidden">
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        />
      </NavbarContent>

      {/* --- Mobile Menu --- */}
      <NavbarMenu className="bg-black/80 pt-4 backdrop-blur-md">
        {tabItems.map((item) => (
          <NavbarMenuItem key={item.key}>
            <button
              className={`w-full py-2 text-2xl ${
                item.key === selectedKey
                  ? "font-bold text-[#6A6BB5]" // Active link style
                  : "text-white"
              }`}
              onClick={() => handleMenuNavigate(item.href)}
            >
              {item.title}
            </button>
          </NavbarMenuItem>
        ))}

        {/* Mobile loading state */}
        {isAuthenticated === null && (
          <NavbarMenuItem>
            <div className="w-full py-2 text-center text-2xl text-zinc-500">
              Loading...
            </div>
          </NavbarMenuItem>
        )}
      </NavbarMenu>
    </HeroUINavbar>
  );
};
