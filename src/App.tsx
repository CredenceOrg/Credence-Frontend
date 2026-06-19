import { lazy, Suspense } from 'react'
import React, { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'

import ToastProvider from './components/ToastProvider'
import Layout from './components/Layout'
import RouteLoader from './components/RouteLoader'

const Home = lazy(() => import('./pages/Home'))
const Bond = lazy(() => import('./pages/Bond'))
const TrustScore = lazy(() => import('./pages/TrustScore'))
const AmountInputTestPage = lazy(() => import('./pages/AmountInputTestPage'))
import React, { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'

import ToastProvider from './components/ToastProvider'
import Layout from './components/Layout'
import RouteLoader from './components/RouteLoader'

const Home = lazy(() => import('./pages/Home'))
const Bond = lazy(() => import('./pages/Bond'))
const TrustScore = lazy(() => import('./pages/TrustScore'))
const AmountInputTestPage = lazy(() => import('./pages/AmountInputTestPage'))
const FocusTrapTestPage = lazy(() => import('./pages/FocusTrapTestPage'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RouteChangeManager() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)

    const mainHeading = document.querySelector('h1')
    if (mainHeading) {
      mainHeading.setAttribute('tabindex', '-1')
      mainHeading.focus()
    }
  }, [location.pathname])

  return null
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <RouteChangeManager />
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
  )
}
function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
<Suspense fallback={<div>Loading...</div>}>
  <RouteChangeManager />
  <AppRoutes />
</Suspense>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
