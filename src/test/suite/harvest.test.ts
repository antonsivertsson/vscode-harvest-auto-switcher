import * as assert from 'assert';
import * as nock from 'nock';
import Harvest from '../../harvest';

const apiEndpoint = 'https://api.harvestapp.com/api/v2';

suite('Harvest class', () => {
  const harvest = new Harvest({
    accessToken: 'abc',
    accountId: 'def',
    userId: -1,
  });

  teardown(() => {
    nock.cleanAll();
  });

  test('StartEntry doesnt trigger twice when called simultaneously with same args', async () => {
    const startEntryScope = nock(apiEndpoint)
      .patch(/time_entries\/(.*?)\/restart/)
      .times(2)
      .reply(200);
    let nrOfCalls = 0;
    startEntryScope.on('replied', () => {
      nrOfCalls++;
    });
    await Promise.all([harvest.update.startEntry(1), harvest.update.startEntry(1)]);
    // SetTimeout to wait for nock event to increment
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(nrOfCalls, 1);
  });
  
  test('startEntry triggers twice when called simultaneously if it uses different args', async () => {
    const startEntryScope = nock(apiEndpoint)
      .patch(/time_entries\/(.*?)\/restart/)
      .times(2)
      .reply(200);
    let nrOfCalls = 0;
    startEntryScope.on('replied', () => {
      nrOfCalls++;
    });
    await Promise.all([harvest.update.startEntry(1), harvest.update.startEntry(2)]);
    // SetTimeout to wait for nock event to increment
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(nrOfCalls, 2);
  });
  
  test('stopEntry doesnt trigger twice when called simultaneously with same args', async () => {
    const stopEntryScope = nock(apiEndpoint)
      .patch(/time_entries\/(.*?)\/stop/)
      .times(2)
      .reply(200);
    let nrOfCalls = 0;
    stopEntryScope.on('replied', () => {
      nrOfCalls++;
    });
    await Promise.all([harvest.update.stopEntry(1), harvest.update.stopEntry(1)]);
    // SetTimeout to wait for nock event to increment
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(nrOfCalls, 1);
  });
  
  test('stopEntry triggers twice when called simultaneously if it uses different args', async () => {
    const stopEntryScope = nock(apiEndpoint)
      .patch(/time_entries\/(.*?)\/stop/)
      .times(2)
      .reply(200);
    let nrOfCalls = 0;
    stopEntryScope.on('replied', () => {
      nrOfCalls++;
    });
    await Promise.all([harvest.update.stopEntry(1), harvest.update.stopEntry(2)]);
    // SetTimeout to wait for nock event to increment
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(nrOfCalls, 2);
  });
  
  test('updateNotes doesnt trigger twice when called simultaneously with same args', async () => {
    const updateNotesScope = nock(apiEndpoint)
      .patch(/time_entries\/(.*?)/)
      .times(2)
      .reply(200);
    let nrOfCalls = 0;
    updateNotesScope.on('replied', () => {
      nrOfCalls++;
    });
    await Promise.all([harvest.update.notes(1, 'same'), harvest.update.notes(1, 'same')]);
    // SetTimeout to wait for nock event to increment
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(nrOfCalls, 1);
  });
  
  test('updateNotes triggers twice when called simultaneously if it uses different args', async () => {
    const updateNotesScope = nock(apiEndpoint)
      .patch(/time_entries\/(.*?)/)
      .times(2)
      .reply(200);
    let nrOfCalls = 0;
    updateNotesScope.on('replied', () => {
      nrOfCalls++;
    });
    await Promise.all([harvest.update.notes(1, 'same'), harvest.update.notes(1, 'different')]);
    // SetTimeout to wait for nock event to increment
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(nrOfCalls, 2);
  });
  
  test('get user returns error if entity not found', async () => {
    const getUserScope = nock(apiEndpoint)
      .get('/users/me')
      .reply(404);
    await assert.rejects(harvest.get.user(), {
      message: 'Failed to get user. Status: Not Found'
    });
	});
});
