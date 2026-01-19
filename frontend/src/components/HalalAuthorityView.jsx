// src/components/HalalAuthorityView.jsx
import React, { useState, useEffect } from 'react';
import './HalalAuthorityView.css';
import { 
  CONTRACT_ADDRESS, 
  getContractWithSigner, 
  readOnlyContract,
  hasRole
} from '../services/blockchain';
import { ethers } from 'ethers';

const HalalAuthorityView = ({ onBack }) => {
  const [batches, setBatches] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [signerAddress, setSignerAddress] = useState(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [activeCertHash, setActiveCertHash] = useState({});
  const [filter, setFilter] = useState('pending'); // 'all', 'pending', 'certified'
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Helper function to ensure Sepolia network
  const ensureSepoliaNetwork = async () => {
    const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        throw new Error('Please add Sepolia network to MetaMask first');
      }
      throw switchError;
    }
  };

  // Connect wallet & check authorization
  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum === 'undefined') {
        setMessage('Please install MetaMask');
        setLoadingAuth(false);
        return;
      }

      try {
        // Ensure we're on Sepolia network
        await ensureSepoliaNetwork();

        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        const userAddr = accounts[0].toLowerCase();
        setSignerAddress(userAddr);

        // Check if user has Halal Authority role
        const authorized = await hasRole(userAddr, 'HALAL_AUTHORITY_ROLE');
        setIsAuthorized(authorized);
        
        if (!authorized) {
          setMessage('You are not authorized as a Halal Authority. Contact the admin.');
          setStatus('error');
        } else {
          // Load all batches for certification
          await loadAllBatches();
        }
      } catch (err) {
        console.error('Wallet connection failed:', err);
        if (err.message.includes('Sepolia')) {
          setMessage(err.message);
        } else {
          setMessage('Wallet connection denied');
        }
        setStatus('error');
      } finally {
        setLoadingAuth(false);
      }
    };

    init();
  }, []);

  // Filter batches based on selected filter
  useEffect(() => {
    if (filter === 'all') {
      setFilteredBatches(batches);
    } else if (filter === 'pending') {
      setFilteredBatches(batches.filter(batch => !batch.isHalalCertified));
    } else if (filter === 'certified') {
      setFilteredBatches(batches.filter(batch => batch.isHalalCertified));
    }
  }, [batches, filter]);

  // FIXED: Use simpler approach - Get all batches using getAllBatchIds if available
  const loadAllBatches = async () => {
    setIsLoadingBatches(true);
    try {
      console.log('🔍 Loading all batches for Halal Authority...');
      
      let allBatchIds = [];
      
      // Try to use getAllBatchIds if it exists
      try {
        // Get total count first
        const totalCount = await readOnlyContract.getTotalBatchCount();
        console.log(`📊 Total batches in system: ${totalCount.toString()}`);
        
        if (Number(totalCount) > 0) {
          // Get first 100 batches (adjust as needed)
          allBatchIds = await readOnlyContract.getAllBatchIds(0, 100);
        }
      } catch (err) {
        console.log('getAllBatchIds failed, trying alternative:', err.message);
        // Fallback: Get batches by status or use events
        allBatchIds = await getBatchesByStatus('Produced');
      }
      
      console.log(`📋 Found ${allBatchIds.length} batch IDs`);
      
      if (allBatchIds.length === 0) {
        setBatches([]);
        return;
      }

      // Fetch detailed batch data for each batch
      const batchList = await Promise.all(
        allBatchIds.map(async (batchId) => {
          try {
            const batchData = await readOnlyContract.getBatch(batchId);
            const certHash = batchData[5];
            const isHalalCertified = certHash && certHash.length > 0;
            const createdAt = new Date(Number(batchData[6]) * 1000);
            
            return {
              id: batchId,
              productName: batchData[0],
              batchId: batchData[1],
              producer: batchData[2],
              currentOwner: batchData[3],
              status: batchData[4],
              certHash,
              createdAt,
              timestamp: createdAt.toLocaleString(),
              isHalalCertified,
              needsCertification: !isHalalCertified
            };
          } catch (err) {
            console.warn(`Failed to fetch batch ${batchId}:`, err);
            return null;
          }
        })
      );

      // Filter out null results and sort by timestamp (newest first)
      const validBatches = batchList
        .filter(b => b !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
      
      setBatches(validBatches);
      console.log(`✅ Successfully loaded ${validBatches.length} batches`);
      
    } catch (err) {
      console.error('Failed to load batches:', err);
      setMessage('Failed to load batches. Please try again.');
      setStatus('error');
    } finally {
      setIsLoadingBatches(false);
    }
  };

  // Helper function to get batches by status
  const getBatchesByStatus = async (status) => {
    try {
      // Try the new function
      return await readOnlyContract.getBatchesByStatus(status, 0, 100);
    } catch (err) {
      console.log(`getBatchesByStatus failed for ${status}:`, err.message);
      return [];
    }
  };

  const handleSetCertificate = async (batchId, certHashInput) => {
    if (!certHashInput.trim()) {
      setMessage('Certificate hash cannot be empty');
      setStatus('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setStatus('certifying');
      setMessage(`Certifying ${batchId}...`);

      // Ensure we're on Sepolia before transaction
      await ensureSepoliaNetwork();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getContractWithSigner(signer);

      const tx = await contract.setHalalCertificate(batchId, certHashInput, {
        gasLimit: 500000,
      });

      setMessage('Waiting for confirmation...');
      const receipt = await tx.wait(2);

      console.log('✅ Certificate set:', receipt.transactionHash);

      // Clear the input field
      setActiveCertHash(prev => ({ ...prev, [batchId]: '' }));

      // Refresh batch list
      await loadAllBatches();

      setMessage(`✅ Halal certificate set for ${batchId}!`);
      setStatus('success');
      
      setTimeout(() => {
        setMessage('');
        setStatus('');
      }, 5000);
      
    } catch (err) {
      console.error('Certificate setting error:', err);
      let msg = 'Transaction failed';
      
      if (err.message.includes('user rejected transaction')) {
        msg = 'Transaction rejected by user';
      } else if (err.message.includes('HALAL_AUTHORITY_ROLE') || err.message.includes('AccessControlUnauthorizedAccount')) {
        msg = 'You are not authorized as Halal Authority.';
      } else if (err.message.includes('Batch does not exist')) {
        msg = 'Batch not found.';
      } else if (err.message.includes('insufficient funds')) {
        msg = 'Insufficient Sepolia ETH for gas fee';
      } else if (err.message.includes('Sepolia')) {
        msg = err.message;
      }
      
      setMessage(msg);
      setStatus('error');
      setTimeout(() => { setMessage(''); setStatus(''); }, 5000);
    }
  };

  const handleUpdateCertificate = async (batchId, certHashInput) => {
    await handleSetCertificate(batchId, certHashInput);
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const getPendingCount = () => batches.filter(b => !b.isHalalCertified).length;
  const getCertifiedCount = () => batches.filter(b => b.isHalalCertified).length;

  if (loadingAuth) {
    return (
      <div className="halal-authority-view">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Checking authorization...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="halal-authority-view">
        <div className="view-header">
          <button className="btn-back" onClick={onBack}>
            ← Back
          </button>
          <h2>Halal Authority Dashboard</h2>
        </div>
        <div className="unauthorized-message">
          <h3>⛔ Access Denied</h3>
          <p>Your wallet does not have Halal Authority permissions.</p>
          <p>Please contact the administrator to get assigned the HALAL_AUTHORITY_ROLE.</p>
          <p>Connected Wallet: {signerAddress?.slice(0, 6)}...{signerAddress?.slice(-4)}</p>
          <div className="admin-tip">
            <p><strong>Tip:</strong> If you deployed the contract, connect with your deployer wallet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="halal-authority-view">
      <div className="view-header">
        <button className="btn-back" onClick={onBack}>
          ← Back
        </button>
        <h2>Halal Authority Dashboard</h2>
      </div>

      {message && (
        <div className={`alert ${status === 'error' ? 'alert-error' : status === 'success' ? 'alert-success' : 'alert-info'}`}>
          {message}
        </div>
      )}

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value">{batches.length}</div>
          <div className="stat-label">Total Batches</div>
        </div>
        <div className="stat-card stat-pending">
          <div className="stat-value">{getPendingCount()}</div>
          <div className="stat-label">Awaiting Certification</div>
        </div>
        <div className="stat-card stat-certified">
          <div className="stat-value">{getCertifiedCount()}</div>
          <div className="stat-label">Certified Halal</div>
        </div>
      </div>

      <div className="filter-controls">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => handleFilterChange('all')}
        >
          All ({batches.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => handleFilterChange('pending')}
        >
          Pending ({getPendingCount()})
        </button>
        <button 
          className={`filter-btn ${filter === 'certified' ? 'active' : ''}`}
          onClick={() => handleFilterChange('certified')}
        >
          Certified ({getCertifiedCount()})
        </button>
        <button 
          className="btn-refresh"
          onClick={loadAllBatches}
          disabled={isLoadingBatches}
        >
          {isLoadingBatches ? '🔄 Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      <div className="batches-section">
        <h3>
          {filter === 'all' ? 'All Batches' : 
           filter === 'pending' ? 'Batches Awaiting Halal Certification' : 
           'Certified Halal Batches'}
        </h3>
        
        {isLoadingBatches ? (
          <div className="loading-batches">
            <div className="spinner"></div>
            <p>Loading batches...</p>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="no-batches">
            <p>
              {filter === 'pending' 
                ? 'No batches pending halal certification.' 
                : filter === 'certified' 
                ? 'No batches have been certified yet.'
                : 'No batches found in the system.'}
            </p>
            <small>
              {filter === 'pending' 
                ? 'New raisin batches will appear here once submitted by producers.' 
                : 'Check back later for new batches.'}
            </small>
          </div>
        ) : (
          <div className="batches-list">
            {filteredBatches.map((batch) => (
              <div key={batch.id} className="batch-card">
                <div className="batch-header">
                  <span className="batch-id" title={batch.id}>
                    {batch.id.length > 20 ? `${batch.id.substring(0, 20)}...` : batch.id}
                  </span>
                  <span className={`status-badge ${batch.isHalalCertified ? 'status-certified-halal' : 'status-pending'}`}>
                    {batch.isHalalCertified ? '✅ Certified' : '⏳ Pending'}
                  </span>
                </div>
                
                <div className="batch-details">
                  <p><strong>Product:</strong> {batch.productName}</p>
                  <p><strong>Producer:</strong> 
                    <span className="address" title={batch.producer}>
                      {batch.producer.slice(0, 6)}...{batch.producer.slice(-4)}
                    </span>
                  </p>
                  <p><strong>Status:</strong> {batch.status}</p>
                  <p className="timestamp"><small>Created: {batch.timestamp}</small></p>
                  
                  {batch.isHalalCertified && batch.certHash && (
                    <div className="certificate-info">
                      <p><strong>Certificate Hash:</strong></p>
                      <code className="cert-hash" title={batch.certHash}>
                        {batch.certHash.length > 30 ? `${batch.certHash.substring(0, 15)}...${batch.certHash.substring(batch.certHash.length - 10)}` : batch.certHash}
                      </code>
                    </div>
                  )}
                </div>

                <div className="certification-form">
                  <div className="form-group">
                    <label htmlFor={`cert-${batch.id}`}>
                      {batch.isHalalCertified ? 'Update Certificate' : 'Set Certificate'}
                    </label>
                    <input
                      type="text"
                      id={`cert-${batch.id}`}
                      placeholder={batch.isHalalCertified ? "Update certificate reference" : "Enter certificate reference"}
                      value={activeCertHash[batch.id] || ''}
                      onChange={(e) => setActiveCertHash(prev => ({ 
                        ...prev, 
                        [batch.id]: e.target.value 
                      }))}
                      className="cert-input"
                    />
                    <small className="form-hint">
                      {batch.isHalalCertified 
                        ? 'Enter new certificate reference' 
                        : 'Enter IPFS hash or any reference for halal certificate'}
                    </small>
                  </div>
                  <button
                    className={batch.isHalalCertified ? 'btn-update' : 'btn-certify'}
                    onClick={() => batch.isHalalCertified 
                      ? handleUpdateCertificate(batch.id, activeCertHash[batch.id])
                      : handleSetCertificate(batch.id, activeCertHash[batch.id])
                    }
                    disabled={!activeCertHash[batch.id] || activeCertHash[batch.id].trim().length === 0 || status === 'certifying'}
                  >
                    {status === 'certifying' ? 'Processing...' : 
                     batch.isHalalCertified ? '🔄 Update Certificate' : '✅ Certify as Halal'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="contract-info">
        <p>
          <strong>Contract:</strong> 
          <code title={CONTRACT_ADDRESS}>
            {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}
          </code>
        </p>
        {signerAddress && (
          <p>
            <strong>Authorized Wallet:</strong> 
            <span className="address" title={signerAddress}>
              {signerAddress.slice(0, 6)}...{signerAddress.slice(-4)}
            </span>
          </p>
        )}
        <p className="role-badge">
          <span className="badge-halal">HALAL AUTHORITY</span>
        </p>
      </div>
    </div>
  );
};

export default HalalAuthorityView;
