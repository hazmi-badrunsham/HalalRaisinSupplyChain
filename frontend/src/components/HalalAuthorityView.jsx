// src/components/HalalAuthorityView.jsx
import React, { useState, useEffect } from 'react';
import './HalalAuthorityView.css';
import { 
  CONTRACT_ADDRESS, 
  getContractWithSigner, 
  readOnlyContract,
  getBatchesByCreator,
  getBatchesByOwner,
  getAllBatchIds,
  getMultipleBatches,
  checkBatchExists,
  getBatchDetails,
  hasRole,
  getWalletAddress
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
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'certified'
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Connect wallet & check authorization
  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum === 'undefined') {
        setMessage('Please install MetaMask');
        setLoadingAuth(false);
        return;
      }

      try {
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
        setMessage('Wallet connection denied');
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

  const loadAllBatches = async () => {
    setIsLoadingBatches(true);
    try {
      console.log('🔍 Loading all batches...');
      
      // Method 1: Get all batch IDs (if contract supports it)
      const totalCount = await readOnlyContract.getTotalBatchCount();
      console.log(`📊 Total batches in system: ${totalCount}`);
      
      let allBatchIds = [];
      
      if (totalCount > 0) {
        // Get all batch IDs in chunks
        const batchSize = 50;
        for (let start = 0; start < totalCount; start += batchSize) {
          const limit = Math.min(batchSize, totalCount - start);
          try {
            const ids = await readOnlyContract.getAllBatchIds(start, limit);
            allBatchIds = [...allBatchIds, ...ids];
          } catch (err) {
            console.log('Using fallback method for batch IDs');
            break;
          }
        }
      }
      
      // If we couldn't get IDs via getAllBatchIds, try another approach
      if (allBatchIds.length === 0) {
        // Fallback: Listen for events to get batch IDs
        const currentBlock = await readOnlyContract.provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 20000); // Last 20k blocks
        
        const events = await readOnlyContract.queryFilter(
          readOnlyContract.filters.BatchCreated(),
          fromBlock,
          currentBlock
        );
        
        allBatchIds = events.map(event => event.args.batchId);
        console.log(`📋 Found ${allBatchIds.length} batches via events`);
      }
      
      // Remove duplicates and fetch batch details
      const uniqueBatchIds = [...new Set(allBatchIds)];
      
      // Fetch detailed batch data
      const batchDetails = await Promise.all(
        uniqueBatchIds.map(async (batchId) => {
          try {
            const details = await getBatchDetails(batchId);
            return {
              ...details,
              isHalalCertified: details.certHash && details.certHash.length > 0,
              needsCertification: !details.certHash || details.certHash.length === 0
            };
          } catch (err) {
            console.warn(`Failed to fetch details for batch ${batchId}:`, err);
            return null;
          }
        })
      );
      
      const validBatches = batchDetails
        .filter(batch => batch !== null)
        .sort((a, b) => b.createdAt - a.createdAt); // Sort by newest first
      
      setBatches(validBatches);
      console.log(`✅ Successfully loaded ${validBatches.length} batches`);
      
    } catch (err) {
      console.error('Failed to load batches:', err);
      setMessage('Failed to load batches: ' + err.message);
      setStatus('error');
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const handleSetCertificate = async (batchId, certHashInput) => {
    if (!certHashInput.trim()) {
      setMessage('Certificate hash cannot be empty');
      setStatus('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Validate IPFS hash format (basic check)
    if (!certHashInput.startsWith('Qm') && certHashInput.length !== 46) {
      setMessage('Please enter a valid IPFS hash (starts with Qm, 46 chars)');
      setStatus('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setStatus('certifying');
      setMessage(`Certifying ${batchId}...`);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getContractWithSigner(signer);

      const tx = await contract.setHalalCertificate(batchId, certHashInput, {
        gasLimit: 500000,
      });

      setMessage('Waiting for transaction confirmation...');
      const receipt = await tx.wait(2);

      console.log('✅ Certificate set:', receipt.transactionHash);

      // Clear the input field
      setActiveCertHash(prev => ({ ...prev, [batchId]: '' }));

      // Refresh batch list
      await loadAllBatches();

      setMessage(`✅ Halal certificate set for ${batchId}!`);
      setStatus('success');
      
      // Auto-clear success message
      setTimeout(() => {
        if (status === 'success') {
          setMessage('');
          setStatus('');
        }
      }, 5000);
      
    } catch (err) {
      console.error('Certificate setting error:', err);
      let msg = 'Transaction failed';
      
      if (err.message.includes('user rejected transaction')) {
        msg = 'Transaction rejected by user';
      } else if (err.message.includes('HALAL_AUTHORITY_ROLE')) {
        msg = 'You are not authorized as Halal Authority. Contact the admin.';
      } else if (err.message.includes('Batch does not exist')) {
        msg = 'Batch not found or already certified.';
      } else if (err.message.includes('insufficient funds')) {
        msg = 'Insufficient Sepolia ETH for gas fee';
      } else if (err.message.includes('already certified')) {
        msg = 'This batch is already halal certified';
      }
      
      setMessage(msg);
      setStatus('error');
      
      // Auto-clear error message
      setTimeout(() => {
        if (status === 'error') {
          setMessage('');
          setStatus('');
        }
      }, 5000);
    }
  };

  const handleUpdateCertificate = async (batchId, newCertHash) => {
    // This would require a separate function in the contract
    // For now, we'll use setHalalCertificate (which overwrites)
    await handleSetCertificate(batchId, newCertHash);
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
          <p className="wallet-info">Connected Wallet: {signerAddress?.slice(0, 6)}...{signerAddress?.slice(-4)}</p>
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
          All Batches ({batches.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => handleFilterChange('pending')}
        >
          Pending Certification ({getPendingCount()})
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
        <h3>{filter === 'all' ? 'All Batches' : filter === 'pending' ? 'Batches Awaiting Halal Certification' : 'Certified Halal Batches'}</h3>
        
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
          <div className="batches-grid">
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
                  <p><strong>Current Owner:</strong> 
                    <span className="address" title={batch.currentOwner}>
                      {batch.currentOwner.slice(0, 6)}...{batch.currentOwner.slice(-4)}
                    </span>
                  </p>
                  <p><strong>Status:</strong> {batch.status}</p>
                  <p className="timestamp"><small>Created: {batch.timestamp}</small></p>
                  
                  {batch.isHalalCertified && batch.certHash && (
                    <div className="certificate-info">
                      <p><strong>Certificate Hash:</strong></p>
                      <code className="cert-hash" title={batch.certHash}>
                        {batch.certHash.slice(0, 20)}...{batch.certHash.slice(-10)}
                      </code>
                    </div>
                  )}
                </div>

                {!batch.isHalalCertified ? (
                  <div className="certification-form">
                    <div className="form-group">
                      <label htmlFor={`cert-${batch.id}`}>IPFS Certificate Hash</label>
                      <input
                        type="text"
                        id={`cert-${batch.id}`}
                        placeholder="QmXxx... (46 character IPFS hash)"
                        value={activeCertHash[batch.id] || ''}
                        onChange={(e) => setActiveCertHash(prev => ({ 
                          ...prev, 
                          [batch.id]: e.target.value 
                        }))}
                        className="cert-input"
                      />
                      <small className="form-hint">
                        Enter the IPFS hash of the halal certificate document
                      </small>
                    </div>
                    <button
                      className="btn-certify"
                      onClick={() => handleSetCertificate(batch.id, activeCertHash[batch.id])}
                      disabled={!activeCertHash[batch.id] || activeCertHash[batch.id].trim().length === 0}
                    >
                      ✅ Certify as Halal
                    </button>
                  </div>
                ) : (
                  <div className="certification-form">
                    <div className="form-group">
                      <label htmlFor={`update-cert-${batch.id}`}>Update Certificate Hash</label>
                      <input
                        type="text"
                        id={`update-cert-${batch.id}`}
                        placeholder="Enter new IPFS hash to update"
                        value={activeCertHash[batch.id] || ''}
                        onChange={(e) => setActiveCertHash(prev => ({ 
                          ...prev, 
                          [batch.id]: e.target.value 
                        }))}
                        className="cert-input"
                      />
                    </div>
                    <button
                      className="btn-update"
                      onClick={() => handleUpdateCertificate(batch.id, activeCertHash[batch.id])}
                      disabled={!activeCertHash[batch.id] || activeCertHash[batch.id].trim().length === 0}
                    >
                      🔄 Update Certificate
                    </button>
                  </div>
                )}
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