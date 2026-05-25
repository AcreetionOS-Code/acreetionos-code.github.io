addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(request) {
  const url = new URL(request.url)
  if (url.pathname.startsWith('/TrumpOS')) {
    return Response.redirect('https://spivanatalie64.github.io/TrumpOS/', 301)
  }
  return Response.redirect('https://acreetionos.org', 302)
}
