import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MenuScreen from './screens/MenuScreen'
import GameLayout from './screens/GameLayout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MenuScreen />} />
        <Route path="/combat-test" element={<GameLayout />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
