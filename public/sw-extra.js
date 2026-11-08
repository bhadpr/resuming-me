// A new app copy takes the open page. The previous copy stayed in front and
// sent challenge links to the missing-page screen.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      await Promise.all(
        windows.map((client) =>
          typeof client.navigate === 'function' ? client.navigate(client.url).catch(() => undefined) : undefined,
        ),
      )
    })(),
  )
})
