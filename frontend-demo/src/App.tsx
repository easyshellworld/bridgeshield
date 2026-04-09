import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import CheckerPage from './pages/CheckerPage';
import ComparePage from './pages/ComparePage';
import './index.css';

function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<CheckerPage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
    </AnimatePresence>
  );
}

export default App;
