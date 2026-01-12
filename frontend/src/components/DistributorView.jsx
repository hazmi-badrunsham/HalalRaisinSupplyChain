// src/components/DistributorView.jsx
import React, { useState, useEffect } from 'react';
import {
  CONTRACT_ADDRESS,
  getContractWithSigner,
  readOnlyContract,
  hasRole
} from '../services/blockchain';
import { ethers } from 'ethers';
import './DistributorView.css';

const DistributorView = ({ onBack }) => {
  const [batches, setBatches] = useState([]);
  const [signerAddress, setSignerAddress] = useState(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retailerAddress, setRetailerAddress] = useState('');

  // Connect wallet & check authorization
  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum === 'undefined') {
        setMessage('Please install MetaMask');
        setLoading(false);
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        const userAddr = accounts[0].toLowerCase();
        setSignerAddress(userAddr);

        const authorized = await hasRole(userAddr, 'DISTRIBUTOR_ROLE');
        setIsAuthorized(authorized);

        if (authorized) {
          await loadMyBatches(userAddr);
        } else {
          setMessage('You are not authorized as a Distributor.');
          setStatus('error');
        }
      } catch (err) {
        console.error('Wallet connection failed:', err);
        setMessage('Wallet connection denied');
        setStatus('error');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Load batches owned by distributor AND filter by "At Distributor"
  const loadMyBatches = async (address) => {
    setLoading(true);
    try {
      // Get batch IDs owned by this address
      const batchIds = await readOnlyContract.getBatchesByOwner(address);

      // Fetch full batch details
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

      // 🔽 FILTER: Only show batches with status EXACTLY "At Distributor"
      const atDistributorBatches = validBatches.filter(
        (batch) => batch.status === "At Distributor"
      );

      setBatches(atDistributorBatches);
    } catch (err) {
      console.error('Failed to load batches:', err);
      setMessage('Failed to load your batches');
      setStatus('error');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  // Update batch status
  const handleUpdateStatus = async (batchId, newStatusValue) => {
    try {
      setStatus('updating');
      setMessage('Updating status...');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getContractWithSigner(signer);

      const tx = await contract.updateStatus(batchId, newStatusValue);
      await tx.wait(2);

      await loadMyBatches(signerAddress);
      setMessage('Status updated successfully!');
      setStatus('success');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Status update error:', err);
      setMessage('Failed to update status');
      setStatus('error');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Transfer batch to retailer
  // Transfer batch to retailer AND update status to "At Retailer"
const handleTransferToRetailer = async (batchId) => {
  if (!retailerAddress.trim()) {
    setMessage('Please enter retailer address');
    setStatus('error');
    setTimeout(() => setMessage(''), 3000);
    return;
  }

  if (!ethers.isAddress(retailerAddress)) {
    setMessage('Invalid Ethereum address');
    setStatus('error');
    setTimeout(() => setMessage(''), 3000);
    return;
  }

  try {
    setStatus('transferring');
    setMessage('Transferring batch...');

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = getContractWithSigner(signer);

    // Step 1: Transfer ownership
    const tx1 = await contract.transferBatch(batchId, retailerAddress);
    await tx1.wait(2);

    // Step 2: Update status to "At Retailer"
    const tx2 = await contract.updateStatus(batchId, "At Retailer");
    await tx2.wait(2);

    await loadMyBatches(signerAddress);
    setMessage('Batch transferred and status updated to "At Retailer"!');
    setStatus('success');
    setRetailerAddress('');

    setTimeout(() => setMessage(''), 3000);
  } catch (err) {
    console.error('Transfer error:', err);
    let msg = 'Transfer failed';
    if (err.message.includes('user rejected transaction')) {
      msg = 'Transaction rejected by user';
    } else if (err.message.includes('Distributor -> Retailer only')) {
      msg = 'Can only transfer to authorized retailers';
    } else if (err.message.includes('Only owner can transfer')) {
      msg = 'You are not the current owner of this batch';
    } else if (err.message.includes('insufficient funds')) {
      msg = 'Insufficient gas fee';
    }
    setMessage(msg);
    setStatus('error');
    setTimeout(() => setMessage(''), 3000);
  }
};

  if (loading) {
    return (
      <div className="distributor-view">
        <div className="view-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h2>Distributor Dashboard</h2>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="distributor-view">
        <div className="view-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h2>Distributor Dashboard</h2>
        </div>
        <div className="unauthorized">
          <h3>Access Denied</h3>
          <p>Your wallet does not have Distributor permissions.</p>
          {signerAddress && (
            <p>Connected Wallet: {signerAddress.slice(0, 6)}...{signerAddress.slice(-4)}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="distributor-view">
      <div className="view-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2>Distributor Dashboard</h2>
      </div>

      {message && (
        <div className={`alert ${status === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      <div className="info-box">
        <p><strong>My Address:</strong> {signerAddress?.slice(0, 6)}...{signerAddress?.slice(-4)}</p>
        <p><strong>Batches at Distributor:</strong> {batches.length}</p>
      </div>

      {/* Global Retailer Address Input */}
      <div className="retailer-section">
        <h3>Transfer to Retailer</h3>
        <div className="transfer-controls">
          <input
            type="text"
            placeholder="Enter retailer wallet address (0x...)"
            value={retailerAddress}
            onChange={(e) => setRetailerAddress(e.target.value)}
            className="address-input"
          />
          <small>Enter retailer address once, then transfer batches below</small>
        </div>
      </div>

      <div className="batches-section">
        <h3>Batches at Distributor ({batches.length})</h3>

        {batches.length === 0 ? (
          <div className="no-batches">
            <p>No batches with status "At Distributor".</p>
            <small>
              Batches appear here once their status is set to "At Distributor" 
              (e.g., by the producer or via transfer).
            </small>
          </div>
        ) : (
          <div className="batches-list">
            {batches.map((batch) => (
              <div key={batch.id} className="batch-card">
                <div className="batch-header">
                  <span className="batch-id">{batch.id}</span>
                  <span className={`status-badge status-at-distributor`}>
                    At Distributor
                  </span>
                </div>

                <div className="batch-details">
                  <p><strong>Product:</strong> {batch.productName}</p>
                  <p><strong>Producer:</strong> {batch.producer.slice(0, 6)}...{batch.producer.slice(-4)}</p>
                  <p><strong>Current Owner:</strong> 
                    <span className="address">
                      {batch.currentOwner.slice(0, 6)}...{batch.currentOwner.slice(-4)}
                    </span>
                  </p>
                  <p className="timestamp"><small>Received: {batch.timestamp}</small></p>
                  {batch.certHash && batch.certHash.length > 0 && (
                    <p className="certified">
                      <small>✅ Halal Certified</small>
                    </p>
                  )}
                </div>

                <div className="distributor-actions">
                  {/* Status Update */}
                  <div className="status-update">
                    <label>Update Status:</label>
                    <select
                      defaultValue={batch.status}
                      onChange={(e) => handleUpdateStatus(batch.id, e.target.value)}
                      disabled={status === 'updating' || status === 'transferring'}
                    >
                      <option value="In Transit">In Transit</option>
                      <option value="At Warehouse">At Warehouse</option>
                      <option value="Ready for Sale">Ready for Sale</option>
                      <option value="At Distributor">At Distributor</option>
                    </select>
                  </div>

                  {/* Transfer Button */}
                  <div className="transfer-action">
                    <button
                      onClick={() => handleTransferToRetailer(batch.id)}
                      disabled={!retailerAddress.trim() || !ethers.isAddress(retailerAddress) || status === 'updating' || status === 'transferring'}
                      className="btn-transfer"
                    >
                      {status === 'transferring' ? 'Transferring...' : '🚚 Transfer to Retailer'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="contract-info">
        <p>
          <strong>Contract:</strong>{' '}
          <code title={CONTRACT_ADDRESS}>
            {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}
          </code>
        </p>
        <p><strong>Role:</strong> <span className="role-tag">DISTRIBUTOR</span></p>
      </div>
    </div>
  );
};

export default DistributorView;