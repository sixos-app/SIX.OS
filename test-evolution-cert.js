import fs from 'node:fs';
import { execSync } from 'node:child_process';

const API_BASE = 'http://127.0.0.1:8788/api';
let cookie = '';
let orgId = '';
let userId = '';

async function fetchAPI(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { 'Cookie': cookie } : {}),
      ...(options.headers || {})
    }
  });
  
  if (res.headers.get('set-cookie')) {
    cookie = res.headers.get('set-cookie').split(';')[0];
  }
  
  return res;
}

async function run() {
  console.log('--- LOGIN REAL ---');
  console.log('--- LOGIN REAL (Bypass via injetado) ---');
  cookie = 'sixos_session=my-secret-token; Path=/; HttpOnly; SameSite=Lax';
  const session = await (await fetchAPI('/session')).json();
  console.log('Session Capabilities:', session.capabilities);
  console.log('Has evaluations.cycles.manage:', 'evaluations.cycles.manage' in session.capabilities);
  orgId = session.user.organizationId;
  userId = session.user.id;

  console.log('\n--- TEMPLATE A (ORG 1) ---');
  let scaleId = null;
  try {
    const output = execSync('npx wrangler d1 execute six-os --local --command="SELECT id FROM evaluation_scales LIMIT 1" --json').toString();
    const rows = JSON.parse(output);
    scaleId = rows[0].results[0].id;
  } catch (e) { console.error('Failed to get scale ID', e); }

  const tplRes = await fetchAPI('/evolution/admin/templates', {
    method: 'POST',
    body: JSON.stringify({ name: 'Template Certificação A', scaleId: scaleId })
  });
  const tpl = await tplRes.json();
  const templateId = tpl.id;
  
  console.log('\n--- QUESTION BUILDER ---');
  await fetchAPI(`/evolution/admin/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify({
      questions: [
        { question: 'Q1 (Rating)', type: 'rating', required: true },
        { question: 'Q2 (Text)', type: 'text', required: true }
      ]
    })
  });
  console.log('Questions inserted');

  console.log('\n--- CREATE CYCLE ---');
  const uniqueCycleName = `Ciclo Certificação 7.0.3-B ${Date.now()}`;
  const cRes = await fetchAPI('/evolution/admin/cycles', {
    method: 'POST',
    body: JSON.stringify({
      name: uniqueCycleName,
      description: 'Cert.',
      templateId: templateId,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      resultsAvailableAt: new Date(Date.now() - 86400000).toISOString() // Past to see results
    })
  });
  const cycle = await cRes.json();
  const cycleId = cycle.id;
  console.log('Cycle created:', cycleId);

  console.log('\n--- PARTICIPANTS (ALL) ---');
  const pPut = await fetchAPI(`/evolution/admin/cycles/${cycleId}/participants`, {
    method: 'PUT',
    body: JSON.stringify({ userIds: ['user-agsix-admin', 'user-coord-1', 'user-cs-1'] })
  });
  if (pPut.status !== 200) {
    console.error('Participants PUT error:', pPut.status, await pPut.text());
  }

  const pRes = await fetchAPI(`/evolution/admin/cycles/${cycleId}/participants`);
  const pResText = await pRes.text();
  if (pRes.status !== 200) {
    console.error('Participants GET error:', pRes.status, pResText);
  }
  const participants = JSON.parse(pResText);
  console.log('Participants count:', participants.length);

  console.log('\n--- ASSIGNMENTS GENERATION ---');
  const p1 = participants.find(p => p.email === 'agsix@sixos.app')?.userId;
  const p2 = participants.find(p => p.email === 'coord@sixos.app')?.userId; 
  
  await fetchAPI(`/evolution/admin/cycles/${cycleId}/activate`, {
    method: 'POST',
    body: JSON.stringify({
      self: true,
      manager: false,
      directReport: false
    })
  });
  console.log('Self assignments activated');

  console.log('\n--- PEER ASSIGNMENT ---');
  const peerRes = await fetchAPI('/evolution/admin/assignments', {
    method: 'POST',
    body: JSON.stringify({
      cycleId: cycleId,
      subjectUserId: p1,
      reviewerUserId: p2,
      relationshipType: 'peer'
    })
  });
  console.log('Peer assignment status:', peerRes.status);
  
  const peerInvalidRes = await fetchAPI('/evolution/admin/assignments', {
    method: 'POST',
    body: JSON.stringify({
      cycleId: cycleId,
      subjectUserId: p1,
      reviewerUserId: p1, // Invalid: Subject == Reviewer
      relationshipType: 'peer'
    })
  });
  console.log('Invalid Peer (Subject=Reviewer) status:', peerInvalidRes.status); // Expect 400

  console.log('\n--- ASSIGNMENTS API ---');
  const myAss = await (await fetchAPI('/evolution/assignments')).json();
  console.log('My assignments:', myAss.length);
  const targetAss = myAss.find(a => a.cycleName === uniqueCycleName);
  if (!targetAss) throw new Error('Assignment not found for the new cycle');
  const targetAssId = targetAss.id;

  console.log('\n--- DYNAMIC SCALE ---');
  const formRes = await fetchAPI(`/evolution/assignments/${targetAssId}`);
  const formData = await formRes.json();
  console.log('Scale Options length:', formData.scaleOptions ? formData.scaleOptions.length : 'N/A');

  console.log('\n--- QUESTION MANIPULATION / INVALID RATING ---');
  const badSubmit1 = await fetchAPI(`/evolution/assignments/${targetAssId}`, {
    method: 'POST',
    body: JSON.stringify({
      isDraft: false,
      answers: [
        { questionId: 'invalid-question-uuid', ratingValue: 5 }, // Fake question
        { questionId: formData.questions[0].id, ratingValue: 999 } // Bad rating
      ]
    })
  });
  console.log('Bad submit status:', badSubmit1.status);
  if (badSubmit1.status !== 200) console.log(await badSubmit1.text());

  console.log('\n--- SUBMIT NORMAL ---');
  const goodSubmit = await fetchAPI(`/evolution/assignments/${targetAssId}`, {
    method: 'POST',
    body: JSON.stringify({
      isDraft: false,
      answers: [
        { questionId: formData.questions[0].id, ratingValue: 5 },
        { questionId: formData.questions[1].id, textValue: 'Muito bom trabalho!' }
      ]
    })
  });
  console.log('Good submit status:', goodSubmit.status);
  if (goodSubmit.status !== 200) console.log(await goodSubmit.text());

  console.log('\n--- DOUBLE SUBMIT ---');
  const doubleSubmit = await fetchAPI(`/evolution/assignments/${targetAssId}`, {
    method: 'POST',
    body: JSON.stringify({
      isDraft: false,
      answers: [
        { questionId: formData.questions[0].id, ratingValue: 5 }
      ]
    })
  });
  console.log('Double submit status:', doubleSubmit.status); // Expect 409
  if (doubleSubmit.status !== 200) console.log(await doubleSubmit.text());

  console.log('\n--- CYCLE CLOSE ---');
  const closeRes = await fetchAPI(`/evolution/admin/cycles/${cycleId}/close`, { method: 'POST' });
  console.log('Close cycle status:', closeRes.status);
  
  const submitClosed = await fetchAPI(`/evolution/assignments/${targetAssId}`, {
    method: 'POST',
    body: JSON.stringify({ isDraft: false, answers: [] })
  });
  console.log('Submit on closed cycle status:', submitClosed.status); // Expect 403
  
  console.log('\n--- RESULTS CONFIDENTIALITY ---');
  const resData = await (await fetchAPI(`/evolution/results/${p1}?cycleId=${cycleId}`)).json();
  console.log('Result payload structure:', Object.keys(resData));
  if (resData.metrics) {
      console.log('Metrics available?', resData.metrics.length > 0);
  }

}

run().catch(console.error);
