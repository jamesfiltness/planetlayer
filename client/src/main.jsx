import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import './style.css';
import AppLayout from './components/AppLayout.jsx';
import MapListPage from './pages/MapListPage.jsx';
import MapPage from './pages/MapPage.jsx';
import NotFound from './pages/NotFound.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SettingsProvider from './settings/SettingsProvider.jsx';
import { applyRememberedTheme } from './settings/theme.js';

// Before the first render, so the page starts in the last theme it was shown in.
applyRememberedTheme();

// The server answers every non-API path with index.html, so these routes
// work when reloaded or opened from a link.
createRoot(document.getElementById('root')).render(
  <SettingsProvider>
    <BrowserRouter>
      <Routes>
        {/* A layout route: every page is drawn inside the header's frame. */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<MapListPage />} />
          <Route path="/maps/:mapId" element={<MapPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </SettingsProvider>,
);
