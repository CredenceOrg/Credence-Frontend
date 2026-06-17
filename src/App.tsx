import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ToastProvider from './components/ToastProvider'
import Layout from './components/Layout'
import Home from './pages/Home'
import Bond from './pages/Bond'
import TrustScore from './pages/TrustScore'
import NotFound from './pages/NotFound'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="bond" element={<Bond />} />
            <Route path="trust" element={<TrustScore />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
