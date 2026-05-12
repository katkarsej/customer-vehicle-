const API_BASE_URL = 'http://localhost:3001/api';
const STORAGE_KEY = 'profluxDeskData';

let db = { customers: [], vehicles: [], issues: [] };
let currentView = 'customers';
let editing = { customer: null, vehicle: null, issue: null };
let serverOnline = false;

const sampleData = {
  customers: [
    {
      id: 'CUST-001',
      name: 'Laxmi Traders',
      type: 'commercial',
      phone: '9876543210',
      email: 'laxmi@example.com',
      aadhaar: '123412341234',
      pan: 'ABCDE1234F',
      pin: '411001',
      license: 'MH1420200012345',
      address: 'Market Yard, Pune, Maharashtra',
      checks: { aadhaar: true, pin: true, address: true },
      createdAt: new Date().toISOString()
    },
    {
      id: 'CUST-002',
      name: 'Rahul Patil',
      type: 'private',
      phone: '9988776655',
      email: 'rahul@example.com',
      aadhaar: '222233334444',
      pan: 'PQRSX5678K',
      pin: '400001',
      license: '',
      address: 'Dadar West, Mumbai, Maharashtra',
      checks: { aadhaar: true, pin: false, address: false },
      createdAt: new Date().toISOString()
    },
    {
      id: 'CUST-003',
      name: 'Metro Logistics',
      type: 'commercial',
      phone: '9001122334',
      email: 'metro@example.com',
      aadhaar: '555566667777',
      pan: 'METRO9821L',
      pin: '560001',
      license: 'KA0120210098765',
      address: 'Peenya Industrial Area, Bengaluru',
      checks: { aadhaar: false, pin: false, address: false },
      createdAt: new Date().toISOString()
    }
  ],
  vehicles: [
    { id: 'VEH-001', customerId: 'CUST-001', number: 'MH12AB1234', type: 'Truck', model: 'Tata 407', fuel: 'Diesel', chassis: 'CHS001234', insurance: '2026-11-20', status: 'active' },
    { id: 'VEH-002', customerId: 'CUST-002', number: 'MH01CX4321', type: 'Car', model: 'Swift Dzire', fuel: 'Petrol', chassis: 'CHS005678', insurance: '2026-08-14', status: 'service' },
    { id: 'VEH-003', customerId: 'CUST-003', number: 'KA05MT9090', type: 'Tempo', model: 'Ashok Leyland Dost', fuel: 'CNG', chassis: 'CHS009090', insurance: '2026-12-01', status: 'active' }
  ],
  issues: [
    { id: 'ISS-001', customerId: 'CUST-002', vehicleId: 'VEH-002', category: 'Document missing', priority: 'high', status: 'open', due: '2026-05-20', note: 'Customer needs to upload updated address proof.' },
    { id: 'ISS-002', customerId: 'CUST-001', vehicleId: 'VEH-001', category: 'Call back', priority: 'medium', status: 'progress', due: '2026-05-16', note: 'Discuss insurance renewal and fleet addition.' }
  ]
};

const el = {};

function qs(id) {
  return document.getElementById(id);
}

