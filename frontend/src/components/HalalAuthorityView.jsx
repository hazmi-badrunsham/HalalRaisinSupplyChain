// src/components/HalalAuthorityView.jsx
import React, { useState, useEffect } from 'react';
import './HalalAuthorityView.css';
import { CONTRACT_ADDRESS, getContractWithSigner, readOnlyContract } from '../services/blockchain';
import { ethers } from 'ethers';

const HalalAuthorityView = ({ onBack }) => {
  const [batches, setBatches] = useState([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [signerAddress, setSignerAddress] = useState(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  // Connect wallet & load pending batches on mount
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

        // Load batches awaiting halal cert
        await loadPendingBatches();
      } catch (err) {
        console.error('Wallet connection failed:', err);
        setMessage('Wallet connection denied');
      }
    };

    init();
  }, []);

  const loadPendingBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const currentBlock = await readOnlyContract.provider.getBlockNumber();
      const DEPLOYMENT_BLOCK = 5200000; // 👈 REPLACE WITH YOUR ACTUAL DEPLOYMENT BLOCK
      const fromBlock = Math.max(DEPLOYMENT_BLOCK, currentBlock - 5000);
      const toBlock = currentBlock;

      console.log(`🔍 Fetching BatchCreated events from block ${fromBlock} to ${toBlock}`);

      const allEvents = await readOnlyContract.queryFilter(
        readOnlyContract.filters.BatchCreated(),
        fromBlock,
        toBlock
      );

      // Filter batches with status "Pending Halal Certification"
      const pendingBatches = await Promise.all(
        allEvents.map(async (event) => {
          const { batchId, productName, creator } = event.args;
          try {
            const batchData = await readOnlyContract.getBatch(batchId);
            const status = batchData[4]; // assuming status is at index 4
            if (status === 'Pending Halal Certification') {
              return {
                id: batchId,
                productName,
                creator,
                timestamp: new Date(Number(batchData[6]) * 1000).toLocaleString(),
              };
            }
            return null;
          } catch (err) {
            console.warn(`Failed to fetch batch ${batchId}`);
            return null;
          }
        })
      );

      const validBatches = pendingBatches.filter(b => b !== null).reverse();
      setBatches(validBatches);
    } catch (err) {
      console.error('Failed to load pending batches:', err);
      setMessage('Failed to load pending batches (block range too large)');
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const handleSetCertificate = async (batchId, certHashInput) => {
    if (!certHashInput.trim()) {
      setMessage('Certificate hash cannot be empty');
      setStatus('error');
      return;
    }

    try {
      setStatus('certifying');
      setMessage(`Certifying ${batchId}...`);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getContractWithSigner(signer);

      const tx = await contract.setHalalCertificate(batchId, certHashInput, {
        gasLimit: 300000,
      });

      setMessage('Waiting for confirmation...');
      await tx.wait(2);

      // Refresh list
      await loadPendingBatches();

      setMessage(`Halal certificate set for ${batchId}!`);
      setStatus('success');
    } catch (err) {
      console.error(err);
      let msg = 'Transaction failed';
      if (err.message) {
        if (err.message.includes('HALAL_AUTHORITY_ROLE')) {
          msg = 'Your account is not authorized as Halal Authority. Contact the admin.';
        } else if (err.message.includes('Batch not found')) {
          msg = 'Batch not found or already certified.';
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
    <div className="halal-authority-view">
      <div className="view-header">
        <button className="btn-back" onClick={onBack}>
          ← Back
        </button>
        <h2>Halal Authority Dashboard</h2>
      </div>

      {message && (
        <div className={`alert ${status === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      <div className="batches-section">
        <h3>Batches Awaiting Halal Certification</h3>
        {isLoadingBatches ? (
          <p className="no-batches">Loading pending batches...</p>
        ) : batches.length === 0 ? (
          <p className="no-batches">
            No batches pending halal certification.
            <br />
            <em>New raisin batches will appear here once submitted by producers.</em>
          </p>
        ) : (
          <div className="batches-list">
            {batches.map((batch) => (
              <div key={batch.id} className="batch-card">
                <div className="batch-header">
                  <span className="batch-id">{batch.id}</span>
                </div>
                <p><strong>Product:</strong> {batch.productName}</p>
                <p><strong>Creator:</strong> {batch.creator.slice(0, 6)}...{batch.creator.slice(-4)}</p>
                <p><small>{batch.timestamp}</small></p>

                <div className="cert-form">
                  <input
                    type="text"
                    placeholder="Enter certificate IPFS hash"
                    className="cert-input"
                    id={`cert-${batch.id}`}
                  />
                  <button
                    className="btn-certify"
                    onClick={() => {
                      const input = document.getElementById(`cert-${batch.id}`);
                      handleSetCertificate(batch.id, input.value);
                    }}
                  >
                    Set Certificate
                  </button>
                </div>
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

export default HalalAuthorityView;