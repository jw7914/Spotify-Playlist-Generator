import {
  Navbar as HeroUINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@heroui/react";
import { Tabs, Tab } from "@heroui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname || "/";

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch("/api/auth/status");
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(data.authenticated);
        } else {
          // If the API call fails, assume not authenticated
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

  return (
    <HeroUINavbar shouldHideOnScroll className="bg-black">
      <NavbarBrand>
        <p className="font-bold text-white">Spotify Playlist Generator</p>
        <img></img>
      </NavbarBrand>
      <NavbarContent justify="end">
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
            </Tabs>
          </div>
        </NavbarItem>
      </NavbarContent>
    </HeroUINavbar>
  );
};
