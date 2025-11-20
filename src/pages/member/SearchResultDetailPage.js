import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Shows a detailed report for a selected person.
 * Pulls data from `/people/:id` using the user’s token.
 */
const SearchResultDetailPage = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await api.get(`/people/${id}`, { token });
        setReport(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchReport();
  }, [id, token]);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Report Details</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {report && (
        <div>
          <h2>{report.fullName}</h2>
          <p>Age: {report.age}</p>
          <p>Location: {report.location}</p>
          {/* Additional information can be displayed here */}
        </div>
      )}
    </main>
  );
};

export default SearchResultDetailPage;