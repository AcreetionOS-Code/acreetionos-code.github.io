addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(request) {
  const url = new URL(request.url)
  const target = 'https://spivanatalie64.github.io/TrumpOS/'
  if (url.pathname.startsWith('/TrumpOS')) {
    return Response.redirect(target, 301)
  }
  return Response.redirect(target, 301)
}
