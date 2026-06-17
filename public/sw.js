// sw.js
let pendingItem = null;
let pendingProjectId = null;

self.addEventListener('push', (event) => {
  console.log('🖱️ SW Push RECEIVED:', event.data ? event.data.json() : 'No data');
  try {
    const data = event.data ? event.data.json() : {};
    console.log('🚨 SW Push Data:', data.title, data.body, data.projectId, data.userType, 'has full item?', !!data.item);
    if (data.item) {
      console.log('Full item structure in push:', { project_id: data.item.project_id || data.item.ProjectId, title: data.item.title || data.item.Title, workstream: data.item.workstream || data.item.Workstream });
    }
    const { title, body, projectId, item, route, userType, icon = '/icon-192x192.png', badge = '/badge-72x72.png' } = data;
    const options = {
      body: body || 'New message received',
      icon,
      badge,
      data: { projectId, item, route, userType },
      actions: [{ action: 'open', title: 'Open Project' }],
      tag: `msg-${projectId}-${Date.now()}`
    };
    event.waitUntil(
      self.registration.showNotification(title || 'New Notification', options)
        .then(() => console.log('🔔 SW Notification SHOWN with full item ready'))
        .catch(err => console.error('SW Show Notification Error:', err))
    );
  } catch (error) {
    console.error('💥 SW Push Handler Error:', error);
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'readyForProject') {
    const clientProjectId = event.data.projectId;
    if (pendingItem && (!pendingProjectId || clientProjectId === pendingProjectId)) {
      event.source.postMessage({
        type: 'navigateToProject',
        state: { item: pendingItem }  // FIXED: Send state with item
      });
      console.log('🖱️ SW: Sent pending state to client (verified projectId:', clientProjectId, ')');
      pendingItem = null;
      pendingProjectId = null;
    } else {
      console.log('🖱️ SW: Ready signal ignored – no/mismatched pending item');
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  console.log('🖱️ SW Notification CLICKED:', event.notification.data);
  const { projectId, item, route, userType } = event.notification.data || {};
  console.log('Extracted from notification:', { projectId, hasFullItem: !!item, route, userType, itemTitle: item?.title || item?.Title });

  // FIXED: Dynamic URL based on userType (head/client)
userType === 'client' ? 'clientprojectinfo' : 
  userType === 'employee' ? (role === 'Team Leader' ? 'teamleaderprojectinfo' : 'employeeprojectinfo') : 'projectlist'
const url = projectId ? `/${targetRoute}?projectId=${projectId}` : `/${userType}projectlist`;  console.log('Opening URL:', url);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const appClients = clientList.filter((client) => client.url.startsWith(self.location.origin));
        console.log('Existing clients found:', appClients.length);
        if (appClients.length > 0) {
          // Target existing chat tab if possible
          const expectedRoute = targetRoute;
          const targetClient = appClients.find(c => c.url.includes(expectedRoute));
          const clientToUse = targetClient || appClients[0];
          return clientToUse.focus().then(() => {
            clientToUse.postMessage({
              type: 'navigateToProject',
              state: { item }  // FIXED: Send state with item
            });
            console.log('🖱️ SW: PostMessaged state to existing tab:', clientToUse.url);
          }).catch((err) => {
            console.error('🖱️ SW: Focus error:', err);
            appClients.forEach(c => c.postMessage({ type: 'navigateToProject', state: { item } }));
          });
        } else {
          // Open new window and store pending
          return clients.openWindow(url).then((newClient) => {
            if (!newClient) return;
            if (item) {
              pendingItem = item;
              pendingProjectId = projectId;
              console.log('🖱️ SW: New window opened, stored pending item for project', projectId, '(', userType, ')');
            } else {
              console.warn('🖱️ SW: New window opened, no item (fallback to fetch)');
            }
          });
        }
      }).catch((err) => {
        console.error('🖱️ SW Client error:', err);
        clients.openWindow(url);
      })
  );
});