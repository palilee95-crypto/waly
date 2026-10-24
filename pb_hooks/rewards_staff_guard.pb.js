/// <reference path="../pb_data/types.d.ts" />
// Enforces `can_manage_rewards` for merchant staff.
//
// The collection rules allow any staff of the merchant (needed so the app's
// direct writes are not rejected before this guard runs); the granular check
// lives in staff_permissions.assertPermission. Owners and superusers pass.
//
// Goja does not expose file-scope functions inside hook callbacks, so the guard
// is required inline in each handler.

onRecordCreateRequest((e) => {
  const helper = require(`${__hooks}/staff_permissions.js`);
  helper.assertPermission($app, e, e.record, "can_manage_rewards", "manage rewards");
  return e.next();
}, "rewards");

onRecordUpdateRequest((e) => {
  const helper = require(`${__hooks}/staff_permissions.js`);
  helper.assertPermission($app, e, e.record, "can_manage_rewards", "manage rewards");
  return e.next();
}, "rewards");

onRecordDeleteRequest((e) => {
  const helper = require(`${__hooks}/staff_permissions.js`);
  helper.assertPermission($app, e, e.record, "can_manage_rewards", "manage rewards");
  return e.next();
}, "rewards");
