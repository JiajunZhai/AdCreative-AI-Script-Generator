import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layout/MainLayout';
import { Generator } from './pages/Generator';

import { OracleIngestion } from './pages/OracleIngestion';

function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/generator" replace />} />
          <Route path="/generator" element={<Generator />} />
          <Route path="/oracle" element={<OracleIngestion />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;
