import {
  Navbar as HeroUINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@heroui/react";
import { Tabs, Tab } from "@heroui/react";
import { useLocation, useNavigate } from "react-router-dom";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname || "/";

  const tabItems = [
    { key: "/", href: "/", title: "Home" },
    { key: "/create", href: "/create", title: "Create With AI" },
    { key: "/login", href: "/login", title: "Login" },
  ];

  // Your selectedKey logic
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
                      item.key === "/login"
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
