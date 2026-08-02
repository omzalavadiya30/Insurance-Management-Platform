const test = require("node:test");
const assert = require("node:assert/strict");
const customerService = require("../src/services/customer.service");

const createActor = (role = "agent") => ({
  id: `actor-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
});

test("registerCustomerProfile creates a customer profile and default policy", async () => {
  const userId = `test-user-${Date.now()}`;

  const result = await customerService.registerCustomerProfile({
    userId,
    fullName: "Asha Patel",
    email: "asha@example.com",
    phone: "+91 98765 43210",
    dateOfBirth: "1998-07-12",
    address: "Mira Road, Mumbai",
    identityType: "Aadhaar",
    identityNumber: "1234 5678 9012",
  });

  assert.equal(result.customer.fullName, "Asha Patel");
  assert.equal(result.policies.length, 1);
  assert.equal(result.documents.length, 1);
});

test("createCustomerClaim adds a claim to the customer dashboard", async () => {
  const userId = `test-user-claim-${Date.now()}`;

  await customerService.registerCustomerProfile({
    userId,
    fullName: "Neha Rao",
    email: "neha@example.com",
    phone: "+91 98765 0000",
    dateOfBirth: "1995-03-01",
    address: "Bengaluru",
    identityType: "PAN",
    identityNumber: "ABCD1234E",
  });

  const result = await customerService.createCustomerClaim({
    userId,
    claimAmount: 15000,
    reason: "Accident damage claim",
  });

  assert.equal(result.claims.length, 1);
  assert.equal(result.claims[0].status, "submitted");
});

test("recordPremiumPayment adds a payment entry to the dashboard", async () => {
  const userId = `test-user-payment-${Date.now()}`;

  await customerService.registerCustomerProfile({
    userId,
    fullName: "Pooja Singh",
    email: "pooja@example.com",
    phone: "+91 90000 11111",
    dateOfBirth: "1992-08-10",
    address: "Delhi",
    identityType: "Aadhaar",
    identityNumber: "9999 1111 2222",
  });

  const result = await customerService.recordPremiumPayment({
    userId,
    amount: 2500,
    paymentMethod: "UPI",
  });

  assert.equal(result.premiumPayments.length, 1);
  assert.equal(result.premiumPayments[0].paymentStatus, "paid");
});

test("uploadCustomerDocument attaches a document to the customer dashboard", async () => {
  const userId = `test-user-doc-${Date.now()}`;

  await customerService.registerCustomerProfile({
    userId,
    fullName: "Rohit Kumar",
    email: "rohit@example.com",
    phone: "+91 91234 56789",
    dateOfBirth: "1990-01-20",
    address: "Pune",
    identityType: "Passport",
    identityNumber: "P1234567",
  });

  const result = await customerService.uploadCustomerDocument({
    userId,
    fileName: "claim-photo.jpg",
    filePath: "/documents/claim-photo.jpg",
  });

  assert.equal(result.documents.length, 2);
  assert.equal(result.documents[0].fileName, "claim-photo.jpg");
});

test("createManagedCustomer registers searchable customer profiles", async () => {
  const actor = createActor("agent");
  const email = `isha.${Date.now()}@example.com`;

  const result = await customerService.createManagedCustomer({
    actor,
    fullName: "Isha Verma",
    email,
    phone: "+91 98888 12345",
    dateOfBirth: "1994-04-14",
    address: "MG Road, Pune",
    identityType: "PAN",
    identityNumber: "ABCDE1234F",
  });

  assert.equal(result.customer.createdBy, actor.id);
  assert.equal(result.customer.email, email);
  assert.match(result.customer.customerCode, /^CUS-/);

  const listResult = await customerService.listCustomerProfiles({
    actor,
    search: "Isha",
    page: 1,
    limit: 10,
  });

  assert.equal(listResult.total >= 1, true);
  assert.equal(
    listResult.customers.some((customer) => customer.id === result.customer.id),
    true
  );
});

test("createManagedCustomer rejects duplicate customer emails", async () => {
  const actor = createActor("admin");
  const email = `duplicate.${Date.now()}@example.com`;

  await customerService.createManagedCustomer({
    actor,
    fullName: "Riya Shah",
    email,
    phone: "+91 97777 12345",
    dateOfBirth: "1991-06-30",
    address: "Nehru Place, Delhi",
    identityType: "Aadhaar",
    identityNumber: "1111 2222 3333",
  });

  await assert.rejects(
    () =>
      customerService.createManagedCustomer({
        actor,
        fullName: "Riya Shah",
        email: email.toUpperCase(),
        phone: "+91 97777 12345",
        dateOfBirth: "1991-06-30",
        address: "Nehru Place, Delhi",
        identityType: "Aadhaar",
        identityNumber: "1111 2222 3333",
      }),
    (error) => error.statusCode === 409
  );
});

test("updateCustomerProfile edits customer information and creates history", async () => {
  const actor = createActor("agent");

  const created = await customerService.createManagedCustomer({
    actor,
    fullName: "Kabir Joshi",
    email: `kabir.${Date.now()}@example.com`,
    phone: "+91 96666 12345",
    dateOfBirth: "1988-11-03",
    address: "Bandra West, Mumbai",
    identityType: "Passport",
    identityNumber: "P9876543",
  });

  const updated = await customerService.updateCustomerProfile({
    actor,
    customerId: created.customer.id,
    patch: {
      phone: "+91 95555 12345",
      address: "Bandra East, Mumbai",
      status: "disabled",
    },
  });

  assert.equal(updated.customer.phone, "+91 95555 12345");
  assert.equal(updated.customer.address, "Bandra East, Mumbai");
  assert.equal(updated.customer.status, "disabled");

  const historyResult = await customerService.getCustomerHistory({
    actor,
    customerId: created.customer.id,
  });

  assert.equal(
    historyResult.history.some((event) => event.title === "Customer profile updated"),
    true
  );
});

test("customer users can only access their own customer profile", async () => {
  const userId = `self-user-${Date.now()}`;
  const otherUserId = `other-user-${Date.now()}`;

  const ownDashboard = await customerService.registerCustomerProfile({
    userId,
    fullName: "Meera Nair",
    email: `meera.${Date.now()}@example.com`,
    phone: "+91 94444 12345",
    dateOfBirth: "1997-02-18",
    address: "Kochi",
    identityType: "Aadhaar",
    identityNumber: "4444 5555 6666",
  });

  const otherDashboard = await customerService.registerCustomerProfile({
    userId: otherUserId,
    fullName: "Tanvi Rao",
    email: `tanvi.${Date.now()}@example.com`,
    phone: "+91 93333 12345",
    dateOfBirth: "1993-09-22",
    address: "Hyderabad",
    identityType: "PAN",
    identityNumber: "PQRS1234T",
  });

  const ownProfile = await customerService.getCustomerProfile({
    actor: { id: userId, role: "customer" },
    customerId: ownDashboard.customer.id,
  });

  assert.equal(ownProfile.customer.fullName, "Meera Nair");

  await assert.rejects(
    () =>
      customerService.getCustomerProfile({
        actor: { id: userId, role: "customer" },
        customerId: otherDashboard.customer.id,
      }),
    (error) => error.statusCode === 403
  );
});

test("listCustomerProfiles is limited to administrators and agents", async () => {
  await assert.rejects(
    () =>
      customerService.listCustomerProfiles({
        actor: { id: "customer-actor", role: "customer" },
      }),
    (error) => error.statusCode === 403
  );
});
