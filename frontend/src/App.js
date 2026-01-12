import React, { useState } from 'react';
import './App.css';
import ProducerView from './components/ProducerView';
import HalalAuthorityView from './components/HalalAuthorityView';
import DistributorView from './components/DistributorView';
import RetailerView from './components/RetailerView';
import ConsumerView from './components/ConsumerView';



// 1. Define the mapping outside the component
const ROLE_VIEWS = {
  'producer': ProducerView,
  'halal-authority': HalalAuthorityView,
  'distributor': DistributorView,
  'retailer': RetailerView,
  'consumer': ConsumerView,

  // Add new roles here as you build them:
  // 'retailer': RetailerView,
};

const ROLES = [
  { id: 'producer', label: 'Producer' },
  { id: 'halal-authority', label: 'Halal Authority' },
  { id: 'distributor', label: 'Distributor' },
  { id: 'retailer', label: 'Retailer' },
  { id: 'consumer', label: 'Consumer' },
];

function App() {
  const [selectedRole, setSelectedRole] = useState(null);

  const handleBack = () => setSelectedRole(null);

  // 2. Dynamically select the component based on state
  const SelectedView = ROLE_VIEWS[selectedRole];

  // 3. If a valid view exists, render it
  if (SelectedView) {
    return <SelectedView onBack={handleBack} />;
  }

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
            onClick={() => setSelectedRole(role.id)}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setSelectedRole(role.id)}
          >
            {role.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;