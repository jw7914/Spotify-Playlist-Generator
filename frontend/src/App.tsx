import { Route, Routes } from "react-router-dom";

import IndexPage from "@/pages/index";
import DocsPage from "@/pages/docs";
import PricingPage from "@/pages/pricing";
import BlogPage from "@/pages/blog";
import PlaylistsPage from "@/pages/playlists";
import TopArtistsPage from "@/pages/top-artists";
import NotFoundPage from "@/pages/404";
import LoginPage from "@/pages/login";

function App() {
  return (
    <Routes>
      <Route element={<IndexPage />} path="/" />
      <Route element={<DocsPage />} path="/docs" />
      <Route element={<PricingPage />} path="/pricing" />
      <Route element={<BlogPage />} path="/blog" />
      <Route element={<PlaylistsPage />} path="/playlists" />
      <Route element={<TopArtistsPage />} path="/top-artists" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}

export default App;
