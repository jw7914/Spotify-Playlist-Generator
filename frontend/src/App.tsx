import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";

import IndexPage from "@/pages/index";
import PlaylistsPage from "@/pages/playlists";
import TopArtistsPage from "@/pages/top-artists";
import ProfilePage from "@/pages/profile";
import NotFoundPage from "@/pages/404";
import LoginPage from "@/pages/login";
import LogoutPage from "@/pages/logout";
import CreateWithAIPage from "@/pages/createWithAI";
import { Navbar } from "@/components/navbar";

function App() {
  return (
    <AuthProvider>
      <Navbar />
      <Routes>
        <Route element={<IndexPage />} path="/" />
        <Route element={<PlaylistsPage />} path="/playlists" />
        <Route element={<TopArtistsPage />} path="/top-artists" />
        <Route element={<ProfilePage />} path="/profile" />
        <Route element={<LoginPage />} path="/login" />
        <Route element={<LogoutPage />} path="/logout" />
        <Route element={<CreateWithAIPage />} path="/create" />
        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </AuthProvider>
  );
}

export default App;
