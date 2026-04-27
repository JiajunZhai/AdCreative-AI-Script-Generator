import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ShellActivityProvider } from './context/ShellActivityContext';
import { ProjectProvider } from './context/ProjectContext';
import { MainLayout } from './layout/MainLayout';
import { Lab } from './pages/Lab';
import { CopyLab } from './pages/CopyLab';
import { WorkspaceHub } from './pages/WorkspaceHub';
import { EntryPortal } from './pages/EntryPortal';
import { ComplianceAdmin } from './pages/ComplianceAdmin';

function App() {
  return (
    <Router>
      <ProjectProvider>
      <ShellActivityProvider>
        <Routes>
          <Route path="/" element={<EntryPortal />} />
          <Route path="/hub" element={<WorkspaceHub />} />

          <Route path="/*" element={
            <MainLayout>
              <Routes>
                <Route path="generator" element={<Lab />} />
                <Route path="copy-lab" element={<CopyLab />} />
                <Route path="compliance" element={<ComplianceAdmin />} />
                <Route path="*" element={<Navigate to="/hub" replace />} />
              </Routes>
            </MainLayout>
          } />
        </Routes>
      </ShellActivityProvider>
      </ProjectProvider>
    </Router>
  );
}

export default App;
