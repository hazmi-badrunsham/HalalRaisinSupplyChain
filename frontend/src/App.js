// src/App.js
import React, { useState } from 'react';
import './App.css';
import ProducerView from './components/ProducerView';
import HalalAuthorityView from './components/HalalAuthorityView';


const ROLES = [
  { id: 'producer', label: 'Producer' },
  { id: 'halal-authority', label: 'Halal Authority' },
  { id: 'distributor', label: 'Distributor / Retailer' },
  { id: 'consumer', label: 'Consumer' },
];

function App() {
  const [selectedRole, setSelectedRole] = useState(null);

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
  };

  const handleBack = () => {
    setSelectedRole(null);
  };

  if (selectedRole === 'producer') {
    return <ProducerView onBack={handleBack} />;
    
  }
    if (selectedRole === 'halal-authority') {
    return <HalalAuthorityView onBack={handleBack} />;
    
  }

  // Later: add other role views here

  return (
    <div className="App">
      <header className="App-header">
        <h1>Halal Raisin Supply Chain</h1>
        <p className="App-subtitle">Select your role to continue</p>
      </header>

      <div className="role-grid">
        {ROLES.map((role) => (
          <div
            key={role.id}
            className="role-card"
            onClick={() => handleRoleSelect(role.id)}
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && handleRoleSelect(role.id)}
          >
            {role.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;