function captureElements() {
  Object.assign(el, {
    viewTitle: qs('viewTitle'),
    syncDot: qs('syncDot'),
    syncTitle: qs('syncTitle'),
    syncText: qs('syncText'),
    searchInput: qs('searchInput'),
    statusFilter: qs('statusFilter'),
    typeFilter: qs('typeFilter'),
    primaryActionBtn: qs('primaryActionBtn'),
    sampleBtn: qs('sampleBtn'),
    exportBtn: qs('exportBtn'),
    totalCustomers: qs('totalCustomers'),
    totalVehicles: qs('totalVehicles'),
    verifiedCustomers: qs('verifiedCustomers'),
    openIssues: qs('openIssues'),
    customerCards: qs('customerCards'),
    vehicleRows: qs('vehicleRows'),
    kycBoard: qs('kycBoard'),
    issueList: qs('issueList'),
    customerModal: qs('customerModal'),
    vehicleModal: qs('vehicleModal'),
    issueModal: qs('issueModal'),
    customerDrawer: qs('customerDrawer'),
    drawerName: qs('drawerName'),
    drawerBody: qs('drawerBody'),
    drawerClose: qs('drawerClose')
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function readLocal() {
  const stored = localStorage.getItem(STORAGE_KEY);
  db = stored ? JSON.parse(stored) : structuredClone(sampleData);
  normalizeData();
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function normalizeData() {
  db.customers = (db.customers || []).map(customer => ({
    checks: { aadhaar: false, pin: false, address: false },
    ...customer,
    checks: { aadhaar: false, pin: false, address: false, ...(customer.checks || {}) }
  }));
  db.vehicles = db.vehicles || [];
  db.issues = db.issues || [];
}

async function loadData() {
  try {
    const data = await apiRequest('/desk');
    db = data;
    normalizeData();
    serverOnline = true;
    saveLocal();
  } catch (error) {
    readLocal();
    serverOnline = false;
  }
  updateSyncStatus();
}

async function persist(entity, action, payload) {
  saveLocal();
  if (!serverOnline) return;
  const endpoint = entity === 'customer' ? 'customers' : entity === 'vehicle' ? 'vehicles' : 'issues';
  try {
    if (action === 'create') await apiRequest(`/${endpoint}`, { method: 'POST', body: JSON.stringify(payload) });
    if (action === 'update') await apiRequest(`/${endpoint}/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    if (action === 'delete') await apiRequest(`/${endpoint}/${payload.id}`, { method: 'DELETE' });
  } catch (error) {
    serverOnline = false;
    updateSyncStatus();
  }
}

function updateSyncStatus() {
  el.syncDot.classList.toggle('offline', !serverOnline);
  el.syncTitle.textContent = serverOnline ? 'SQLite linked' : 'Browser storage';
  el.syncText.textContent = serverOnline
    ? 'Changes are saved to the backend and mirrored locally.'
    : 'Backend is offline, so edits are saved in this browser.';
}

function nextId(prefix, collection) {
  const max = collection
    .map(item => Number(String(item.id || '').split('-')[1]))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

function label(value = '') {
  return String(value).split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function customerById(id) {
  return db.customers.find(customer => customer.id === id);
}

function vehicleById(id) {
  return db.vehicles.find(vehicle => vehicle.id === id);
}

function vehicleOwner(vehicle) {
  const customer = customerById(vehicle.customerId);
  return {
    name: customer?.name || vehicle.ownerName || 'Unlinked owner',
    phone: customer?.phone || vehicle.ownerPhone || '',
    type: customer ? 'Customer record' : 'Custom owner'
  };
}

function kycPercent(customer) {
  const checks = customer.checks || {};
  const score = [checks.aadhaar, checks.pin, checks.address].filter(Boolean).length;
  return Math.round((score / 3) * 100);
}

function kycStatus(customer) {
  const percent = kycPercent(customer);
  if (percent === 100) return 'verified';
  if (percent > 0) return 'pending';
  return 'not-started';
}

function filteredData(collection) {
  const search = el.searchInput.value.trim().toLowerCase();
  const status = el.statusFilter.value;
  const type = el.typeFilter.value;
  return collection.filter(item => {
    const customer = item.customerId ? customerById(item.customerId) : item;
    const vehicle = item.vehicleId ? vehicleById(item.vehicleId) : item.number ? item : null;
    const text = JSON.stringify({ item, customer, vehicle }).toLowerCase();
    const matchesSearch = !search || text.includes(search);
    const matchesType = type === 'all' || customer?.type === type;
    const itemStatus = item.note ? item.status : item.number ? item.status : kycStatus(item);
    const matchesStatus = status === 'all'
      || itemStatus === status
      || (status === 'open' && db.issues.some(issue => issue.customerId === customer?.id && issue.status !== 'closed'));
    return matchesSearch && matchesType && matchesStatus;
  });
}

function render() {
  renderStats();
  renderCustomers();
  renderVehicles();
  renderKyc();
  renderIssues();
  fillSelects();
}

function renderStats() {
  el.totalCustomers.textContent = db.customers.length;
  el.totalVehicles.textContent = db.vehicles.length;
  el.verifiedCustomers.textContent = db.customers.filter(customer => kycStatus(customer) === 'verified').length;
  el.openIssues.textContent = db.issues.filter(issue => issue.status !== 'closed').length;
}

function renderCustomers() {
  const customers = filteredData(db.customers);
  if (!customers.length) {
    el.customerCards.innerHTML = '<div class="empty">No customers found. Add one to start linking KYC, vehicles, and contact issues.</div>';
    return;
  }
  el.customerCards.innerHTML = customers.map(customer => {
    const linkedVehicles = db.vehicles.filter(vehicle => vehicle.customerId === customer.id);
    const openIssues = db.issues.filter(issue => issue.customerId === customer.id && issue.status !== 'closed');
    const percent = kycPercent(customer);
    return `
      <article class="customer-card">
        <div class="card-head">
          <div class="name-line">
            <span class="avatar">${escapeHtml(customer.name.slice(0, 2).toUpperCase())}</span>
            <div>
              <h4>${escapeHtml(customer.name)}</h4>
              <p class="subtext">${customer.id} • ${escapeHtml(customer.phone)}</p>
            </div>
          </div>
          <span class="badge ${customer.type}">${label(customer.type)}</span>
        </div>
        <div class="customer-sections">
          <section class="info-block">
            <h5>Details</h5>
            <div class="info-row"><i class="fas fa-phone"></i><span>${escapeHtml(customer.phone)}</span></div>
            <div class="info-row"><i class="fas fa-envelope"></i><span>${escapeHtml(customer.email)}</span></div>
            <div class="info-row"><i class="fas fa-location-dot"></i><span>PIN ${escapeHtml(customer.pin)} · ${escapeHtml(customer.address || 'Address not added')}</span></div>
          </section>
          <section class="info-block">
            <h5>Verification</h5>
            <div class="info-row"><i class="fas fa-id-card"></i><span>Aadhaar ${mask(customer.aadhaar)}</span></div>
            <div class="info-row"><i class="fas fa-address-card"></i><span>PAN ${escapeHtml(customer.pan || 'not added')}</span></div>
            <div class="info-row"><i class="fas fa-shield-alt"></i><span><span class="pill ${kycStatus(customer)}">${label(kycStatus(customer))}</span> ${percent}% complete</span></div>
          </section>
          <section class="info-block">
            <h5>Vehicles</h5>
            <div class="mini-metrics">
              <div class="mini-metric"><span>Linked</span><strong>${linkedVehicles.length}</strong></div>
              <div class="mini-metric"><span>Active</span><strong>${linkedVehicles.filter(vehicle => vehicle.status === 'active').length}</strong></div>
            </div>
            <div class="info-row"><i class="fas fa-truck"></i><span>${linkedVehicles[0] ? escapeHtml(linkedVehicles[0].number) : 'No vehicle linked'}</span></div>
          </section>
          <section class="info-block">
            <h5>Issues</h5>
            <div class="mini-metrics">
              <div class="mini-metric"><span>Open</span><strong>${openIssues.length}</strong></div>
              <div class="mini-metric"><span>Total</span><strong>${db.issues.filter(issue => issue.customerId === customer.id).length}</strong></div>
            </div>
            <div class="info-row"><i class="fas fa-headset"></i><span>${openIssues[0] ? escapeHtml(openIssues[0].category) : 'No open issue'}</span></div>
          </section>
        </div>
        <div class="card-actions">
          <button class="mini-btn" data-action="view-customer" data-id="${customer.id}"><i class="fas fa-eye"></i> View</button>
          <button class="mini-btn" data-action="edit-customer" data-id="${customer.id}"><i class="fas fa-edit"></i> Edit</button>
          <button class="mini-btn danger" data-action="delete-customer" data-id="${customer.id}"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </article>
    `;
  }).join('');
}

function mask(value = '') {
  return value ? `${String(value).slice(0, 2)}••••${String(value).slice(-2)}` : 'not added';
}

function renderVehicles() {
  const vehicles = filteredData(db.vehicles);
  el.vehicleRows.innerHTML = vehicles.length ? vehicles.map(vehicle => {
    const owner = vehicleOwner(vehicle);
    return `
      <tr>
        <td><strong>${escapeHtml(vehicle.number)}</strong><p class="subtext">${escapeHtml(vehicle.type)} • ${escapeHtml(vehicle.model || 'Model not added')}</p></td>
        <td>${escapeHtml(owner.name)}<p class="subtext">${escapeHtml(owner.type)} ${owner.phone ? `• ${escapeHtml(owner.phone)}` : ''}</p></td>
        <td>Fuel: ${escapeHtml(vehicle.fuel || '-')}<br>Insurance: ${escapeHtml(vehicle.insurance || '-')}<br>Chassis: ${escapeHtml(vehicle.chassis || '-')}</td>
        <td><span class="pill ${vehicle.status}">${label(vehicle.status)}</span></td>
        <td><div class="row-actions"><button class="mini-btn" data-action="edit-vehicle" data-id="${vehicle.id}">Edit</button><button class="mini-btn danger" data-action="delete-vehicle" data-id="${vehicle.id}">Delete</button></div></td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="5" class="empty">No vehicles found.</td></tr>';
}

function renderKyc() {
  const customers = filteredData(db.customers);
  el.kycBoard.innerHTML = customers.length ? customers.map(customer => {
    const percent = kycPercent(customer);
    return `
      <article class="kyc-card">
        <div class="card-head">
          <div><h4>${escapeHtml(customer.name)}</h4><p class="subtext">Aadhaar ${mask(customer.aadhaar)} • PAN ${escapeHtml(customer.pan || 'not added')}</p></div>
          <span class="pill ${kycStatus(customer)}">${label(kycStatus(customer))}</span>
        </div>
        <div class="progress-track"><div class="progress-bar" style="width:${percent}%"></div></div>
        <strong>${percent}% verified</strong>
        <div class="verify-list">
          <span>Aadhaar check <button class="mini-btn" data-action="toggle-check" data-check="aadhaar" data-id="${customer.id}">${customer.checks.aadhaar ? 'Verified' : 'Verify'}</button></span>
          <span>PIN check <button class="mini-btn" data-action="toggle-check" data-check="pin" data-id="${customer.id}">${customer.checks.pin ? 'Verified' : 'Verify'}</button></span>
          <span>Address check <button class="mini-btn" data-action="toggle-check" data-check="address" data-id="${customer.id}">${customer.checks.address ? 'Verified' : 'Verify'}</button></span>
        </div>
      </article>
    `;
  }).join('') : '<div class="empty">No KYC records found.</div>';
}

function renderIssues() {
  const issues = filteredData(db.issues);
  el.issueList.innerHTML = issues.length ? issues.map(issue => {
    const customer = customerById(issue.customerId);
    const vehicle = vehicleById(issue.vehicleId);
    return `
      <article class="issue-card">
        <div>
          <h4>${escapeHtml(issue.category)} • ${escapeHtml(customer?.name || 'Unknown customer')}</h4>
          <p class="subtext">${escapeHtml(issue.note)}</p>
          <div class="issue-meta">
            <span class="pill ${issue.priority}">${label(issue.priority)}</span>
            <span class="pill ${issue.status}">${label(issue.status)}</span>
            <span class="pill not-started">${escapeHtml(vehicle?.number || 'No vehicle')}</span>
            <span class="pill not-started">Due ${escapeHtml(issue.due || 'not set')}</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="mini-btn" data-action="edit-issue" data-id="${issue.id}">Edit</button>
          <button class="mini-btn danger" data-action="delete-issue" data-id="${issue.id}">Delete</button>
        </div>
      </article>
    `;
  }).join('') : '<div class="empty">No contact issues found.</div>';
}

function fillSelects() {
  const customerOptions = db.customers.map(customer => `<option value="${customer.id}">${escapeHtml(customer.name)} (${customer.id})</option>`).join('');
  qs('vehicleOwner').innerHTML = customerOptions || '<option value="">Add customer first</option>';
  qs('issueCustomer').innerHTML = customerOptions || '<option value="">Add customer first</option>';
  qs('issueVehicle').innerHTML = '<option value="">No vehicle</option>' + db.vehicles.map(vehicle => `<option value="${vehicle.id}">${escapeHtml(vehicle.number)}</option>`).join('');
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.toggle('active', panel.id === `${view}View`));
  el.viewTitle.textContent = { customers: 'Customers', vehicles: 'Vehicles', kyc: 'KYC Verification', issues: 'Contact Issues' }[view];
  const action = { customers: ['New Customer', 'customer'], vehicles: ['New Vehicle', 'vehicle'], kyc: ['New Customer', 'customer'], issues: ['New Issue', 'issue'] }[view];
  el.primaryActionBtn.innerHTML = `<i class="fas fa-plus"></i> ${action[0]}`;
  el.primaryActionBtn.dataset.open = action[1];
}

function openModal(name) {
  qs(name).classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal(name) {
  qs(name).classList.remove('show');
  document.body.style.overflow = '';
}

function openCustomerForm(customer = null) {
  editing.customer = customer?.id || null;
  qs('customerModalTitle').textContent = customer ? 'Edit Customer' : 'Add Customer';
  qs('customerId').value = customer?.id || '';
  qs('customerName').value = customer?.name || '';
  qs('customerType').value = customer?.type || 'private';
  qs('customerPhone').value = customer?.phone || '';
  qs('customerEmail').value = customer?.email || '';
  qs('customerAadhaar').value = customer?.aadhaar || '';
  qs('customerPan').value = customer?.pan || '';
  qs('customerPin').value = customer?.pin || '';
  qs('customerLicense').value = customer?.license || '';
  qs('customerAddress').value = customer?.address || '';
  qs('aadhaarVerified').checked = Boolean(customer?.checks?.aadhaar);
  qs('pinVerified').checked = Boolean(customer?.checks?.pin);
  qs('addressVerified').checked = Boolean(customer?.checks?.address);
  openModal('customerModal');
}

function openVehicleForm(vehicle = null) {
  editing.vehicle = vehicle?.id || null;
  qs('vehicleModalTitle').textContent = vehicle ? 'Edit Vehicle' : 'Add Vehicle';
  qs('vehicleId').value = vehicle?.id || '';
  const ownerMode = vehicle?.ownerName && !vehicle?.customerId ? 'custom' : 'customer';
  qs('vehicleOwnerMode').value = ownerMode;
  qs('vehicleOwner').value = vehicle?.customerId || db.customers[0]?.id || '';
  qs('vehicleOwnerName').value = vehicle?.ownerName || '';
  qs('vehicleOwnerPhone').value = vehicle?.ownerPhone || '';
  qs('vehicleNumber').value = vehicle?.number || '';
  qs('vehicleType').value = vehicle?.type || 'Truck';
  qs('vehicleModel').value = vehicle?.model || '';
  qs('vehicleFuel').value = vehicle?.fuel || 'Diesel';
  qs('vehicleChassis').value = vehicle?.chassis || '';
  qs('vehicleInsurance').value = vehicle?.insurance || '';
  qs('vehicleStatus').value = vehicle?.status || 'active';
  updateVehicleOwnerFields();
  openModal('vehicleModal');
}

function openIssueForm(issue = null) {
  editing.issue = issue?.id || null;
  qs('issueModalTitle').textContent = issue ? 'Edit Contact Issue' : 'Add Contact Issue';
  qs('issueId').value = issue?.id || '';
  qs('issueCustomer').value = issue?.customerId || db.customers[0]?.id || '';
  qs('issueVehicle').value = issue?.vehicleId || '';
  qs('issueCategory').value = issue?.category || 'Call back';
  qs('issuePriority').value = issue?.priority || 'medium';
  qs('issueStatus').value = issue?.status || 'open';
  qs('issueDue').value = issue?.due || '';
  qs('issueNote').value = issue?.note || '';
  openModal('issueModal');
}

function validateCustomer(data) {
  if (!data.name || data.name.length < 2) return 'Customer name is required.';
  if (!/^\d{10}$/.test(data.phone)) return 'Phone number must be exactly 10 digits.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Enter a valid email.';
  if (!/^\d{12}$/.test(data.aadhaar)) return 'Aadhaar must be 12 digits.';
  if (!/^\d{6}$/.test(data.pin)) return 'PIN code must be 6 digits.';
  const duplicate = db.customers.find(customer => (customer.email === data.email || customer.aadhaar === data.aadhaar) && customer.id !== data.id);
  if (duplicate) return 'Email or Aadhaar already exists for another customer.';
  return '';
}

async function saveCustomer(event) {
  event.preventDefault();
  const data = {
    id: editing.customer || nextId('CUST', db.customers),
    name: qs('customerName').value.trim(),
    type: qs('customerType').value,
    phone: qs('customerPhone').value.trim(),
    email: qs('customerEmail').value.trim(),
    aadhaar: qs('customerAadhaar').value.trim(),
    pan: qs('customerPan').value.trim().toUpperCase(),
    pin: qs('customerPin').value.trim(),
    license: qs('customerLicense').value.trim(),
    address: qs('customerAddress').value.trim(),
    checks: {
      aadhaar: qs('aadhaarVerified').checked,
      pin: qs('pinVerified').checked,
      address: qs('addressVerified').checked
    },
    updatedAt: new Date().toISOString()
  };
  const error = validateCustomer(data);
  if (error) return alert(error);
  const index = db.customers.findIndex(customer => customer.id === data.id);
  if (index >= 0) db.customers[index] = { ...db.customers[index], ...data };
  else db.customers.push({ ...data, createdAt: new Date().toISOString() });
  await persist('customer', index >= 0 ? 'update' : 'create', data);
  closeModal('customerModal');
  render();
}

async function saveVehicle(event) {
  event.preventDefault();
  const ownerMode = qs('vehicleOwnerMode').value;
  const data = {
    id: editing.vehicle || nextId('VEH', db.vehicles),
    customerId: ownerMode === 'customer' ? qs('vehicleOwner').value : '',
    ownerName: ownerMode === 'custom' ? qs('vehicleOwnerName').value.trim() : '',
    ownerPhone: ownerMode === 'custom' ? qs('vehicleOwnerPhone').value.trim() : '',
    number: qs('vehicleNumber').value.trim().toUpperCase(),
    type: qs('vehicleType').value,
    model: qs('vehicleModel').value.trim(),
    fuel: qs('vehicleFuel').value,
    chassis: qs('vehicleChassis').value.trim(),
    insurance: qs('vehicleInsurance').value,
    status: qs('vehicleStatus').value
  };
  if (ownerMode === 'customer' && !data.customerId) return alert('Select an existing customer owner.');
  if (ownerMode === 'custom' && !data.ownerName) return alert('Custom owner name is required.');
  if (data.ownerPhone && !/^\d{10}$/.test(data.ownerPhone)) return alert('Owner phone must be exactly 10 digits.');
  if (!data.number) return alert('Vehicle registration is required.');
  const index = db.vehicles.findIndex(vehicle => vehicle.id === data.id);
  if (index >= 0) db.vehicles[index] = data;
  else db.vehicles.push(data);
  await persist('vehicle', index >= 0 ? 'update' : 'create', data);
  closeModal('vehicleModal');
  render();
}

function updateVehicleOwnerFields() {
  const isCustom = qs('vehicleOwnerMode').value === 'custom';
  qs('vehicleOwnerSelectWrap').classList.toggle('hidden', isCustom);
  document.querySelectorAll('.owner-custom-field').forEach(field => field.classList.toggle('hidden', !isCustom));
  qs('vehicleOwner').required = !isCustom;
  qs('vehicleOwnerName').required = isCustom;
}

async function saveIssue(event) {
  event.preventDefault();
  const data = {
    id: editing.issue || nextId('ISS', db.issues),
    customerId: qs('issueCustomer').value,
    vehicleId: qs('issueVehicle').value,
    category: qs('issueCategory').value,
    priority: qs('issuePriority').value,
    status: qs('issueStatus').value,
    due: qs('issueDue').value,
    note: qs('issueNote').value.trim()
  };
  if (!data.customerId || !data.note) return alert('Customer and notes are required.');
  const index = db.issues.findIndex(issue => issue.id === data.id);
  if (index >= 0) db.issues[index] = data;
  else db.issues.push(data);
  await persist('issue', index >= 0 ? 'update' : 'create', data);
  closeModal('issueModal');
  render();
}

async function removeItem(entity, id) {
  if (!confirm('Delete this record?')) return;
  if (entity === 'customer') {
    db.customers = db.customers.filter(customer => customer.id !== id);
    db.vehicles = db.vehicles.filter(vehicle => vehicle.customerId !== id);
    db.issues = db.issues.filter(issue => issue.customerId !== id);
  }
  if (entity === 'vehicle') {
    db.vehicles = db.vehicles.filter(vehicle => vehicle.id !== id);
    db.issues = db.issues.map(issue => issue.vehicleId === id ? { ...issue, vehicleId: '' } : issue);
  }
  if (entity === 'issue') db.issues = db.issues.filter(issue => issue.id !== id);
  await persist(entity, 'delete', { id });
  render();
}

async function toggleCheck(customerId, check) {
  const customer = customerById(customerId);
  customer.checks[check] = !customer.checks[check];
  customer.updatedAt = new Date().toISOString();
  await persist('customer', 'update', customer);
  render();
}

function showCustomer(customerId) {
  const customer = customerById(customerId);
  if (!customer) return;
  const vehicles = db.vehicles.filter(vehicle => vehicle.customerId === customer.id);
  const issues = db.issues.filter(issue => issue.customerId === customer.id);
  el.drawerName.textContent = customer.name;
  el.drawerBody.innerHTML = `
    <section class="drawer-section">
      <h4>Contact Details</h4>
      <div class="detail-list">
        <span><i class="fas fa-phone"></i>${escapeHtml(customer.phone)}</span>
        <span><i class="fas fa-envelope"></i>${escapeHtml(customer.email)}</span>
        <span><i class="fas fa-map-marker-alt"></i>${escapeHtml(customer.address)}</span>
      </div>
      <div class="card-actions">
        <button class="mini-btn" data-action="edit-customer" data-id="${customer.id}">Edit Details</button>
        <button class="mini-btn" data-action="quick-issue" data-id="${customer.id}">Add Issue</button>
      </div>
    </section>
    <section class="drawer-section">
      <h4>KYC</h4>
      <p class="subtext">Aadhaar ${mask(customer.aadhaar)} • PAN ${escapeHtml(customer.pan || 'not added')} • PIN ${escapeHtml(customer.pin)}</p>
      <div class="progress-track"><div class="progress-bar" style="width:${kycPercent(customer)}%"></div></div>
      <span class="pill ${kycStatus(customer)}">${label(kycStatus(customer))}</span>
    </section>
    <section class="drawer-section">
      <h4>Vehicles</h4>
      ${vehicles.length ? vehicles.map(vehicle => `<p><strong>${escapeHtml(vehicle.number)}</strong><br><span class="subtext">${escapeHtml(vehicle.type)} • ${escapeHtml(vehicle.model || '-')} • ${label(vehicle.status)}</span></p>`).join('') : '<p class="subtext">No vehicles linked.</p>'}
    </section>
    <section class="drawer-section">
      <h4>Contact Issues</h4>
      ${issues.length ? issues.map(issue => `<p><strong>${escapeHtml(issue.category)}</strong> <span class="pill ${issue.status}">${label(issue.status)}</span><br><span class="subtext">${escapeHtml(issue.note)}</span></p>`).join('') : '<p class="subtext">No issues added.</p>'}
    </section>
  `;
  el.customerDrawer.classList.add('show');
}

function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `proflux-data-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetSamples() {
  if (!confirm('Replace current browser data with sample customers, vehicles, and issues?')) return;
  db = structuredClone(sampleData);
  saveLocal();
  render();
}

function handleDocumentClick(event) {
  const nav = event.target.closest('.nav-tab');
  if (nav) switchView(nav.dataset.view);

  const opener = event.target.closest('[data-open]');
  if (opener) {
    const kind = opener.dataset.open;
    if (kind === 'customer') openCustomerForm();
    if (kind === 'vehicle') openVehicleForm();
    if (kind === 'issue') openIssueForm();
  }

  const closer = event.target.closest('[data-close]');
  if (closer) closeModal(closer.dataset.close);

  const action = event.target.closest('[data-action]');
  if (!action) return;
  const id = action.dataset.id;
  const customer = customerById(id);
  const vehicle = vehicleById(id);
  const issue = db.issues.find(item => item.id === id);
  if (action.dataset.action === 'view-customer') showCustomer(id);
  if (action.dataset.action === 'edit-customer') openCustomerForm(customer);
  if (action.dataset.action === 'delete-customer') removeItem('customer', id);
  if (action.dataset.action === 'edit-vehicle') openVehicleForm(vehicle);
  if (action.dataset.action === 'delete-vehicle') removeItem('vehicle', id);
  if (action.dataset.action === 'edit-issue') openIssueForm(issue);
  if (action.dataset.action === 'delete-issue') removeItem('issue', id);
  if (action.dataset.action === 'toggle-check') toggleCheck(id, action.dataset.check);
  if (action.dataset.action === 'quick-issue') {
    openIssueForm({ customerId: id, priority: 'medium', status: 'open', category: 'Call back', note: '', due: '', vehicleId: '' });
  }
}

function initializeEvents() {
  document.addEventListener('click', handleDocumentClick);
  el.searchInput.addEventListener('input', render);
  el.statusFilter.addEventListener('change', render);
  el.typeFilter.addEventListener('change', render);
  el.exportBtn.addEventListener('click', exportData);
  el.sampleBtn.addEventListener('click', resetSamples);
  el.drawerClose.addEventListener('click', () => el.customerDrawer.classList.remove('show'));
  qs('vehicleOwnerMode').addEventListener('change', updateVehicleOwnerFields);
  el.customerDrawer.addEventListener('click', event => {
    if (event.target === el.customerDrawer) el.customerDrawer.classList.remove('show');
  });
  qs('customerForm').addEventListener('submit', saveCustomer);
  qs('vehicleForm').addEventListener('submit', saveVehicle);
  qs('issueForm').addEventListener('submit', saveIssue);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(modal => closeModal(modal.id));
      el.customerDrawer.classList.remove('show');
    }
  });
}

async function boot() {
  captureElements();
  initializeEvents();
  await loadData();
  switchView('customers');
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
