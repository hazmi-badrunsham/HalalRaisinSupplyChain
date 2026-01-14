// src/components/ProducerView.jsx
import React, { useState, useEffect } from 'react';
import './ProducerView.css';
import { CONTRACT_ADDRESS, getContractWithSigner, readOnlyContract, ensureSepoliaNetwork } from '../services/blockchain';
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
  // Track distributor address per batch (key: batchId, value: address)
  const [distributorAddresses, setDistributorAddresses] = useState({});

  // Connect wallet & load batches on mount
  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum === 'undefined') {
        setMessage('Please install MetaMask');
        return;
      }

      try {
        // Ensure we're on Sepolia network
        await ensureSepoliaNetwork();

        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        const userAddr = accounts[0].toLowerCase();
        setSignerAddress(userAddr);
        await loadBatches(userAddr);
      } catch (err) {
        console.error('Wallet connection failed:', err);
        if (err.message.includes('Sepolia')) {
          setMessage(err.message);
        } else {
          setMessage('Wallet connection denied');
        }
      }
    };

    init();
  }, []);

  const loadBatches = async (userAddress) => {
    setIsLoadingBatches(true);
    try {
      const batchIds = await readOnlyContract.getBatchesByCreator(userAddress);
      if (batchIds.length === 0) {
        setBatches([]);
        setIsLoadingBatches(false);
        return;
      }

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

      const validBatches = batchList
        .filter(b => b !== null)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setBatches(validBatches);
    } catch (err) {
      console.error('Failed to load batches:', err);
      if (err.message.includes('function not found') || err.message.includes('cannot estimate gas')) {
        await loadBatchesFallback(userAddress);
      } else {
        setMessage('Failed to load your batches: ' + err.message);
      }
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const loadBatchesFallback = async (userAddress) => {
    try {
      const currentBlock = await readOnlyContract.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 20000);
      const filter = readOnlyContract.filters.BatchCreated(null, null, userAddress);
      const events = await readOnlyContract.queryFilter(filter, fromBlock, currentBlock);

      const batchList = await Promise.all(
        events.map(async (event) => {
          const { batchId, productName } = event.args;
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

      const validBatches = batchList
        .filter(b => b !== null)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setBatches(validBatches);
    } catch (err) {
      console.error('Fallback loading failed:', err);
      setMessage('Failed to load batches');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();

    if (!formData.batchId.trim() || !formData.productName.trim()) {
      setMessage('Please fill in all fields');
      setStatus('error');
      return;
    }

    try {
      setStatus('creating');
      setMessage('Creating batch...');

      // Ensure we're on Sepolia before transaction
      await ensureSepoliaNetwork();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getContractWithSigner(signer);

      const tx = await contract.createBatch(formData.batchId, formData.productName, {
        gasLimit: 500000,
      });

      setMessage('Waiting for blockchain confirmation...');
      const receipt = await tx.wait(2);

      console.log('✅ Batch created:', receipt.transactionHash);

      setFormData({ batchId: '', productName: 'Raisins' });
      await loadBatches(signerAddress);

      setMessage('✅ Batch created successfully!');
      setStatus('success');

      setTimeout(() => {
        setMessage('');
        setStatus('');
      }, 5000);
    } catch (err) {
      console.error('Batch creation error:', err);
      let msg = 'Transaction failed';

      if (err.message.includes('user rejected transaction')) {
        msg = 'Transaction rejected by user';
      } else if (err.message.includes('Batch already exists')) {
        msg = 'Batch ID already exists. Please use a different ID.';
      } else if (err.message.includes('insufficient funds')) {
        msg = 'Insufficient Sepolia ETH for gas fee';
      } else if (err.message.includes('Sepolia')) {
        msg = err.message;
      }

      setMessage(msg);
      setStatus('error');
      setTimeout(() => {
        setMessage('');
        setStatus('');
      }, 5000);
    }
  };

  const handleUpdateStatus = async (batchId, newStatusValue) => {
    try {
      setStatus('updating');
      setMessage(`Updating status for ${batchId}...`);

      // Ensure we're on Sepolia before transaction
      await ensureSepoliaNetwork();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getContractWithSigner(signer);

      const tx = await contract.updateStatus(batchId, newStatusValue);
      await tx.wait(2);

      await loadBatches(signerAddress);

      setMessage(`✅ Status updated to "${newStatusValue}"!`);
      setStatus('success');

      setTimeout(() => {
        setMessage('');
        setStatus('');
      }, 3000);
    } catch (err) {
      console.error('Status update error:', err);
      let msg = 'Status update failed';
      
      if (err.message.includes('Sepolia')) {
        msg = err.message;
      }
      
      setMessage(msg);
      setStatus('error');
      setTimeout(() => {
        setMessage('');
        setStatus('');
      }, 3000);
    }
  };

  const handleTransferToDistributor = async (batchId) => {
    const distributorAddr = distributorAddresses[batchId];

    if (!distributorAddr || !distributorAddr.trim()) {
      setMessage('Please enter distributor address');
      setStatus('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!ethers.isAddress(distributorAddr)) {
      setMessage('Invalid Ethereum address');
      setStatus('error');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setStatus('transferring');
      setMessage(`Transferring ${batchId}...`);

      // Ensure we're on Sepolia before transaction
      await ensureSepoliaNetwork();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getContractWithSigner(signer);

      const tx1 = await contract.transferBatch(batchId, distributorAddr);
      await tx1.wait(2);

      const tx2 = await contract.updateStatus(batchId, "At Distributor");
      await tx2.wait(2);

      await loadBatches(signerAddress);

      setDistributorAddresses(prev => ({ ...prev, [batchId]: '' }));

      setMessage(`✅ Batch transferred and status updated to "At Distributor"!`);
      setStatus('success');

      setTimeout(() => {
        setMessage('');
        setStatus('');
      }, 5000);
    } catch (err) {
      console.error('Transfer error:', err);
      let msg = 'Transfer failed';

      if (err.message.includes('user rejected transaction')) {
        msg = 'Transaction rejected by user';
      } else if (err.message.includes('Producer -> Distributor only')) {
        msg = 'Can only transfer to authorized distributors';
      } else if (err.message.includes('Only owner can transfer')) {
        msg = 'You are not the current owner of this batch';
      } else if (err.message.includes('insufficient funds')) {
        msg = 'Insufficient Sepolia ETH for gas fee';
      } else if (err.message.includes('Sepolia')) {
        msg = err.message;
      }

      setMessage(msg);
      setStatus('error');
      setTimeout(() => {
        setMessage('');
        setStatus('');
      }, 5000);
    }
  };

  return (
    <div className="producer-view">
      <div className="view-header">
        <button className="btn-back" onClick={onBack}>
          ← Back
        </button>
        <h2>Producer Dashboard</h2>
      </div>

      {message && (
        <div className={`alert ${status === 'error' ? 'alert-error' : status === 'success' ? 'alert-success' : 'alert-info'}`}>
          {message}
        </div>
      )}

      <div className="create-batch-section">
        <h3>Create New Batch</h3>
        <form onSubmit={handleCreateBatch} className="batch-form">
          <div className="form-group">
            <label htmlFor="batchId">Batch ID *</label>
            <input
              type="text"
              id="batchId"
              name="batchId"
              placeholder="e.g., BATCH-001"
              value={formData.batchId}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="productName">Product Name *</label>
            <input
              type="text"
              id="productName"
              name="productName"
              placeholder="e.g., Organic Raisins"
              value={formData.productName}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={status === 'creating' || status === 'updating' || status === 'transferring'}
          >
            {status === 'creating' ? 'Creating...' : '✚ Create Batch'}
          </button>
        </form>
      </div>

      <div className="batches-section">
        <h3>My Batches ({batches.length})</h3>
        
        {isLoadingBatches ? (
          <div className="loading-batches">
            <div className="spinner"></div>
            <p>Loading your batches...</p>
          </div>
        ) : batches.length === 0 ? (
          <div className="no-batches">
            <p>You haven't created any batches yet.</p>
            <small>Create your first batch using the form above.</small>
          </div>
        ) : (
          <div className="batches-list">
            {batches.map((batch) => (
              <div key={batch.id} className="batch-card">
                <div className="batch-header">
                  <span className="batch-id" title={batch.id}>
                    {batch.id.length > 20 ? `${batch.id.substring(0, 20)}...` : batch.id}
                  </span>
                  <span className={`status-badge status-${batch.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {batch.status}
                  </span>
                </div>

                <div className="batch-details">
                  <p><strong>Product:</strong> {batch.productName}</p>
                  <p>
                    <strong>Current Owner:</strong> 
                    <span className="address" title={batch.currentOwner}>
                      {batch.currentOwner.slice(0, 6)}...{batch.currentOwner.slice(-4)}
                    </span>
                  </p>
                  <p className="timestamp"><small>Created: {batch.timestamp}</small></p>
                  
                  {batch.certHash && batch.certHash.length > 0 && (
                    <div className="cert-info">
                      <p className="certified">✅ <strong>Halal Certified</strong></p>
                      <small title={batch.certHash}>
                        Cert: {batch.certHash.substring(0, 10)}...{batch.certHash.substring(batch.certHash.length - 6)}
                      </small>
                    </div>
                  )}
                </div>

                <div className="batch-actions">
                  <div className="status-update">
                    <label htmlFor={`status-${batch.id}`}>Update Status:</label>
                    <select
                      id={`status-${batch.id}`}
                      defaultValue={batch.status}
                      onChange={(e) => handleUpdateStatus(batch.id, e.target.value)}
                      disabled={status === 'updating' || status === 'transferring'}
                    >
                      <option value="Produced">Produced</option>
                      <option value="In Transit">In Transit</option>
                      <option value="At Warehouse">At Warehouse</option>
                      <option value="Quality Checked">Quality Checked</option>
                      <option value="Ready to Ship">Ready to Ship</option>
                      <option value="At Distributor">At Distributor</option>
                    </select>
                  </div>

                  {batch.currentOwner.toLowerCase() === signerAddress && (
                    <div className="transfer-section">
                      <label htmlFor={`distributor-${batch.id}`}>Transfer to Distributor:</label>
                      <div className="transfer-controls">
                        <input
                          type="text"
                          id={`distributor-${batch.id}`}
                          placeholder="Distributor address (0x...)"
                          value={distributorAddresses[batch.id] || ''}
                          onChange={(e) =>
                            setDistributorAddresses((prev) => ({
                              ...prev,
                              [batch.id]: e.target.value,
                            }))
                          }
                          disabled={status === 'transferring'}
                        />
                        <button
                          onClick={() => handleTransferToDistributor(batch.id)}
                          className="btn-transfer"
                          disabled={
                            !distributorAddresses[batch.id] ||
                            !ethers.isAddress(distributorAddresses[batch.id]) ||
                            status === 'transferring'
                          }
                        >
                          {status === 'transferring' ? 'Transferring...' : '🚚 Transfer'}
                        </button>
                      </div>
                    </div>
                  )}
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
            <strong>Your Wallet:</strong> 
            <span className="address" title={signerAddress}>
              {signerAddress.slice(0, 6)}...{signerAddress.slice(-4)}
            </span>
          </p>
        )}
        <p className="role-badge">
          <span className="badge-producer">PRODUCER</span>
        </p>
      </div>
    </div>
  );
};

export default ProducerView;
