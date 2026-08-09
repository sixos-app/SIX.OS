import fs from 'node:fs';

const API_BASE = 'http://127.0.0.1:8788/api';

async function fetchAPI(path, options = {}, userEmail = '') {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(userEmail ? { 'Cf-Access-Authenticated-User-Email': userEmail } : {}),
      ...(options.headers || {})
    }
  });
  return res;
}

async function run() {
  console.log('--- STARTING DEVELOPMENT CERTIFICATION ---');

  const adminEmail = 'agsix@sixos.app';
  const managerEmail = 'coord@sixos.app';
  const collabEmail = 'spec1@sixos.app';
  const otherCollabEmail = 'spec2@sixos.app';

  // Get User IDs
  const u1 = await (await fetchAPI('/session', {}, adminEmail)).json();
  const u2 = await (await fetchAPI('/session', {}, managerEmail)).json();
  const u3 = await (await fetchAPI('/session', {}, collabEmail)).json();
  const u4 = await (await fetchAPI('/session', {}, otherCollabEmail)).json();

  const adminId = u1.user.id;
  const managerId = u2.user.id;
  const collabId = u3.user.id;
  const otherCollabId = u4.user.id;

  console.log(`Admin: ${adminId}, Manager: ${managerId}, Collab: ${collabId}, Other: ${otherCollabId}`);

  console.log('\n--- 1. DEBRIEF CREATION & IMMUTABILITY ---');
  // Manager creates Debrief for Collab
  let res = await fetchAPI('/evolution/debriefs', {
    method: 'POST',
    body: JSON.stringify({ subjectUserId: collabId, meetingDate: new Date().toISOString() })
  }, managerEmail);
  
  if (res.status !== 201) throw new Error('Failed to create debrief: ' + await res.text());
  const debriefId = (await res.json()).id;
  console.log('Debrief created by manager:', debriefId);

  console.log('\n--- 2. PDI CREATION (CROSS-ORG & SCOPE) ---');
  
  // Collab creates own PDI
  res = await fetchAPI('/evolution/development-plans', {
    method: 'POST',
    body: JSON.stringify({ title: 'Meu PDI de Teste' }) // subject defaults to self
  }, collabEmail);
  if (res.status !== 201) throw new Error('Collab failed to create own PDI: ' + await res.text());
  const myPlanId = (await res.json()).id;
  console.log('Collab created own PDI:', myPlanId);

  // Other Collab tries to view Collab's PDI (should fail 403)
  res = await fetchAPI(`/evolution/development-plans/${myPlanId}`, {}, otherCollabEmail);
  console.log('Other Collab viewing Collab PDI status:', res.status, '(Expected 403)');
  if (res.status !== 403) throw new Error('Access control failed. Other Collab accessed the plan.');
  
  // Manager tries to view Collab's PDI (should succeed 200, assuming Team scope)
  res = await fetchAPI(`/evolution/development-plans/${myPlanId}`, {}, managerEmail);
  console.log('Manager viewing Collab PDI status:', res.status, '(Expected 200)');
  if (res.status !== 200) throw new Error('Manager could not access subordinate plan.');

  console.log('\n--- 3. GOALS & ACTIONS ---');
  // Collab creates Goal
  res = await fetchAPI(`/evolution/development-plans/${myPlanId}/goals`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Aprender React' })
  }, collabEmail);
  if (res.status !== 201) throw new Error('Failed to create goal: ' + await res.text());
  const goalId = (await res.json()).id;
  console.log('Goal created:', goalId);

  // Collab creates Action
  res = await fetchAPI(`/evolution/development-plans/${myPlanId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ goalId, title: 'Fazer curso X' })
  }, collabEmail);
  if (res.status !== 201) throw new Error('Failed to create action: ' + await res.text());
  const actionId = (await res.json()).id;
  console.log('Action created:', actionId);

  console.log('\n--- 4. EVIDENCE ---');
  // Collab adds evidence
  res = await fetchAPI(`/evolution/development-plans/${myPlanId}/evidence`, {
    method: 'POST',
    body: JSON.stringify({ actionId, title: 'Certificado de Conclusão', linkUrl: 'http://cert' })
  }, collabEmail);
  console.log('Evidence created status:', res.status);

  console.log('\n--- 5. CHECK-INS ---');
  // Manager adds check-in
  res = await fetchAPI(`/evolution/development-plans/${myPlanId}/checkins`, {
    method: 'POST',
    body: JSON.stringify({ meetingDate: new Date().toISOString(), notes: 'Bom progresso' })
  }, managerEmail);
  console.log('Check-in created status:', res.status);

  console.log('\n--- 6. PLAN LIFECYCLE (IMMUTABILITY) ---');
  // Collab tries to complete the plan
  res = await fetchAPI(`/evolution/development-plans/${myPlanId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'completed' })
  }, collabEmail);
  console.log('Plan completed status:', res.status);

  // Collab tries to add goal to completed plan
  res = await fetchAPI(`/evolution/development-plans/${myPlanId}/goals`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Meta em plano fechado' })
  }, collabEmail);
  console.log('Add goal to closed plan status:', res.status, '(Expected 409)');
  if (res.status !== 409) throw new Error('Closed plan constraint failed.');

  console.log('\n--- CERTIFICATION COMPLETE ---');
}

run().catch(console.error);
