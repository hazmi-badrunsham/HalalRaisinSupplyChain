// src/components/ProducerView.jsx
import React, { useState, useEffect } from 'react';
import './ProducerView.css';
import { CONTRACT_ADDRESS, getContractWithSigner, readOnlyContract } from '../services/blockchain';
import { ethers } from 'ethers';

const ProducerView = ({ onBack }) => {
  const [formData, setFormData] = useState({
    batchId: '',
    productName: 'Raisins',
  });
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [signerAddress, setSignerAddress] = useState(null);
  const [batches, setBatches] = useState([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  // Connect wallet & load batches on mount
  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum === 'undefined') {
        setMessage('Please install MetaMask');
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        const userAddr = accounts[0].toLowerCase();
        setSignerAddress(userAddr);

        // Fetch batches created by this address
        await loadBatches(userAddr);
      } catch (err) {
        console.error('Wallet connection failed:', err);
        setMessage('Wallet connection denied');
      }
    };

    init();
  }, []);

  // NEW: Improved loadBatches using contract storage
  const loadBatches = async (userAddress) => {
    setIsLoadingBatches(true);
    try {
      console.log(`🔍 Loading batches for address: ${userAddress}`);
      
      // Use the new getBatchesByCreator function
      const batchIds = await readOnlyContract.getBatchesByCreator(userAddress);
      console.log(`📋 Found ${batchIds.length} batches`);
      
      if (batchIds.length === 0) {
        setBatches([]);
        setIsLoadingBatches(false);
        return;
      }

      // Fetch detailed batch data for each batch
      const batchList = await Promise.all(
        batchIds.map(async (batchId) => {
          try {
            const batchData = await readOnlyContract.getBatch(batchId);
            return {
              id: batchId,
              productName: batchData[0],
              batchId: batchData[1],
              producer: batchData[2],
              currentOwner: batchData[3],
              status: batchData[4],
              certHash: batchData[5],
              timestamp: new Date(Number(batchData[6]) * 1000).toLocaleString(),
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
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setBatches(validBatches);
      console.log(`✅ Successfully loaded ${validBatches.length} batches`);
      
    } catch (err) {
      console.error('Failed to load batches:', err);
      
      // Fallback to event filtering if new function doesn't exist yet
      if (err.message.includes('function not found') || err.message.includes('cannot estimate gas')) {
        console.log('⚠️ Using event filtering fallback...');
        await loadBatchesFallback(userAddress);
      } else {
        setMessage('Failed to load your batches: ' + err.message);
      }
    } finally {
      setIsLoadingBatches(false);
    }
  };

  // Fallback method using event filtering (for old contract or as backup)
  const loadBatchesFallback = async (userAddress) => {
    try {
      const currentBlock = await readOnlyContract.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 20000); // Last 20k blocks
      
      console.log(`🔍 Fetching events from block ${fromBlock} to ${currentBlock}`);

      // Try with indexed event parameters
      const filter = readOnlyContract.filters.BatchCreated(null, null, userAddress);
      const events = await readOnlyContract.queryFilter(filter, fromBlock, currentBlock);

      console.log(`📋 Found ${events.length} events`);

      const batchList = await Promise.all(
        events.map(async (event) => {
          const { batchId, productName } = event.args;
          try {
            const batchData = await readOnlyContract.getBatch(batchId);
            return {
              id: batchId,
              productName,
              status: batchData[4],
              timestamp: new Date(Number(batchData[6]) * 1000).toLocaleString(),
              transactionHash: event.transactionHash,
            };
          } catch (err) {
            console.warn(`Failed to fetch batch ${batchId}`);
            return null;
          }
        })
      );

      const validBatches = batchList
        .filter(b => b !== null)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setBatches(validBatches);
      
    } catch (err) {
      console.error('Fallback method also failed:', err);
      setMessage('Failed to load batches. Please refresh or try again.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!formData.batchId.trim() || !formData.productName.trim()) {
      setMessage('Please fill all fields');
      setStatus('error');
      return;
    }
    if (!signerAddress) {
      setMessage('Wallet not connected');
      setStatus('error');
      return;
    }

    try {
      setStatus('creating');
      setMessage('Creating batch...');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getContractWithSigner(signer);

      // Check if batch already exists
      const exists = await readOnlyContract.batchExists(formData.batchId);
      if (exists) {
        throw new Error('Batch ID already exists');
      }

      // Create batch with optimized gas
      const tx = await contract.createBatch(formData.batchId, formData.productName, {
        gasLimit: 500000, // Increased gas limit for new contract
      });

      setMessage('Waiting for confirmation...');
      const receipt = await tx.wait(2);

      console.log('✅ Batch created:', receipt.transactionHash);

      // Refresh batch list
      await loadBatches(signerAddress);

      // Reset form
      setFormData({ batchId: '', productName: 'Raisins' });
      setMessage('Batch created successfully!');
      setStatus('success');
      
      // Auto-clear success message after 5 seconds
      setTimeout(() => {
        if (status === 'success') {
          setMessage('');
          setStatus('');
        }
      }, 5000);
      
    } catch (err) {
      console.error('Batch creation error:', err);
      let msg = 'Transaction failed';
      
      if (err.message.includes('user rejected transaction')) {
        msg = 'Transaction rejected by user';
      } else if (err.message.includes('Batch ID already exists')) {
        msg = 'Batch ID already exists';
      } else if (err.message.includes('PRODUCER_ROLE')) {
        msg = 'Your account is not authorized as a Producer. Contact the admin.';
      } else if (err.message.includes('insufficient funds')) {
        msg = 'Insufficient Sepolia ETH for gas fee';
      } else if (err.message.includes('Batch ID required')) {
        msg = 'Batch ID cannot be empty';
      } else if (err.message.includes('gas')) {
        msg = 'Gas estimation failed. Try increasing gas limit.';
      }
      
      setMessage(msg);
      setStatus('error');
      
      // Auto-clear error message after 5 seconds
      setTimeout(() => {
        if (status === 'error') {
          setMessage('');
          setStatus('');
        }
      }, 5000);
    }
  };

  return (
    <div className="producer-view">
      <div className="view-header">
        <button className="btn-back" onClick={onBack}>
          ← Back
        </button>
        <h2>Producer</h2>
      </div>

      {message && (
        <div className={`alert ${status === 'error' ? 'alert-error' : status === 'success' ? 'alert-success' : 'alert-info'}`}>
          {message}
        </div>
      )}

      <form className="create-batch-form" onSubmit={handleCreateBatch}>
        <div className="form-group">
          <label htmlFor="batchId">Batch ID (Unique)</label>
          <input
            id="batchId"
            name="batchId"
            type="text"
            value={formData.batchId}
            onChange={handleInputChange}
            placeholder="e.g. RAISIN-2026-001"
            required
            disabled={status === 'creating'}
          />
          <small className="form-hint">Unique identifier for this batch</small>
        </div>

        <div className="form-group">
          <label htmlFor="productName">Product Name</label>
          <input
            id="productName"
            name="productName"
            type="text"
            value={formData.productName}
            onChange={handleInputChange}
            placeholder="e.g. Organic Raisins"
            required
            disabled={status === 'creating'}
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={status === 'creating' || !signerAddress}
        >
          {status === 'creating' ? (
            <>
              <span className="spinner"></span> Creating...
            </>
          ) : (
            'Create Batch'
          )}
        </button>
      </form>

      <div className="batches-section">
        <div className="section-header">
          <h3>Your Batches</h3>
          <button 
            className="btn-refresh" 
            onClick={() => signerAddress && loadBatches(signerAddress)}
            disabled={isLoadingBatches}
          >
            {isLoadingBatches ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
        
        {isLoadingBatches ? (
          <div className="loading-batches">
            <div className="spinner"></div>
            <p>Loading your batches...</p>
          </div>
        ) : batches.length === 0 ? (
          <div className="no-batches">
            <p>No batches found. Create your first batch!</p>
            <small>Only batches created by your wallet are shown.</small>
          </div>
        ) : (
          <>
            <p className="batch-count">Showing {batches.length} batch{batches.length !== 1 ? 'es' : ''}</p>
            <div className="batches-list">
              {batches.map((batch) => (
                <div key={batch.id} className="batch-card">
                  <div className="batch-header">
                    <span className="batch-id" title={batch.id}>
                      {batch.id.length > 20 ? `${batch.id.substring(0, 20)}...` : batch.id}
                    </span>
                    <span className={`status-badge status-${batch.status.replace(/\s+/g, '-').toLowerCase()}`}>
                      {batch.status}
                    </span>
                  </div>
                  <div className="batch-details">
                    <p><strong>Product:</strong> {batch.productName}</p>
                    <p><strong>Current Owner:</strong> 
                      <span className="address">
                        {batch.currentOwner.slice(0, 6)}...{batch.currentOwner.slice(-4)}
                      </span>
                    </p>
                    <p className="timestamp"><small>Created: {batch.timestamp}</small></p>
                    {batch.certHash && (
                      <p className="certified">
                        <small>✅ Halal Certified</small>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
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
            <strong>Connected Wallet:</strong> 
            <span className="address">
              {signerAddress.slice(0, 6)}...{signerAddress.slice(-4)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};

export default ProducerView;