import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ToastProvider from './components/ToastProvider'
import Layout from './components/Layout'
import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RouteLoader from './components/RouteLoader';

const Home = lazy(() => import('./pages/Home'));
const Bond = lazy(() => import('./pages/Bond'));
const TrustScore = lazy(() => import('./pages/TrustScore'));
const AmountInputTestPage = lazy(() => import('./pages/AmountInputTestPage'));
const FocusTrapTestPage = lazy(() => import('./pages/FocusTrapTestPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="bond" element={<Bond />} />
          <Route path="trust" element={<TrustScore />} />
          <Route path="test-amount-input" element={<AmountInputTestPage />} />
          <Route path="test-focus-trap" element={<FocusTrapTestPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
const Home = lazy(() => import('./pages/Home'));
const Bond = lazy(() => import('./pages/Bond'));
const TrustScore = lazy(() => import('./pages/TrustScore'));
const AmountInputTestPage = lazy(() => import('./pages/AmountInputTestPage'));
const FocusTrapTestPage = lazy(() => import('./pages/FocusTrapTestPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/bond" element={<Bond />} />
        <Route path="/trust-score" element={<TrustScore />} />
        <Route path="/test/amount-input" element={<AmountInputTestPage />} />
        <Route path="/test/focus-trap" element={<FocusTrapTestPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

const Home = lazy(() => import('./pages/Home'));
const Bond = lazy(() => import('./pages/Bond'));
const TrustScore = lazy(() => import('./pages/TrustScore'));
const AmountInputTestPage = lazy(() => import('./pages/AmountInputTestPage'));
const FocusTrapTestPage = lazy(() => import('./pages/FocusTrapTestPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function AppRoutes() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="bond" element={<Bond />} />
          <Route path="trust" element={<TrustScore />} />
          <Route path="test-amount-input" element={<AmountInputTestPage />} />
          <Route path="test-focus-trap" element={<FocusTrapTestPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
