/**
 * Seed data generator for mock API
 * Creates realistic test data for development
 */

const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica', 'William', 'Ashley', 'James', 'Amanda', 'Christopher', 'Melissa', 'Daniel', 'Nicole', 'Matthew', 'Michelle', 'Anthony', 'Kimberly'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee'];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'FL', 'OH', 'GA', 'NC'];

const generateName = () => {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
};

const generateEmail = (name) => {
  const parts = name.toLowerCase().split(' ');
  return `${parts[0]}.${parts[1]}@example.com`;
};

const generatePhone = () => {
  return `555-${Math.floor(Math.random() * 9000) + 1000}`;
};

const generateZip = () => {
  return `${Math.floor(Math.random() * 90000) + 10000}`;
};

const generateAddress = () => {
  const city = cities[Math.floor(Math.random() * cities.length)];
  const state = states[Math.floor(Math.random() * states.length)];
  const zip = generateZip();
  return {
    street: `${Math.floor(Math.random() * 9999) + 1} Main St`,
    city,
    state,
    zip,
    type: Math.random() > 0.5 ? 'current' : 'previous'
  };
};

const generatePerson = () => {
  const fullName = generateName();
  const age = Math.floor(Math.random() * 50) + 20;
  const ageRange = `${Math.floor(age / 5) * 5}-${Math.floor(age / 5) * 5 + 4}`;
  const address = generateAddress();
  
  return {
    id: generateId('person'),
    fullName,
    age,
    ageRange,
    dateOfBirth: new Date(1970 + age, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
    location: `${address.city}, ${address.state}`,
    addresses: [address, ...(Math.random() > 0.5 ? [generateAddress()] : [])],
    phoneNumbers: [generatePhone()],
    emailAddresses: [generateEmail(fullName)],
    relatives: Math.random() > 0.3 ? [{
      name: generateName(),
      relation: ['spouse', 'sibling', 'parent', 'child'][Math.floor(Math.random() * 4)]
    }] : [],
    associatedRecords: []
  };
};

const generateSearch = (userId, targetUserId = null) => {
  const queries = ['John Doe', 'Jane Smith', 'Michael Johnson', 'Sarah Williams', 'David Brown'];
  const query = queries[Math.floor(Math.random() * queries.length)];
  const searcherLocation = `${cities[Math.floor(Math.random() * cities.length)]}, ${states[Math.floor(Math.random() * states.length)]}`;
  
  return {
    id: generateId('search'),
    userId,
    targetUserId: targetUserId || `user-${Math.floor(Math.random() * 10) + 1}`,
    query,
    timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    searcherLocation,
    searcherId: userId,
    searcherMembershipLevel: ['basic', 'premium', 'enterprise'][Math.floor(Math.random() * 3)]
  };
};

const generateAlert = (userId) => {
  const name = generateName();
  const location = Math.random() > 0.5 ? cities[Math.floor(Math.random() * cities.length)] : null;
  // criteria is always a plain string so AlertsPage can render it directly
  const criteria = location ? `${name}, ${location}` : name;

  return {
    id: generateId('alert'),
    userId,
    criteria,
    frequency: ['daily', 'weekly', 'monthly'][Math.floor(Math.random() * 3)],
    channels: Math.random() > 0.5 ? ['email', 'in-app'] : ['email'],
    status: Math.random() > 0.2 ? 'active' : 'inactive',
    createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    lastTriggered: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : null
  };
};

const generateNotification = (userId) => {
  const types = ['search_alert', 'who_searched', 'subscription_renewal', 'new_feature'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  const messages = {
    search_alert: 'New search match found',
    who_searched: 'Someone searched for you',
    subscription_renewal: 'Your subscription will renew soon',
    new_feature: 'New feature available'
  };

  return {
    id: generateId('notif'),
    userId,
    type,
    title: messages[type],
    message: `${messages[type]}: ${generateName()}`,
    read: Math.random() > 0.5,
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
  };
};

const generateSubscription = (userId, plan = 'basic') => {
  const plans = ['basic', 'premium', 'enterprise'];
  const selectedPlan = plan || plans[Math.floor(Math.random() * plans.length)];
  const amounts = { basic: 29.99, premium: 49.99, enterprise: 99.99 };
  
  return {
    id: generateId('sub'),
    userId,
    plan: selectedPlan,
    amount: amounts[selectedPlan],
    currency: 'USD',
    status: Math.random() > 0.1 ? 'active' : 'cancelled',
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentMethod: {
      type: 'card',
      last4: `${Math.floor(Math.random() * 9000) + 1000}`,
      brand: ['visa', 'mastercard', 'amex'][Math.floor(Math.random() * 3)]
    },
    billingAddress: generateAddress(),
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
  };
};

const generateInvoice = (userId, subscriptionId) => {
  return {
    id: generateId('invoice'),
    userId,
    subscriptionId,
    amount: 29.99 + Math.random() * 70,
    currency: 'USD',
    status: ['paid', 'pending', 'overdue'][Math.floor(Math.random() * 3)],
    date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };
};

const generateSession = (userId) => {
  const ips = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '203.0.113.1'];
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
  ];

  const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
  
  return {
    id: generateId('session'),
    userId,
    ipAddress: ips[Math.floor(Math.random() * ips.length)],
    userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
    createdAt: createdAt.toISOString(),
    lastActivity: new Date(createdAt.getTime() + Math.random() * 2 * 60 * 60 * 1000).toISOString(),
    active: Math.random() > 0.3
  };
};

