});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const customer = await get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const vehicles = (await all('SELECT * FROM vehicles WHERE customer_id = ?', [req.params.id])).map(toClientVehicle);
    const issues = (await all('SELECT * FROM contact_issues WHERE customer_id = ?', [req.params.id])).map(toClientIssue);
    res.json({ ...toClientCustomer(customer), vehicles, issues });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

app.post('/api/customers', async (req, res) => {
  const error = validateCustomer(req.body);
  if (error) return res.status(400).json({ error });
  try {
    await run(`
      INSERT INTO customers (id, name, type, phone, email, aadhaar, pan, pin, license, address, aadhaar_verified, pin_verified, address_verified, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      req.body.id, req.body.name, req.body.type, req.body.phone, req.body.email, req.body.aadhaar || '',
      req.body.pan || '', req.body.pin || '', req.body.license || '', req.body.address || '',
      req.body.checks?.aadhaar ? 1 : 0, req.body.checks?.pin ? 1 : 0, req.body.checks?.address ? 1 : 0
    ]);
    res.status(201).json(req.body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  const error = validateCustomer(req.body);
  if (error) return res.status(400).json({ error });
  try {
    await run(`
      UPDATE customers
      SET name = ?, type = ?, phone = ?, email = ?, aadhaar = ?, pan = ?, pin = ?, license = ?, address = ?,
          aadhaar_verified = ?, pin_verified = ?, address_verified = ?, kyc = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      req.body.name, req.body.type, req.body.phone, req.body.email, req.body.aadhaar || '', req.body.pan || '',
      req.body.pin || '', req.body.license || '', req.body.address || '',
      req.body.checks?.aadhaar ? 1 : 0, req.body.checks?.pin ? 1 : 0, req.body.checks?.address ? 1 : 0,
      req.body.checks?.aadhaar && req.body.checks?.pin && req.body.checks?.address ? 'verified' : 'pending',
      req.params.id
    ]);
    res.json(req.body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    await run('DELETE FROM contact_issues WHERE customer_id = ?', [req.params.id]);
    await run('DELETE FROM vehicles WHERE customer_id = ?', [req.params.id]);
    await run('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

app.get('/api/vehicles', async (req, res) => {
  try {
    res.json({ vehicles: (await all('SELECT * FROM vehicles ORDER BY number')).map(toClientVehicle) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

app.post('/api/vehicles', async (req, res) => {
  try {
    await run(`
      INSERT INTO vehicles (id, customer_id, number, type, model, fuel, chassis, insurance, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [req.body.id, req.body.customerId, req.body.number, req.body.type, req.body.model || '', req.body.fuel || '', req.body.chassis || '', req.body.insurance || '', req.body.status || 'active']);
    res.status(201).json(req.body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vehicles/:id', async (req, res) => {
  try {
    await run(`
      UPDATE vehicles SET customer_id = ?, number = ?, type = ?, model = ?, fuel = ?, chassis = ?, insurance = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.body.customerId, req.body.number, req.body.type, req.body.model || '', req.body.fuel || '', req.body.chassis || '', req.body.insurance || '', req.body.status || 'active', req.params.id]);
    res.json(req.body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    await run('UPDATE contact_issues SET vehicle_id = "" WHERE vehicle_id = ?', [req.params.id]);
    await run('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    res.json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

app.get('/api/issues', async (req, res) => {
  try {
    res.json({ issues: (await all('SELECT * FROM contact_issues ORDER BY updated_at DESC')).map(toClientIssue) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

app.post('/api/issues', async (req, res) => {
  try {
    await run(`
      INSERT INTO contact_issues (id, customer_id, vehicle_id, category, priority, status, due, note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [req.body.id, req.body.customerId, req.body.vehicleId || '', req.body.category, req.body.priority, req.body.status, req.body.due || '', req.body.note]);
    res.status(201).json(req.body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/issues/:id', async (req, res) => {
  try {
    await run(`
      UPDATE contact_issues SET customer_id = ?, vehicle_id = ?, category = ?, priority = ?, status = ?, due = ?, note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.body.customerId, req.body.vehicleId || '', req.body.category, req.body.priority, req.body.status, req.body.due || '', req.body.note, req.params.id]);
    res.json(req.body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/issues/:id', async (req, res) => {
  try {
    await run('DELETE FROM contact_issues WHERE id = ?', [req.params.id]);
    res.json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete issue' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

initializeDatabase()
  .then(() => app.listen(PORT, () => {
    console.log(`ProFlux desk running on http://localhost:${PORT}`);
  }))
  .catch(error => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });

module.exports = app;