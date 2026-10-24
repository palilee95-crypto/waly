/// <reference path="../pb_data/types.d.ts" />
// Enforces the two "store scope" permissions that used to be UI-only.
//
// `merchant_services` and `branches` rules allow any staff of the merchant, so
// without these guards a staff token could edit services or outlets directly
// even with the toggles off. Owners and superusers pass.

onRecordCreateRequest((e) => {
  const helper = require(`${__hooks}/staff_permissions.js`);
  helper.assertPermission($app, e, e.record, "can_edit_store_profile", "edit the store profile");
  return e.next();
}, "merchant_services");

onRecordUpdateRequest((e) => {
  const helper = require(`${__hooks}/staff_permissions.js`);
  helper.assertPermission($app, e, e.record, "can_edit_store_profile", "edit the store profile");
  return e.next();
}, "merchant_services");

onRecordDeleteRequest((e) => {
  const helper = require(`${__hooks}/staff_permissions.js`);
  helper.assertPermission($app, e, e.record, "can_edit_store_profile", "edit the store profile");
  return e.next();
}, "merchant_services");

onRecordCreateRequest((e) => {
  const helper = require(`${__hooks}/staff_permissions.js`);
  helper.assertPermission($app, e, e.record, "can_manage_branches", "manage branches");
  return e.next();
}, "branches");

onRecordUpdateRequest((e) => {
  const helper = require(`${__hooks}/staff_permissions.js`);
  helper.assertPermission($app, e, e.record, "can_manage_branches", "manage branches");
  return e.next();
}, "branches");

onRecordDeleteRequest((e) => {
  const helper = require(`${__hooks}/staff_permissions.js`);
  helper.assertPermission($app, e, e.record, "can_manage_branches", "manage branches");
  return e.next();
}, "branches");
