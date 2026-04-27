with open('src/pages/WorkspaceHub.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("import React, { useState } from 'react';", "import React, { useState, useEffect } from 'react';")
text = text.replace("import { useNavigate } from 'react-router-dom';", "import { useNavigate, useLocation } from 'react-router-dom';")

target = """  const navigate = useNavigate();
  const { projects, setCurrentProject, deleteProject, isLoading } = useProjectContext();"""
replacement = """  const navigate = useNavigate();
  const location = useLocation();
  const { projects, setCurrentProject, deleteProject, isLoading } = useProjectContext();"""

text = text.replace(target, replacement)

target2 = """  const [showOracleModal, setShowOracleModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);"""
replacement2 = """  const [showOracleModal, setShowOracleModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);

  useEffect(() => {
    if (location.state?.openProviders) {
      setShowProviderModal(true);
      // Clear state to avoid reopening on refresh
      navigate('/hub', { replace: true, state: {} });
    }
  }, [location, navigate]);"""

text = text.replace(target2, replacement2)

with open('src/pages/WorkspaceHub.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
