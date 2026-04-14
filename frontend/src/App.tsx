import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ShellActivityProvider } from './context/ShellActivityContext';
import { ProjectProvider } from './context/ProjectContext';
import { MainLayout } from './layout/MainLayout';
import { Lab } from './pages/Lab';
import { OracleIngestion } from './pages/OracleIngestion';
import { Dashboard } from './pages/Dashboard';

function App() {
  return (
    <Router>
      <ProjectProvider>
      <ShellActivityProvider>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/generator" element={<Lab />} />
                              <Route path="/oracle" element={<OracleIngestion />} />
        </Routes>
      </MainLayout>
      </ShellActivityProvider>
      </ProjectProvider>
    </Router>
  );
}

export default App;
