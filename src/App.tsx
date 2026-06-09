import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MenuScreen from './screens/MenuScreen'
import GameLayout from './screens/GameLayout'
import TestEnvironment from './screens/TestEnvironment'
import HistoriaScreen from './screens/HistoriaScreen'
import HistoryScreen from './screens/HistoryScreen'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MenuScreen />} />
        <Route path="/combat-test" element={<GameLayout />} />
        <Route path="/test-env" element={<TestEnvironment />} />
        <Route path="/historia" element={<HistoriaScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
