const sendPushNotification = (userId, title, body, data = {}) => {
  let tokens;
  try {
    tokens = $app.findRecordsByFilter('push_tokens',
      `user = {:uid} && is_active = true`,
      '-created', 5, 0, { uid: userId }
    );
  } catch (err) {
    return;
  }

  const messages = [];
  for (let i = 0; i < tokens.length; i++) {
    messages.push({
      to: tokens[i].get('token'),
      title: title,
      body: body,
      data: data,
      sound: 'default',
      badge: 1,
    });
  }

  if (messages.length === 0) return;

  try {
    const res = $http.send({
      url: 'https://exp.host/--/api/v2/push/send',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    const tickets = JSON.parse(res.raw).data || [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'error' && ticket.details && ticket.details.error === 'DeviceNotRegistered') {
        $app.delete(tokens[i]);
      }
    }
  } catch (err) {
    // Ignore http request errors
  }
};

module.exports = {
  sendPushNotification,
};
