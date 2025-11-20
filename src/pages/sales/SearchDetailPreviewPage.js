import React from 'react';

/**
 * A placeholder page that shows a truncated preview of a search result.
 * When a user clicks on a result in the logged‑out state, they land here.
 * Encourage the visitor to sign up to view full details.
 */
const SearchDetailPreviewPage = () => {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Preview</h1>
      <p>
        This is a preview of the full report. Sign up or log in to access contact
        details, address history, relatives and more.
      </p>
    </main>
  );
};

export default SearchDetailPreviewPage;