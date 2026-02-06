import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";

import IndexPage from "@/pages/index";
import PlaylistsPage from "@/pages/playlists";
import PlaylistDetailsPage from "@/pages/tracks";
import TopArtistsPage from "@/pages/top-artists";
import TopTracksPage from "@/pages/top-tracks";
import StatsPage from "@/pages/stats";
import ProfilePage from "@/pages/profile";
import NotFoundPage from "@/pages/404";
import LoginPage from "@/pages/login";
import LogoutPage from "@/pages/logout";
import CreateWithAIPage from "@/pages/create";
import SearchPage from "@/pages/search";
import { Navbar } from "@/components/navbar";

function App() {
  return (
    <AuthProvider>
      <Navbar />
      <Routes>
        <Route element={<IndexPage />} path="/" />
        <Route element={<PlaylistsPage />} path="/playlists" />
        <Route element={<PlaylistDetailsPage />} path="/playlists/:id" />
        <Route element={<TopArtistsPage />} path="/top-artists" />
        <Route element={<TopTracksPage />} path="/top-tracks" />
        <Route element={<StatsPage />} path="/stats" />
        <Route element={<SearchPage />} path="/search" />
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
