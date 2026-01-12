// src/components/ConsumerView.jsx
import React, { useState, useEffect } from 'react';
import { CONTRACT_ADDRESS, readOnlyContract } from '../services/blockchain';
import { ethers } from 'ethers';
import './ConsumerView.css';

const ConsumerView = ({ onBack }) => {
  const [batchId, setBatchId] = useState('');
  const [batchData, setBatchData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch batch data and timeline
  const fetchBatchInfo = async (id) => {
    if (!id.trim()) {
      setError('Please enter a Batch ID');
      return;
    }

    setLoading(true);
    setError('');
    setBatchData(null);
    setTimeline([]);

    try {
      // Check if batch exists
      const exists = await readOnlyContract.batchExists(id);
      if (!exists) {
        throw new Error('Batch not found');
      }

      // Get batch details
      const data = await readOnlyContract.getBatch(id);
      const batch = {
        productName: data[0],
        batchId: data[1],
        producer: data[2],
        currentOwner: data[3],
        status: data[4],
        certHash: data[5],
        timestamp: new Date(Number(data[6]) * 1000).toLocaleString(),
      };

      setBatchData(batch);

      // Fetch timeline from events
      await fetchTimeline(id);
    } catch (err) {
      console.error('Error fetching batch:', err);
      setError(err.message || 'Failed to load batch information');
    } finally {
      setLoading(false);
    }
  };

  // Fetch event-based timeline
  const fetchTimeline = async (id) => {
    try {
      const provider = readOnlyContract.provider;
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000); // Last 50k blocks

      // Get all relevant events for this batch
      const createdFilter = readOnlyContract.filters.BatchCreated(id);
      const transferredFilter = readOnlyContract.filters.BatchTransferred(id);
      const statusFilter = readOnlyContract.filters.StatusUpdated(id);

      const [createdEvents, transferredEvents, statusEvents] = await Promise.all([
        readOnlyContract.queryFilter(createdFilter, fromBlock, currentBlock),
        readOnlyContract.queryFilter(transferredFilter, fromBlock, currentBlock),
        readOnlyContract.queryFilter(statusFilter, fromBlock, currentBlock)
      ]);

      // Combine and sort events by block number
      const allEvents = [
        ...createdEvents.map(e => ({ ...e, type: 'created' })),
        ...transferredEvents.map(e => ({ ...e, type: 'transferred' })),
        ...statusEvents.map(e => ({ ...e, type: 'status' }))
      ].sort((a, b) => a.blockNumber - b.blockNumber);

      // Format timeline entries
      const formattedTimeline = allEvents.map((event, index) => {
        const timestamp = new Date(event.args.timestamp * 1000).toLocaleString();
        let description = '';
        let actor = '';

        switch (event.type) {
          case 'created':
            description = `Batch created`;
            actor = `${event.args.producer.slice(0, 6)}...${event.args.producer.slice(-4)}`;
            break;
          case 'transferred':
            description = `Transferred to owner`;
            actor = `${event.args.to.slice(0, 6)}...${event.args.to.slice(-4)}`;
            break;
          case 'status':
            description = `Status updated to: ${event.args.newStatus}`;
            actor = `${event.args.updater.slice(0, 6)}...${event.args.updater.slice(-4)}`;
            break;
          default:
            description = 'Unknown event';
        }

        return {
          id: `${event.transactionHash}-${index}`,
          timestamp,
          description,
          actor,
          blockNumber: event.blockNumber,
          txHash: event.transactionHash
        };
      });

      setTimeline(formattedTimeline);
    } catch (err) {
      console.warn('Failed to load timeline:', err);
      // Timeline is optional – don't break the whole view
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchBatchInfo(batchId);
  };

  return (
    <div className="consumer-view">
      <div className="view-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2>Consumer Verification</h2>
      </div>

      <div className="search-section">
        <p>Verify the authenticity and halal status of your product.</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="Enter Batch ID (e.g. RAISIN-2026-001)"
              disabled={loading}
            />
            <button 
              type="submit" 
              className="btn-search"
              disabled={loading || !batchId.trim()}
            >
              {loading ? 'Searching...' : '🔍 Verify'}
            </button>
          </div>
        </form>
        {error && <div className="alert alert-error">{error}</div>}
      </div>

      {batchData && (
        <div className="batch-details-section">
          <h3>Product Information</h3>
          <div className="info-card">
            <div className="info-row">
              <strong>Product Name:</strong>
              <span>{batchData.productName}</span>
            </div>
            <div className="info-row">
              <strong>Batch ID:</strong>
              <span className="batch-id">{batchData.batchId}</span>
            </div>
            <div className="info-row">
              <strong>Current Status:</strong>
              <span className={`status-badge status-${batchData.status.replace(/\s+/g, '-').toLowerCase()}`}>
                {batchData.status}
              </span>
            </div>
            <div className="info-row">
              <strong>Halal Certification:</strong>
              {batchData.certHash && batchData.certHash.length > 0 ? (
                <span className="certified">✅ Certified (Ref: {batchData.certHash})</span>
              ) : (
                <span className="not-certified">❌ Not Certified</span>
              )}
            </div>
            <div className="info-row">
              <strong>Producer:</strong>
              <span className="address">{batchData.producer.slice(0, 6)}...{batchData.producer.slice(-4)}</span>
            </div>
            <div className="info-row">
              <strong>Current Owner:</strong>
              <span className="address">{batchData.currentOwner.slice(0, 6)}...{batchData.currentOwner.slice(-4)}</span>
            </div>
          </div>
        </div>
      )}

      {timeline.length > 0 && (
        <div className="timeline-section">
          <h3>Supply Chain Timeline</h3>
          <div className="timeline">
            {timeline.map((entry) => (
              <div key={entry.id} className="timeline-item">
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-time">{entry.timestamp}</span>
                    <span className="timeline-actor">{entry.actor}</span>
                  </div>
                  <p className="timeline-desc">{entry.description}</p>
                  <div className="timeline-tx">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${entry.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View on Etherscan
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="contract-info">
        <p>
          <strong>Verified on Contract:</strong>{' '}
          <code title={CONTRACT_ADDRESS}>
            {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}
          </code>
        </p>
      </div>
    </div>
  );
};

export default ConsumerView;