// src/components/RetailerView.jsx
import React, { useState, useEffect } from 'react';
import {
  CONTRACT_ADDRESS,
  getContractWithSigner,
  readOnlyContract,
  hasRole,
  ensureSepoliaNetwork
} from '../services/blockchain';
import { ethers } from 'ethers';
import './RetailerView.css';

const RetailerView = ({ onBack }) => {
  const [batches, setBatches] = useState([]);
  const [signerAddress, setSignerAddress] = useState(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Connect wallet & check authorization
  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum === 'undefined') {
        setMessage('Please install MetaMask');
        setLoading(false);
        return;
      }

      try {
        // Ensure we're on Sepolia network
        await ensureSepoliaNetwork();

        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        const userAddr = accounts[0].toLowerCase();
        setSignerAddress(userAddr);

        const authorized = await hasRole(userAddr, 'RETAILER_ROLE');
        setIsAuthorized(authorized);

        if (authorized) {
          await loadMyBatches(userAddr);
        } else {
          setMessage('You are not authorized as a Retailer.');
          setStatus('error');
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
        setLoading(false);
      }
    };

    init();
  }, []);

  // Load batches owned by retailer AND filter by "At Retailer"
  const loadMyBatches = async (address) => {
    setLoading(true);
    try {
      const batchIds = await readOnlyContract.getBatchesByOwner(address);

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

      // Only show batches with status "At Retailer"
      const atRetailerBatches = validBatches.filter(
        (batch) => batch.status === "At Retailer"
      );

      setBatches(atRetailerBatches);
    } catch (err) {
      console.error('Failed to load batches:', err);
      setMessage('Failed to load your batches');
      setStatus('error');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="retailer-view">
        <div className="view-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h2>Retailer Dashboard</h2>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="retailer-view">
        <div className="view-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h2>Retailer Dashboard</h2>
        </div>
        <div className="unauthorized">
          <h3>Access Denied</h3>
          <p>Your wallet does not have Retailer permissions.</p>
          {signerAddress && (
            <p>Connected Wallet: {signerAddress.slice(0, 6)}...{signerAddress.slice(-4)}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="retailer-view">
      <div className="view-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2>Retailer Dashboard</h2>
      </div>

      {message && (
        <div className={`alert ${status === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      <div className="info-box">
        <p><strong>My Address:</strong> {signerAddress?.slice(0, 6)}...{signerAddress?.slice(-4)}</p>
        <p><strong>Batches at Retailer:</strong> {batches.length}</p>
      </div>

      <div className="batches-section">
        <h3>Batches at Retailer ({batches.length})</h3>

        {batches.length === 0 ? (
          <div className="no-batches">
            <p>No batches with status "At Retailer".</p>
            <small>
              Batches appear here once a distributor transfers them to you 
              and updates the status to "At Retailer".
            </small>
          </div>
        ) : (
          <div className="batches-list">
            {batches.map((batch) => (
              <div key={batch.id} className="batch-card">
                <div className="batch-header">
                  <span className="batch-id">{batch.id}</span>
                  <span className="status-badge status-at-retailer">
                    At Retailer
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
        <p><strong>Role:</strong> <span className="role-tag">RETAILER</span></p>
      </div>
    </div>
  );
};

export default RetailerView;
