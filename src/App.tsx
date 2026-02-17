import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Bond from './pages/Bond'
import TrustScore from './pages/TrustScore'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="bond" element={<Bond />} />
          <Route path="trust" element={<TrustScore />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
