// Provide default env vars for tests
process.env.NODE_ENV = 'test';
process.env.REACT_APP_NEW_API_ENABLED = 'true';
process.env.REACT_APP_USE_MOCK_API = 'true';
process.env.REACT_APP_API_URL = 'http://localhost:3001/api/v1';
process.env.REACT_APP_USE_NEW_API_SEARCH = 'true';
process.env.REACT_APP_USE_NEW_API_REPORTS = 'true';
process.env.REACT_APP_USE_NEW_API_OPTOUT = 'false';
process.env.REACT_APP_USE_NEW_API_AUTH = 'false';
