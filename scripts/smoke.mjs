import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:' + (process.env.PORT || 3128) + '/api/';

async function request(path, method = 'GET', body = null, cookie = '') {
  const headers = { 'X-Requested-With': 'clan-stats' };
  if (body !== null) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === null ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

function startFor(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 5) % 7));
  return d;
}

function weekOffset(start, offset) {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + offset * 7);
  return d.toISOString().slice(0, 10);
}

function ensure(actual, expected, context) {
  assert.equal(actual, expected, context);
}

async function run() {
  ensure((await request('auth/setup-state')).body.initialized, false, 'Uninitialized');
  ensure((await request('dashboard')).status, 401, 'Dashboard guarded');
  ensure((await request('wiki-ai/status')).status, 401, 'AI endpoint guarded');
  ensure(
    (await request('wiki-ai/ask', 'POST', { question: 'CDT?', locale: 'en' })).status,
    401,
    'AI chat guarded',
  );
  const owner = await request('auth/bootstrap', 'POST', {
    bootstrapToken: process.env.BOOTSTRAP_TOKEN,
    username: 'owner',
    password: 'testing-password-1234',
  });
  ensure(owner.status, 201, 'Owner enrolled');
  const ownerCookie = owner.cookie;
  assert.ok(ownerCookie.startsWith('clan_session='), 'Owner cookie was issued');
  const aiStatus = await request('wiki-ai/status', 'GET', null, ownerCookie);
  ensure(aiStatus.status, 200, 'AI status available to members');
  ensure(aiStatus.body.enabled, false, 'No-key environment reports disabled AI');
  ensure(
    (await request('wiki-ai/ask', 'POST', { question: 'How does CDT work?', locale: 'en' }, ownerCookie))
      .status,
    503,
    'No-key environment rejects AI requests without contacting Google',
  );
  ensure((await request('auth/me', 'GET', null, ownerCookie)).body.role, 'owner', 'Owner role');
  ensure(
    (await request('auth/locale', 'PATCH', { locale: 'en' }, ownerCookie)).status,
    200,
    'Locale update',
  );
  ensure((await request('auth/me', 'GET', null, ownerCookie)).body.locale, 'en', 'Locale persisted');
  ensure(
    (await request('auth/login', 'POST', { username: 'owner', password: 'testing-password-1234' }))
      .status,
    201,
    'Password-only login',
  );
  const preferred = await request('auth/login', 'POST', {
    username: 'owner',
    password: 'testing-password-1234',
    locale: 'uk',
  });
  ensure(preferred.status, 201, 'Explicit locale accepted at login');
  ensure(preferred.body.locale, 'uk', 'Login returns explicitly chosen locale');
  ensure(
    (await request('auth/me', 'GET', null, ownerCookie)).body.locale,
    'uk',
    'Login locale persists across other active sessions',
  );
  ensure(
    (
      await request('auth/login', 'POST', {
        username: 'owner',
        password: 'wrong-password',
        locale: 'en',
      })
    ).status,
    401,
    'Invalid password cannot change locale',
  );
  ensure(
    (await request('auth/me', 'GET', null, ownerCookie)).body.locale,
    'uk',
    'Failed login leaves account locale unchanged',
  );
  ensure(
    (
      await request('auth/login', 'POST', {
        username: 'owner',
        password: 'testing-password-1234',
        locale: 'fr',
      })
    ).status,
    400,
    'Unsupported locale is rejected',
  );
  const restored = await request('auth/login', 'POST', {
    username: 'owner',
    password: 'testing-password-1234',
  });
  ensure(restored.body.locale, 'uk', 'Login without explicit language keeps account preference');
  const english = await request('auth/login', 'POST', {
    username: 'owner',
    password: 'testing-password-1234',
    locale: 'en',
  });
  ensure(english.body.locale, 'en', 'Later explicit locale overrides existing account preference');
  ensure(
    (await request('auth/me', 'GET', null, english.cookie)).body.locale,
    'en',
    'Explicit locale is available on session restoration',
  );

  const old = weekOffset(startFor(new Date()), -3);
  const recent = weekOffset(startFor(new Date()), -2);
  const dayPoints = [1, 2, 2, 2, 2, 4];
  const days = dayPoints.map((points, i) => ({
    day: i + 1,
    points,
    winner: i === 1 ? 'opponent' : 'ours',
    mvp: i === 1 ? 'opponentMVP' : 'КРОСТ',
  }));
  let result = await request(
    'import/confirm',
    'POST',
    {
      start: old,
      players: [
        { position: 1, name: 'КРОСТ', points: 100000 },
        { position: 2, name: 'Someone', points: 200000 },
      ],
      result: { opponent: 'poorplay', ourScore: 11, opponentScore: 2, days },
    },
    ownerCookie,
  );
  ensure(result.status, 201, 'Initial import');
  ensure(result.body.record.wins, 1, 'Win counted');
  result = await request(
    'import/confirm',
    'POST',
    {
      start: recent,
      players: [
        { position: 1, name: 'NewPerson', points: 550000 },
        { position: 2, name: 'КРОСТ', points: 400000 },
      ],
    },
    ownerCookie,
  );
  ensure(result.status, 201, 'Next week imported');
  const computed = result.body.rankings.calculated;
  const oldPlayer = computed.find((p) => p.name === 'Someone');
  const oldName = computed.find((p) => p.name === 'КРОСТ');
  const newcomer = computed.find((p) => p.name === 'NewPerson');
  ensure(oldPlayer.active, false, 'Missing player marked inactive');
  ensure(oldName.score, 325000, '75/25 calculation');
  ensure(newcomer.active, true, 'Newcomer marked active');
  ensure(
    (
      await request(
        'import/confirm',
        'POST',
        {
          start: recent,
          players: [{ position: 1, name: 'КРОСТ', points: 123 }],
        },
        ownerCookie,
      )
    ).status,
    400,
    'Prevent duplicate import',
  );
  const ownerInvitation = await request(
    'auth/invites',
    'POST',
    {
      label: 'SecondOwner',
      role: 'owner',
    },
    ownerCookie,
  );
  ensure(ownerInvitation.status, 201, 'Owner can invite another owner');
  const ownerToken = new URL(ownerInvitation.body.url).searchParams.get('invite');
  const secondOwner = await request('auth/invite/' + ownerToken + '/register', 'POST', {
    username: 'SecondOwner',
    password: 'second-owner-password-1234',
  });
  ensure(secondOwner.status, 201, 'Second owner registered');
  ensure(secondOwner.body.role, 'owner', 'Multiple owners supported');

  const adminInvitation = await request(
    'auth/invites',
    'POST',
    {
      label: 'TrustedAdmin',
      role: 'admin',
    },
    ownerCookie,
  );
  ensure(adminInvitation.status, 201, 'Owner can invite admin');
  const adminToken = new URL(adminInvitation.body.url).searchParams.get('invite');
  const administrator = await request('auth/invite/' + adminToken + '/register', 'POST', {
    username: 'TrustedAdmin',
    password: 'trusted-admin-password-1234',
  });
  ensure(administrator.status, 201, 'Admin registered');
  ensure(
    (await request('auth/invites', 'POST', { label: 'Escalate', role: 'owner' }, administrator.cookie))
      .status,
    403,
    'Admin cannot invite owner',
  );
  ensure(
    (await request('auth/invites', 'POST', { label: 'Higher', role: 'admin' }, administrator.cookie))
      .status,
    403,
    'Admin cannot invite admin',
  );
  ensure(
    (await request('auth/invites', 'POST', { label: 'Permitted', role: 'member' }, administrator.cookie))
      .status,
    201,
    'Admin invites member',
  );
  ensure(
    (await request('auth/accounts', 'GET', null, administrator.cookie)).status,
    200,
    'Admin can see accounts',
  );
  ensure(
    (await request('auth/accounts/' + secondOwner.body.id, 'DELETE', null, administrator.cookie)).status,
    403,
    'Admin cannot revoke accounts',
  );
  const invitation = await request(
    'auth/invites',
    'POST',
    { label: 'Guest', role: 'member' },
    ownerCookie,
  );
  ensure(invitation.status, 201, 'Owner can invite');
  const inviteToken = new URL(invitation.body.url).searchParams.get('invite');
  const info = await request('auth/invite/' + inviteToken);
  ensure(info.body.label, 'Guest', 'Invitation display name');
  const member = await request('auth/invite/' + inviteToken + '/register', 'POST', {
    username: 'guest',
    password: 'guest-password-1234',
  });
  ensure(member.status, 201, 'Member account registered');
  const memberCookie = member.cookie;
  ensure((await request('dashboard', 'GET', null, memberCookie)).status, 200, 'Member can view');
  ensure(
    (
      await request(
        'settings',
        'PATCH',
        {
          clanName: 'Modified',
          minimumPoints: 0,
          weights: [1],
        },
        memberCookie,
      )
    ).status,
    403,
    'Member cannot edit settings',
  );
  ensure(
    (
      await request(
        'import/confirm',
        'POST',
        {
          start: recent,
          players: [{ position: 1, name: 'Fake', points: 12 }],
        },
        memberCookie,
      )
    ).status,
    403,
    'Member cannot import',
  );
  const revoke = await request('auth/accounts/' + member.body.id, 'DELETE', null, ownerCookie);
  ensure(revoke.status, 200, 'Owner can revoke');
  ensure((await request('dashboard', 'GET', null, memberCookie)).status, 401, 'Revoked user denied');
  // One reusable group link serves multiple independent Member registrations.
  const shared = await request('auth/shared-invite', 'POST', {}, ownerCookie);
  ensure(shared.status, 201, 'Owner can issue group invite');
  const groupToken = new URL(shared.body.url).searchParams.get('invite');
  ensure(
    (await request('auth/invite/' + groupToken)).body.shared,
    true,
    'Reusable invitation advertised',
  );
  const groupFirst = await request('auth/invite/' + groupToken + '/register', 'POST', {
    username: 'NewPerson',
    password: 'newperson-password-1234',
  });
  ensure(groupFirst.status, 201, 'First group member registered');
  ensure(groupFirst.body.role, 'member', 'Reusable invitation is always member');
  ensure(groupFirst.body.playerId, newcomer.id, 'Existing player history linked to account');
  const groupSecond = await request('auth/invite/' + groupToken + '/register', 'POST', {
    username: 'OtherMember',
    password: 'othermember-password-1234',
  });
  ensure(groupSecond.status, 201, 'Second group member registered with same link');
  ensure(
    (
      await request('auth/invite/' + groupToken + '/register', 'POST', {
        username: 'owner',
        password: 'unimportant-password-1234',
      })
    ).status,
    400,
    'Cannot register duplicate in-game name',
  );

  const lastResult = await request(
    'import/confirm',
    'POST',
    {
      start: recent,
      result: {
        opponent: 'poorplay',
        ourScore: 11,
        opponentScore: 2,
        days: dayPoints.map((points, index) => ({
          day: index + 1,
          points,
          winner: index === 1 ? 'opponent' : 'ours',
          mvp: index === 1 ? 'enemy' : 'NewPerson',
        })),
      },
    },
    ownerCookie,
  );
  ensure(lastResult.status, 201, 'War result imported for nickname migration');
  ensure(
    (
      await request(
        'auth/profile',
        'PATCH',
        {
          username: 'FreshNick',
          currentPassword: 'wrong-password',
          newPassword: 'some-new-password-1234',
        },
        groupFirst.cookie,
      )
    ).status,
    401,
    'Password change checks current password',
  );
  ensure(
    (
      await request(
        'auth/profile',
        'PATCH',
        {
          username: 'КРОСТ',
        },
        groupFirst.cookie,
      )
    ).status,
    400,
    'Cannot claim a historical nickname',
  );
  const renamed = await request(
    'auth/profile',
    'PATCH',
    {
      username: 'FreshNick',
    },
    groupFirst.cookie,
  );
  ensure(renamed.status, 200, 'Change nickname without password');
  ensure(
    (
      await request(
        'auth/profile',
        'PATCH',
        {
          username: 'FreshNick',
          currentPassword: 'newperson-password-1234',
          newPassword: 'fresh-password-5678',
        },
        groupFirst.cookie,
      )
    ).status,
    200,
    'Change password separately',
  );
  ensure(renamed.body.playerId, newcomer.id, 'Stable player identity retained');
  ensure(
    (
      await request('auth/login', 'POST', {
        username: 'NewPerson',
        password: 'newperson-password-1234',
      })
    ).status,
    401,
    'Old login no longer works',
  );
  ensure(
    (
      await request('auth/login', 'POST', {
        username: 'FreshNick',
        password: 'fresh-password-5678',
      })
    ).status,
    201,
    'New login works',
  );
  const renamedDashboard = await request('dashboard', 'GET', null, groupFirst.cookie);
  ensure(
    renamedDashboard.body.rankings.calculated.some(
      (p) => p.id === newcomer.id && p.name === 'FreshNick',
    ),
    true,
    'Historical ranking uses updated player name',
  );
  const renamedWeek = renamedDashboard.body.weeks.find((w) => w.start === recent);
  ensure(
    renamedWeek.players.some((p) => p.id === newcomer.id && p.name === 'FreshNick'),
    true,
    'War log uses updated name',
  );
  ensure(
    renamedWeek.days.some((day) => day.mvp === 'FreshNick'),
    true,
    'Historical MVP text updated too',
  );
  ensure(
    (await request('auth/shared-invite', 'DELETE', null, ownerCookie)).status,
    200,
    'Owner disables group invite',
  );
  ensure(
    (
      await request('auth/invite/' + groupToken + '/register', 'POST', {
        username: 'AnotherMember',
        password: 'another-password-1234',
      })
    ).status,
    400,
    'Disabled group invite rejects new signups',
  );
  ensure(
    (await request('dashboard', 'GET', null, groupSecond.cookie)).status,
    200,
    'Existing accounts remain active after disabling invitation',
  );

  ensure(
    (await request('auth/shared-invite', 'POST', {}, administrator.cookie)).status,
    201,
    'Admin manages member group invitations',
  );
  ensure(
    (
      await request(
        'auth/accounts/' + groupSecond.body.id,
        'PATCH',
        {
          username: 'RenamedMember',
          role: 'admin',
        },
        administrator.cookie,
      )
    ).status,
    403,
    'Admin cannot promote member to admin',
  );
  ensure(
    (
      await request(
        'auth/accounts/' + groupSecond.body.id,
        'PATCH',
        {
          username: 'RenamedMember',
          role: 'member',
        },
        administrator.cookie,
      )
    ).status,
    200,
    'Admin can rename a member',
  );
  ensure(
    (
      await request('auth/login', 'POST', {
        username: 'RenamedMember',
        password: 'othermember-password-1234',
      })
    ).status,
    201,
    'Edited nickname works for sign-in',
  );
  ensure(
    (
      await request(
        'auth/accounts/' + secondOwner.body.id,
        'PATCH',
        {
          username: 'SecondOwner',
          role: 'member',
        },
        administrator.cookie,
      )
    ).status,
    403,
    'Admin cannot edit owner',
  );
  ensure(
    (await request('auth/accounts/' + owner.body.id, 'DELETE', null, ownerCookie)).status,
    403,
    'Owner cannot delete self',
  );
  ensure(
    (await request('auth/accounts/' + groupFirst.body.id, 'DELETE', null, administrator.cookie)).status,
    200,
    'Admin may delete member',
  );
  ensure(
    (await request('auth/me', 'GET', null, groupFirst.cookie)).status,
    401,
    'Deleted account session invalidated',
  );
  const afterDeletion = await request('dashboard', 'GET', null, ownerCookie);
  ensure(
    afterDeletion.body.weeks
      .find((w) => w.start === recent)
      .players.some((player) => player.id === newcomer.id && player.name === 'FreshNick'),
    true,
    'Deleted user leaves historical player and points intact',
  );
  ensure(
    (await request('auth/accounts/' + secondOwner.body.id, 'DELETE', null, ownerCookie)).status,
    200,
    'Owner may revoke another owner',
  );
  ensure(
    (await request('auth/me', 'GET', null, secondOwner.cookie)).status,
    401,
    'Revoked owner session invalidated',
  );
  // Editing must preserve the historical player IDs and recalculate derived values.
  const changedWar = await request(
    'import/war',
    'PATCH',
    {
      start: old,
      result: {
        opponent: 'NewEnemy',
        ourScore: 1,
        opponentScore: 12,
        days: dayPoints.map((points, index) => ({
          day: index + 1,
          points,
          winner: index === 0 ? 'ours' : 'opponent',
          mvp: index === 0 ? 'КРОСТ' : 'enemy MVP',
        })),
      },
    },
    ownerCookie,
  );
  ensure(changedWar.status, 200, 'Edit imported war result');
  ensure(changedWar.body.record.wins, 1, 'Win record recalculated');
  ensure(changedWar.body.record.losses, 1, 'Loss record recalculated');
  ensure(
    (
      await request(
        'import/war',
        'PATCH',
        {
          start: old,
          players: [{ position: 1, name: 'КРОСТ', points: 500 }],
        },
        groupSecond.cookie,
      )
    ).status,
    403,
    'Member cannot edit archived war',
  );

  const changedRanking = await request(
    'import/war',
    'PATCH',
    {
      start: old,
      players: [
        { position: 1, name: 'КРОСТ', playerId: oldName.id, points: 250000 },
        { position: 2, name: 'Someone', playerId: oldPlayer.id, points: 200000 },
        { position: 3, name: 'HistoricNew', points: 7777 },
      ],
    },
    ownerCookie,
  );
  ensure(changedRanking.status, 200, 'Update imported player scores');
  ensure(
    changedRanking.body.rankings.calculated.find((p) => p.id === oldName.id).score,
    362500,
    'Rank score recalculated after historical edit',
  );
  ensure(
    changedRanking.body.rankings.calculated.find((p) => p.id === oldName.id).active,
    true,
    'Editing an old roster does not replace latest active roster',
  );
  const oldAfterEdit = await request('dashboard?anchor=' + old + '&count=1', 'GET', null, ownerCookie);
  ensure(oldAfterEdit.body.weeks[0].opponent, 'NewEnemy', 'Opponent correction persisted');
  ensure(oldAfterEdit.body.weeks[0].players.length, 3, 'Edited historical roster persisted');
  ensure(
    oldAfterEdit.body.weeks[0].players.find((p) => p.id === oldName.id).points,
    250000,
    'Historical identity preserved',
  );
  ensure(
    (
      await request(
        'import/war',
        'PATCH',
        {
          start: old,
          players: [
            { position: 1, name: 'КРОСТ', playerId: oldName.id, points: 1 },
            { position: 1, name: 'Someone', playerId: oldPlayer.id, points: 2 },
          ],
        },
        ownerCookie,
      )
    ).status,
    400,
    'Duplicate corrected ranks rejected atomically',
  );
  ensure(
    (await request('dashboard?anchor=' + old + '&count=1', 'GET', null, ownerCookie)).body.weeks[0]
      .players.length,
    3,
    'Invalid edit did not delete existing scores',
  );
  ensure(
    (
      await request(
        'import/war',
        'PATCH',
        {
          start: weekOffset(startFor(new Date()), -5),
          players: [{ position: 1, name: 'Ghost', points: 100 }],
        },
        ownerCookie,
      )
    ).status,
    400,
    'Cannot edit a war that was never imported',
  );
  // OCR nickname corrections must preserve player identity, history, and the canonical login.
  const corrected = await request(
    'import/war',
    'PATCH',
    {
      start: old,
      players: [
        { position: 1, name: 'КРОСТ-fixed', playerId: oldName.id, points: 250000 },
        { position: 2, name: 'Someone', playerId: oldPlayer.id, points: 200000 },
        { position: 3, name: 'HistoricNew', points: 7777 },
      ],
    },
    ownerCookie,
  );
  ensure(corrected.status, 200, 'Correct OCR name without creating duplicate identity');
  ensure(
    corrected.body.rankings.calculated.find((p) => p.id === oldName.id).name,
    'КРОСТ-fixed',
    'Original player ID retained',
  );
  ensure(
    corrected.body.rankings.calculated.filter((p) => p.name === 'КРОСТ-fixed').length,
    1,
    'Corrected name appears once',
  );
  ensure(
    (await request('import/roster?start=' + recent, 'GET', null, ownerCookie)).body.aliases.some(
      (a) => a.normalizedName === 'крост' && a.playerId === oldName.id,
    ),
    true,
    'OCR correction saves old spelling as alias',
  );
  const correctedDays = (await request('dashboard?anchor=' + old + '&count=1', 'GET', null, ownerCookie))
    .body.weeks[0].days;
  ensure(
    correctedDays.some((day) => day.mvp === 'КРОСТ-fixed'),
    true,
    'Older MVP text updates with corrected identity',
  );

  ensure(
    (
      await request(
        'players/merge',
        'POST',
        {
          sourceId: oldPlayer.id,
          targetId: newcomer.id,
          overlap: 'keepTarget',
        },
        groupSecond.cookie,
      )
    ).status,
    403,
    'Member cannot merge player identities',
  );
  const migrated = await request(
    'players/merge',
    'POST',
    {
      sourceId: oldPlayer.id,
      targetId: newcomer.id,
      overlap: 'keepTarget',
    },
    ownerCookie,
  );
  ensure(migrated.status, 201, 'Merge wrong OCR player into corrected account');
  ensure(
    migrated.body.rankings.calculated.some((p) => p.id === oldPlayer.id),
    false,
    'Old duplicate identity removed',
  );
  ensure(
    migrated.body.rankings.calculated.find((p) => p.id === newcomer.id).appearances,
    2,
    'Both historical weeks retained for merged player',
  );
  const migratedWeek = (await request('dashboard?anchor=' + old + '&count=1', 'GET', null, ownerCookie))
    .body.weeks[0];
  ensure(
    migratedWeek.players.some((p) => p.id === newcomer.id && p.points === 200000),
    true,
    'Earlier war points reassigned to canonical ID',
  );
  ensure(
    (await request('import/roster?start=' + recent, 'GET', null, ownerCookie)).body.aliases.some(
      (a) => a.normalizedName === 'someone' && a.playerId === newcomer.id,
    ),
    true,
    'Merged old nickname is searchable OCR alias',
  );
  const rosterAfter = await request('players', 'GET', null, ownerCookie);
  ensure(
    rosterAfter.body.some((p) => p.id === oldPlayer.id),
    false,
    'Duplicate removed from players list',
  );
  ensure(
    (
      await request(
        'players/merge',
        'POST',
        {
          sourceId: newcomer.id,
          targetId: newcomer.id,
          overlap: 'keepSource',
        },
        ownerCookie,
      )
    ).status,
    400,
    'Cannot merge identity into itself',
  );

  const resolvedAlias = await request(
    'import/war',
    'PATCH',
    {
      start: old,
      players: [
        { position: 1, name: 'КРОСТ-fixed', playerId: oldName.id, points: 250000 },
        { position: 2, name: 'Someone', playerId: null, points: 200000 },
        { position: 3, name: 'HistoricNew', points: 7777 },
      ],
    },
    ownerCookie,
  );
  ensure(resolvedAlias.status, 200, 'Historic typo resolves via alias on repeat edit');
  ensure(
    (
      await request('dashboard?anchor=' + old + '&count=1', 'GET', null, ownerCookie)
    ).body.weeks[0].players.some((p) => p.id === newcomer.id && p.name === 'FreshNick'),
    true,
    'Old alias cannot create a duplicate player',
  );
  // Two different OCR identities in the same war must not duplicate that week's points.
  const overlapBefore = (await request('dashboard?anchor=' + old + '&count=1', 'GET', null, ownerCookie))
    .body.weeks[0].players;
  const other = overlapBefore.find((p) => p.name === 'HistoricNew');
  const canonical = overlapBefore.find((p) => p.id === oldName.id);
  const dayStats = await request('insights/days', 'GET', null, groupSecond.cookie);
  ensure(dayStats.status, 200, 'Any member can view day outcome statistics');
  ensure(dayStats.body.days.length, 6, 'Six game days analyzed');
  ensure(dayStats.body.days[0].total, 2, 'Both completed wars counted');
  ensure(dayStats.body.days[0].winRate, 100, 'Day one win rate derived from actual wins');
  ensure(
    (await request('insights/health', 'GET', null, groupSecond.cookie)).status,
    403,
    'Private clan health not visible to members',
  );
  const progress = await request('insights/players/' + canonical.id, 'GET', null, groupSecond.cookie);
  ensure(progress.status, 200, 'Any member can inspect historical player profile');
  ensure(progress.body.weeks.length, 2, 'Player profile includes both wars');
  ensure(progress.body.best, 250000, 'Player personal best calculated from actual scores');
  ensure(
    (await request('player-management/' + canonical.id, 'GET', null, groupSecond.cookie)).status,
    403,
    'Member cannot see staff-only information',
  );

  const sourceLabels = {
    telegram: true,
    discord: false,
    telegramHandle: '@helper',
    discordHandle: '',
    tags: ['family', 'exception'],
    exceptionReason: 'Partner account: approved by leadership',
  };
  const targetLabels = {
    telegram: false,
    discord: true,
    telegramHandle: '',
    discordHandle: 'trusted-member',
    tags: ['attention'],
    exceptionReason: '',
  };
  ensure(
    (await request('player-management/' + other.id, 'PATCH', sourceLabels, ownerCookie)).status,
    200,
    'Owner marks protected player',
  );
  ensure(
    (await request('player-management/' + canonical.id, 'PATCH', targetLabels, ownerCookie)).status,
    200,
    'Owner marks team member as needing attention',
  );
  const note = await request(
    'player-management/' + other.id + '/notes',
    'POST',
    {
      body: 'Discussed reduced activity, will follow up on Telegram',
      category: 'contact',
    },
    ownerCookie,
  );
  ensure(note.status, 201, 'Can append time-stamped private conversation note');
  ensure(note.body.notes[0].author, 'owner', 'Note records its author');
  ensure(
    (await request('player-management/' + other.id, 'GET', null, groupSecond.cookie)).status,
    403,
    'Private player notes never exposed to members',
  );
  const staffHealth = await request('insights/health', 'GET', null, ownerCookie);
  ensure(staffHealth.status, 200, 'Leadership can view health');
  ensure(
    staffHealth.body.attention.some((p) => p.id === canonical.id),
    true,
    'Tagged player appears in health attention list',
  );
  ensure(
    staffHealth.body.belowRequirement.some((p) => p.id === other.id && p.exception),
    true,
    'Protected exception is visible alongside minimum-score warnings',
  );

  ensure(
    (
      await request(
        'players/merge',
        'POST',
        {
          sourceId: other.id,
          targetId: canonical.id,
          overlap: 'keepTarget',
        },
        ownerCookie,
      )
    ).status,
    201,
    'Overlapping duplicate rows safely merged',
  );
  const overlapAfter = (await request('dashboard?anchor=' + old + '&count=1', 'GET', null, ownerCookie))
    .body.weeks[0].players;
  ensure(
    overlapAfter.find((p) => p.id === canonical.id).points,
    250000,
    'Explicit keepTarget retains the correct score',
  );
  ensure(
    overlapAfter.some((p) => p.id === other.id),
    false,
    'Incorrect overlapping row removed',
  );
  ensure(overlapAfter.length, overlapBefore.length - 1, 'No duplicated score after overlap merge');
  const mergedStaff = await request('player-management/' + canonical.id, 'GET', null, ownerCookie);
  ensure(mergedStaff.status, 200, 'Merged player management record available');
  ensure(mergedStaff.body.labels.telegram, true, 'Source contact flag preserved during merge');
  ensure(mergedStaff.body.labels.discord, true, 'Target contact flag preserved during merge');
  ensure(mergedStaff.body.labels.tags.includes('family'), true, 'Source tags migrated');
  ensure(mergedStaff.body.labels.tags.includes('attention'), true, 'Target tags retained');
  ensure(
    mergedStaff.body.notes.some((entry) => entry.body.includes('reduced activity')),
    true,
    'Staff notes moved to canonical player ID',
  );
  ensure(
    (await request('player-management/' + other.id, 'GET', null, ownerCookie)).status,
    400,
    'Deleted OCR duplicate cannot retain an independent management profile',
  );
  const savedNoteId = mergedStaff.body.notes[0].id;
  ensure(
    (
      await request(
        'player-management/' + canonical.id + '/notes/' + savedNoteId,
        'DELETE',
        null,
        ownerCookie,
      )
    ).status,
    200,
    'Leadership can remove obsolete note',
  );

  console.log('Production integration smoke tests passed');
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
