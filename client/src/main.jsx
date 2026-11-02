import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import './style.css';
import MapListPage from './pages/MapListPage.jsx';
import MapPage from './pages/MapPage.jsx';
import NotFound from './pages/NotFound.jsx';

// The server answers every non-API path with index.html, so these routes
// work when reloaded or opened from a link.
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<MapListPage />} />
      <Route path="/maps/:mapId" element={<MapPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>,
);
