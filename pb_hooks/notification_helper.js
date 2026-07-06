const createNotification = (recipientId, title, body, type, data = {}) => {
  const col = $app.findCollectionByNameOrId('notifications');
  const n = new Record(col);
  n.set('recipient', recipientId);
  n.set('title', title);
  n.set('body', body);
  n.set('type', type);
  n.set('is_read', false);
  n.set('data', data);
  $app.save(n);
};

module.exports = {
  createNotification,
};
