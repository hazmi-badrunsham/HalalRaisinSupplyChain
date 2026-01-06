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

  const loadBatches = async (userAddress) => {
  setIsLoadingBatches(true);
  try {
    // 🔑 Get current block
    const currentBlock = await readOnlyContract.provider.getBlockNumber();
    
    // 🔑 Set fromBlock to your contract's deployment block (or slightly before)
    const DEPLOYMENT_BLOCK = 5200000; // 👈 REPLACE WITH YOUR ACTUAL BLOCK
    const fromBlock = Math.max(DEPLOYMENT_BLOCK, currentBlock - 5000); // max 5k blocks back
    const toBlock = currentBlock;

    console.log(`🔍 Fetching events from block ${fromBlock} to ${toBlock}`);

    const allEvents = await readOnlyContract.queryFilter(
      readOnlyContract.filters.BatchCreated(),
      fromBlock,
      toBlock
    );

    const myEvents = allEvents.filter(
      event => event.args.creator.toLowerCase() === userAddress.toLowerCase()
    );

    const batchList = await Promise.all(
      myEvents.map(async (event) => {
        const { batchId, productName } = event.args;
        try {
          const batchData = await readOnlyContract.getBatch(batchId);
          return {
            id: batchId,
            productName,
            status: batchData[4],
            timestamp: new Date(Number(batchData[6]) * 1000).toLocaleString(),
          };
        } catch (err) {
          console.warn(`Failed to fetch batch ${batchId}`);
          return null;
        }
      })
    );

    const validBatches = batchList.filter(b => b !== null).reverse();
    setBatches(validBatches);
  } catch (err) {
    console.error('Failed to load batches:', err);
    setMessage('Failed to load your batches (block range too large)');
  } finally {
    setIsLoadingBatches(false);
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

      const tx = await contract.createBatch(formData.batchId, formData.productName, {
        gasLimit: 300000,
      });

      setMessage('Waiting for confirmation...');
      await tx.wait(2);

      // Refresh batch list
      await loadBatches(signerAddress);

      setFormData({ batchId: '', productName: 'Raisins' });
      setMessage('Batch created successfully!');
      setStatus('success');
    } catch (err) {
      console.error(err);
      let msg = 'Transaction failed';
      if (err.message) {
        if (err.message.includes('Batch already exists')) {
          msg = 'Batch ID already exists';
        } else if (err.message.includes('PRODUCER_ROLE')) {
          msg = 'Your account is not authorized as a Producer. Contact the admin.';
        } else if (err.message.includes('insufficient funds')) {
          msg = 'Insufficient Sepolia ETH for gas fee';
        }
      }
      setMessage(msg);
      setStatus('error');
    } finally {
      setTimeout(() => setStatus(''), 5000);
    }
  };

  return (
    <div className="producer-view">
      <button className="btn-back" onClick={onBack}>
        ← Back
      </button>
      <h2>Create New Raisin Batch</h2>

      {message && (
        <div className={`alert ${status === 'error' ? 'alert-error' : 'alert-success'}`}>
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
          />
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
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={status === 'creating'}
        >
          {status === 'creating' ? 'Creating...' : 'Create Batch'}
        </button>
      </form>

      <div className="batches-section">
        <h3>Your Batches</h3>
        {isLoadingBatches ? (
          <p className="no-batches">Loading your batches...</p>
        ) : batches.length === 0 ? (
          <p className="no-batches">
            No batches found. Create your first batch!
            <br />
            <em>Only batches created by your wallet are shown.</em>
          </p>
        ) : (
          <div className="batches-list">
            {batches.map((batch) => (
              <div key={batch.id} className="batch-card">
                <div className="batch-header">
                  <span className="batch-id">{batch.id}</span>
                  <span className={`status-badge status-${batch.status.replace(/\s+/g, '-').toLowerCase()}`}>
                    {batch.status}
                  </span>
                </div>
                <p><strong>Product:</strong> {batch.productName}</p>
                <p><small>{batch.timestamp}</small></p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="contract-info">
        <p>Contract: <code>{CONTRACT_ADDRESS}</code></p>
        {signerAddress && <p>Wallet: {signerAddress.slice(0, 6)}...{signerAddress.slice(-4)}</p>}
      </div>
    </div>
  );
};

export default ProducerView;