const seedData = () => {
  const dataStore = {
    users: [],
    people: [],
    searches: [],
    alerts: [],
    notifications: [],
    subscriptions: [],
    invoices: [],
    sessions: [],
    dataRemovalRequests: [],
    csReps: []
  };

  // Create admin user
  const adminUser = {
    id: 'user-admin',
    email: 'admin@test.com',
    fullName: 'Admin User',
    zip: '10001',
    password: 'admin123',
    emailVerified: true,
    role: 'admin',
    status: 'active',
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date().toISOString()
  };
  dataStore.users.push(adminUser);

  // Create member users
  const memberUser = {
    id: 'user-member',
    email: 'member@test.com',
    fullName: 'Member User',
    phone: '555-0100',
    zip: '90210',
    password: 'password123',
    emailVerified: true,
    role: 'member',
    status: 'active',
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date().toISOString()
  };
  dataStore.users.push(memberUser);
  
  // Create a paid member user with active subscription
  const paidMemberUser = {
    id: 'user-paid-member',
    email: 'paid@test.com',
    fullName: 'Paid Member User',
    phone: '555-0101',
    zip: '90210',
    password: 'password123',
    emailVerified: true,
    role: 'member',
    status: 'active',
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: new Date().toISOString()
  };
  dataStore.users.push(paidMemberUser);
  
  // Create active subscription for paid member
  const paidMemberSubscription = {
    id: generateId('sub'),
    userId: paidMemberUser.id,
    plan: 'basic',
    amount: 29.99,
    currency: 'USD',
    status: 'active', // Guaranteed active subscription
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentMethod: {
      type: 'card',
      last4: '1234',
      brand: 'visa'
    },
    billingAddress: {
      street: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90210',
      type: 'current'
    },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  };
  dataStore.subscriptions.push(paidMemberSubscription);
  
  // Also create an active subscription for member@test.com (for convenience)
  const memberSubscription = {
    id: generateId('sub'),
    userId: memberUser.id,
    plan: 'basic',
    amount: 29.99,
    currency: 'USD',
    status: 'active', // Guaranteed active subscription
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentMethod: {
      type: 'card',
      last4: '5678',
      brand: 'mastercard'
    },
    billingAddress: {
      street: '456 Oak Ave',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90210',
      type: 'current'
    },
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  };
  dataStore.subscriptions.push(memberSubscription);

  // Create alerts and notifications for the known member users
  for (let j = 0; j < 3; j++) {
    dataStore.alerts.push(generateAlert(memberUser.id));
    dataStore.alerts.push(generateAlert(paidMemberUser.id));
  }
  for (let j = 0; j < 4; j++) {
    dataStore.notifications.push(generateNotification(memberUser.id));
    dataStore.notifications.push(generateNotification(paidMemberUser.id));
  }

  // Create 20 more member users
  for (let i = 0; i < 20; i++) {
    const name = generateName();
    const user = {
      id: `user-${i + 1}`,
      email: generateEmail(name),
      fullName: name,
      zip: generateZip(),
      password: 'password123',
      emailVerified: Math.random() > 0.1,
      role: 'member',
      status: Math.random() > 0.1 ? 'active' : 'suspended',
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      lastLogin: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : null
    };
    dataStore.users.push(user);

    // Create subscription for most users
    if (Math.random() > 0.2) {
      const subscription = generateSubscription(user.id);
      dataStore.subscriptions.push(subscription);

      // Create invoices
      for (let j = 0; j < Math.floor(Math.random() * 5) + 1; j++) {
        dataStore.invoices.push(generateInvoice(user.id, subscription.id));
      }
    }

    // Create alerts
    for (let j = 0; j < Math.floor(Math.random() * 3); j++) {
      dataStore.alerts.push(generateAlert(user.id));
    }

    // Create notifications
    for (let j = 0; j < Math.floor(Math.random() * 5) + 1; j++) {
      dataStore.notifications.push(generateNotification(user.id));
    }

    // Create sessions
    for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
      dataStore.sessions.push(generateSession(user.id));
    }
  }

  // Create CS reps
  for (let i = 0; i < 3; i++) {
    const name = generateName();
    dataStore.csReps.push({
      id: `cs-rep-${i + 1}`,
      name,
      email: generateEmail(name),
      role: 'cs-rep',
      status: 'active',
      createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  // Helper function to generate multiple variations of a person with the same name
  const generatePersonVariations = (firstName, lastName, count = 10) => {
    const variations = [];
    const ageRanges = [
      { min: 20, max: 29, range: '20-29' },
      { min: 30, max: 39, range: '30-39' },
      { min: 40, max: 49, range: '40-49' },
      { min: 50, max: 59, range: '50-59' },
      { min: 60, max: 69, range: '60-69' }
    ];
    
    const streetNames = ['Main St', 'Oak Ave', 'Elm St', 'Park Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd', 'Birch Way', 'Willow St', 'Ash Blvd'];
    const streetNumbers = Array.from({ length: 100 }, (_, i) => i + 1);
    
    for (let i = 0; i < count; i++) {
      const ageRange = ageRanges[i % ageRanges.length];
      const age = Math.floor(Math.random() * (ageRange.max - ageRange.min + 1)) + ageRange.min;
      const cityIndex = i % cities.length;
      const city = cities[cityIndex];
      const state = states[cityIndex % states.length];
      const zip = generateZip();
      const streetNum = streetNumbers[i % streetNumbers.length];
      const streetName = streetNames[i % streetNames.length];
      
      const year = new Date().getFullYear() - age;
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      const dateOfBirth = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const phone = `555-${String(1000 + i).padStart(4, '0')}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i > 0 ? i : ''}@example.com`;
      
      const person = {
        id: generateId('person'),
        fullName: `${firstName} ${lastName}`,
        age,
        ageRange: ageRange.range,
        dateOfBirth,
        location: `${city}, ${state}`,
        addresses: [{
          street: `${streetNum} ${streetName}`,
          city,
          state,
          zip,
          type: 'current'
        }],
        phoneNumbers: [phone],
        emailAddresses: [email],
        relatives: Math.random() > 0.5 ? [{
          name: generateName(),
          relation: ['spouse', 'sibling', 'parent', 'child'][Math.floor(Math.random() * 4)]
        }] : [],
        associatedRecords: []
      };
      
      // Add a previous address for some variations
      if (i % 3 === 0) {
        const prevCity = cities[(i + 1) % cities.length];
        const prevState = states[(i + 1) % states.length];
        person.addresses.push({
          street: `${Math.floor(Math.random() * 9999) + 1} ${streetNames[(i + 1) % streetNames.length]}`,
          city: prevCity,
          state: prevState,
          zip: generateZip(),
          type: 'previous'
        });
      }
      
      variations.push(person);
    }
    
    return variations;
  };

  // Create guaranteed test people for easy searching
  const testPeople = [
    {
      id: generateId('person'),
      fullName: 'John Smith',
      age: 35,
      ageRange: '35-39',
      dateOfBirth: '1988-05-15',
      location: 'New York, NY',
      addresses: [{
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        type: 'current'
      }],
      phoneNumbers: ['555-1234'],
      emailAddresses: ['john.smith@example.com'],
      relatives: [{
        name: 'Jane Smith',
        relation: 'spouse'
      }],
      associatedRecords: []
    },
    {
      id: generateId('person'),
      fullName: 'Jane Johnson',
      age: 32,
      ageRange: '30-34',
      dateOfBirth: '1991-08-22',
      location: 'Los Angeles, CA',
      addresses: [{
        street: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90210',
        type: 'current'
      }],
      phoneNumbers: ['555-5678'],
      emailAddresses: ['jane.johnson@example.com'],
      relatives: [],
      associatedRecords: []
    },
    {
      id: generateId('person'),
      fullName: 'Michael Williams',
      age: 42,
      ageRange: '40-44',
      dateOfBirth: '1981-03-10',
      location: 'Chicago, IL',
      addresses: [{
        street: '789 Elm St',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        type: 'current'
      }],
      phoneNumbers: ['555-9012'],
      emailAddresses: ['michael.williams@example.com'],
      relatives: [],
      associatedRecords: []
    },
    // Guaranteed test people for requested searches
    {
      id: generateId('person'),
      fullName: 'David Wolfe',
      age: 38,
      ageRange: '35-39',
      dateOfBirth: '1985-07-20',
      location: 'San Francisco, CA',
      addresses: [{
        street: '100 Market St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        type: 'current'
      }],
      phoneNumbers: ['555-2001'],
      emailAddresses: ['david.wolfe@example.com'],
      relatives: [{
        name: 'Sarah Wolfe',
        relation: 'spouse'
      }],
      associatedRecords: []
    },
    {
      id: generateId('person'),
      fullName: 'Tim Chin',
      age: 29,
      ageRange: '25-29',
      dateOfBirth: '1994-11-05',
      location: 'Seattle, WA',
      addresses: [{
        street: '200 Pine St',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
        type: 'current'
      }],
      phoneNumbers: ['555-2002'],
      emailAddresses: ['tim.chin@example.com'],
      relatives: [],
      associatedRecords: []
    },
    {
      id: generateId('person'),
      fullName: 'Jerome Ang',
      age: 45,
      ageRange: '45-49',
      dateOfBirth: '1978-02-14',
      location: 'Boston, MA',
      addresses: [{
        street: '300 Boylston St',
        city: 'Boston',
        state: 'MA',
        zip: '02116',
        type: 'current'
      }],
      phoneNumbers: ['555-2003'],
      emailAddresses: ['jerome.ang@example.com'],
      relatives: [{
        name: 'Lisa Ang',
        relation: 'spouse'
      }],
      associatedRecords: []
    },
    {
      id: generateId('person'),
      fullName: 'Kwan Park',
      age: 33,
      ageRange: '30-34',
      dateOfBirth: '1990-09-30',
      location: 'Austin, TX',
      addresses: [{
        street: '400 Congress Ave',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        type: 'current'
      }],
      phoneNumbers: ['555-2004'],
      emailAddresses: ['kwan.park@example.com'],
      relatives: [],
      associatedRecords: []
    }
  ];
  
  // Generate 10 variations for each requested search name (for more realistic results)
  const requestedSearches = [
    { firstName: 'David', lastName: 'Wolfe' },
    { firstName: 'Tim', lastName: 'Chin' },
    { firstName: 'Jerome', lastName: 'Ang' },
    { firstName: 'Kwan', lastName: 'Park' }
  ];
  
  requestedSearches.forEach(({ firstName, lastName }) => {
    const variations = generatePersonVariations(firstName, lastName, 10);
    testPeople.push(...variations);
    console.log(`Generated ${variations.length} variations for ${firstName} ${lastName}`);
  });
  
  // Add guaranteed test people
  testPeople.forEach(person => dataStore.people.push(person));
  console.log(`Total test people created: ${testPeople.length}`);
  
  // Log counts for each requested search name
  requestedSearches.forEach(({ firstName, lastName }) => {
    const count = dataStore.people.filter(p => 
      p.fullName.toLowerCase() === `${firstName} ${lastName}`.toLowerCase()
    ).length;
    console.log(`  - ${firstName} ${lastName}: ${count} results`);
  });

  // Create additional random people records to maintain a good dataset
  // (43 guaranteed test people + 57 random = 100 total)
  for (let i = 0; i < 57; i++) {
    dataStore.people.push(generatePerson());
  }

  // Create search history
  for (let i = 0; i < 200; i++) {
    const userId = dataStore.users[Math.floor(Math.random() * dataStore.users.length)].id;
    const targetUserId = Math.random() > 0.5 ? dataStore.users[Math.floor(Math.random() * dataStore.users.length)].id : null;
    dataStore.searches.push(generateSearch(userId, targetUserId));
  }

  // Create data removal requests
  for (let i = 0; i < 5; i++) {
    const user = dataStore.users[Math.floor(Math.random() * dataStore.users.length)];
    dataStore.dataRemovalRequests.push({
      id: generateId('request'),
      userId: user.id,
      status: ['pending', 'approved', 'rejected'][Math.floor(Math.random() * 3)],
      requestedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'GDPR request'
    });
  }

  return dataStore;
};

module.exports = { seedData };

